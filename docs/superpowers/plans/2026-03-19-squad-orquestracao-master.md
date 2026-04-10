# Squad Sismais — Plano Mestre de Orquestracao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Despachar 20 especialistas autonomos para analisar, estabilizar, evoluir e profissionalizar o Sismais Helpdesk IA.

**Architecture:** Cada especialista e um subagente independente despachado com prompt especifico contendo: missao, contexto, arquivos relevantes, skills a invocar, formato de entrega. O plano mestre orquestra a ordem de despacho respeitando dependencias entre fases. Especialistas transversais (CTO, CPO, QA, DevOps, Melhoria Continua) sao despachados primeiro para definir padroes e depois re-invocados entre fases.

**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui | Supabase (PostgreSQL + RLS + Edge Functions Deno) | OpenRouter (Gemini Flash) + OpenAI (embeddings) | UAZAPI + Meta Business API + Instagram Messaging API | Vitest + Playwright

**Spec:** `docs/superpowers/specs/2026-03-19-squad-especialistas-design.md`

---

## Modelo de Despacho

Cada especialista recebe:
1. **Prompt de missao** com contexto completo do sistema
2. **Lista de arquivos** que deve analisar/modificar
3. **Skills** que deve invocar
4. **Formato de entrega** (relatorio em `docs/reports/`)
5. **Regras de autonomia** — trabalha sozinho, pede aprovacao apenas para mudancas destrutivas
6. **Regra de feature flags** — toda mudanca critica de codigo deve ser gateada por feature flag (coordenada com E20-DevOps). Isso se aplica a: E01, E02, E03, E06, E09, E10, E11, E14, E15

Cada especialista entrega:
1. **Relatorio** em `docs/reports/E{NN}-{nome}-report.md`
2. **Codigo** (se aplicavel) commitado na branch `claude/sismais-support-system-JCMCi`
3. **Lista de pendencias** ou bloqueios para o proximo especialista

---

## Onda 0: Fundacao (Transversais Estrategicos)

Despachar ANTES de qualquer especialista tecnico. Definem padroes e prioridades.

### Task 1: Despachar E16 — CTO (Analise Tecnica Inicial)

**Missao do subagente:**
> Voce e o CTO do Sismais Helpdesk IA. Analise o sistema completo e produza: (1) Roadmap tecnico com prioridades, (2) ADRs para decisoes de arquitetura pendentes, (3) Padroes tecnicos que todos os especialistas devem seguir, (4) Lista de debitos tecnicos criticos. Foque em: pipeline de mensagens desconectado, dois sistemas de automacao conflitantes, 52 edge functions sem padrao de resiliencia, seguranca de RLS. Analise TODOS os arquivos em supabase/functions/ e src/. Entregue relatorio em docs/reports/E16-cto-report.md.

**Skills:** Nenhuma especifica — analise geral
**Arquivos chave:** `supabase/functions/*/index.ts`, `src/pages/*.tsx`, `src/components/**/*.tsx`, `supabase/config.toml`
**Entrega:** `docs/reports/E16-cto-report.md`

- [ ] **Step 1: Criar diretorio de relatorios**
```bash
mkdir -p docs/reports
```

- [ ] **Step 2: Despachar subagente E16-CTO**
Despachar com `subagent_type: "general-purpose"`, prompt completo acima, sem isolation (precisa ver codebase real).

- [ ] **Step 3: Validar entrega do E16**
Ler `docs/reports/E16-cto-report.md` e verificar que contem: roadmap, ADRs, padroes, debitos tecnicos.

---

### Task 2: Despachar E17 — CPO (Analise de Produto Inicial)

**Missao do subagente:**
> Voce e o CPO do Sismais Helpdesk IA (produto GMS — Gestao Mais Simples). Analise o sistema como produto e produza: (1) Analise competitiva vs Zendesk, Freshdesk, Intercom, Movidesk, Octadesk, (2) Backlog priorizado de features por valor de negocio, (3) Diferenciais competitivos atuais e potenciais, (4) Criterios de aceitacao para cada fase do projeto. Analise todas as paginas em src/pages/ para entender funcionalidades existentes. Pesquise na web os concorrentes para comparacao real. Entregue relatorio em docs/reports/E17-cpo-report.md. Responda em portugues.

**Skills:** Nenhuma especifica — analise de produto + pesquisa web
**Arquivos chave:** `src/pages/*.tsx`, `src/components/**/*.tsx`, CLAUDE.md
**Entrega:** `docs/reports/E17-cpo-report.md`

- [ ] **Step 1: Despachar subagente E17-CPO**
Despachar com `subagent_type: "general-purpose"`, prompt completo acima.

- [ ] **Step 2: Validar entrega do E17**
Ler `docs/reports/E17-cpo-report.md` e verificar que contem: analise competitiva, backlog, diferenciais, criterios.

---

## Onda 1: Estabilidade + IA (Paralelo)

Despachar APOS Onda 0. Fase 1 e Fase 2 rodam em paralelo. E14 inicia instrumentacao basica junto.

### Task 3: Despachar E01 — Arquiteto de Pipeline

**Missao do subagente:**
> Voce e o Arquiteto de Pipeline do Sismais Helpdesk IA. Sua missao e reconectar e estabilizar o pipeline completo de mensagens. PROBLEMAS CRITICOS: (1) O webhook usa `ai-whatsapp-reply` simplificado em vez do pipeline completo (process-incoming-message → orchestrator → agent-executor), (2) Mensagens de midia (audio/imagem) sao transcritas mas NAO disparam resposta IA, (3) Debounce de 5s perde mensagens em rajada, (4) Handler type travado — conversas escaladas para humano nunca voltam para IA, (5) Confidence scoring existe no agent-executor mas nao e usado no pipeline ativo. REGRA CRITICA DE ROLLBACK: NAO desative o pipeline atual (ai-whatsapp-reply). O novo pipeline (process-incoming-message → orchestrator → agent-executor) deve rodar em SHADOW MODE primeiro — processa mensagens mas NAO envia respostas ao cliente. Somente apos validacao com metricas positivas, ative o novo pipeline e desative o antigo. Todas as mudancas criticas devem ser gateadas por FEATURE FLAGS (coordene com E20-DevOps em docs/reports/E20-devops-report.md). Use as skills `perf-messaging` e `supabase-realtime-engine`. Analise e corrija os arquivos: supabase/functions/uazapi-webhook/index.ts, supabase/functions/ai-whatsapp-reply/index.ts, supabase/functions/process-incoming-message/index.ts, supabase/functions/orchestrator/index.ts, supabase/functions/agent-executor/index.ts, supabase/functions/transcribe-media/index.ts. Entregue: (1) Codigo corrigido, (2) Relatorio em docs/reports/E01-pipeline-report.md com diagnostico, acoes tomadas, metricas de latencia. REGRAS: trabalhe autonomamente, peca aprovacao apenas para mudancas destrutivas. Commite na branch claude/sismais-support-system-JCMCi. Nunca push para main. Responda em portugues.

**Skills:** `perf-messaging`, `supabase-realtime-engine`
**Arquivos:** `supabase/functions/uazapi-webhook/index.ts`, `supabase/functions/ai-whatsapp-reply/index.ts`, `supabase/functions/process-incoming-message/index.ts`, `supabase/functions/orchestrator/index.ts`, `supabase/functions/agent-executor/index.ts`, `supabase/functions/transcribe-media/index.ts`, `supabase/functions/_shared/*.ts`
**Entrega:** Codigo corrigido + `docs/reports/E01-pipeline-report.md`

- [ ] **Step 1: Despachar subagente E01**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 4: Despachar E02 — Engenheiro de Infra Supabase

**Missao do subagente:**
> Voce e o Engenheiro de Infra Supabase do Sismais Helpdesk IA. Sua missao e tornar a infraestrutura resiliente e performante. RESPONSABILIDADES: (1) Adicionar retry, circuit breaker e timeout nas edge functions criticas, (2) Revisar e otimizar RLS policies de todas as tabelas, (3) Criar database triggers para eventos criticos (nova mensagem, escalacao, timeout de SLA), (4) Otimizar queries lentas e connection pooling, (5) Garantir que todas as migrations tenham rollback script. Use as skills `supabase-realtime-engine` e `senior-backend`. Analise: supabase/functions/*/index.ts (especialmente _shared/), supabase/migrations/, supabase/config.toml. Entregue: (1) Codigo otimizado, (2) Relatorio em docs/reports/E02-infra-report.md. REGRAS: trabalhe autonomamente, peca aprovacao apenas para mudancas destrutivas (ex: alterar schema). Commite na branch claude/sismais-support-system-JCMCi. Nunca push para main. Responda em portugues.

**Skills:** `supabase-realtime-engine`, `senior-backend`
**Entrega:** Codigo + `docs/reports/E02-infra-report.md`

- [ ] **Step 1: Despachar subagente E02**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 5: Despachar E03 — Analista de Seguranca

**Missao do subagente:**
> Voce e o Analista de Seguranca do Sismais Helpdesk IA. Sua missao e fazer auditoria completa de seguranca e compliance LGPD. RESPONSABILIDADES: (1) Auditar RLS policies em TODAS as tabelas (verificar se ha tabelas sem RLS), (2) Revisar CORS em todas as 52 edge functions, (3) Verificar vazamento de PII (dados pessoais) em logs e respostas, (4) Implementar rate limiting em endpoints publicos, (5) Validar input em todas as edge functions (SQL injection, XSS), (6) Checklist LGPD (consentimento, direito ao esquecimento, portabilidade), (7) Auditar secrets e variaveis de ambiente (verificar se algum segredo esta hardcoded), (8) Hardening de autenticacao. Use as skills `security-agent` e `ai-safety-guardrails`. Analise: supabase/functions/*/index.ts, supabase/migrations/*.sql, src/integrations/supabase/client.ts, src/contexts/AuthContext.tsx. Entregue: (1) Correcoes implementadas, (2) Relatorio em docs/reports/E03-seguranca-report.md com vulnerabilidades encontradas (severidade alta/media/baixa), correcoes aplicadas, pendencias. REGRAS: trabalhe autonomamente. Commite na branch claude/sismais-support-system-JCMCi. Nunca push para main. Responda em portugues.

**Skills:** `security-agent`, `ai-safety-guardrails`
**Entrega:** Correcoes + `docs/reports/E03-seguranca-report.md`

- [ ] **Step 1: Despachar subagente E03**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 6: Despachar E04 — Estrategista de Agentes IA

**Missao do subagente:**
> Voce e o Estrategista de Agentes IA do Sismais Helpdesk IA. Sua missao e REPENSAR DO ZERO a arquitetura de agentes. Voce e dono da camada de SELECAO E ROUTING — decide QUAL agente atende cada conversa. Agentes atuais: LANA (triage, prioridade 100), LINO (support, 80), MAX (support, 80), KIRA (financial, 75), KITANA (sales, 70), AXEL (copilot, 60), ORION (analytics, 50). RESPONSABILIDADES: (1) Avaliar se esses 7 agentes fazem sentido ou devem ser consolidados/expandidos, (2) Redesenhar routing (LLM vs regras vs hibrido), (3) Definir thresholds de confianca por tipo, (4) Projetar handoff entre agentes, (5) Fallback chains e escalacao, (6) Metricas de sucesso por agente, (7) Avaliar modelos LLM (custo vs qualidade). Use as skills `ai-agent-orchestrator` e `ai-safety-guardrails`. Analise: supabase/functions/orchestrator/index.ts, supabase/functions/agent-executor/index.ts, supabase/functions/ai-whatsapp-reply/index.ts, tabela ai_agents (via types.ts). NAO implemente ainda — entregue APENAS documentacao: docs/reports/E04-agentes-report.md com nova arquitetura proposta, matriz de decisao, plano de migracao. Responda em portugues.

**Skills:** `ai-agent-orchestrator`, `ai-safety-guardrails`
**Entrega:** `docs/reports/E04-agentes-report.md` (documentacao apenas — sem codigo nesta fase)

- [ ] **Step 1: Despachar subagente E04**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 7: Despachar E05 — Engenheiro de Prompts

**Missao do subagente:**
> Voce e o Engenheiro de Prompts do Sismais Helpdesk IA. Sua missao e criar prompts profissionais para todos os agentes IA. RESPONSABILIDADES: (1) Analisar os system prompts atuais de todos os agentes, (2) Reescrever com: personalidade definida, tom de voz, few-shot examples, guardrails do que NAO fazer, (3) Criar versionamento A/B, (4) Definir rubrica de qualidade (clareza, tom, precisao, guardrails), (5) Testar qualidade das respostas. Use a skill `prompt-engineering-specialist`. Analise: supabase/functions/agent-executor/index.ts (onde system_prompt e usado), supabase/functions/orchestrator/index.ts, tabela ai_agents (campo system_prompt). Entregue: docs/reports/E05-prompts-report.md com biblioteca de prompts proposta, guia de estilo, rubrica de avaliacao. Responda em portugues.

**Skills:** `prompt-engineering-specialist`
**Entrega:** `docs/reports/E05-prompts-report.md`

- [ ] **Step 1: Despachar subagente E05**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 8: Despachar E06 — Engenheiro RAG/Knowledge

**Missao do subagente:**
> Voce e o Engenheiro RAG/Knowledge do Sismais Helpdesk IA. Sua missao e otimizar a busca semantica e base de conhecimento. RESPONSABILIDADES: (1) Revisar estrategia de chunking atual (tamanho, overlap), (2) Avaliar modelo de embeddings (OpenAI text-embedding-3-small — custo vs qualidade vs alternativas), (3) Implementar re-ranking para melhorar relevancia, (4) Detectar informacao desatualizada automaticamente, (5) Otimizar pipeline de ingestao, (6) Metricas de retrieval (precision, recall). Use a skill `rag-knowledge-engineer`. Analise: supabase/functions/generate-embedding/index.ts, supabase/functions/rag-search/index.ts, supabase/functions/semantic-search/index.ts, supabase/functions/knowledge-ingestion/index.ts, supabase/functions/agent-executor/index.ts (onde RAG e consumido). Entregue: codigo otimizado + docs/reports/E06-rag-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `rag-knowledge-engineer`
**Entrega:** Codigo + `docs/reports/E06-rag-report.md`

- [ ] **Step 1: Despachar subagente E06**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 9: Despachar E07 — Arquiteto Conversacional

**Missao do subagente:**
> Voce e o Arquiteto Conversacional do Sismais Helpdesk IA. Voce e dono da camada INTRA-CONVERSA — define COMO o agente conduz o dialogo depois de selecionado pelo routing (E04). RESPONSABILIDADES: (1) Projetar state machines de conversacao (estados, transicoes), (2) Gestao de contexto entre mensagens, (3) Deteccao de intencao refinada, (4) Coleta de dados via conversa natural, (5) Re-engagement para conversas abandonadas, (6) Experiencia multi-canal consistente. Use a skill `conversation-flow-architect`. Analise: supabase/functions/agent-executor/index.ts, supabase/functions/message-analyzer/index.ts, supabase/functions/check-inactive-conversations/index.ts. Entregue: docs/reports/E07-conversacional-report.md com mapa de estados, fluxos, regras de re-engagement. Responda em portugues.

**Skills:** `conversation-flow-architect`
**Entrega:** `docs/reports/E07-conversacional-report.md`

- [ ] **Step 1: Despachar subagente E07**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 10: Despachar E08 — Especialista em Feedback Loop

**Missao do subagente:**
> Voce e o Especialista em Feedback Loop do Sismais Helpdesk IA. Sua missao e criar um sistema de aprendizado continuo para os agentes. RESPONSABILIDADES: (1) Projetar interface de aprovacao/rejeicao de respostas IA, (2) Captura de correcoes humanas como dados de treinamento, (3) Metricas de qualidade por agente (acertos, erros, escalacoes), (4) Deteccao de padroes de erro recorrentes, (5) Sugestao automatica de novos docs para knowledge base, (6) Dashboard de evolucao. Use a skill `ai-training-feedback-loop`. Analise: supabase/functions/learning-loop/index.ts, supabase/functions/evaluate-service/index.ts, src/components/conversation/, tabelas ai_messages e ai_knowledge_ratings. Entregue: docs/reports/E08-feedback-report.md com design do sistema, componentes necessarios, metricas. Responda em portugues.

**Skills:** `ai-training-feedback-loop`
**Entrega:** `docs/reports/E08-feedback-report.md`

- [ ] **Step 1: Despachar subagente E08**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 11: Despachar E14 — Instrumentacao Basica (Inicia com Fase 1)

**Missao do subagente:**
> Voce e o Especialista SLA/Analytics do Sismais Helpdesk IA. NESTA FASE INICIAL, sua missao e apenas instrumentacao basica para validar a estabilizacao do pipeline (Fase 1). NAO construa dashboards completos ainda. RESPONSABILIDADES INICIAIS: (1) Instrumentar o pipeline de mensagens com metricas de latencia (tempo webhook → resposta), (2) Contar mensagens processadas vs perdidas, (3) Medir taxa de erro por edge function, (4) Criar queries basicas para validar SLA (tempo de primeira resposta). Use a skill `sla-analytics-specialist`. Analise: supabase/functions/uazapi-webhook/index.ts, supabase/functions/ai-whatsapp-reply/index.ts, supabase/functions/sla-alert-check/index.ts. Entregue: instrumentacao implementada + docs/reports/E14-analytics-fase1-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `sla-analytics-specialist`
**Entrega:** Codigo + `docs/reports/E14-analytics-fase1-report.md`

- [ ] **Step 1: Despachar subagente E14**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 12: Despachar E20 — DevOps (Setup Inicial)

**Missao do subagente:**
> Voce e o Engenheiro DevOps do Sismais Helpdesk IA. NESTA FASE INICIAL, sua missao e estabelecer a fundacao de CI/CD e observabilidade. RESPONSABILIDADES: (1) Configurar pipeline CI/CD basico (lint + testes no push), (2) Setup de logging estruturado nas edge functions criticas, (3) Estrategia de feature flags (propor solucao simples sem dependencia externa), (4) Documentar processo de deploy atual e propor melhorias, (5) Criar runbook basico de incidentes. Analise: package.json, supabase/config.toml, supabase/functions/*/index.ts. Entregue: configuracao + docs/reports/E20-devops-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Entrega:** Configuracao + `docs/reports/E20-devops-report.md`

- [ ] **Step 1: Despachar subagente E20**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

## Checkpoint 1: Validacao da Onda 1

Antes de avancar para Onda 2, validar:

### Task 13: Review Cruzado da Onda 1

- [ ] **Step 1: Coletar todos os relatorios da Onda 1**
Ler todos os `docs/reports/E{NN}-*-report.md` gerados.

- [ ] **Step 2: Despachar E18 — QA Lead (Review)**
> Voce e o QA Lead do Sismais Helpdesk IA. Revise os relatorios e codigo produzidos por E01 (Pipeline), E02 (Infra), E03 (Seguranca), E06 (RAG), E14 (Instrumentacao) e E20 (DevOps). Verifique: (1) Codigo tem testes? (2) Mudancas seguem padroes do CLAUDE.md? (3) Ha conflitos entre mudancas de diferentes especialistas? (4) Alguma mudanca destrutiva nao autorizada? Entregue: docs/reports/E18-qa-onda1-report.md.

- [ ] **Step 3: Despachar E19 — Melhoria Continua (Review)**
> Voce e o Engenheiro de Melhoria Continua do Sismais Helpdesk IA. Faca code review do codigo produzido por E01, E02, E03, E06, E14 e E20. Verifique: (1) Codigo duplicado, (2) Padroes ruins, (3) Complexidade desnecessaria, (4) Performance, (5) Conformidade com padroes do CLAUDE.md. Entregue: docs/reports/E19-review-onda1-report.md.

- [ ] **Step 4: Apresentar relatorio consolidado ao Marcio**
Resumir: o que foi feito, o que funcionou, o que precisa de ajuste, se Onda 2 pode iniciar.

---

## Onda 2: Multi-Canal + API + CRM (Fase 3)

Despachar APOS validacao da Onda 1 (Fase 1 estabilizada).

### Task 14: Despachar E09 — Engenheiro Multi-Canal

**Missao do subagente:**
> Voce e o Engenheiro Multi-Canal do Sismais Helpdesk IA. Sua missao e integrar WhatsApp Official (Meta API) e Instagram como canais paralelos ao UAZAPI existente. RESPONSABILIDADES: (1) Projetar channel adapter pattern — abstrai canal para o pipeline processar de forma agnostica, (2) Integrar WhatsApp Business API (Meta Official) — webhook de entrada, envio via API, templates HSM, (3) Integrar Instagram Messaging API — DMs, Stories mentions, (4) Manter UAZAPI funcionando como canal existente, (5) Roteamento unificado independente de canal, (6) Dashboard de canais. Use as skills `uazapi-specialist` e `perf-messaging`. Analise: supabase/functions/uazapi-webhook/index.ts, supabase/functions/uazapi-proxy/index.ts, src/pages/WhatsAppInstances.tsx, src/components/whatsapp/. Entregue: codigo + docs/reports/E09-multicanal-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `uazapi-specialist`, `perf-messaging`
**Entrega:** Codigo + `docs/reports/E09-multicanal-report.md`

- [ ] **Step 1: Despachar subagente E09**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 15: Despachar E10 — Arquiteto de API Publica

**Missao do subagente:**
> Voce e o Arquiteto de API Publica do Sismais Helpdesk IA. Sua missao e projetar e implementar uma API REST publica para terceiros integrarem com o Sismais. RESPONSABILIDADES: (1) Design da API REST versionada (/api/v1/), (2) Autenticacao via API keys + OAuth2, (3) Rate limiting por cliente/plano, (4) Documentacao OpenAPI/Swagger auto-gerada, (5) SDK basico JavaScript, (6) Webhooks de saida (novo ticket, mensagem, escalacao), (7) Sandbox de testes, (8) Monitoramento de uso. ENDPOINTS INICIAIS: POST /api/v1/messages, GET /api/v1/conversations, GET /api/v1/conversations/:id, POST /api/v1/tickets, GET /api/v1/tickets, GET /api/v1/clients, POST /api/v1/webhooks. Use as skills `senior-backend` e `security-agent`. Implementar como edge functions em supabase/functions/. Entregue: codigo + docs/reports/E10-api-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `senior-backend`, `security-agent`
**Entrega:** Codigo + `docs/reports/E10-api-report.md`

- [ ] **Step 1: Despachar subagente E10**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 16: Despachar E11 — Arquiteto CRM 360

**Missao do subagente:**
> Voce e o Arquiteto CRM 360 do Sismais Helpdesk IA. Sua missao e criar uma visao unificada do cliente em todos os canais e sistemas. RESPONSABILIDADES: (1) Projetar modelo de dados unificado (Sismais GL + Admin + Helpdesk + WhatsApp + Instagram), (2) Timeline unificada de interacoes, (3) Scoring de cliente (engajamento, valor, risco de churn), (4) Deteccao e merge de duplicatas, (5) Relacionamentos empresa → contatos → contratos, (6) Dados acessiveis para agentes IA em tempo real. Use a skill `crm-data-architect`. Analise: supabase/functions/sismais-client-lookup/index.ts, supabase/functions/sismais-client-auto-link/index.ts, supabase/functions/customer-360/index.ts, supabase/functions/sync-sismais-admin-clients/index.ts, src/pages/ClientDetail.tsx, src/pages/Customer360.tsx. Entregue: modelo de dados + codigo + docs/reports/E11-crm360-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `crm-data-architect`
**Entrega:** Codigo + `docs/reports/E11-crm360-report.md`

- [ ] **Step 1: Despachar subagente E11**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

## Onda 3: UX/UI (Fase 4)

Despachar APOS Fase 2 definir novos agentes (E04 entrega aceita).

### Task 17: Despachar E12 — Especialista UX/UI Sismais

**Missao do subagente:**
> Voce e o Especialista UX/UI do Sismais Helpdesk IA (produto GMS — Gestao Mais Simples). Sua missao e auditar e redesenhar toda a interface para nivel profissional. RESPONSABILIDADES: (1) Auditar TODAS as 50+ telas por qualidade de UX, (2) Redesenhar fluxos de usuario para produtividade, (3) Aplicar melhores padroes de WhatsApp, Gmail, ChatGPT, Slack, (4) Garantir identidade visual GMS (paleta navy #10293F, cyan #45E5E5, yellow #FFB800), (5) Design responsivo, (6) Acessibilidade WCAG AA. Use as skills `ux-sismais`, `ux-expert-squad` e `ui-ux-pro-max`. Analise TODAS as paginas em src/pages/ e componentes em src/components/. Entregue: docs/reports/E12-ux-report.md com auditoria completa (tela por tela), wireframes/mockups propostos, guia de componentes atualizado. Responda em portugues.

**Skills:** `ux-sismais`, `ux-expert-squad`, `ui-ux-pro-max`
**Entrega:** `docs/reports/E12-ux-report.md`

- [ ] **Step 1: Despachar subagente E12**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 18: Despachar E13 — Engenheiro Frontend Senior

**Missao do subagente:**
> Voce e o Engenheiro Frontend Senior do Sismais Helpdesk IA. Sua missao e implementar o redesign UX/UI com performance. IMPORTANTE: leia primeiro o relatorio do E12 em docs/reports/E12-ux-report.md para saber o que implementar. RESPONSABILIDADES: (1) Implementar componentes do redesign, (2) Otimizar bundle size e code splitting, (3) Performance profiling (LCP, FID, CLS), (4) Componentizacao reutilizavel, (5) Acessibilidade tecnica (ARIA, foco, contraste). Use as skills `senior-frontend` e `frontend-design`. Siga obrigatoriamente o design system GMS do CLAUDE.md. Entregue: codigo implementado + docs/reports/E13-frontend-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `senior-frontend`, `frontend-design`
**Entrega:** Codigo + `docs/reports/E13-frontend-report.md`
**Dependencia:** Requer `docs/reports/E12-ux-report.md`

- [ ] **Step 1: Verificar que E12 entregou**
Ler `docs/reports/E12-ux-report.md`.

- [ ] **Step 2: Despachar subagente E13**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

## Onda 4: Analytics + Automacoes (Fase 5)

Despachar APOS Ondas 1-2 (dados reais disponiveis).

### Task 19: Despachar E14 — Dashboards Completos (Fase 5)

**Missao do subagente:**
> Voce e o Especialista SLA/Analytics do Sismais Helpdesk IA. Na Fase 1 voce fez instrumentacao basica. Agora sua missao e construir dashboards executivos completos. Leia seu relatorio anterior em docs/reports/E14-analytics-fase1-report.md. RESPONSABILIDADES: (1) Tracking completo de SLA por ticket/agente/fila, (2) KPIs de agentes IA (tempo de resposta, resolucao, satisfacao), (3) Comparativo IA vs humano, (4) Dashboards executivos com Recharts, (5) Deteccao de anomalias, (6) Relatorios automaticos (diario, semanal), (7) Previsao de demanda. Use a skill `sla-analytics-specialist`. Entregue: codigo + docs/reports/E14-analytics-fase5-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `sla-analytics-specialist`
**Entrega:** Codigo + `docs/reports/E14-analytics-fase5-report.md`

- [ ] **Step 1: Despachar subagente E14-v2**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

### Task 20: Despachar E15 — Engenheiro de Automacoes

**Missao do subagente:**
> Voce e o Engenheiro de Automacoes do Sismais Helpdesk IA. Sua missao e unificar e fortalecer o motor de workflows. PROBLEMA: existem dois sistemas conflitantes — `ai_automations` e `flow_automations`. RESPONSABILIDADES: (1) Unificar em um unico motor, (2) Triggers configuraveis (mensagem, tempo, evento, webhook), (3) Actions compostas (enviar msg, criar ticket, notificar, chamar API), (4) Conditions com logica booleana, (5) Templates de workflows prontos, (6) Melhorar visual flow builder. Use a skill `automation-workflow-engine`. Analise: supabase/functions/automation-executor/index.ts, supabase/functions/flow-executor/index.ts, supabase/functions/flow-engine/index.ts, src/pages/Automations.tsx, src/pages/FlowBuilder.tsx, src/components/automations/, src/components/flow-builder/. Entregue: codigo + docs/reports/E15-automacoes-report.md. Commite na branch claude/sismais-support-system-JCMCi. Responda em portugues.

**Skills:** `automation-workflow-engine`
**Entrega:** Codigo + `docs/reports/E15-automacoes-report.md`

- [ ] **Step 1: Despachar subagente E15**
Despachar com `subagent_type: "general-purpose"`, prompt acima. Usar `run_in_background: true`.

---

## Checkpoint Final: Consolidacao

### Task 21: Review Final Completo

- [ ] **Step 1: Despachar E18 — QA Final**
Review de todo o codigo produzido por todos os especialistas.

- [ ] **Step 2: Despachar E19 — Review Final de Qualidade**
Code review consolidado de todas as mudancas.

- [ ] **Step 3: Despachar E16 — CTO Review Final**
Validar que arquitetura final esta coerente.

- [ ] **Step 4: Despachar E17 — CPO Review Final**
Validar que features entregues atendem criterios de produto.

- [ ] **Step 5: Relatorio Final ao Marcio**
Consolidar todos os relatorios em um resumo executivo: o que foi feito, metricas, pendencias, proximos passos.
