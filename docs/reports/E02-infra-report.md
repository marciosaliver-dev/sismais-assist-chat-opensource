# E02 — Relatorio de Infraestrutura e Resiliencia

**Data:** 2026-03-19
**Autor:** E02 Infra Engineer (Supabase)
**Branch:** main (1f83c32)
**Escopo:** Modulos _shared de resiliencia, RLS audit, triggers, indexes, feature flags

---

## 1. DIAGNOSTICO

### 1.1 Estado Anterior

A infraestrutura de edge functions carecia de padroes de resiliencia:
- **Sem retry/circuit breaker**: Chamadas ao OpenRouter falhavam silenciosamente sem recuperacao
- **Sem timeout padronizado**: Cada funcao implementava (ou nao) seu proprio timeout
- **Logs inconsistentes**: Mix de `console.log` com strings livres e JSON parcial (D12 do CTO report)
- **Sem correlation ID**: Impossivel rastrear uma mensagem end-to-end entre webhook -> orchestrator -> agent-executor (D13)
- **Race conditions em contadores**: `unread_count`, `ai_messages_count`, `human_messages_count` usando SELECT+UPDATE nao atomico (D3)
- **Sem triggers para eventos criticos**: Escalacoes e violacoes de SLA nao notificavam em tempo real
- **Indexes faltantes**: Queries frequentes no webhook sem indexes adequados

### 1.2 Tabelas sem RLS

Auditoria completa das 80+ tabelas nas migrations. A maioria tem RLS ativado. Nao foram encontradas tabelas expostas sem RLS criticas — as tabelas criadas recentemente (knowledge_products, help_videos, ai_agent_skills, etc.) todas possuem `ENABLE ROW LEVEL SECURITY` nas migrations.

**Nota**: Todas as policies atuais usam `USING (true)` para `authenticated`, o que significa que qualquer usuario autenticado tem acesso total. Isso e aceitavel no estagio atual (sistema interno), mas deve ser refinado quando houver multi-tenancy.

---

## 2. OTIMIZACOES REALIZADAS

### 2.1 Modulo _shared/resilience.ts (NOVO)

**Arquivo:** `supabase/functions/_shared/resilience.ts`

Implementa tres patterns de resiliencia composiveis:

| Pattern | Funcao | Descricao |
|---------|--------|-----------|
| Retry | `withRetry()` | Backoff exponencial com jitter, shouldRetry customizavel |
| Timeout | `withTimeout()` | AbortController com mensagem customizada |
| Circuit Breaker | `withCircuitBreaker()` | 3 estados (closed/open/half-open), failureThreshold configuravel |
| Composicao | `resilientCall()` | Combina os tres: circuitBreaker(retry(timeout(fn))) |

**Uso recomendado para chamadas LLM:**
```typescript
import { resilientCall } from '../_shared/resilience.ts'

const result = await resilientCall(
  (signal) => callOpenRouter({ ...params, signal }),
  {
    retry: { maxAttempts: 2, baseDelayMs: 500 },
    timeout: { timeoutMs: 25000 },
    circuitBreaker: { name: 'openrouter', failureThreshold: 5 },
  }
)
```

### 2.2 Modulo _shared/structured-log.ts (NOVO)

**Arquivo:** `supabase/functions/_shared/structured-log.ts`

Logger JSON estruturado com:
- Correlation ID (`x-request-id`) propagado entre edge functions
- Niveis: debug, info, warn, error
- Timestamp ISO
- Nome da funcao

**Uso:**
```typescript
import { createLogger, extractRequestId } from '../_shared/structured-log.ts'

const log = createLogger('agent-executor', extractRequestId(req))
log.info('Processing message', { conversationId, agentId })
// Output: {"level":"info","fn":"agent-executor","msg":"Processing message","requestId":"abc123","ts":"...","conversationId":"..."}
```

### 2.3 Modulo _shared/supabase-helpers.ts (NOVO)

**Arquivo:** `supabase/functions/_shared/supabase-helpers.ts`

Padroniza:
- `createServiceClient()` — client Supabase com cache no isolate
- `corsHeaders` — headers CORS com x-request-id
- `jsonResponse()` / `errorResponse()` / `corsPreflightResponse()` — respostas HTTP
- `atomicIncrement()` — resolve D3 (race condition em contadores)

### 2.4 Migration de Infraestrutura

**Arquivo:** `supabase/migrations/20260319120000_infra_resilience.sql`

Conteudo:

| Item | Tipo | Descricao |
|------|------|-----------|
| `increment_counter()` | Funcao SQL | Incremento atomico generico (resolve D3) |
| `increment_unread_count()` | Funcao SQL | Atalho atomico para unread_count |
| `increment_message_counts()` | Funcao SQL | Atalho atomico para ai/human_messages_count |
| `trg_notify_new_message` | Trigger | pg_notify em INSERT ai_messages |
| `trg_notify_escalation` | Trigger | pg_notify quando handler_type muda para 'human' |
| `trg_check_sla_breach` | Trigger | Marca conversas que passaram do prazo de SLA |
| `pending_ai_processing` | Tabela | Fila para debounce assincrono (resolve D2) |
| `feature_flag_audit` | Tabela | Auditoria de mudancas em feature flags |
| 8 indexes | Indexes | Performance em queries criticas |
| Rollback script | Comentarios | Script completo de rollback no final do arquivo |

**Indexes criados:**

| Index | Tabela | Coluna(s) | Justificativa |
|-------|--------|-----------|---------------|
| `idx_ai_conversations_status_active` | ai_conversations | status (partial) | Filtragem de conversas ativas |
| `idx_ai_messages_conversation_created` | ai_messages | conversation_id, created_at DESC | Paginacao de historico |
| `idx_uazapi_chats_phone_instance` | uazapi_chats | phone, whatsapp_instance_id | Lookup no webhook |
| `idx_ai_conversations_whatsapp_phone` | ai_conversations | whatsapp_phone (partial) | Lookup no process-incoming |
| `idx_ai_knowledge_base_active_type` | ai_knowledge_base | content_type (partial) | RAG search |
| `idx_ai_automations_active_trigger` | ai_automations | trigger_type (partial) | Automacoes ativas |
| `idx_flow_automations_active_trigger` | flow_automations | trigger_type (partial) | Flows ativos |
| `idx_processing_lock_conversation` | conversation_processing_lock | conversation_id (partial) | Lock lookup |

---

## 3. METRICAS DE PERFORMANCE ESPERADAS

| Metrica | Antes | Depois (estimado) | Melhoria |
|---------|-------|--------------------|----------|
| Latencia webhook (debounce) | 5000ms fixo | <100ms (async) | ~98% com FF_ASYNC_DEBOUNCE |
| Race condition contadores | Frequente | Zero | 100% com FF_ATOMIC_COUNTERS |
| Tempo de recovery LLM down | Indeterminado | 30s (circuit breaker) | Previsivel |
| Query conversas ativas | Full scan | Index scan | ~10-50x para tabelas grandes |
| Query historico mensagens | Full scan | Index scan | ~10-50x |
| Rastreabilidade end-to-end | Nenhuma | Completa (requestId) | Com FF_STRUCTURED_LOGGING |

---

## 4. DOCUMENTACAO DE PATTERNS

### 4.1 Como Adicionar Resiliencia a uma Edge Function Existente

```typescript
// ANTES (sem resiliencia)
const result = await callOpenRouter(params)

// DEPOIS (com resiliencia completa)
import { resilientCall } from '../_shared/resilience.ts'
import { FLAGS } from '../_shared/feature-flags.ts'

const result = await resilientCall(
  (signal) => callOpenRouter(params),
  {
    retry: { maxAttempts: 2 },
    timeout: { timeoutMs: 25000 },
    circuitBreaker: FLAGS.CIRCUIT_BREAKER_LLM
      ? { name: 'openrouter', failureThreshold: 5, resetTimeoutMs: 30000 }
      : undefined,
  }
)
```

### 4.2 Como Usar Logs Estruturados

```typescript
import { createLogger, extractRequestId, propagateRequestId } from '../_shared/structured-log.ts'

Deno.serve(async (req) => {
  const log = createLogger('minha-funcao', extractRequestId(req))
  log.info('Request received', { method: req.method })

  // Propagar para sub-chamadas
  const headers = propagateRequestId(log.getRequestId())
  await supabase.functions.invoke('outra-funcao', {
    body: { ... },
    headers,
  })
})
```

### 4.3 Como Usar Contadores Atomicos

```typescript
import { atomicIncrement } from '../_shared/supabase-helpers.ts'
import { FLAGS } from '../_shared/feature-flags.ts'

// Incrementar unread_count
if (FLAGS.ATOMIC_COUNTERS) {
  await supabase.rpc('increment_unread_count', { p_chat_id: chatId })
} else {
  // fallback legado
  const { data } = await supabase.from('uazapi_chats').select('unread_count').eq('id', chatId).single()
  await supabase.from('uazapi_chats').update({ unread_count: (data?.unread_count || 0) + 1 }).eq('id', chatId)
}
```

---

## 5. FEATURE FLAGS CRIADAS

| Flag | Env Var | Default | Descricao | Pre-requisito |
|------|---------|---------|-----------|---------------|
| `ATOMIC_COUNTERS` | `FF_ATOMIC_COUNTERS` | `false` | Contadores atomicos via RPC | Migration 20260319120000 |
| `CIRCUIT_BREAKER_LLM` | `FF_CIRCUIT_BREAKER_LLM` | `false` | Circuit breaker para OpenRouter | Nenhum |
| `STRUCTURED_LOGGING` | `FF_STRUCTURED_LOGGING` | `false` | Logs JSON com correlation ID | Nenhum |
| `CONFIDENCE_THRESHOLD` | `FF_CONFIDENCE_THRESHOLD` | `0` | Threshold de escalacao por confidence (0-1) | Nenhum |

**Ativacao recomendada (em ordem):**
1. `FF_STRUCTURED_LOGGING=true` — sem risco, apenas muda formato de logs
2. `FF_ATOMIC_COUNTERS=true` — apos aplicar migration
3. `FF_CIRCUIT_BREAKER_LLM=true` — apos validar em staging
4. `FF_CONFIDENCE_THRESHOLD=0.3` — apos calibrar com dados de producao

---

## 6. PROXIMOS PASSOS (NAO INCLUIDOS NESTA ENTREGA)

| # | Acao | Prioridade | Dependencia |
|---|------|------------|-------------|
| 1 | Integrar `resilientCall` no `agent-executor` e `orchestrator` | Alta | Nenhuma |
| 2 | Integrar `createLogger` nas 7 funcoes do pipeline IA | Alta | Nenhuma |
| 3 | Substituir SELECT+UPDATE por `increment_unread_count` no webhook | Alta | Migration aplicada |
| 4 | Ativar `FF_ASYNC_DEBOUNCE` e testar debounce via `pending_ai_processing` | Alta | Migration + worker |
| 5 | Criar cron job que processa `pending_ai_processing` a cada 5s | Media | #4 |
| 6 | Monitorar triggers pg_notify e criar dashboards de SLA | Media | Migration aplicada |
| 7 | Refinar policies RLS para multi-tenancy futuro | Baixa | Quando necessario |

---

## 7. ARQUIVOS CRIADOS/MODIFICADOS

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/_shared/resilience.ts` | CRIADO | Retry, timeout, circuit breaker |
| `supabase/functions/_shared/structured-log.ts` | CRIADO | Logger JSON com correlation ID |
| `supabase/functions/_shared/supabase-helpers.ts` | CRIADO | Helpers Supabase (CORS, responses, atomic counters) |
| `supabase/functions/_shared/feature-flags.ts` | MODIFICADO | +4 novas flags (atomic counters, circuit breaker, structured logging, confidence threshold) |
| `supabase/migrations/20260319120000_infra_resilience.sql` | CRIADO | Funcoes atomicas, triggers, indexes, tabelas auxiliares |
| `docs/reports/E02-infra-report.md` | CRIADO | Este relatorio |
