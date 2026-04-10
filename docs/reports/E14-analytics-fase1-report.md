# E14 — Analytics Fase 1: Instrumentacao Basica do Pipeline

**Data:** 2026-03-19
**Autor:** SLA/Analytics Specialist (Claude)
**Branch:** `claude/sismais-support-system-JCMCi`
**Escopo:** Instrumentacao basica para validar estabilidade do pipeline de mensagens

---

## 1. Resumo

Fase 1 implementa instrumentacao minima no pipeline de mensagens para medir:
- **Latencia ponta-a-ponta** (webhook recebido ate resposta enviada)
- **Contagem de mensagens** processadas vs erros
- **Taxa de erro** por edge function

Toda a instrumentacao e **gateada pela feature flag `FF_PIPELINE_METRICS`** e opera em modo **fire-and-forget** (zero impacto na latencia do pipeline).

---

## 2. Artefatos Criados/Modificados

### Novos
| Arquivo | Descricao |
|---------|-----------|
| `supabase/migrations/20260319120000_pipeline_metrics.sql` | Tabela `pipeline_metrics` com indices e RLS |
| `supabase/functions/_shared/pipeline-metrics.ts` | Helper fire-and-forget para gravar metricas |

### Modificados
| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/_shared/feature-flags.ts` | Nova flag `FF_PIPELINE_METRICS` |
| `supabase/functions/uazapi-webhook/index.ts` | Metricas em `message_received` e `pipeline_complete`/`pipeline_error` |
| `supabase/functions/ai-whatsapp-reply/index.ts` | Metricas em `ai_reply_sent` e `ai_reply_error` |
| `supabase/functions/agent-executor/index.ts` | Metricas em `agent_response` e `agent_error` |

---

## 3. Tabela pipeline_metrics

```sql
CREATE TABLE pipeline_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id text,              -- correlation ID
  edge_function text NOT NULL,  -- ex: 'uazapi-webhook'
  conversation_id uuid,
  event_type text NOT NULL,     -- ex: 'message_received', 'pipeline_complete'
  latency_ms integer,
  webhook_to_reply_ms integer,  -- latencia ponta-a-ponta
  success boolean DEFAULT true,
  error_message text,
  error_code text,
  metadata jsonb DEFAULT '{}'
);
```

**Retencao:** 30 dias (funcao `cleanup_old_pipeline_metrics()` disponivel para pg_cron).

---

## 4. Eventos Instrumentados

| Edge Function | Event Type | Dados Capturados |
|---------------|-----------|------------------|
| `uazapi-webhook` | `message_received` | latency_ms, message_type, from_me, should_trigger_ai |
| `uazapi-webhook` | `pipeline_complete` | webhook_to_reply_ms, pipeline (legacy/new) |
| `uazapi-webhook` | `pipeline_error` | webhook_to_reply_ms, error_message |
| `ai-whatsapp-reply` | `ai_reply_sent` | latency_ms, agent, model, confidence, tokens, rag_used |
| `ai-whatsapp-reply` | `ai_reply_error` | error_message |
| `agent-executor` | `agent_response` | latency_ms, agent, model, confidence, cost_usd, rag_docs, tools, tokens |
| `agent-executor` | `agent_error` | error_message |

---

## 5. Feature Flag

```bash
# Ativar metricas (requer migration aplicada)
supabase secrets set FF_PIPELINE_METRICS=true

# Desativar (padrao)
supabase secrets set FF_PIPELINE_METRICS=false
```

Quando desativada, as chamadas a `trackMetric()`/`trackError()` retornam imediatamente sem nenhuma operacao de I/O.

---

## 6. Queries de Validacao

### 6.1 Latencia media ponta-a-ponta (ultimas 24h)
```sql
SELECT
  AVG(webhook_to_reply_ms) AS avg_ms,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY webhook_to_reply_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY webhook_to_reply_ms) AS p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY webhook_to_reply_ms) AS p99_ms,
  COUNT(*) AS total
FROM pipeline_metrics
WHERE event_type = 'pipeline_complete'
  AND created_at > now() - interval '24 hours';
```

### 6.2 Mensagens processadas vs erros (ultimas 24h)
```sql
SELECT
  event_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE success = false) AS errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / NULLIF(COUNT(*), 0), 2) AS error_rate_pct
FROM pipeline_metrics
WHERE created_at > now() - interval '24 hours'
GROUP BY event_type
ORDER BY total DESC;
```

### 6.3 Taxa de erro por edge function (ultimas 24h)
```sql
SELECT
  edge_function,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE success = false) AS errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / NULLIF(COUNT(*), 0), 2) AS error_rate_pct
FROM pipeline_metrics
WHERE created_at > now() - interval '24 hours'
GROUP BY edge_function
ORDER BY error_rate_pct DESC;
```

### 6.4 SLA de primeira resposta (tempo webhook -> reply por conversa)
```sql
SELECT
  conversation_id,
  MIN(webhook_to_reply_ms) AS first_reply_ms,
  MIN(created_at) AS first_reply_at
FROM pipeline_metrics
WHERE event_type = 'pipeline_complete'
  AND success = true
  AND created_at > now() - interval '24 hours'
GROUP BY conversation_id
ORDER BY first_reply_ms DESC
LIMIT 20;
```

### 6.5 Latencia do agent-executor (distribuicao)
```sql
SELECT
  metadata->>'agent_name' AS agent,
  COUNT(*) AS calls,
  AVG(latency_ms) AS avg_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
  AVG((metadata->>'confidence')::numeric) AS avg_confidence,
  SUM((metadata->>'cost_usd')::numeric) AS total_cost_usd
FROM pipeline_metrics
WHERE edge_function = 'agent-executor'
  AND event_type = 'agent_response'
  AND created_at > now() - interval '24 hours'
GROUP BY metadata->>'agent_name'
ORDER BY calls DESC;
```

---

## 7. Baseline de Performance Atual

> **Nota:** Os valores abaixo sao estimativas baseadas na analise do codigo. O baseline real sera coletado apos ativar `FF_PIPELINE_METRICS` em producao.

| Metrica | Estimativa | Observacao |
|---------|-----------|-----------|
| Latencia webhook (parse) | ~50-100ms | Parsing do payload UAZAPI + lookup de instancia |
| Debounce sincrono | +5000ms | Bloqueia edge function (D2 no CTO report) |
| Latencia ai-whatsapp-reply | ~3000-8000ms | Inclui orchestrator + LLM call + envio UAZAPI |
| Latencia agent-executor | ~2000-5000ms | LLM call + RAG search + tools |
| Latencia ponta-a-ponta (legacy) | ~8000-13000ms | webhook + debounce + ai-whatsapp-reply |
| Taxa de erro esperada | <5% | Principalmente timeouts do LLM |

---

## 8. Proximos Passos (Fase 2)

1. **Aplicar migration** e ativar `FF_PIPELINE_METRICS=true` em staging
2. **Coletar baseline real** por 48-72h
3. **Dashboard basico** em `/analytics` com as queries acima
4. **Alertas** via pg_cron: latencia p95 > 15s ou error_rate > 10%
5. **Correlation ID** propagado entre edge functions (request_id no header)
6. **Limpeza automatica** via pg_cron chamando `cleanup_old_pipeline_metrics()`

---

## 9. Decisoes de Design

- **Fire-and-forget:** Metricas nunca bloqueiam o pipeline. Se a insercao falhar, o erro e logado silenciosamente.
- **Feature flag:** Metricas desativadas por padrao. Zero overhead quando desligada.
- **Tabela unica:** Uma tabela `pipeline_metrics` cobre todos os eventos. Simples de consultar e indexar.
- **Retencao 30 dias:** Dados de instrumentacao nao precisam ser permanentes. Funcao de limpeza disponivel.
- **RLS:** Apenas leitura para usuarios autenticados (dashboard). Escrita via service role (edge functions).
