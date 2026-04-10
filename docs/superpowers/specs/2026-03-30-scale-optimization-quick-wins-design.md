# Scale Optimization — Quick Wins (Abordagem A)

**Data:** 2026-03-30
**Projeto:** sismais-assist-chat
**Objetivo:** Preparar o sistema para 5.000+ usuários, 1.000 chamados/dia, 10K mensagens/mês, 100K leads
**Abordagem:** Quick wins — resolver 80% dos gargalos com 20% do esforço

---

## Contexto

Auditoria completa do sistema revelou 3 gargalos críticos que impedirão a escala:

1. **Edge Functions com queries sequenciais** — latência de 2-3s por mensagem
2. **Realtime subscriptions sem pooling** — projeção de 25K subscriptions a 5K usuários
3. **Banco sem indexes compostos** — queries de dashboard vão degradar com 100K+ rows

### Métricas Atuais (estimadas ~100 usuários)
- Processamento de mensagem: ~2-3s
- Ingestão de webhook: ~500-800ms
- Resposta da API: ~1-2s

### Métricas Alvo (5.000 usuários)
- Processamento de mensagem: <800ms (-60%)
- Ingestão de webhook: <200ms (-75%)
- Resposta da API: <400ms (-80%)

---

## Frente 1: Indexes Compostos no Banco de Dados

Uma migration SQL única com 10 indexes críticos que faltam.

### Indexes

| # | Tabela | Colunas | Tipo | Query que resolve |
|---|--------|---------|------|-------------------|
| 1 | `ai_conversations` | `(helpdesk_client_id, status, started_at DESC)` | Compound | Conversas do cliente X filtradas por status |
| 2 | `ai_conversations` | `(handler_type, status)` WHERE status IN ('active','waiting') | Partial | Fila de atendimento humano |
| 3 | `ai_messages` | `(agent_id, created_at DESC)` | Compound | Dashboard de performance do agente |
| 4 | `ai_messages` | `(created_at DESC)` | Simple | Feed geral de mensagens |
| 5 | `helpdesk_clients` | `(lifecycle_stage, health_score DESC)` | Compound | Segmentação CRM |
| 6 | `helpdesk_clients` | `(created_at DESC)` | Simple | Lista de clientes recentes |
| 7 | `campaign_contacts` | `(campaign_id, status, created_at DESC)` | Compound | Progresso de campanha |
| 8 | `crm_duplicate_candidates` | `(status, match_score DESC)` | Compound | Fila de revisão de duplicatas |
| 9 | `crm_score_history` | `(client_id, score_type, calculated_at DESC)` | Compound | Tendência de score por cliente |
| 10 | `whatsapp_messages` | `(conversation_id, created_at DESC)` | Compound | Histórico de thread WhatsApp |

### Impacto esperado
- Queries de dashboard: de 2-5s (com 100K+ rows) → 50-200ms
- Lookup de cliente: de full scan → index seek

### Riscos
- Indexes ocupam espaço (estimativa: ~500MB extra com dados em escala)
- `CREATE INDEX CONCURRENTLY` para não bloquear tabelas em produção

---

## Frente 2: Paralelização de Edge Functions

Refatorar 5 Edge Functions críticas para usar `Promise.all()` em queries independentes. Sem reescrita — apenas reorganização.

### 2.1 `ai-whatsapp-reply/index.ts` (maior ganho: -300ms)

**Hoje:** 12+ queries sequenciais antes do LLM call
**Proposta:** 3 blocos paralelos:

```
Bloco 1 (paralelo):
  - conversation lookup
  - client data fetch
  - agent config lookup

Bloco 2 (paralelo, depende do Bloco 1):
  - skill assignments
  - RAG embedding + search
  - message history (últimas 15)

Bloco 3 (sequencial, depende do Bloco 2):
  - LLM call com contexto montado
```

### 2.2 `process-incoming-message/index.ts` (ganho: -350ms)

**Hoje:** 7 DB queries + 3 function calls síncronos
**Proposta:**
- Paralelizar lookups independentes: `Promise.all([conversation, client, lock_acquisition])`
- `message-analyzer` e `orchestrator` em paralelo quando não há dependência
- Manter debounce e chunking como estão (lógica correta)

### 2.3 `uazapi-webhook/index.ts` (ganho: -60ms/msg)

**Hoje:** 3 queries de dedup por mensagem (instance + uazapi_messages + ai_messages)
**Proposta:** Query única com composite check:
```sql
SELECT id FROM uazapi_messages WHERE message_id = $1 AND instance_id = $2 LIMIT 1
```
Elimina 2 queries por mensagem. Com 1000 msgs/dia = 2000 queries a menos.

### 2.4 `whatsapp-meta-webhook/index.ts` (ganho: -80% latência em batch)

**Hoje:** Loop sequencial para processar múltiplos eventos no mesmo webhook
**Proposta:** `Promise.all(messages.map(msg => insertMessage(msg)))`
Cache de `whatsapp_business_accounts` lookup (1 query por invocação, não por mensagem).

### 2.5 `agent-executor/index.ts` (ganho: -500ms em conversas longas)

**Hoje:** RAG + summarization bloqueiam sequencialmente
**Proposta:**
- Desabilitar RAG reranking via LLM (economiza 1-3s quando ativo)
- Cache de summaries para conversas com 40+ mensagens
- Paralelizar: `Promise.all([client_data, ticket_history, rag_search])`

### Impacto total estimado
- Latência por mensagem: de 2-3s → ~800ms (-70%)
- Queries/dia eliminadas: ~5000 (dedup + lookups repetidos)

### Riscos
- Paralelizar queries com dependência entre si causa bugs — mapear dependências antes
- `Promise.all` falha se qualquer promise rejeitar — usar `Promise.allSettled` onde faz sentido

---

## Frente 3: Subscription Pooling no Frontend

Refatorar 3 hooks de Realtime para compartilhar channels.

### Problema
Cada operador cria 5+ channels individuais por tabela. Projeção:
- 100 operadores: ~500 subscriptions
- 5000 usuários: ~25.000 subscriptions (acima do limite Supabase)

### Proposta

**Canal compartilhado por tabela, filtro client-side:**

| Hook | Hoje | Proposta |
|------|------|----------|
| `useKanbanTickets` | 4 channels (ai_conversations, ai_messages, uazapi_chats, uazapi_messages) | 1 channel único: `kanban-realtime` subscrito a 4 tabelas |
| `useConversationMessages` | 1 channel por conversa aberta | Reusar channel global de `ai_messages`, filtrar por `conversation_id` client-side |
| `useNotifications` | Manter como está | Individual per-user (volume baixo, correto) |

### Implementação
1. Criar `useSharedRealtimeChannel` — hook centralizado que gerencia 1 channel por tabela
2. Componentes se inscrevem com callback + filtro local
3. Cleanup automático quando último subscriber sai

### Impacto
- De ~25.000 subscriptions → ~500 (1 por tabela × operadores online)
- Redução de 98% na carga do Realtime

### Riscos
- Mais dados trafegam para o client (sem filtro server-side) — mitigado pelo volume ser gerenciável
- Requer refator dos 3 hooks — risco de regressão no Kanban

---

## Frente 4: Cache de Lookups Repetidos

Módulo `_shared/cache.ts` com Map + TTL para Edge Functions.

### Dados cacheados

| Dado | Function(s) | Frequência de mudança | TTL |
|------|------------|----------------------|-----|
| `ai_agents` ativos | orchestrator, ai-whatsapp-reply | 1x/semana | 5 min |
| `platform_ai_config` | ai-whatsapp-reply, agent-executor | Raro | 10 min |
| `ai_agent_skill_assignments` | ai-whatsapp-reply | Raro | 5 min |
| `whatsapp_business_accounts` | whatsapp-meta-webhook | Quase nunca | 10 min |
| `uazapi_instances` | uazapi-webhook | Raro | 5 min |

### Implementação
```typescript
// _shared/cache.ts
const cache = new Map<string, { data: unknown; expires: number }>()

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expires) return cached.data as T
  const data = await fetcher()
  cache.set(key, { data, expires: Date.now() + ttlMs })
  return data
}
```

### Comportamento
- Cache vive na memória do Deno isolate (morre no cold start, sobrevive entre invocações quentes)
- Não precisa de Redis — o ganho em hot path já é significativo
- Invalidação natural via TTL

### Impacto
- -50-100ms por mensagem processada
- -80% queries de lookup repetitivo

### Riscos
- Dado stale por até TTL — aceitável para configs que mudam raramente
- Se agent for desativado, leva até 5 min para parar de ser roteado — aceitável

---

## Fora do Escopo (futuro)

- **Particionamento de tabelas** — necessário quando ai_messages > 1M rows (~6-12 meses)
- **Message queue (Redis/Bull)** — quando webhooks > 100/min sustentado
- **Multi-tenant (org_id)** — preparação SaaS (projeto separado)
- **Sentry no sismais_admin** — observabilidade expandida
- **Soft deletes** — compliance LGPD

---

## Ordem de Implementação

1. **Indexes** (menor risco, maior impacto imediato)
2. **Cache module** (dependência das functions refatoradas)
3. **Edge Functions** (usa o cache, beneficia dos indexes)
4. **Subscription pooling** (frontend, independente do backend)

---

## Critérios de Sucesso

- [ ] Todos os 10 indexes criados e verificados via `EXPLAIN ANALYZE`
- [ ] 5 Edge Functions refatoradas com `Promise.all` onde aplicável
- [ ] Latência p95 de `process-incoming-message` < 1s (medir antes/depois)
- [ ] Subscription count reduzido 90%+ com 10 operadores simultâneos
- [ ] Cache hit rate > 80% para lookups de agents/config
- [ ] Zero regressões nos testes existentes
- [ ] Build + TypeScript + lint passando
