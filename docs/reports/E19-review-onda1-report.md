# E19 — Code Review Consolidado da Onda 1

**Data:** 2026-03-19
**Revisor:** E19 — Engenheiro de Melhoria Continua
**Escopo:** Modulos shared, edge functions modificadas, migrations, CI/CD

---

## Resumo Executivo

A Onda 1 entregou infraestrutura solida de resiliencia, RAG hibrido, metricas de pipeline e logging estruturado. Porem, ha **3 problemas criticos** que devem ser resolvidos antes de prosseguir, alem de duplicacoes e inconsistencias entre especialistas.

**Nota geral de qualidade: 7.2/10**

---

## PROBLEMAS CRITICOS (bloquear merge ate resolver)

### C1. Tres migrations com timestamp identico

**Arquivos:**
- `supabase/migrations/20260319120000_infra_resilience.sql`
- `supabase/migrations/20260319120000_rag_improvements.sql`
- `supabase/migrations/20260319120000_pipeline_metrics.sql`

**Problema:** O Supabase CLI executa migrations em ordem alfabetica do nome do arquivo quando o timestamp e identico. Isso significa que a ordem de execucao sera: `infra_resilience` -> `pipeline_metrics` -> `rag_improvements` (ordem alfabetica do sufixo). Isso pode funcionar por coincidencia, mas e fragil e nao-determinista entre ambientes.

**Correcao obrigatoria:** Renomear para timestamps sequenciais:
- `20260319120000_infra_resilience.sql` (mantem)
- `20260319120100_rag_improvements.sql`
- `20260319120200_pipeline_metrics.sql`

### C2. Dois loggers identicos: structured-log.ts vs structured-logger.ts

**Arquivos:**
- `supabase/functions/_shared/structured-log.ts` (criado por E02)
- `supabase/functions/_shared/structured-logger.ts` (criado por E20)

**Problema:** Ambos exportam `createLogger` com assinaturas identicas mas implementacoes ligeiramente diferentes:

| Aspecto | `structured-log.ts` (E02) | `structured-logger.ts` (E20) |
|---|---|---|
| Campo timestamp | `ts` | `timestamp` |
| Campo request_id | `requestId` | `request_id` |
| Request ID format | `crypto.randomUUID().substring(0, 12)` | `req_${Date.now().toString(36)}_${random}` |
| Exporta | `createLogger`, `extractRequestId`, `propagateRequestId` | `createLogger`, `generateRequestId` |
| `debug` level | Usa `console.debug` | Usa `console.log` |
| Interface Logger | Inclui `getRequestId()` | Nao inclui |

**Uso atual:** `uazapi-webhook/index.ts` importa de `structured-logger.ts` (E20). Nenhum arquivo importa de `structured-log.ts` (E02).

**Correcao obrigatoria:** Consolidar em um unico modulo. Recomendo manter `structured-logger.ts` (que ja esta em uso) e:
1. Mover `extractRequestId` e `propagateRequestId` de `structured-log.ts` para `structured-logger.ts`
2. Adicionar `getRequestId()` na interface Logger de `structured-logger.ts`
3. Deletar `structured-log.ts`
4. Padronizar campo como `request_id` (snake_case, consistente com o resto do codebase)

### C3. CORS headers inconsistentes entre edge functions

**Problema:** `ai-whatsapp-reply/index.ts` define CORS headers **reduzidos**:
```ts
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
```

Todas as outras edge functions incluem headers adicionais:
```ts
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, ..."
```

Isso pode causar falhas CORS quando o frontend ou outra edge function envia headers extras (como `x-request-id` para correlation).

**Correcao obrigatoria:** `ai-whatsapp-reply` deve importar `corsHeaders` de `supabase-helpers.ts` em vez de definir localmente. O mesmo vale para `transcribe-media`, `process-incoming-message`, `rag-search` e `knowledge-ingestion` — todos definem corsHeaders localmente em vez de usar o shared.

---

## PROBLEMAS MEDIOS (corrigir antes do merge)

### M1. corsHeaders duplicado em 6 arquivos

Cada edge function define `const corsHeaders = { ... }` localmente, apesar de `supabase-helpers.ts` exportar uma versao canonica. Funcoes afetadas:
- `transcribe-media/index.ts`
- `process-incoming-message/index.ts`
- `rag-search/index.ts`
- `knowledge-ingestion/index.ts`
- `agent-executor/index.ts`
- `ai-whatsapp-reply/index.ts`

**Correcao:** Importar `{ corsHeaders }` de `../_shared/supabase-helpers.ts` em todas.

### M2. Supabase client nao reutilizado

`supabase-helpers.ts` exporta `createServiceClient()` com cache singleton, mas **nenhuma edge function** o usa. Todas fazem `createClient(Deno.env.get(...)...)` manualmente. Isso:
- Cria nova instancia a cada request no mesmo isolate (desperdicio)
- Duplica a logica de obtencao de env vars

**Correcao:** Migrar edge functions para usar `createServiceClient()`.

### M3. Feature flags lidas diretamente em vez de usar FLAGS

`process-incoming-message/index.ts` le feature flags diretamente do env:
```ts
const USE_PROCESSING_LOCK = Deno.env.get('FF_PROCESSING_LOCK') === 'true'
const FLOWS_BLOCK_AGENT = Deno.env.get('FF_FLOWS_BLOCK_AGENT') === 'true'
```

Deveria usar `import { FLAGS } from '../_shared/feature-flags.ts'` como fazem `rag-search`, `knowledge-ingestion` e `agent-executor`.

`transcribe-media/index.ts` tambem le diretamente: `Deno.env.get('FF_NEW_PIPELINE')`.

### M4. Modulo resilience.ts nao utilizado

`resilience.ts` exporta `withRetry`, `withTimeout`, `withCircuitBreaker` e `resilientCall`, mas **nenhuma edge function** importa ou usa esses utilitarios. O `ai-whatsapp-reply` implementa retry manual (loop for com 2 tentativas) sem usar `withRetry`.

**Correcao:** Aplicar `withRetry` no `ai-whatsapp-reply` para envio UAZAPI e no `agent-executor` para chamadas ao OpenRouter.

### M5. Logica de confianca duplicada entre agent-executor e ai-whatsapp-reply

Ambos implementam scoring de confianca com patterns quase identicos (hedging detection, finish_reason, RAG boost, agent success_rate). O `ai-whatsapp-reply` tem uma versao simplificada (sem intent-specialty matching, sem tool boost).

**Correcao:** Extrair para `_shared/confidence-scoring.ts`.

### M6. Logica de RAG date enrichment duplicada

Tanto `agent-executor` quanto `ai-whatsapp-reply` fazem a mesma query para enriquecer RAG docs com `updated_at` e formatam datas identicamente com funcao `formatDate`/`fmtDate`.

**Correcao:** Mover para `_shared/rag-utils.ts`.

### M7. Pipeline metrics sem politica INSERT para service_role

`20260319120000_pipeline_metrics.sql` habilita RLS mas so cria politica de `SELECT` para `authenticated`. Nao cria politica para `service_role` fazer `INSERT`. Isso pode funcionar porque `service_role` geralmente bypassa RLS no Supabase, mas e inconsistente com as outras tabelas (`pending_ai_processing`, `feature_flag_audit`) que criam politicas explicitas.

### M8. increment_counter com SQL injection potencial

`20260319120000_infra_resilience.sql` define `increment_counter` usando `format('%I', ...)` que e seguro contra injection de identificadores. Porem, a funcao aceita `p_table` e `p_id_column` como `text` — um caller malicioso com acesso ao RPC poderia injetar nomes de tabelas/colunas inesperados. A funcao e `SECURITY DEFINER`, entao executa com privilegios do owner.

**Mitigacao:** A funcao ja usa `%I` (identifier quoting), o que previne SQL injection classico. Mas recomenda-se adicionar validacao whitelist de tabelas permitidas.

### M9. CI nao valida migrations

O workflow CI (`ci.yml`) verifica syntax de edge functions mas nao valida SQL das migrations (nem mesmo syntax). Um erro de SQL so seria detectado no deploy.

---

## SUGESTOES DE MELHORIA

### S1. `ai-whatsapp-reply` nao usa `jsonResponse`/`errorResponse`

Todas as respostas sao construidas manualmente com `new Response(JSON.stringify(...))`. Deveria usar os helpers de `supabase-helpers.ts`.

### S2. `agent-executor` esta muito grande (1018 linhas)

A funcao `executeCustomerSearch` (linhas 854-1017) deveria ser extraida para um modulo separado `_shared/tools/customer-search.ts`.

### S3. Variavel `updatedExisting` declarada mas nao usada apos early return

Em `knowledge-ingestion/index.ts`, linha 135: `let updatedExisting = false`. O valor e setado para `true` na linha 180, mas o fluxo ja retornou na linha 182. A variavel e inutil.

### S4. Edge function check no CI e non-blocking

`ci.yml` usa `|| echo "WARN: ..."` nas verificacoes de edge functions, fazendo com que erros de tipo nunca falhem o build. Considerar tornar blocking para funcoes criticas.

### S5. `process-incoming-message` nao usa `trackMetric`

`agent-executor` e `ai-whatsapp-reply` usam `trackMetric` para registrar metricas, mas `process-incoming-message` (o orquestrador do pipeline) nao registra metricas de latencia ponta-a-ponta.

---

## METRICAS DE QUALIDADE

| Metrica | Valor |
|---|---|
| Arquivos revisados | 17 |
| Linhas de codigo analisadas | ~3.500 |
| Problemas criticos | 3 |
| Problemas medios | 9 |
| Sugestoes de melhoria | 5 |
| Codigo duplicado detectado | 4 instancias (corsHeaders, logger, confidence scoring, RAG enrichment) |
| Modulos nao utilizados | 2 (resilience.ts, structured-log.ts) |
| Edge functions usando shared helpers | 3/7 (43%) |
| Edge functions com corsHeaders local | 6/7 (86%) |
| Cobertura de testes | 0% (nenhum teste para edge functions) |

---

## DEBITOS TECNICOS INTRODUZIDOS

1. **DT1 — Dois loggers coexistentes** — Risco de confusao para novos devs e inconsistencia nos logs
2. **DT2 — resilience.ts sem consumidores** — Codigo morto ate alguem integrar
3. **DT3 — Confidence scoring duplicado** — Divergencia silenciosa entre pipelines
4. **DT4 — corsHeaders local** — Qualquer mudanca de CORS precisa ser feita em 7 lugares
5. **DT5 — createServiceClient nao adotado** — Perde beneficio de singleton por isolate
6. **DT6 — Sem testes de edge functions** — Regressoes so detectadas em producao
7. **DT7 — Migrations com timestamp conflitante** — Risco de ordem nao-determinista

---

## PLANO DE ACAO RECOMENDADO

### Antes do merge (obrigatorio)
1. Renomear timestamps das migrations (C1)
2. Consolidar loggers em um unico modulo (C2)
3. Padronizar corsHeaders via import do shared (C1 + M1)

### Sprint seguinte (alta prioridade)
4. Migrar edge functions para `createServiceClient()` (M2)
5. Extrair confidence scoring para modulo shared (M5)
6. Integrar `withRetry` do resilience.ts nos pontos criticos (M4)
7. Adicionar `trackMetric` no process-incoming-message (S5)

### Backlog
8. Extrair `executeCustomerSearch` do agent-executor (S2)
9. Adicionar validacao de SQL no CI (M9)
10. Escrever testes para edge functions criticas (DT6)
