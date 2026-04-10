# Revisão do Pipeline de Encerramento e Classificação de Tickets

**Data:** 2026-04-08
**Autor:** Marcio + Claude
**Status:** Design aprovado — aguardando continuação em nova sessão para writing-plans

---

## Problemas Identificados

1. **Classificação IA incompleta** — `ticket-category-classifier` só preenche `category_id`, `module_id`, `ticket_subject`. Não gera "Resumo do problema" nem "Solução" de forma integrada. Em alguns casos, nem classifica (silencia quando conf < 0.3).
2. **CSAT não enviado ao finalizar** — `closeConversation.ts` invoca `csat-processor` em fire-and-forget sem retry. Se a invoke falha, some silenciosamente. Não há log de auditoria.
3. **Reabertura indevida** — Mensagens curtas ("ok", "obrigado") pós-fechamento criam novo ticket em vez de serem absorvidas. Grace period existe mas tem janela única, ignora mídia com caption, e só reconhece status hardcoded.

---

## Arquitetura Geral

Três frentes coordenadas no pipeline existente:

- **Frente 1** — Classificação enriquecida em 2 momentos (durante + no close)
- **Frente 2** — CSAT garantido (retry síncrono + cron reconcile + botão manual)
- **Frente 3** — Grace period inteligente (2 janelas + 3 saídas do smart classify)

---

## Frente 1 — Classificação Enriquecida

### Schema

```sql
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS problem_summary TEXT,
  ADD COLUMN IF NOT EXISTS solution_summary TEXT,
  ADD COLUMN IF NOT EXISTS classification_version INT DEFAULT 0;
```

### Edge function: `ticket-category-classifier` (refatorada)

- Prompt expandido: retorna `{ category_id, module_id, ticket_subject, problem_summary, confidence }` num único call LLM.
- Threshold: salva `category` se conf > 0.3; salva `subject + problem_summary` sempre (são úteis mesmo com baixa conf).
- Incrementa `classification_version` a cada call.
- Backward-compatible: mesmo endpoint/input.

### Edge function: `ticket-solution-classifier` (NOVA)

- **Input:** `{ conversation_id, resolution_summary }`
- **Lógica:** lê últimas 30 mensagens + `problem_summary` + `resolution_summary` do agente que fechou.
- **Prompt:** "O cliente relatou X. O atendente resolveu Y. Gere um resumo objetivo da SOLUÇÃO aplicada (máx 300 chars). Se a categoria/módulo originais não fizerem mais sentido, sugira novos."
- **Output:** `{ solution_summary, suggested_category_id?, suggested_module_id?, category_changed: bool }`
- **Fallback:** se LLM falhar, salva o próprio `resolution_summary` como `solution_summary`.
- **Guardrail:** não roda se `resolution_summary` estiver vazio.

### Disparo

- `closeConversation.ts` chama via `invokeWithRetry` após update de status para `finalizado`.
- Fire-and-forget com retry interno — não bloqueia UI.

### UI

- Painel direito do ticket ganha campo **"Solução aplicada"** abaixo de "Detalhamento".
- Read-only após gerado; botão **"Regenerar"** para re-chamar.

---

## Frente 2 — CSAT Garantido

### Mudança 1 — Retry síncrono em `closeConversation.ts`

```ts
// antes: fire-and-forget sem retry
// depois:
if (shouldSendCsat && csatConfigId) {
  invokeWithRetry('csat-processor', {
    action: 'send',
    conversationId,
    configId: csatConfigId,
    trigger_source: 'close',
  });
}
```

### Mudança 2 — Cron de rede de segurança

Novo action em `csat-processor`: `reconcile-missed`.

```sql
SELECT conversations WHERE
  status = 'finalizado'
  AND csat_sent_at IS NULL
  AND resolved_at > now() - interval '2 hours'
  AND kanban_board_id IN (
    SELECT board_id FROM csat_board_configs WHERE enabled AND send_on_close
  )
LIMIT 50;
```

Cron novo `csat_reconcile_cron` rodando a cada 5 min (ao lado do `csat_process_pending_cron` existente).

### Mudança 3 — Auditoria

```sql
CREATE TABLE csat_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id),
  config_id uuid,
  trigger_source text, -- 'close' | 'cron_reconcile' | 'manual'
  status text,         -- 'sent' | 'failed' | 'skipped_no_config' | 'skipped_no_instance'
  error_message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON csat_send_log(conversation_id);
CREATE INDEX ON csat_send_log(created_at DESC);
```

Todo `handleSend` grava uma linha. Permite debugar "por que o CSAT desse ticket não saiu".

### Mudança 4 — Botão manual na UI

No painel direito do ticket:

- **Visível se:** `isWhatsApp` E board tem CSAT config habilitado.
- **Label dinâmico:**
  - "Enviar CSAT" se `csat_sent_at IS NULL`
  - "Reenviar CSAT" se `csat_sent_at` existe mas sem resposta
  - Oculto se já respondido
- **Chama:** `csat-processor` com `action: 'send'` e `trigger_source: 'manual'`.
- **UX:** toast sucesso/erro; desabilita por 30s após click (anti duplo-click).

---

## Frente 3 — Grace Period Inteligente

### Mudança 1 — Duas janelas

Separar em duas janelas configuráveis:

- **Janela curta** (`grace_absorb_minutes`, default 5 min) — absorve incondicionalmente "ok/obrigado/emoji/números CSAT" via regex. **Não chama LLM.**
- **Janela longa** (`grace_smart_minutes`, default 30 min) — chama smart classify com 3 saídas.

Config em `platform_ai_config`, feature `grace_period_config`:

```json
{
  "absorb_minutes": 5,
  "smart_minutes": 30,
  "smart_classify_enabled": true
}
```

### Mudança 2 — Smart classify com 3 saídas

Prompt atualizado:

```
Contexto: cliente enviou mensagem N segundos após fechamento do ticket #X.
Assunto do ticket fechado: "{ticket_subject}"
Problema reportado: "{problem_summary}"

Classifique a nova mensagem:
- "dismiss"       → agradecimento/despedida/CSAT/emoji
- "same_subject"  → novo problema, mas relacionado ao mesmo assunto/módulo
- "new_subject"   → problema totalmente diferente
```

Roteamento:

| Resultado | Ação |
|---|---|
| `dismiss` | Absorve na conv fechada, não responde |
| `same_subject` | Reabre conv (`reopen_count++`, status → `em_atendimento`) |
| `new_subject` | Cria novo ticket, seta `parent_ticket_id = old.id` |

### Mudança 3 — Schema `parent_ticket_id`

```sql
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS parent_ticket_id UUID REFERENCES ai_conversations(id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_parent_ticket
  ON ai_conversations(parent_ticket_id) WHERE parent_ticket_id IS NOT NULL;
```

UI: badge "Continuação de #NNNN" clicável no header/sidebar do ticket.

### Mudança 4 — Correções menores no webhook

- Incluir mídia com caption curta: usar `caption || textBody` no smart classify.
- Aumentar limite de `normalizedText.length` de 300 → 500.
- Não hardcodar `["finalizado", "resolvido", "aguardando_cliente"]`: buscar também conversas cujo `kanban_stages.status_type = 'resolvido'`.
- Lock otimista anti-race: marcar mensagem como "em processamento" via `uazapi_message_id` unique constraint existente antes do smart classify.

---

## Plano de Testes

1. **Classificação durante ticket** — criar 5 conversas, verificar `problem_summary` preenchido.
2. **Classificação no close** — fechar ticket com `resolution_summary`, verificar `solution_summary` coerente.
3. **CSAT caminho feliz** — fechar ticket, verificar log `csat_send_log` com `trigger_source='close'` e `status='sent'`.
4. **CSAT rede de segurança** — simular falha no invoke, verificar cron reconcilia em ≤5 min, log com `trigger_source='cron_reconcile'`.
5. **CSAT manual** — clicar botão, verificar envio + log com `trigger_source='manual'`; duplo-click bloqueado.
6. **Grace dismiss** — fechar ticket, "ok obrigado" em 2 min → absorvido, sem novo ticket.
7. **Grace same_subject** — fechar "erro no login", "continuou dando erro no login" em 15 min → reabre.
8. **Grace new_subject** — fechar login, "boleto não chegou" em 15 min → novo ticket com `parent_ticket_id`.
9. **Grace fora da janela** — mensagem depois de 40 min → novo ticket sem parent.

---

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| LLM da solution classifier alucinar "solução" fake | Só roda se `resolution_summary` não vazio; fallback para o próprio resolution_summary |
| Cron reconcile disparar CSAT indevidamente | Filtro: só processa `csat_sent_at IS NULL` + board com `send_on_close=true` |
| Smart classify errar `new_subject` vs `same_subject` | Log completo + `classification_version`; admin pode rever via Kanban |
| `parent_ticket_id` quebrar relatórios existentes | Campo nullable, queries antigas ignoram |
| Race no grace period (2 mensagens simultâneas) | Lock via `uazapi_message_id` unique constraint (já existe) |

---

## Rollout (ordem dos deploys)

1. **Migration** — `problem_summary`, `solution_summary`, `classification_version`, `parent_ticket_id`, tabela `csat_send_log`.
2. **Deploy** `ticket-category-classifier` refatorado (backward-compatible).
3. **Deploy** `ticket-solution-classifier` nova.
4. **Deploy** `csat-processor` com action `reconcile-missed` + logs.
5. **Deploy** `uazapi-webhook` com grace period v2.
6. **Migration** — cron job `csat_reconcile_cron` (a cada 5 min).
7. **Frontend** — `closeConversation.ts` com retry + botão manual CSAT + badge parent_ticket + campo "Solução aplicada".

Cada passo é verificável e reversível. Sem breaking change.

---

## Métricas de Sucesso (verificar 1 semana após deploy)

- % tickets com `problem_summary` preenchido > **90%**
- % tickets finalizados com `solution_summary` preenchido > **80%**
- % tickets `finalizado` com `csat_sent_at IS NOT NULL` (quando board tem CSAT) > **98%**
- Novos tickets criados dentro de 30min de um fechamento na mesma conta caiu > **50%**

---

## Próximo passo

Invocar `superpowers:writing-plans` para criar o plano de implementação detalhado a partir deste spec. **Pendente em nova sessão.**
