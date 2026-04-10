# Squad de Especialistas — Sismais Helpdesk IA

**Data:** 2026-03-19
**Autor:** Claude (supervisionado por Marcio)
**Status:** Em aprovacao

---

## 1. Objetivo

Montar um time de 20 especialistas autonomos para analisar, estabilizar, evoluir e profissionalizar o sistema Sismais Helpdesk IA. O time trabalha com autonomia total, reportando resultados ao Marcio e pedindo aprovacao apenas para mudancas destrutivas.

## 2. Decisoes de Design

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| Estrutura do time | Squad por Missao | Cada especialista tem escopo claro e autonomia |
| Multi-canal | Canais paralelos | UAZAPI + WhatsApp Official + Instagram como canais independentes |
| Modelo de trabalho | Autonomia total com relatorio | Especialistas trabalham independentes, relatorio ao final |
| Prioridade | Estabilidade primeiro | Corrigir bugs criticos antes de features novas |
| Agentes IA | Repensar do zero | Reavaliar toda a estrutura de agentes |

## 3. Contexto do Sistema (Estado Atual)

### Problemas Criticos Identificados
1. **Pipeline desconectado** — Pipeline completo (orchestrator + agent-executor) nao e usado pelo webhook. O ativo (`ai-whatsapp-reply`) e simplificado
2. **Mensagens de midia sem resposta** — Transcricao funciona mas nao dispara resposta IA
3. **Debounce de 5s** — Pode perder mensagens em rajada
4. **Handler type travado** — Conversas escaladas para humano nunca voltam para IA
5. **Dois sistemas de automacao** — `ai_automations` e `flow_automations` podem conflitar
6. **Confidence scoring desconectado** — Existe no agent-executor mas nao no pipeline ativo

### Numeros Atuais
- 52 edge functions (Deno)
- 50+ paginas React
- 80+ migrations SQL
- 7 agentes IA configurados (LANA, LINO, MAX, KIRA, KITANA, AXEL, ORION)
- 1 canal ativo (WhatsApp via UAZAPI)

## 4. Squad Completa — 20 Especialistas

### 4.1 Lideranca Estrategica

#### E16: CTO (Chief Technology Officer)
- **Missao:** Visao tecnica de longo prazo, decisoes de arquitetura, roadmap tecnico
- **Responsabilidades:**
  - Supervisionar todos os especialistas tecnicos
  - Resolver conflitos de arquitetura entre frentes
  - Avaliar trade-offs tecnicos e escolher tecnologias
  - Definir padroes de codigo, API e infraestrutura
  - Sugerir melhorias tecnicas estrategicas
- **Entregaveis:** Roadmap tecnico, ADRs (Architecture Decision Records), parecer sobre propostas
- **Atua:** Antes (define padroes), durante (resolve bloqueios), depois (review tecnico) de cada fase

#### E17: CPO (Chief Product Officer)
- **Missao:** Visao de produto, features priorizadas por valor de negocio
- **Responsabilidades:**
  - Analisar concorrentes (Zendesk, Freshdesk, Intercom, Movidesk, Octadesk)
  - Propor features com alto valor para o cliente final
  - Priorizar backlog por impacto de negocio
  - Definir criterios de aceitacao de cada entrega
  - Identificar diferenciais competitivos do GMS
- **Entregaveis:** Backlog priorizado, analise competitiva, specs de features, criterios de aceitacao
- **Atua:** Antes (prioriza), durante (valida), depois (avalia impacto) de cada fase

### 4.2 Qualidade Transversal

#### E18: Engenheiro de Testes / QA Lead
- **Missao:** Garantia de qualidade em todas as entregas
- **Responsabilidades:**
  - Criar estrategia de testes (unitarios, integracao, e2e)
  - Implementar testes automatizados (Vitest para frontend, testes de edge functions)
  - Testes E2E com Playwright para fluxos criticos
  - Definir cobertura minima por modulo
  - Pipeline CI/CD de testes
  - Testar cada entrega antes de considerar concluida
- **Entregaveis:** Plano de testes, suite automatizada, relatorio de cobertura, bugs encontrados
- **Atua:** Apos cada entrega de qualquer especialista

#### E19: Engenheiro de Melhoria Continua
- **Missao:** Saude do codebase e reducao de debito tecnico
- **Responsabilidades:**
  - Code review de todas as entregas
  - Identificar codigo duplicado, padroes ruins, complexidade desnecessaria
  - Refatorar codigo legado quando impactar estabilidade
  - Performance profiling (frontend bundle, edge function latency)
  - Monitoramento de erros em producao
- **Entregaveis:** Code reviews, metricas de qualidade, refatoracoes, relatorio de debito tecnico
- **Atua:** Revisao continua do codigo de todos os especialistas

### 4.3 Fase 1: Estabilidade e Fundacao

#### E01: Arquiteto de Pipeline
- **Missao:** Reconectar e estabilizar o pipeline completo de mensagens
- **Skills:** `perf-messaging`, `supabase-realtime-engine`
- **Problemas a resolver:**
  1. Conectar webhook ao pipeline completo: `uazapi-webhook` → `process-incoming-message` → `orchestrator` → `agent-executor`
  2. Corrigir bug de midia: `transcribe-media` deve disparar resposta IA
  3. Reduzir debounce de 5s para 1-2s
  4. Implementar retorno automatico de handler humano → IA (com timeout configuravel)
  5. Garantir que confidence scoring funcione no pipeline ativo
- **Entregaveis:** Pipeline unificado funcionando, testes de fluxo completo, metricas de latencia

#### E02: Engenheiro de Infra Supabase
- **Missao:** Infraestrutura resiliente e performante
- **Skills:** `supabase-realtime-engine`, `senior-backend`
- **Responsabilidades:**
  1. Edge functions com retry, circuit breaker, timeout
  2. Revisar e otimizar RLS policies
  3. Database triggers para eventos criticos
  4. Connection pooling e otimizacao de queries
  5. Migrations seguras com rollback
- **Entregaveis:** Infra otimizada, metricas de performance, documentacao de patterns

#### E03: Analista de Seguranca
- **Missao:** Auditoria completa de seguranca e compliance
- **Skills:** `security-agent`, `ai-safety-guardrails`
- **Responsabilidades:**
  1. Auditoria de RLS policies em todas as tabelas
  2. Revisar CORS em todas as edge functions
  3. Verificar vazamento de PII em logs
  4. Implementar rate limiting em endpoints publicos
  5. Validacao de input em todas as edge functions
  6. Compliance LGPD (consentimento, exclusao de dados, portabilidade)
  7. Auditoria de secrets e variaveis de ambiente
  8. Hardening de autenticacao
- **Entregaveis:** Relatorio de vulnerabilidades, correcoes implementadas, checklist LGPD

### 4.4 Fase 2: Inteligencia e IA (Repensar do Zero)

#### E04: Estrategista de Agentes IA
- **Missao:** Reprojetar a arquitetura de agentes desde a fundacao
- **Skills:** `ai-agent-orchestrator`, `ai-safety-guardrails`
- **Escopo:** Dono da camada de **selecao e routing de agentes** — decide QUAL agente atende cada conversa
- **Responsabilidades:**
  1. Avaliar se os 7 agentes atuais fazem sentido ou precisam ser consolidados/expandidos
  2. Redesenhar o routing/orquestracao (LLM vs regras vs hibrido)
  3. Definir thresholds de confianca por tipo de agente
  4. Projetar handoff inteligente entre agentes
  5. Fallback chains e escalacao para humano
  6. Definir metricas de sucesso por agente
  7. Avaliar modelos LLM (custo vs qualidade por funcao)
- **Entregaveis:** Nova arquitetura de agentes documentada, matriz de decisao, plano de migracao

#### E05: Engenheiro de Prompts
- **Missao:** Prompts profissionais para todos os agentes
- **Skills:** `prompt-engineering-specialist`
- **Responsabilidades:**
  1. Reescrever system prompts de todos os agentes
  2. Definir personalidade e tom de voz por agente
  3. Criar few-shot examples para cada tipo de atendimento
  4. Guardrails de comportamento (o que o agente NAO deve fazer)
  5. Versionamento A/B de prompts
  6. Testes de qualidade de resposta
- **Entregaveis:** Biblioteca de prompts versionada, resultados de testes A/B, guia de estilo

#### E06: Engenheiro RAG/Knowledge
- **Missao:** Otimizar busca semantica e base de conhecimento
- **Skills:** `rag-knowledge-engineer`
- **Responsabilidades:**
  1. Revisar estrategia de chunking (tamanho, overlap)
  2. Avaliar modelo de embeddings (custo vs qualidade)
  3. Implementar re-ranking para melhorar relevancia
  4. Detectar informacao desatualizada automaticamente
  5. Pipeline de ingestao otimizado
  6. Metricas de qualidade de retrieval (precision, recall)
- **Entregaveis:** Pipeline RAG otimizado, metricas de qualidade, estrategia de atualizacao

#### E07: Arquiteto Conversacional
- **Missao:** Fluxos de conversa naturais e eficientes
- **Skills:** `conversation-flow-architect`
- **Escopo:** Dono da camada **intra-conversa** — define COMO o agente conduz o dialogo depois de selecionado pelo E04
- **Responsabilidades:**
  1. State machines de conversacao (estados, transicoes)
  2. Gestao de contexto entre mensagens
  3. Deteccao de intencao refinada
  4. Coleta de dados via conversa natural (sem formularios)
  5. Re-engagement automatico para conversas abandonadas
  6. Experiencia multi-canal consistente
- **Entregaveis:** Mapa de estados conversacionais, fluxos documentados, regras de re-engagement

#### E08: Especialista em Feedback Loop
- **Missao:** Sistema de aprendizado continuo para os agentes
- **Skills:** `ai-training-feedback-loop`
- **Responsabilidades:**
  1. Interface de aprovacao/rejeicao de respostas IA
  2. Captura de correcoes humanas como dados de treinamento
  3. Metricas de qualidade por agente (acertos, erros, escalacoes)
  4. Deteccao de padroes de erro recorrentes
  5. Sugestao automatica de novos docs para knowledge base
  6. Dashboard de evolucao dos agentes
- **Entregaveis:** Sistema de feedback funcionando, dashboard de qualidade, pipeline de melhoria

### 4.5 Fase 3: Multi-Canal e Integracoes

#### E09: Engenheiro Multi-Canal
- **Missao:** Integrar WhatsApp Official + Instagram como canais paralelos
- **Skills:** `uazapi-specialist`, `perf-messaging`
- **Responsabilidades:**
  1. Arquitetura agnostica de canal (channel adapter pattern)
  2. Integracao WhatsApp Business API (Meta Official)
  3. Integracao Instagram Messaging API
  4. Manter UAZAPI como canal existente
  5. Roteamento de mensagens unificado independente do canal
  6. Tratamento de particularidades de cada canal (templates do WhatsApp Official, stories do Instagram)
  7. Dashboard de canais com status e metricas
- **Entregaveis:** 3 canais funcionando, adaptador de canal reutilizavel, documentacao de cada integracao

#### E10: Arquiteto de API Publica
- **Missao:** API REST para terceiros integrarem com o Sismais
- **Skills:** `senior-backend`, `security-agent`
- **Responsabilidades:**
  1. Design da API publica (REST, versionada, /api/v1/)
  2. Autenticacao via API keys + OAuth2
  3. Rate limiting por cliente/plano
  4. Documentacao OpenAPI/Swagger auto-gerada
  5. SDKs basicos (JavaScript, Python)
  6. Webhooks de saida para eventos (novo ticket, mensagem, escalacao)
  7. Sandbox/ambiente de testes para integradores
  8. Monitoramento de uso por integrador
- **Endpoints iniciais sugeridos:**
  - `POST /api/v1/messages` — Enviar mensagem
  - `GET /api/v1/conversations` — Listar conversas
  - `GET /api/v1/conversations/:id` — Detalhe da conversa
  - `POST /api/v1/tickets` — Criar ticket
  - `GET /api/v1/tickets` — Listar tickets
  - `GET /api/v1/clients` — Listar clientes
  - `POST /api/v1/webhooks` — Registrar webhook
- **Entregaveis:** API funcionando, documentacao Swagger, SDK JS, sandbox de testes

#### E11: Arquiteto CRM 360
- **Missao:** Visao unificada do cliente em todos os canais e sistemas
- **Skills:** `crm-data-architect`
- **Responsabilidades:**
  1. Unificar dados: Sismais GL + Admin + Helpdesk + WhatsApp + Instagram
  2. Timeline unificada de interacoes (todos os canais)
  3. Scoring de cliente (engajamento, valor, risco de churn)
  4. Deteccao e merge de duplicatas
  5. Relacionamentos empresa → contatos → contratos
  6. Dados acessiveis para agentes IA em tempo real
- **Entregaveis:** Modelo de dados unificado, timeline funcionando, scoring implementado

### 4.6 Fase 4: UX/UI e Experiencia

#### E12: Especialista UX/UI Sismais
- **Missao:** Redesign profissional de toda a interface
- **Skills:** `ux-sismais`, `ux-expert-squad`, `ui-ux-pro-max`
- **Responsabilidades:**
  1. Auditar todas as 50+ telas por qualidade de UX
  2. Redesenhar fluxos de usuario para produtividade
  3. Aplicar padroes de WhatsApp, Gmail, ChatGPT, Slack
  4. Garantir identidade visual GMS (paleta, tipografia, componentes)
  5. Design responsivo (mobile-friendly)
  6. Acessibilidade WCAG AA
- **Entregaveis:** Auditoria UX completa, wireframes/mockups, guia de componentes atualizado

#### E13: Engenheiro Frontend Senior
- **Missao:** Implementar o redesign com performance
- **Skills:** `senior-frontend`, `frontend-design`
- **Responsabilidades:**
  1. Implementar componentes do redesign
  2. Otimizar bundle size e code splitting
  3. Performance profiling (LCP, FID, CLS)
  4. Componentizacao reutilizavel
  5. Acessibilidade tecnica (ARIA, foco, contraste)
- **Entregaveis:** Componentes implementados, metricas de performance, testes de acessibilidade

### 4.7 Fase 5: Analytics, Automacoes e Evolucao

#### E14: Especialista SLA/Analytics
- **Missao:** Dashboards executivos e metricas em tempo real
- **Skills:** `sla-analytics-specialist`
- **Responsabilidades:**
  1. Tracking de SLA por ticket/agente/fila
  2. KPIs de agentes IA (tempo de resposta, resolucao, satisfacao)
  3. Comparativo IA vs humano
  4. Dashboards executivos com Recharts
  5. Deteccao de anomalias
  6. Relatorios automaticos (diario, semanal)
  7. Previsao de demanda
- **Entregaveis:** Dashboards funcionando, alertas configurados, relatorios automaticos

#### E15: Engenheiro de Automacoes
- **Missao:** Motor de workflows robusto e extensivel
- **Skills:** `automation-workflow-engine`
- **Responsabilidades:**
  1. Unificar `ai_automations` e `flow_automations` em um unico motor
  2. Triggers configuraveis (mensagem, tempo, evento, webhook)
  3. Actions compostas (enviar msg, criar ticket, notificar, chamar API)
  4. Conditions com logica booleana
  5. Templates de workflows prontos
  6. Visual flow builder melhorado
- **Entregaveis:** Motor unificado, templates prontos, builder visual funcionando

### 4.8 Transversal: DevOps e Observabilidade

#### E20: Engenheiro DevOps / Observabilidade
- **Missao:** Deploy seguro, monitoramento e observabilidade do sistema em producao
- **Responsabilidades:**
  1. Pipeline CI/CD para edge functions e frontend
  2. Deploy automatizado com rollback seguro
  3. Monitoramento de saude das 52+ edge functions
  4. Alertas de erro, latencia e disponibilidade
  5. Logging estruturado e centralizado
  6. Observabilidade do pipeline de mensagens (tracing ponta a ponta)
  7. Gestao de secrets e variaveis de ambiente
  8. Estrategia de feature flags para deploys graduais
- **Entregaveis:** Pipeline CI/CD, dashboard de observabilidade, alertas configurados, runbook de incidentes
- **Atua:** Em todas as fases — todo deploy passa por ele

## 5. Modelo de Operacao

### Autonomia
- Cada especialista trabalha de forma **autonoma**
- Reporta resultados via **relatorio** ao Marcio
- Pede aprovacao **apenas** para:
  - Mudancas destrutivas (deletar tabelas, resetar dados)
  - Alteracoes de schema que afetem outros especialistas
  - Decisoes de arquitetura com impacto irreversivel

### Coordenacao
- **CTO** resolve conflitos tecnicos entre especialistas
- **CPO** prioriza quando ha competicao por recursos
- **QA Lead** valida cada entrega antes de merge
- **Melhoria Continua** revisa codigo continuamente

### Comunicacao
- Idioma: **Portugues brasileiro** (codigo em ingles)
- Relatorios: ao final de cada fase ou quando ha bloqueio
- Formato: diagnostico + acoes tomadas + resultados + proximos passos

## 6. Faseamento e Dependencias

```
FASE 1 (Estabilidade) ──────────────────────► FASE 3 (Multi-Canal)
  E01 Pipeline                                  E09 Canais
  E02 Infra                                     E10 API Publica
  E03 Seguranca                                 E11 CRM 360

FASE 2 (IA) ── analise inicia em paralelo ──► FASE 4 (UX/UI)
  E04 Estrategista (routing)                    E12 UX/UI
  E05 Prompts                                   E13 Frontend
  E06 RAG
  E07 Conversacional (dialogo)                FASE 5 (Analytics)
  E08 Feedback Loop                             E14 SLA
                                                E15 Automacoes

TRANSVERSAL (todas as fases):
  E16 CTO
  E17 CPO
  E18 QA Lead
  E19 Melhoria Continua
  E20 DevOps/Observabilidade
```

### Regras de dependencia
- Fase 3 so **implementa** apos Fase 1 estabilizar (mas pode **analisar** antes)
- Fase 4 so **implementa** apos Fase 2 definir novos agentes (para refletir na UI)
- Fase 5: E14 (SLA/Analytics) inicia **instrumentacao basica junto com Fase 1** para validar estabilizacao; dashboards completos apos Fases 1-3. E15 (Automacoes) implementa apos Fases 1-3
- Fases 1 e 2 iniciam **simultaneamente** (analise de IA nao depende de estabilidade)
- CTO, CPO, QA, Melhoria Continua e DevOps atuam **em todas as fases**

### Estrategia de rollback
- Toda mudanca critica usa **feature flags** (gerenciadas por E20)
- Fase 2 (repensar agentes) NAO desativa o pipeline atual ate nova arquitetura estar validada
- Novo pipeline roda em **shadow mode** (processa mas nao responde) antes de substituir o ativo
- Migrations com rollback script obrigatorio (E02)
- Edge functions com versionamento: v1 ativa, v2 em teste (E20)

## 7. Tecnologias e Padroes

### Stack confirmada
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: Supabase (PostgreSQL + RLS + Edge Functions Deno)
- IA: OpenRouter (Gemini Flash) + OpenAI (embeddings)
- WhatsApp: UAZAPI + Meta Business API + Instagram Messaging API
- Testes: Vitest (unit) + Playwright (e2e)

### Padroes de codigo
- Variaveis e funcoes em **ingles**
- Comentarios em **portugues**
- Componentes React funcionais com TypeScript
- React Query para estado servidor
- Toast via Sonner
- Icones via Lucide React
- Design system GMS (paleta oficial no CLAUDE.md)

### Git
- Branch: `claude/sismais-support-system-JCMCi`
- NUNCA push para main/master
- Commits descritivos em portugues

## 8. Criterios de Sucesso

| Fase | Criterio | Metrica |
|------|----------|---------|
| 1 | Pipeline 100% conectado | Mensagem WhatsApp → resposta IA em < 5s |
| 1 | Zero mensagens perdidas | 100% de mensagens (texto + midia) recebem resposta |
| 1 | Seguranca auditada | Zero vulnerabilidades criticas |
| 2 | Agentes repensados | Nova arquitetura documentada e aprovada pelo Marcio (CTO valida viabilidade tecnica) |
| 2 | Prompts profissionais | Score > 80% em rubrica de testes (clareza, tom, precisao, guardrails) avaliada por E08 + humano |
| 3 | 3 canais funcionando | WhatsApp UAZAPI + Official + Instagram |
| 3 | API publica documentada | Swagger + SDK + sandbox funcionando |
| 4 | Interface profissional | Todas as telas seguem design system GMS |
| 5 | Dashboards executivos | Metricas em tempo real funcionando |
