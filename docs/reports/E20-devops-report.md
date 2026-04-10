# E20 — Relatorio DevOps e Observabilidade

**Data:** 2026-03-19
**Autor:** Engenheiro DevOps/Observabilidade
**Branch:** claude/sismais-support-system-JCMCi
**Escopo:** CI/CD, logging estruturado, feature flags, runbook, versionamento de edge functions

---

## 1. DIAGNOSTICO ATUAL

### 1.1 CI/CD
- **Inexistente.** Nenhum arquivo em `.github/workflows/`.
- Deploy de edge functions e manual via `supabase functions deploy <nome>`.
- Frontend deploy via Lovable (plataforma gerenciada).
- Sem gate de qualidade: codigo pode ir para producao sem lint, sem testes, sem build check.

### 1.2 Testes
- Vitest configurado (`vitest.config.ts`) com jsdom e setup file.
- Scripts `test` e `test:watch` no `package.json`.
- Cobertura desconhecida — provavelmente baixa dado que o projeto cresceu sem CI.

### 1.3 Linting
- ESLint 9 com flat config (`eslint.config.js`).
- TypeScript-eslint + react-hooks + react-refresh plugins.
- `@typescript-eslint/no-unused-vars` desativado (pode esconder problemas).
- Script `lint` no `package.json` funciona.

### 1.4 Logging
- **Inconsistente.** Conforme relatado no E16 (debito D12):
  - Algumas functions usam `console.log(JSON.stringify({...}))` (correto)
  - Outras usam `console.log('[nome] texto livre')` (nao parseavel)
  - Sem correlation ID entre funcoes na cadeia (D13)
- Nenhum padrao documentado ou enforced.

### 1.5 Feature Flags
- Sistema basico em `_shared/feature-flags.ts` com 7 flags via `Deno.env.get()`.
- Funciona, mas exige redeploy ou `supabase secrets set` para alterar.
- Sem UI para toggle. Sem audit log de mudancas.

### 1.6 Edge Functions
- **73 edge functions** (73 index.ts encontrados em `supabase/functions/`).
- Todas com `verify_jwt = false` no `config.toml`.
- Deploy individual: `supabase functions deploy <nome>`.
- Sem versionamento — sobrescreve a versao ativa.

---

## 2. CI/CD IMPLEMENTADO

### 2.1 GitHub Actions — `.github/workflows/ci.yml`

Pipeline com 3 jobs paralelos:

| Job | O que faz | Timeout |
|-----|-----------|---------|
| `lint-and-build` | `npm run lint` + `tsc --noEmit` + `npm run build` | 10min |
| `test` | `npm run test` (vitest) | 10min |
| `edge-functions-check` | `deno check` em cada edge function (non-blocking) | 5min |

**Triggers:**
- Push em `main` e `claude/**`
- Pull requests para `main`

**Concurrency:** cancela runs anteriores da mesma branch.

**Nota:** O check de Deno e non-blocking (warnings apenas) porque muitas edge functions importam de `esm.sh` que pode ter types incompletos. Gradualmente tornar blocking conforme os types forem corrigidos.

### 2.2 Pipeline de Deploy Proposto (Futuro)

```
PR merged -> CI green -> deploy edge functions alteradas -> smoke test -> done
```

Para implementar deploy automatico no futuro:
1. Detectar quais functions mudaram: `git diff --name-only HEAD~1 | grep supabase/functions/`
2. Deploy seletivo: `supabase functions deploy <nome> --project-ref pomueweeulenslxvsxar`
3. Requer `SUPABASE_ACCESS_TOKEN` como secret do GitHub

**Nao implementado agora** porque exige configurar secrets e validar acesso. Proximo passo natural apos CI estabilizar.

---

## 3. LOGGING ESTRUTURADO

### 3.1 Modulo Implementado — `_shared/structured-logger.ts`

```typescript
import { createLogger, generateRequestId } from '../_shared/structured-logger.ts'

const requestId = generateRequestId()
const log = createLogger('orchestrator', requestId)

log.info('Agent selected', { agent_id: 'abc', confidence: 0.95 })
log.error('LLM timeout', { model: 'gemini-2.0-flash', latency_ms: 25000 })
```

### 3.2 Formato de Saida (JSON)

```json
{
  "level": "info",
  "fn": "orchestrator",
  "msg": "Agent selected",
  "timestamp": "2026-03-19T14:30:00.000Z",
  "request_id": "req_abc123_def456",
  "agent_id": "abc",
  "confidence": 0.95
}
```

### 3.3 Campos Obrigatorios

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `level` | `debug\|info\|warn\|error` | Severidade |
| `fn` | `string` | Nome da edge function |
| `msg` | `string` | Mensagem descritiva |
| `timestamp` | `ISO 8601` | Quando ocorreu |

### 3.4 Campos Recomendados

| Campo | Quando usar |
|-------|-------------|
| `request_id` | Sempre — propagar entre functions para tracing |
| `conversation_id` | Em functions do pipeline de mensagens |
| `agent_id` | Em orchestrator/agent-executor |
| `latency_ms` | Em chamadas LLM e APIs externas |
| `model` | Em chamadas LLM |
| `cost_usd` | Em chamadas LLM (via log-ai-cost) |
| `error_code` | Em erros categorizados |

### 3.5 Plano de Adocao

1. **Semana 1:** Adotar em `process-incoming-message`, `orchestrator`, `agent-executor` (pipeline critico)
2. **Semana 2:** `uazapi-webhook`, `transcribe-media`, `trigger-flows`
3. **Semana 3+:** Demais functions conforme forem tocadas

Propagar `request_id` entre functions via header `x-request-id` ou campo no body.

---

## 4. ESTRATEGIA DE FEATURE FLAGS

### 4.1 Estado Atual (Funcional)

O `_shared/feature-flags.ts` atual funciona bem para o momento. 7 flags definidas com JSDoc.

### 4.2 Evolucao Proposta — Tabela no Supabase

Para permitir toggle sem redeploy, migrar para tabela:

```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- Inserir flags existentes
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('FF_PROCESSING_LOCK', false, 'Lock de processamento por conversa'),
  ('FF_DISABLE_LEGACY_AUTO', false, 'Desativa automacoes legadas'),
  ('FF_FLOWS_BLOCK_AGENT', false, 'Flows bloqueiam resposta do agente'),
  ('FF_SHADOW_PIPELINE', false, 'Shadow mode do pipeline completo'),
  ('FF_NEW_PIPELINE', false, 'Pipeline completo como principal'),
  ('FF_ASYNC_DEBOUNCE', false, 'Debounce assincrono via DB'),
  ('FF_HUMAN_TIMEOUT_MINUTES', false, 'Timeout de handler humano')
ON CONFLICT DO NOTHING;
```

**Implementacao no _shared:**
```typescript
// Manter env vars como override (prioridade sobre DB)
// Se env var existe, usa ela. Senao, consulta tabela com cache de 60s.
```

**Nao implementado agora** porque:
- O sistema atual funciona
- Adicionar query ao DB em cada request adiciona latencia
- Precisa de cache strategy (in-memory com TTL)
- Melhor fazer quando houver UI de admin para toggle

### 4.3 Regras para Novas Flags

1. Prefixo `FF_` obrigatorio
2. Default sempre `false` (desativado)
3. Documentar com JSDoc em `feature-flags.ts`
4. Logar quando flag afeta comportamento
5. Remover flag apos feature estavel por 2+ semanas

---

## 5. PROCESSO DE DEPLOY — DOCUMENTACAO

### 5.1 Frontend
- Deploy automatico via Lovable ao fazer merge em `main`
- Build: `npm run build` (Vite)
- Nenhuma acao manual necessaria

### 5.2 Edge Functions (Processo Atual)

```bash
# 1. Instalar Supabase CLI (se necessario)
npm i -g supabase

# 2. Login
supabase login

# 3. Deploy de uma funcao especifica
supabase functions deploy <nome-da-funcao> --project-ref pomueweeulenslxvsxar

# 4. Deploy de TODAS as funcoes (cuidado!)
supabase functions deploy --project-ref pomueweeulenslxvsxar

# 5. Definir secrets (feature flags, API keys)
supabase secrets set FF_NEW_PIPELINE=true --project-ref pomueweeulenslxvsxar

# 6. Ver logs
supabase functions logs <nome-da-funcao> --project-ref pomueweeulenslxvsxar
```

### 5.3 Melhorias Propostas

| Melhoria | Esforco | Impacto |
|----------|---------|---------|
| CI no GitHub Actions (lint+test+build) | **Feito** | Gate de qualidade |
| Deploy automatico de functions alteradas | 4h | Elimina deploys manuais |
| Smoke test pos-deploy (health check) | 2h | Detecta falhas rapido |
| Rollback automatico (re-deploy versao anterior) | 4h | Recuperacao rapida |
| Notificacao Slack/Discord em falha de CI | 1h | Visibilidade |

---

## 6. RUNBOOK DE INCIDENTES

### 6.1 CI Pipeline Falhou

**Sintoma:** GitHub Actions job vermelho.

**Acao:**
1. Abrir o job no GitHub Actions, ler o log de erro
2. Se `lint` falhou: corrigir erros de lint localmente, push novamente
3. Se `build` falhou: verificar erros TypeScript (`npx tsc --noEmit` local)
4. Se `test` falhou: rodar `npm run test` local, corrigir testes quebrados
5. Se `edge-functions-check` falhou: e warning apenas, nao bloqueia

### 6.2 Edge Function Retornando 500

**Sintoma:** Usuarios reportam erro ou IA nao responde.

**Acao:**
1. Verificar logs: `supabase functions logs <nome> --project-ref pomueweeulenslxvsxar`
2. Procurar entradas com `"level":"error"` nos logs
3. Causas comuns:
   - **API key expirada**: `supabase secrets list` para verificar, `supabase secrets set` para atualizar
   - **Timeout LLM (>25s)**: verificar se OpenRouter esta instavel (status.openrouter.ai)
   - **Erro de parsing**: body inesperado — verificar quem chama a function
   - **Rate limit**: OpenRouter retorna 429 — aguardar ou trocar modelo
4. Se a function e critica (`uazapi-webhook`, `process-incoming-message`):
   - Verificar se as mensagens estao sendo salvas no DB (mesmo sem resposta IA)
   - Se nao: a function crashou antes de salvar — precisa de fix urgente
   - Se sim: o erro e na cadeia de IA — mensagens nao se perdem

### 6.3 WhatsApp Nao Recebe Respostas da IA

**Sintoma:** Mensagens chegam no Supabase mas IA nao responde.

**Acao:**
1. Verificar `ai_conversations` — o `handler_type` esta como `human`?
   - Se sim: ninguem assumiu o atendimento. Mudar para `ai` manualmente ou esperar timeout (se FF_HUMAN_TIMEOUT_MINUTES ativo)
2. Verificar logs do `uazapi-webhook` — a mensagem chegou?
3. Verificar logs do `process-incoming-message` (ou `ai-whatsapp-reply` se pipeline antigo)
4. Verificar se a instancia UAZAPI esta online: chamar `uazapi-proxy` com GET `/instance/status`
5. Verificar se o `ai_agents` ativo tem `is_active = true` e modelo configurado

### 6.4 Instancia UAZAPI Desconectada

**Sintoma:** QR code expirou ou celular desconectou.

**Acao:**
1. Acessar painel UAZAPI (url da instancia em `uazapi_instances`)
2. Reconectar via QR code
3. Verificar se o webhook URL esta configurado corretamente na instancia UAZAPI
4. Enviar mensagem de teste para validar

### 6.5 Supabase Edge Function Nao Inicia (Deploy Falhou)

**Sintoma:** Function retorna 404 ou "Boot Error".

**Acao:**
1. Verificar se o deploy foi bem-sucedido: `supabase functions list --project-ref pomueweeulenslxvsxar`
2. Re-deploy: `supabase functions deploy <nome> --project-ref pomueweeulenslxvsxar`
3. Se persiste: verificar imports — `esm.sh` pode estar fora do ar
4. Verificar se `config.toml` tem a function declarada
5. Ultimo recurso: deploy com `--no-verify-jwt` flag

### 6.6 Base de Conhecimento (RAG) Nao Retorna Resultados

**Sintoma:** Agente IA responde sem contexto do knowledge base.

**Acao:**
1. Verificar `ai_knowledge_base` — existem documentos com `embedding IS NOT NULL`?
2. Se embeddings sao NULL: rodar `generate-embedding` para os documentos pendentes
3. Verificar se a OPENAI_API_KEY esta valida (usada para embeddings)
4. Testar diretamente: chamar `rag-search` com uma query de teste

---

## 7. VERSIONAMENTO DE EDGE FUNCTIONS

### 7.1 Limitacao do Supabase

Supabase Edge Functions **nao suportam versionamento nativo**. Cada deploy sobrescreve a versao ativa. Nao ha rollback automatico.

### 7.2 Estrategia Proposta — Roteamento por Flag

Para testar uma v2 sem desativar a v1:

```
supabase/functions/
  agent-executor/index.ts          ← v1 (ativa)
  agent-executor-v2/index.ts       ← v2 (em teste)
```

No chamador (ex: `process-incoming-message`):
```typescript
const useV2 = Deno.env.get('FF_AGENT_EXECUTOR_V2') === 'true'
const fnName = useV2 ? 'agent-executor-v2' : 'agent-executor'
await supabase.functions.invoke(fnName, { body: payload })
```

**Ciclo de vida:**
1. Criar `<function>-v2/index.ts` com as mudancas
2. Deploy v2 ao lado da v1
3. Ativar flag `FF_<FUNCTION>_V2=true` para testar
4. Validar com metricas/logs
5. Se ok: copiar v2 para o path original, remover v2, remover flag
6. Se nao ok: desativar flag, investigar

### 7.3 Rollback Manual

Sem versionamento nativo, o rollback depende do git:

```bash
# Ver versao anterior da function
git log --oneline supabase/functions/<nome>/index.ts

# Restaurar versao anterior
git checkout <commit-hash> -- supabase/functions/<nome>/index.ts

# Re-deploy
supabase functions deploy <nome> --project-ref pomueweeulenslxvsxar
```

**Recomendacao:** Sempre commitar antes de fazer deploy. Isso garante que o rollback via git e possivel.

---

## 8. PROXIMOS PASSOS

| # | Acao | Prioridade | Esforco |
|---|------|-----------|---------|
| 1 | Configurar secrets do GitHub para CI funcionar | P0 | 15min |
| 2 | Adotar `structured-logger.ts` nas 3 functions do pipeline critico | P0 | 2h |
| 3 | Propagar `request_id` entre functions (header x-request-id) | P1 | 3h |
| 4 | Adicionar deploy automatico de edge functions ao CI | P1 | 4h |
| 5 | Criar smoke test pos-deploy (health endpoint) | P2 | 2h |
| 6 | Migrar feature flags para tabela Supabase + UI | P2 | 4h |
| 7 | Adicionar notificacao (Slack/Discord) em falha de CI | P3 | 1h |
| 8 | Dashboard de logs (Supabase Logs Explorer ou Grafana) | P3 | 8h |

---

## 9. RESUMO

**O que foi entregue:**
- `.github/workflows/ci.yml` — Pipeline CI com lint, build, testes e check de Deno
- `_shared/structured-logger.ts` — Logger JSON estruturado com correlation ID
- Este relatorio com: diagnostico, estrategia de flags, runbook, versionamento

**Impacto imediato:**
- Todo push/PR agora passa por lint + build + testes (quando CI for ativado com secrets)
- Padrao de logging definido para adocao gradual nas edge functions
- Equipe tem runbook para os incidentes mais comuns

**Dependencias para ativar:**
- O repositorio precisa estar no GitHub com Actions habilitado
- Nenhum secret adicional necessario para o CI basico (lint/build/test)
- Para deploy automatico: configurar `SUPABASE_ACCESS_TOKEN` como secret
