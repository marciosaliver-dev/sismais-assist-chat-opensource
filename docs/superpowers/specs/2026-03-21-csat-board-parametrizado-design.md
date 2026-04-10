# CSAT Parametrizado por Board — Design Spec

**Data:** 2026-03-21
**Status:** Aprovado
**Abordagem:** Config por Board + Edge Function dedicada + IA classificadora

---

## 1. Visão Geral

Sistema de pesquisa de satisfação (CSAT) parametrizado por Kanban Board, com envio automático ao finalizar conversas WhatsApp, suporte a respostas tardias, reenvio automático e classificação avançada por IA com análise de sentimento e dimensões configuráveis.

### Requisitos

- Config completa por board: mensagem, escala, perguntas adicionais, timing
- Toggle por board: cada board decide se envia CSAT ou não
- Delay configurável + reenvio automático se sem resposta
- Janela de resposta configurável (aceita resposta tardia)
- IA classifica respostas: extrai nota, sentimento, dimensões, tags
- Cliente pode responder em conversa nova — IA detecta e registra na survey correta

---

## 2. Modelo de Dados

### 2.1 Tabela `csat_board_configs`

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `id` | uuid PK | gen_random_uuid() | |
| `board_id` | uuid FK → kanban_boards | NOT NULL UNIQUE | Board associado (1:1) |
| `enabled` | boolean | false | CSAT ativo neste board |
| `scale_type` | text | 'stars_1_5' | Tipo de escala: `stars_1_5`, `thumbs`, `nps_0_10`, `emoji` |
| `message_template` | text | (template padrão) | Mensagem com variáveis `{{nome}}`, `{{protocolo}}`, `{{board}}` |
| `questions` | jsonb | '[]' | Perguntas adicionais: `[{key, label, type: "scale"|"text"|"yes_no"}]` |
| `send_on_close` | boolean | true | Enviar automaticamente ao fechar conversa |
| `delay_minutes` | integer | 0 | Delay antes do primeiro envio (0 = imediato) |
| `resend_enabled` | boolean | false | Ativar reenvio automático |
| `resend_after_hours` | integer | 4 | Horas para aguardar antes de reenviar |
| `max_resends` | integer | 1 | Máximo de reenvios |
| `response_window_hours` | integer | 48 | Janela para aceitar respostas |
| `ai_dimensions` | jsonb | '["resolucao","tempo","cordialidade"]' | Dimensões para classificação IA |
| `created_at` | timestamptz | now() | |
| `updated_at` | timestamptz | now() | |

**Escalas suportadas:**

| `scale_type` | Representação na mensagem | Valores aceitos |
|-------------|--------------------------|-----------------|
| `stars_1_5` | 1⭐ a 5⭐⭐⭐⭐⭐ | 1-5 |
| `thumbs` | 👍 / 👎 | 1 (👎) ou 2 (👍) |
| `nps_0_10` | 0 a 10 | 0-10 |
| `emoji` | 😡😕😐🙂😍 | 1-5 mapeado |

**Template padrão:**

```
📊 *Pesquisa de Satisfação — {{board}}*

Olá {{nome}}! Seu atendimento (protocolo {{protocolo}}) foi concluído.

Como você avalia nosso suporte?

1 ⭐ — Muito insatisfeito
2 ⭐⭐ — Insatisfeito
3 ⭐⭐⭐ — Regular
4 ⭐⭐⭐⭐ — Satisfeito
5 ⭐⭐⭐⭐⭐ — Muito satisfeito

Responda com o número ou envie um comentário. Obrigado! 🙏
```

### 2.2 Tabela `csat_surveys`

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `id` | uuid PK | gen_random_uuid() | |
| `conversation_id` | uuid FK → ai_conversations | NOT NULL | Conversa avaliada |
| `config_id` | uuid FK → csat_board_configs | NOT NULL | Config usada no envio |
| `customer_phone` | text | NOT NULL | Telefone do cliente |
| `instance_id` | uuid FK → uazapi_instances | NOT NULL | Instância WhatsApp |
| `status` | text | 'pending' | `pending`, `sent`, `resent`, `processing`, `answered`, `expired` |
| `response_window_hours` | integer | NOT NULL | Denormalizado da config no momento da criação |
| `sent_at` | timestamptz | null | Quando enviou pela primeira vez |
| `sent_message_id` | text | null | msgId WhatsApp (para match de reply) |
| `resend_count` | integer | 0 | Quantas vezes reenviou |
| `next_action_at` | timestamptz | null | Próxima ação (envio com delay, reenvio, ou expiração) |
| `score` | integer | null | Nota principal extraída pela IA |
| `raw_response` | text | null | Texto original do cliente |
| `ai_analysis` | jsonb | null | `{sentiment, dimensions, tags, summary}` |
| `answers` | jsonb | null | Respostas às perguntas adicionais |
| `responded_at` | timestamptz | null | Quando respondeu |
| `expired_at` | timestamptz | null | Quando expirou |
| `created_at` | timestamptz | now() | |

**Índices:**
- `idx_csat_surveys_phone_status` em `(customer_phone, instance_id, status)` — lookup rápido no webhook
- `idx_csat_surveys_next_action` em `(next_action_at)` WHERE `status IN ('pending', 'sent', 'resent')` — scheduler
- `idx_csat_surveys_conversation` em `(conversation_id)` — join com conversas

---

## 3. Fluxos

### 3.1 Envio ao Fechar Conversa

```
CloseConversationDialog → closeConversation()
    │
    ▼
Busca csat_board_configs WHERE board_id = conversa.kanban_board_id
    │
    ├─ não encontrou ou enabled=false → finaliza normalmente
    │
    ├─ send_on_close=false → finaliza sem CSAT
    │
    └─ enabled + send_on_close → cria csat_survey
           │
           ├─ delay_minutes = 0 → invoke csat-processor action=send
           │                       status=sent, next_action_at = now + resend_after_hours
           │
           └─ delay_minutes > 0 → status=pending, next_action_at = now + delay_minutes
                                   (scheduler enviará depois)
```

### 3.2 Scheduler (a cada 15min)

```
csat-processor action=process-pending
    │
    ├─ surveys WHERE status='pending' AND next_action_at <= now
    │     └─ Envia mensagem, status=sent, next_action_at = now + resend_after_hours
    │
    ├─ surveys WHERE status IN ('sent','resent') AND next_action_at <= now
    │     ├─ resend_count < max_resends → reenvia, resend_count++, status=resent
    │     │                               next_action_at = now + resend_after_hours
    │     └─ resend_count >= max_resends → status=expired, expired_at=now
    │
    └─ surveys WHERE status IN ('sent','resent')
          AND created_at + response_window_hours <= now
          └─ status=expired, expired_at=now
```

### 3.3 Captura de Resposta (no uazapi-webhook)

```
Mensagem recebida no webhook
    │
    ▼
SELECT * FROM csat_surveys
  WHERE customer_phone = :phone
  AND instance_id = :instance
  AND status IN ('sent', 'resent')
  AND created_at + response_window_hours > now()
  ORDER BY created_at DESC LIMIT 1
    │
    ├─ Não encontrou → segue fluxo normal (orchestrator)
    │
    └─ Encontrou survey pendente
         │
         ├─ quotedMsgId = sent_message_id → certeza total, classifica
         │
         └─ sem quote → IA avalia se parece resposta CSAT
              │
              ├─ Sim (número, emoji, texto curto) → classifica
              │
              └─ Não (assunto diferente) → segue orchestrator
```

### 3.4 Classificação IA

```
csat-processor action=classify
    │
    ▼
Chama LLM (OpenRouter / Gemini Flash) com prompt:

  "Analise esta resposta de pesquisa de satisfação.
   Escala: {scale_type}
   Perguntas: {questions}
   Dimensões: {ai_dimensions}
   Resposta: '{raw_response}'

   Retorne JSON:
   {
     is_csat_response: boolean,
     score: number | null,
     sentiment: 'positive' | 'neutral' | 'negative' | 'mixed',
     dimensions: { [key]: number },
     tags: string[],
     summary: string,
     answers: { [question_key]: string } | null
   }"
    │
    ├─ is_csat_response = true
    │     └─ Grava ai_analysis, score, status=answered, responded_at=now
    │        Sincroniza ai_conversations.csat_score
    │
    └─ is_csat_response = false
          └─ Não altera survey, mensagem segue pro orchestrator
```

---

## 4. Edge Functions

### 4.1 `csat-processor` (nova)

**Actions:**

| Action | Input | Descrição |
|--------|-------|-----------|
| `send` | `{conversationId, configId, delayMinutes?}` | Envia pesquisa via uazapi-proxy |
| `classify` | `{surveyId, message, quotedMsgId?}` | Classifica resposta via LLM |
| `process-pending` | `{}` | Scheduler: envia pendentes, reenvia, expira |

### 4.2 Alterações em `uazapi-webhook`

Adicionar check de CSAT **antes** do orchestrator:

```typescript
// --- CSAT Response Check ---
const pendingSurvey = await supabaseAdmin
  .from('csat_surveys')
  .select('*, config:csat_board_configs(*)')
  .eq('customer_phone', senderPhone)
  .eq('instance_id', instanceId)
  .in('status', ['sent', 'resent'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (pendingSurvey.data) {
  const isDirectReply = quotedMsgId === pendingSurvey.data.sent_message_id
  if (isDirectReply || looksLikeCSATResponse(messageText, pendingSurvey.data.config)) {
    // Optimistic lock: marca como processing para evitar concorrência
    const { data: locked } = await supabaseAdmin
      .from('csat_surveys')
      .update({ status: 'processing' })
      .eq('id', pendingSurvey.data.id)
      .in('status', ['sent', 'resent'])
      .select()
      .maybeSingle()

    if (locked) {
      const { data: result } = await supabase.functions.invoke('csat-processor', {
        body: { action: 'classify', surveyId: locked.id, message: messageText, quotedMsgId }
      })

      // Se IA determinou que NÃO é resposta CSAT, reverte status e segue pro orchestrator
      if (!result?.is_csat_response) {
        await supabaseAdmin.from('csat_surveys')
          .update({ status: pendingSurvey.data.status })
          .eq('id', locked.id)
        // Continua pro orchestrator normalmente
      } else {
        // Resposta CSAT registrada. Se tem conversa ativa, continua pro orchestrator.
        // Se não tem, return (não cria conversa nova).
        if (!activeConversation) return
      }
    }
  }
}
```

**`looksLikeCSATResponse(text, config)` — heurística pré-IA:**

Retorna `true` se:
- Mensagem é um número dentro da escala configurada (ex: "4", "8")
- Mensagem é um emoji único mapeado (⭐, 👍, 👎, 😍, 😡, etc.)
- Mensagem tem menos de 15 palavras (texto curto = provável comentário CSAT)

Retorna `false` se:
- Mensagem tem mais de 15 palavras (provavelmente assunto novo)
- Mensagem contém pergunta (? no final)
- Mensagem contém saudação ("bom dia", "olá", "oi")

### 4.3 Alterações em `closeConversation.ts`

Substituir lógica CSAT existente por chamada ao `csat-processor`:

```typescript
const { data: csatConfig } = await supabase
  .from('csat_board_configs')
  .select('*')
  .eq('board_id', boardId)
  .eq('enabled', true)
  .maybeSingle()

if (csatConfig?.send_on_close) {
  await supabase.functions.invoke('csat-processor', {
    body: { action: 'send', conversationId, configId: csatConfig.id }
  })
}
```

---

## 5. UI

### 5.1 Config CSAT por Board

**Localização:** Aba "CSAT" no modal/página de configuração do board.

**Componentes:**
- `CSATBoardConfigForm` — formulário completo com preview da mensagem
- `CSATQuestionBuilder` — lista dinâmica de perguntas adicionais (add/remove/reorder)
- `CSATMessagePreview` — preview ao vivo da mensagem com dados de exemplo
- Hook: `useCSATBoardConfig(boardId)` — query + mutation

**Campos do formulário:** (ver seção 2.1)

### 5.2 Dashboard CSAT

**Localização:** Nova aba "CSAT" na página `/evaluations`.

**KPI Cards:**
- Score médio (por board e geral)
- Taxa de resposta (answered / total enviadas)
- Total de pesquisas enviadas
- Sentimento predominante

**Filtros:** Board, período, agente responsável, score range

**Tabela:**
| Conversa | Cliente | Board | Score | Sentimento | Tags | Data |
|----------|---------|-------|-------|------------|------|------|
| #1234 | João Silva | Suporte | ⭐⭐⭐⭐ | Positivo | elogio | 21/03 |

Expandir linha → mostra resposta raw, análise IA completa, dimensões

**Gráficos:**
- Score médio por board (bar chart horizontal)
- Evolução do score no tempo (line chart)

### 5.3 Indicadores em Cards/Inbox

- **Card Kanban:** Badge `⏳ CSAT` (pendente) ou `⭐ 4` (respondida)
- **Inbox conversa fechada:** Linha de status com score e sentimento
- **Detalhe da conversa:** Seção CSAT com timeline (enviada → respondida → análise)

---

## 6. Scheduler

**Opção preferida:** Supabase Cron (pg_cron extension) chamando `csat-processor` com action `process-pending` a cada 15 minutos.

```sql
SELECT cron.schedule(
  'csat-process-pending',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/csat-processor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{"action": "process-pending"}'::jsonb
  )$$
);
```

**Fallback:** Se pg_cron não disponível, usar Supabase Dashboard > Database > Cron Jobs.

---

## 7. Migração de Dados

- Campos CSAT existentes em `ai_conversations` (`csat_score`, `csat_sent_at`, etc.) são mantidos por compatibilidade
- `closeConversation.ts` passa a usar `csat_surveys` como source of truth
- Sincroniza `ai_conversations.csat_score` após classificação para manter queries existentes funcionando
- Config global em `platform_ai_config.csat_survey` serve como fallback para boards sem config própria

---

## 8. Compatibilidade e Migração Suave

1. Boards sem `csat_board_configs` → comportamento atual (usa config global ou não envia)
2. Ao criar config de board, pré-popula com valores da config global
3. Dashboard CSAT mostra dados novos (`csat_surveys`) e legados (`ai_conversations.csat_score`)
4. Após migração completa, depreciar campos CSAT de `ai_conversations`

---

## 9. Segurança

### RLS Policies

**`csat_board_configs`:**
- SELECT: authenticated users (todos podem ler configs)
- INSERT/UPDATE/DELETE: apenas admin (`auth.jwt() ->> 'role' = 'admin'`)

**`csat_surveys`:**
- SELECT: authenticated users (agentes precisam ver surveys das conversas)
- INSERT/UPDATE: service_role only (apenas edge functions criam/atualizam surveys)
- DELETE: nenhum (surveys são imutáveis, apenas expiram)

### Service Role

A edge function `csat-processor` cria seu próprio client com `SUPABASE_SERVICE_ROLE_KEY` internamente (padrão das edge functions do projeto). Chamadas do frontend via `supabase.functions.invoke()` usam o JWT do usuário para autenticar a requisição HTTP, mas a function usa service role para operações no banco.

### Scheduler: Ordem de Processamento

O `process-pending` deve processar na seguinte ordem para evitar conflitos:
1. **Expirar** surveys que ultrapassaram `response_window_hours` (prioridade máxima)
2. **Reenviar** surveys pendentes de reenvio (somente as não expiradas)
3. **Enviar** surveys com delay que atingiram `next_action_at`

---

## 10. Arquivos a Criar/Modificar

### Novos
- `supabase/functions/csat-processor/index.ts` — Edge Function principal
- `src/components/csat/CSATBoardConfigForm.tsx` — Formulário de config
- `src/components/csat/CSATQuestionBuilder.tsx` — Builder de perguntas
- `src/components/csat/CSATMessagePreview.tsx` — Preview da mensagem
- `src/components/csat/CSATDashboard.tsx` — Dashboard/aba na Evaluations
- `src/hooks/useCSATBoardConfig.ts` — Hook de config por board
- `src/hooks/useCSATSurveys.ts` — Hook de surveys/dashboard
- Migration SQL para tabelas `csat_board_configs` e `csat_surveys`

### Modificados
- `supabase/functions/uazapi-webhook/index.ts` — Check CSAT antes do orchestrator
- `src/utils/closeConversation.ts` — Nova lógica de envio via csat-processor
- `src/components/inbox/CloseConversationDialog.tsx` — Ajustar toggle CSAT
- `src/pages/Evaluations.tsx` — Adicionar aba CSAT
- `src/components/kanban/` — Badge CSAT nos cards
