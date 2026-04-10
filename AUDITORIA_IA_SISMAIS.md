# AUDITORIA — Arquitetura de IA Sismais Helpdesk

**Data:** 2026-03-06
**Responsável:** Claude Code (Arquiteto de IA Autônoma)
**Branch:** `claude/audit-ai-helpdesk-DLLRQ`

---

## 1. Mapa da Arquitetura Atual

```
WhatsApp → uazapi-webhook → process-incoming-message
                                      │
              ┌───────────────────────┼────────────────────────────┐
              │                       │                             │
        message-analyzer         orchestrator              [FIRE & FORGET]
        (OpenRouter +            (seleciona 1             ├─ automation-executor ──→ send_message ⚠️
         OpenAI embed)            agente via LLM)         ├─ trigger-flows ────────→ flow-engine ──→ send_message ⚠️
                                       │                  └─ learning-loop (OK)
                                  agent-executor
                                  (RAG + LLM)
                                       │
                                  WhatsApp Reply

Pipeline paralelo — CONFLITO CRÍTICO:
ai-whatsapp-reply ←── chamada direta ──→ WhatsApp Reply (LLM diferente: Lovable Gateway) ⚠️
```

**Total de edge functions mapeadas:** 61
**Funções que disparam LLM:** orchestrator, agent-executor, message-analyzer, flow-engine (ai_response node), ai-whatsapp-reply, learning-loop, generate-report, copilot-suggest, platform-ai-assistant

---

## 2. Conflitos Identificados

### 🔴 CRÍTICO — Resposta Duplicada ao Cliente

**Problema:** `process-incoming-message` dispara em fire-and-forget:
1. `automation-executor` → pode executar ação `send_message`
2. `trigger-flows` → `flow-engine` → pode executar node `send_message`
3. `agent-executor` → envia resposta via WhatsApp

Os três rodam **ao mesmo tempo**, sem coordenação. O cliente pode receber 2 ou 3 mensagens de diferentes executores.

**Localização:** `supabase/functions/process-incoming-message/index.ts` L444-488

**Evidência:**
```typescript
// L452-469: automation-executor disparado async (sem await)
supabase.functions.invoke('automation-executor', {...}).catch(...)

// L475-488: trigger-flows disparado async (sem await)
supabase.functions.invoke('trigger-flows', {...}).catch(...)

// AMBOS rodam junto com agent-executor que já respondeu acima (L300-440)
```

---

### 🔴 CRÍTICO — Pipeline Paralela ai-whatsapp-reply

**Problema:** Existe a função `ai-whatsapp-reply` que usa um provedor LLM completamente diferente (Lovable AI Gateway) para responder ao cliente. Se chamada junto com o pipeline principal, o cliente recebe 2 respostas de LLMs diferentes.

**Localização:** `supabase/functions/ai-whatsapp-reply/index.ts`

---

### 🔴 CRÍTICO — Ausência de Mutex por Conversa

**Problema:** Seis funções diferentes atualizam `ai_conversations` de forma independente e concorrente:
- `orchestrator` → atualiza `current_agent_id`, `status`
- `agent-executor` → atualiza `handler_type`, `status`
- `automation-executor` → atualiza via `update_conversation` action
- `process-incoming-message` → atualiza diretamente
- `flow-engine` → atualiza via `update_field` e `assign_human` nodes
- `learning-loop` → atualiza métricas

Resultado: race conditions, "last write wins", estado inconsistente.

**Tabela afetada:** `ai_conversations`
**Constraint inexistente:** `conversation_processing_lock` — **tabela não existe no banco atual**

---

### 🔴 ALTO — Sem Deduplicação no Webhook

**Problema:** `uazapi-webhook` não verifica se `message_id` já foi processado antes de chamar `process-incoming-message`. O UAZAPI faz retry automático em falhas → mesma mensagem processada 2x.

**Nota positiva:** A tabela `uazapi_messages` tem `UNIQUE (message_id, instance_id)` — a constraint existe, mas o webhook não a usa para deduplicação prévia.

**Localização:** `supabase/functions/uazapi-webhook/index.ts` L28-50

---

### 🟡 MÉDIO — Loop Infinito em jump_to_flow

**Problema:** `flow-engine` implementa `jump_to_flow` que chama a si mesmo recursivamente via `supabase.functions.invoke('flow-engine', ...)` sem nenhum controle de profundidade.

**Localização:** `supabase/functions/flow-engine/index.ts` L590-607

---

### 🟡 MÉDIO — escalate_to_human Triplicado

**Problema:** A lógica de escalação para humano existe de forma independente em 3 lugares:
1. `orchestrator` → atualiza `handler_type='human'` + move Kanban
2. `agent-executor` → atualiza `handler_type='human'`
3. `process-incoming-message` → atualiza `handler_type='human'` (L420-441)

Se mais de um disparar, `queue_entered_at` é sobrescrito múltiplas vezes.

---

## 3. Redundâncias

| Funcionalidade | Sistema 1 | Sistema 2 | Sistema 3 |
|----------------|-----------|-----------|-----------|
| Envio de mensagem | `automation-executor` (ação `send_message`) | `flow-engine` (node `send_message`) | `agent-executor` + `ai-whatsapp-reply` |
| Escalação humano | `orchestrator` | `agent-executor` | `process-incoming-message` |
| Delays/espera | `automation-executor` (ação `wait`) | `flow-engine` (node `delay`) | — |
| HTTP Webhook | `automation-executor` (ação `http_request`) | `flow-engine` (node `http_request`) | — |
| Busca em KB | `automation-executor` (ação `search_knowledge`) | `flow-engine` (node `search_knowledge`) | `agent-executor` (RAG) |
| Resposta IA | `automation-executor` (ação `ai_respond`) | `flow-engine` (node `ai_response`) | `agent-executor` |
| Config de IA | `/agents` (15 abas) | `/automations` (regras) | `/flow-builder` (visual) |

---

## 4. Edge Functions sem Utilidade Atual

| Função | Status | Motivo |
|--------|--------|--------|
| `flow-executor` | Legada | Duplicata de `flow-engine`, sem chamadores identificados no código principal |
| `copilot-suggest` | Beta | Marcado como "coming soon", sem implementação real |
| `whatsapp-webhook` | Alternativa não usada | Alternativa ao `uazapi-webhook`, não integrada ao pipeline |
| `whatsapp-meta-webhook` | Alternativa não usada | Para WhatsApp Business API oficial — sem configuração ativa |

---

## 5. Arquitetura Proposta — "Uma Verdade"

```
HIERARQUIA IMUTÁVEL DE EXECUÇÃO (sem exceções):

[1] DEDUPLICAÇÃO — uazapi-webhook
    └─ Verifica message_id UNIQUE antes de qualquer processamento
    └─ Retorna 200 com { skipped: 'duplicate' } se já processado

[2] LOCK DE CONVERSA — process-incoming-message
    └─ conversation_processing_lock (nova tabela)
    └─ Adquire lock antes de qualquer lógica
    └─ Libera no finally (sempre, mesmo em erro)
    └─ Se lock falhar → mensagem aguarda retry natural do UAZAPI

[3] FLOWS ATIVOS — trigger-flows → flow-engine (AWAIT, não fire & forget)
    └─ Se flow ativo para este trigger → executa e AGUARDA conclusão
    └─ flow-engine retorna { message_sent: boolean }
    └─ Se message_sent=true → pipeline PARA aqui (agente IA não executa)
    └─ Se message_sent=false → continua para [4]

[4] AGENTE IA — orchestrator → agent-executor (AWAIT)
    └─ Exatamente 1 agente selecionado via LLM
    └─ Responde ou escala para humano

[5] FALLBACK HUMANO
    └─ Nenhum agente qualificado → fila humana
    └─ Confiança < threshold → fila humana

[6] APRENDIZADO — learning-loop (mantém fire & forget — não envia mensagem)

REGRA DE OURO: Para qualquer mensagem recebida,
EXATAMENTE UM executor envia resposta. Nunca zero. Nunca dois.
```

---

## 6. Plano de Implementação (4 Semanas)

| Semana | Foco | Risco |
|--------|------|-------|
| 1 | Auditoria + Aprovação (este documento) | Baixo |
| 2 | **Fundação Anti-Conflito**: lock, deduplicação, hierarquia | **Crítico — prioridade máxima** |
| 3 | Simplificação UI: /ai-config unificado, modo simples de flows | Médio |
| 4 | Autonomia: /supervisor, configuração de autonomia, Kanban source | Baixo |

---

## 7. Decisões de Arquitetura

1. **Não remover** nenhuma edge function existente sem migrar dependências — `automation-executor` continua para triggers não-`message_received`
2. **Feature flags** em todas as novas funcionalidades — `FF_PROCESSING_LOCK`, `FF_DISABLE_LEGACY_AUTO_FOR_MESSAGES`
3. **Fallback seguro** — se lock falhar ou nova lógica lançar erro, comportamento atual é preservado
4. **Logs JSON estruturados** em todas as edge functions modificadas para rastreabilidade
5. **Performance**: cada mensagem processada em < 3 segundos end-to-end (medido com timestamps nos logs)
