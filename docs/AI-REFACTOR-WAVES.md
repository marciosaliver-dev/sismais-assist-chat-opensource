# Refatoração do Módulo de IA — Ondas v2.73.2 → v2.73.10

Documento consolidado de todas as ondas da refatoração do módulo de IA,
executadas entre 2026-04-08 e 2026-04-09. Cada onda é um PR independente
com rollback trivial.

---

## Resumo executivo

| Métrica | Antes | Depois | Delta |
|---------|-------|--------|-------|
| Edge functions IA (ativas) | 30 | 27 | -3 |
| Edge functions deprecadas (shims) | 0 | 3 | +3 shims HTTP 410 |
| Novas edge functions | 0 | 2 | +ai-cost-monitor, +proactive-triggers-detector |
| LOC removidas (dead code) | 0 | ~1.400 | código morto eliminado |
| ChatArea.tsx | 4.076 LOC | 3.270 LOC | -806 (MediaContent extraído) |
| Referências hardcoded Gemini 2.5 | 14 | 0 | 100% centralizado |
| Modelo padrão | gemini-2.5-flash-preview | gemini-3.1-flash-lite-preview | migrado |
| Cost tracking no learning pipeline | invisível | logado em ai_api_logs | observável |
| View agregada de custos | não existia | ai_cost_daily_summary | refresh 1x/hora |
| Alerta de spike de custo | não existia | ai-cost-monitor (Discord) | ativo |
| UI de fallback models | não existia | AgentLLMConfig.tsx | configurável por agente |
| Proactive triggers | tabela seedada, 0 consumers | dry-run detector | 4 triggers ativos |
| Decisões documentadas no código | 0 | 3 JSDoc blocks | previne consolidação errada |

---

## Ondas executadas

### Onda 1 — Dead code inicial (v2.73.2)
**PR:** #220 | **Risco:** zero
- Deletou `KnowledgeBase.tsx` (página sem rota, mock data)
- Removeu `mockKnowledgeBase` de `mockData.ts`
- Comprimiu prompt de contexto no `ai-builder` (menos tokens/chamada)
- **-194 LOC**

### Onda 2 — Consolidação RAG (v2.73.3)
**PR:** #221 (mesclado junto com 220) | **Risco:** médio
- `rag-search` expandido com modes: `hybrid` | `quality` | `vector`
- `knowledge-search` → shim HTTP que delega para `rag-search mode=quality`
- `semantic-search` → shim HTTP que delega para `rag-search mode=vector`
- Fix: `results` como alias de `documents` na resposta (bug latente corrigido)
- `useKnowledgeBase.ts` atualizado para chamar `rag-search` diretamente
- **Estratégia:** Strangler Fig — shims ficam 14 dias para garantir backward compat

### Hotfix Gemini 3.1 (v2.73.4)
**PR:** #222 | **Risco:** baixo
- Todos os defaults migrados de `gemini-2.0-flash-001` para `gemini-3.1-flash-lite-preview`
- Multimodal migrado para `gemini-3.1-flash-image-preview` (Nano Banana 2)
- 5 agentes no banco atualizados (AXEL, ORION, Renan, KIRA, Maya)
- Frontend: `useAgentBuilder`, `PreviewConfig`, `WizardStepEngine` atualizados
- **10 edge functions re-deployadas**

### Onda 3 — skill-agent-creator + docs (v2.73.5)
**PR:** #223 | **Risco:** zero
- `skill-agent-creator` → shim HTTP 410 (zero call sites confirmados)
- JSDoc no topo de `ai-builder` e `agent-builder-ai` documentando por que são separados
- **Decisão arquitetural:** consolidar os 2 builders restantes seria ERRO — contratos incompatíveis (multi-turn vs single-shot)
- **-260 LOC**

### Onda 4 — Learning engines (v2.73.6)
**PR:** #224 | **Risco:** baixo
- `extract-conversation-knowledge`: migrado de `fetch()` raw para `callOpenRouter` + `DEFAULT_LITE_MODEL`
- Cost tracking recuperado no learning pipeline (antes: custo invisível)
- `process-incoming-message:1392`: corrigido shape do body para learning-loop
- **Decisão arquitetural:** os 3 learning engines são pipeline intencional (não duplicatas) — NÃO consolidar

### Onda 4B — fine-tuning-loop shim (v2.73.7)
**PR:** #225 | **Risco:** zero
- Confirmado dead code (0 calls em 30 dias, 0 cron jobs, 0 call sites)
- Transformado em shim HTTP 410
- **-200 LOC**

### Onda 5A — MediaContent extraído (v2.73.8)
**PR:** #226 | **Risco:** baixo
- `MediaContent` (~810 LOC) extraído de `ChatArea.tsx` para `src/components/inbox/MediaContent.tsx`
- Extração PURAMENTE MECÂNICA — zero mudança de comportamento
- UAZAPI/pipeline intocados
- **ChatArea.tsx: 4.076 → 3.270 LOC**
- Ondas 5B-5E (MessageList, Composer, Dialogs, Header) abortadas por acoplamento real — ficam para quando houver testes

### Onda 6A — Cost observability (v2.73.9)
**PR:** #227 | **Risco:** baixo
- **Novo:** `ai_cost_daily_summary` — materialized view com agregação diária
- **Novo:** pg_cron `refresh-ai-cost-daily` (refresh 1x/hora, CONCURRENTLY)
- **Novo:** Edge function `ai-cost-monitor` — alerta Discord se custo sobe > 50% vs baseline 7d
- Descoberta: `fallback_models` já existia no schema (Fix 1 cancelado)

### Onda 6B — UI fallback models (v2.73.10)
**PR:** #228 | **Risco:** baixo
- **Novo:** `FallbackModelsPicker` — multi-select ordenável para até 3 fallbacks por agente
- Integrado no `AgentLLMConfig.tsx` (form de agente, aba LLM)

### Onda 6F — Proactive triggers detector (v2.73.10)
**PR:** #229 | **Risco:** zero
- **Novo:** tabela `ai_proactive_trigger_fires` (histórico de disparos dry-run)
- **Novo:** Edge function `proactive-triggers-detector` (dry-run mode)
- 4 detecções: ticket_stale, client_inactivity, sla_warning, churn_risk
- NÃO executa ações (zero toque no UAZAPI/pipeline) — apenas detecta e loga

---

## Ondas intencionalmente PULADAS e por quê

### Onda 6C — Dynamic model routing (depende de tocar pipeline)
**Status:** design pronto, execução pendente
**Motivo:** exige modificar `agent-executor` (pipeline crítico de mensagens WhatsApp). Pedido explícito de não mexer.
**Pré-requisito:** testes no agent-executor + aprovação presencial
**O que faria:** reordenar fallback chain baseado em métricas reais de `ai_cost_daily_summary`

### Onda 6D — Error classifier ativo (depende de config externa)
**Status:** código pronto (`_shared/error-classifier.ts` + `error-watcher/index.ts`), tabelas existem (`error_routing_rules` 5 rules, `error_issues`, `pipeline_metrics`)
**Motivo:** requer 3 pré-requisitos:
1. GitHub PAT (`GITHUB_PAT_ERROR_WATCHER`) configurado como secret no Supabase
2. Database Webhook no Supabase Dashboard (INSERT em `pipeline_metrics` → `error-watcher`)
3. Modificar edge functions críticas para escrever em `pipeline_metrics` (toca pipeline)
**Ação necessária:** Márcio configura secrets + webhook via Dashboard + decide quais funções instrumentar

### Onda 6E — Semantic cache (depende de tocar pipeline)
**Status:** não iniciada
**Motivo:** ativar cache exige modificar `agent-executor` para checar cache antes de chamar LLM
**Pré-requisito:** Onda 6C implementada + testes + aprovação

---

## Infraestrutura de autonomia — estado atual (pós-ondas)

### ✅ Funcionando em produção

| Componente | Localização | Status |
|------------|-------------|--------|
| Circuit breaker (OpenRouter) | `_shared/resilience.ts` | Ativo |
| Retry exponencial com jitter | `_shared/resilience.ts` + `openrouter-client.ts` | Ativo |
| Timeout 25s + AbortController | `_shared/resilience.ts` | Ativo |
| Dead letter queue | `_shared/dead-letter.ts` | Ativo |
| Loop detection (Jaccard trigram) | `_shared/loop-detector.ts` | Ativo |
| Fallback chains multi-model | `_shared/default-models.ts` + `agent-executor` | Ativo |
| Modelo centralizado | `_shared/default-models.ts` | `gemini-3.1-flash-lite-preview` |
| Learning loop (CSAT/escalação/sentiment) | `learning-loop/index.ts` | Ativo |
| Knowledge extraction (Q&A) | `extract-conversation-knowledge/index.ts` | Ativo + cost tracked |
| Cost aggregation diária | `ai_cost_daily_summary` (materialized view) | Refresh 1x/hora |
| Cost spike alerting | `ai-cost-monitor/index.ts` → Discord | Ativo |
| Proactive triggers detection | `proactive-triggers-detector/index.ts` | Dry-run mode |

### ⏳ Pronto mas não ativado

| Componente | Localização | O que falta |
|------------|-------------|-------------|
| Error classifier | `_shared/error-classifier.ts` | GitHub PAT + webhook + instrumentação |
| Error watcher | `error-watcher/index.ts` | Mesmos pré-requisitos |
| Health monitoring | `system-health-monitor/index.ts` | Validação + agendamento |
| RAG shims (knowledge-search, semantic-search) | shims HTTP 410 | Deleção definitiva em 14 dias |
| Builder shims (skill-agent-creator, fine-tuning-loop) | shims HTTP 410 | Deleção definitiva em 14 dias |
| Proactive triggers execution | `proactive-triggers-detector` | Modo 'execute' + UAZAPI integration |
| Fallback chain UI | `AgentLLMConfig.tsx` | Admin popula via interface |

### ❌ Não implementado (decisões conscientes)

| Componente | Por quê não |
|------------|-------------|
| Dynamic model routing | Exige tocar agent-executor |
| Semantic cache | Exige tocar agent-executor |
| Temperature/max_tokens auto-tuning | Efeito sutil, difícil validar sem A/B test |
| Per-specialty learning | Nova arquitetura, risco alto |
| Prediction generation | Requer ML model |

---

## Deploy da Onda 7 (consolidação)

Esta onda é apenas este documento + Discord + system_updates. Zero mudança de código.

---

## Observações para o futuro

1. **Deleção de shims (14 dias):** em 2026-04-22, conferir logs e deletar:
   - `knowledge-search` (shim desde v2.73.3)
   - `semantic-search` (shim desde v2.73.3)
   - `skill-agent-creator` (shim desde v2.73.5)
   - `fine-tuning-loop` (shim desde v2.73.7)

2. **`generate-ticket-description`** ainda usa `gemini-2.0-flash-001` (visto nos logs). Não é gemini-2.5, então não é urgente, mas deve migrar para `DEFAULT_CONTENT_MODEL` eventualmente.

3. **Testes no ChatArea.tsx** são pré-requisito para continuar decomposição (5B-5E). Sem testes, qualquer extração é risco desnecessário ao inbox em produção.

4. **`ai_cost_daily_summary`** tem janela de 90 dias. Se precisar de histórico maior, ajustar o `WHERE created_at >= NOW() - INTERVAL '90 days'` na view.
