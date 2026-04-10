# E01 — Reconexao e Estabilizacao do Pipeline de Mensagens IA

**Data:** 2026-03-19
**Autor:** Arquiteto de Pipeline (Claude)
**Branch:** claude/sismais-support-system-JCMCi
**Status:** Implementado — aguardando deploy e ativacao de feature flags

---

## 1. DIAGNOSTICO

### 1.1 Pipeline Desconectado (CRITICO)
**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (linha ~1490)
**Problema:** O webhook chamava `ai-whatsapp-reply` diretamente, bypassing todo o pipeline inteligente (`process-incoming-message` -> `message-analyzer` -> `orchestrator` -> `agent-executor`).
**Impacto:** Orquestrador, RAG, confidence scoring, learning loop, multi-agente — tudo desconectado em producao.

### 1.2 Debounce Sincrono Bloqueante (CRITICO)
**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (linha ~1472)
**Problema:** `setTimeout` de 5s dentro do handler bloqueia a edge function. Com limite de ~26s no Supabase, sobram apenas ~21s para todo o processamento.
**Impacto:** Latencia de 5s em toda resposta + risco de timeout.

### 1.3 Midia sem Resposta IA (ALTO)
**Arquivo:** `supabase/functions/transcribe-media/index.ts` (linha ~251)
**Problema:** Apos transcricao, `transcribe-media` chamava `ai-whatsapp-reply` (pipeline simplificado) em vez de `process-incoming-message`.
**Impacto:** Mensagens de audio/imagem nao passavam pelo orchestrator/RAG.

### 1.4 Handler Type Travado (ALTO)
**Arquivo:** `supabase/functions/process-incoming-message/index.ts`
**Problema:** Quando `handler_type = 'human'`, a funcao simplesmente retornava `skipped: human_handler`. Sem mecanismo de timeout/retorno para IA.
**Impacto:** Conversas escaladas para humano ficavam travadas indefinidamente se nenhum humano atendesse.

### 1.5 Confidence Scoring Nao Utilizado (MEDIO)
**Arquivo:** `supabase/functions/process-incoming-message/index.ts`
**Problema:** O `agent-executor` retorna `confidence` mas o `process-incoming-message` nao logava nem usava para decisoes.
**Impacto:** Metricas de qualidade da IA invisíveis; escalacao automatica por confianca nao funcionava.

---

## 2. ACOES TOMADAS

### 2.1 Feature Flags Adicionadas
**Arquivo:** `supabase/functions/_shared/feature-flags.ts`

| Flag | Env Var | Default | Descricao |
|------|---------|---------|-----------|
| `SHADOW_PIPELINE` | `FF_SHADOW_PIPELINE` | `false` | Pipeline completo roda em paralelo sem enviar respostas |
| `NEW_PIPELINE` | `FF_NEW_PIPELINE` | `false` | Pipeline completo substitui ai-whatsapp-reply |
| `ASYNC_DEBOUNCE` | `FF_ASYNC_DEBOUNCE` | `false` | Debounce via DB em vez de setTimeout sincrono |
| `HUMAN_TIMEOUT_MINUTES` | `FF_HUMAN_TIMEOUT_MINUTES` | `0` | Timeout em minutos para reverter handler humano para IA |

### 2.2 Webhook Refatorado (uazapi-webhook/index.ts)
- **Shadow mode:** Quando `FF_SHADOW_PIPELINE=true`, o webhook envia mensagem para AMBOS os pipelines. O legado (ai-whatsapp-reply) continua enviando respostas ao cliente. O novo (process-incoming-message) processa sem enviar — apenas loga resultados.
- **Novo pipeline:** Quando `FF_NEW_PIPELINE=true`, o webhook chama `process-incoming-message` como pipeline principal. O `ai-whatsapp-reply` deixa de ser chamado.
- **Debounce assincrono:** Quando `FF_ASYNC_DEBOUNCE=true`, o webhook marca a mensagem no DB e agenda um `process-incoming-message` com delay de 3s via `setTimeout` + `fetch` fire-and-forget. O handler retorna imediatamente.
- **Debounce legado mantido:** Quando `FF_ASYNC_DEBOUNCE=false`, o comportamento antigo (5s sincrono) e preservado.

### 2.3 Transcribe-media Corrigido
- Quando `FF_NEW_PIPELINE=true`: apos transcricao, chama `process-incoming-message` com texto transcrito.
- Quando `FF_NEW_PIPELINE=false`: mantém comportamento legado (chama `ai-whatsapp-reply`).

### 2.4 Process-incoming-message Aprimorado
- **Shadow mode:** Recebe parametro `shadow_mode`. Quando ativo, executa todo o pipeline (analyzer -> orchestrator -> agent-executor) mas NAO envia mensagens via WhatsApp. Loga resultados em JSON estruturado para analise.
- **Debounce check:** Recebe parametro `debounce_check`. Verifica se ha mensagens mais novas na janela de 3s antes de processar.
- **Human timeout:** Quando `FF_HUMAN_TIMEOUT_MINUTES > 0`, verifica se a conversa esta em `handler_type='human'` sem resposta humana alem do timeout. Se sim, reverte para IA automaticamente.
- **Confidence logging:** Loga `confidence` retornada pelo agent-executor em JSON estruturado para metricas.

---

## 3. PLANO DE ATIVACAO (Rollout Progressivo)

### Fase 1: Shadow Mode (Semana 1)
```bash
supabase secrets set FF_SHADOW_PIPELINE=true
```
- Pipeline completo roda em paralelo
- ai-whatsapp-reply continua como pipeline principal
- Monitorar logs: `step=shadow_result` para validar confidence, latencia, agent selection
- Comparar resultados do shadow com respostas do ai-whatsapp-reply

### Fase 2: Human Timeout (Semana 1)
```bash
supabase secrets set FF_HUMAN_TIMEOUT_MINUTES=15
```
- Conversas escaladas para humano voltam para IA apos 15min sem resposta
- Monitorar: `step=human_timeout_revert` nos logs

### Fase 3: Debounce Assincrono (Semana 2)
```bash
supabase secrets set FF_ASYNC_DEBOUNCE=true
```
- Webhook retorna imediatamente
- Monitorar: tempo de resposta do webhook, `step=debounce_skip` nos logs

### Fase 4: Pipeline Completo (Semana 3)
```bash
supabase secrets set FF_NEW_PIPELINE=true
supabase secrets set FF_SHADOW_PIPELINE=false
```
- process-incoming-message assume como pipeline principal
- ai-whatsapp-reply desativado
- Monitorar: latencia end-to-end, confidence scores, taxa de escalacao

---

## 4. METRICAS DE LATENCIA (Estimativa)

| Etapa | Pipeline Legado | Pipeline Completo | Delta |
|-------|----------------|-------------------|-------|
| Debounce | 5000ms (sincrono) | 0ms (assincrono) | -5000ms |
| Webhook handler | ~200ms | ~200ms | 0 |
| Message Analyzer | N/A | ~800ms | +800ms |
| Orchestrator (bypass) | N/A | ~50ms | +50ms |
| Orchestrator (LLM) | N/A | ~1500ms | +1500ms |
| Agent Executor | ~3000ms | ~3000ms | 0 |
| WhatsApp send | ~500ms | ~500ms | 0 |
| **Total (continuacao)** | **~8700ms** | **~4550ms** | **-4150ms** |
| **Total (novo agente)** | **~8700ms** | **~6000ms** | **-2700ms** |

O ganho principal vem da eliminacao do debounce sincrono de 5s. O orchestrator bypass (para continuacoes de conversa) evita a chamada LLM extra.

---

## 5. PENDENCIAS

| # | Pendencia | Prioridade | Esforco |
|---|-----------|-----------|---------|
| P1 | Criar migration para `debounce_queue` table (se debounce via DB nao for suficiente com setTimeout) | Media | 2h |
| P2 | Extrair `sendTextViaWhatsApp` para `_shared/whatsapp-sender.ts` | Media | 2h |
| P3 | Refatorar webhook monolitico (2061 linhas) em modulos | Baixa | 8h |
| P4 | Adicionar correlation ID propagado por toda a cadeia | Media | 3h |
| P5 | Dashboard de metricas do pipeline (confidence, latencia, shadow vs prod) | Alta | 4h |
| P6 | Race condition em contadores (usar SQL atomico) | Media | 1h |
| P7 | Deprecar `ai-whatsapp-reply` apos validacao da Fase 4 | Baixa | 1h |

---

## 6. ARQUIVOS MODIFICADOS

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/_shared/feature-flags.ts` | +5 feature flags (SHADOW_PIPELINE, NEW_PIPELINE, ASYNC_DEBOUNCE, HUMAN_TIMEOUT_MINUTES, RAG_*) |
| `supabase/functions/uazapi-webhook/index.ts` | Pipeline gateado por FF, debounce assincrono, shadow mode |
| `supabase/functions/transcribe-media/index.ts` | Chama process-incoming-message quando FF_NEW_PIPELINE=true |
| `supabase/functions/process-incoming-message/index.ts` | Shadow mode, debounce check, human timeout, confidence logging |
| `docs/reports/E01-pipeline-report.md` | Este relatorio |
