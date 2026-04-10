# Sismais Corp — Empresa Virtual de Agentes (OpenSquad)

## Resumo

Migrar a squad de 20 especialistas do Sismais Helpdesk para o modelo OpenSquad, organizando-os como uma empresa virtual com departamentos (squads), pipelines automáticos e integração híbrida com as skills existentes do Claude Code.

## Modelo

**Híbrido:** OpenSquad para orquestração e pipelines + skills Claude Code como engine de cada agente.

Cada agente no OpenSquad delega para a skill correspondente do Claude Code, mantendo toda a profundidade e contexto que as skills já possuem.

## Mapeamento E01-E20 → OpenSquad

| ID | Especialista Original | Agente OpenSquad | Squad | Skills |
|---|---|---|---|---|
| E01 | Arquiteto de Pipeline | Workflow Architect | squad-qualidade | `workflow-architect` |
| E02 | Infra Supabase | Supabase Engine | squad-infra | `supabase-realtime-engine` |
| E03 | Segurança | Security Agent | squad-infra | `security-agent` |
| E04 | Estrategista de Agentes | Orquestrador IA | squad-ia | `ai-agent-orchestrator` |
| E05 | Prompt Engineer | Prompt Engineer | squad-ia | `prompt-engineering-specialist` |
| E06 | RAG Engineer | RAG Engineer | squad-ia | `rag-knowledge-engineer` |
| E07 | Conversation Architect | Conversation Architect | squad-ia | `conversation-flow-architect` |
| E08 | AI Safety | AI Safety | squad-ia | `ai-safety-guardrails` |
| E09 | Engenheiro Multi-Canal | Multi-Channel Engineer | squad-infra | `uazapi-specialist`, `perf-messaging` |
| E10 | Arquiteto de API | API Architect | squad-infra | `senior-backend`, `security-agent` |
| E11 | CRM Architect | CRM Architect | squad-produto | `crm-data-architect` |
| E12 | Automation Engine | Automation Engine | squad-produto | `automation-workflow-engine` |
| E13 | Feedback Loop | Feedback Loop | squad-ia | `ai-training-feedback-loop` |
| E14 | SLA Analytics | SLA Analytics | squad-produto | `sla-analytics-specialist` |
| E15 | Product Manager (CPO) | Product Manager | squad-produto | `product-manager` |
| E16 | CTO | CTO | squad-lideranca | `software-architect`, `agents-orchestrator` |
| E17 | DB Optimizer | DB Optimizer | squad-infra | `database-optimizer` |
| E18 | QA Lead | QA Lead | squad-qualidade | `evidence-collector`, `reality-checker` |
| E19 | UX Expert + Sismais | UX Expert + UX Sismais | squad-ux | `ux-expert-squad`, `ux-sismais` |
| E20 | DevOps | DevOps Engineer | squad-infra | `senior-backend` |

## Estrutura Organizacional

```
Sismais Corp
├── squad-lideranca (1 agente)
│   └── CTO                     → skills: software-architect, agents-orchestrator
│
├── squad-ia (6 agentes)
│   ├── Orquestrador IA          → skill: ai-agent-orchestrator
│   ├── Prompt Engineer          → skill: prompt-engineering-specialist
│   ├── RAG Engineer             → skill: rag-knowledge-engineer
│   ├── Conversation Architect   → skill: conversation-flow-architect
│   ├── AI Safety                → skill: ai-safety-guardrails
│   └── Feedback Loop            → skill: ai-training-feedback-loop
│
├── squad-infra (7 agentes)
│   ├── Supabase Engine          → skill: supabase-realtime-engine
│   ├── Security Agent           → skill: security-agent
│   ├── DB Optimizer             → skill: database-optimizer
│   ├── UAZAPI Specialist        → skill: uazapi-specialist
│   ├── Multi-Channel Engineer   → skills: uazapi-specialist, perf-messaging
│   ├── API Architect            → skills: senior-backend, security-agent
│   └── DevOps Engineer          → skill: senior-backend
│
├── squad-produto (4 agentes)
│   ├── Product Manager (CPO)    → skill: product-manager
│   ├── SLA Analytics            → skill: sla-analytics-specialist
│   ├── CRM Architect            → skill: crm-data-architect
│   └── Automation Engine        → skill: automation-workflow-engine
│
├── squad-ux (3 agentes)
│   ├── UX Expert                → skill: ux-expert-squad
│   ├── UX Sismais               → skill: ux-sismais
│   └── Senior Frontend          → skill: senior-frontend
│
└── squad-qualidade (3 agentes)
    ├── Code Reviewer            → skill: code-reviewer
    ├── QA Lead                  → skills: evidence-collector, reality-checker
    └── Workflow Architect       → skill: workflow-architect
```

**Total: 24 agentes em 6 squads** (5 agentes adicionados: CTO, Multi-Channel, API Architect, QA Lead, DevOps)

## Pipelines Pré-configurados

### 1. `nova-tela`
Pipeline para criar novas telas/componentes UI.

```yaml
steps:
  - agent: UX Expert
    action: Auditar referências e propor wireframe
    checkpoint: true
  - agent: UX Sismais
    action: Aplicar design system GMS e gerar código
  - agent: Senior Frontend
    action: Implementar componente React com TypeScript
  - agent: Code Reviewer
    action: Revisar código final
    checkpoint: true
```

### 2. `nova-feature`
Pipeline para features completas (backend + frontend).

```yaml
steps:
  - agent: Product Manager
    action: Definir escopo, acceptance criteria e prioridade
    checkpoint: true
  - agent: Workflow Architect
    action: Mapear fluxos, failure modes e contratos
  - agent: Supabase Engine
    action: Criar migrations, RLS, edge functions
  - agent: Senior Frontend
    action: Implementar UI
  - agent: Security Agent
    action: Auditar segurança (RLS, CORS, input validation)
  - agent: Code Reviewer
    action: Revisão final
    checkpoint: true
```

### 3. `melhoria-ia`
Pipeline para evoluir agentes IA do helpdesk.

```yaml
steps:
  - agent: Prompt Engineer
    action: Ajustar system prompts, few-shot examples, tom de voz
  - agent: RAG Engineer
    action: Otimizar chunking, embeddings, re-ranking
  - agent: AI Safety
    action: Validar guardrails, filtros, compliance LGPD
  - agent: Feedback Loop
    action: Configurar métricas e loops de melhoria contínua
    checkpoint: true
```

### 4. `fix-bug`
Pipeline para correção de bugs.

```yaml
steps:
  - agent: Workflow Architect
    action: Investigar root cause, mapear impacto
  - agent: (dinâmico)
    action: Especialista corrige conforme área afetada
    note: Supabase Engine para DB, Senior Frontend para UI, UAZAPI para WhatsApp
  - agent: QA Lead
    action: Validar correção com evidências
  - agent: Code Reviewer
    action: Revisão final
    checkpoint: true
```

### 5. `auditoria-seguranca`
Pipeline para auditoria de segurança completa.

```yaml
steps:
  - agent: Security Agent
    action: Scan de vulnerabilidades, RLS, CORS, auth
  - agent: API Architect
    action: Validar endpoints públicos, rate limiting
  - agent: AI Safety
    action: Verificar vazamento de PII, compliance LGPD
  - agent: QA Lead
    action: Coletar evidências e gerar relatório
    checkpoint: true
```

### 6. `deploy`
Pipeline para deploy e observabilidade.

```yaml
steps:
  - agent: DevOps Engineer
    action: Build, lint, validar edge functions
  - agent: QA Lead
    action: Smoke tests e validação
  - agent: Security Agent
    action: Checklist de segurança pré-deploy
    checkpoint: true
  - agent: DevOps Engineer
    action: Deploy edge functions via Supabase CLI
    checkpoint: true
```

### 7. `analytics-report`
Pipeline para relatórios e métricas.

```yaml
steps:
  - agent: SLA Analytics
    action: Coletar KPIs, gerar dashboards
  - agent: CRM Architect
    action: Enriquecer dados com contexto CRM 360
  - agent: Product Manager
    action: Interpretar métricas e recomendar ações
    checkpoint: true
```

## Tier Assignment

| Agente | Tier | Justificativa |
|---|---|---|
| CTO | powerful | Decisões arquiteturais complexas |
| Product Manager | powerful | Escopo e priorização |
| Prompt Engineer | powerful | Qualidade de prompts é crítica |
| Orquestrador IA | powerful | Roteamento inteligente |
| RAG Engineer | powerful | Otimização de relevância |
| UX Expert | powerful | Auditoria UX profunda |
| UX Sismais | powerful | Código production-ready |
| Senior Frontend | powerful | Implementação complexa |
| Code Reviewer | powerful | Revisão de qualidade |
| Security Agent | powerful | Segurança não pode falhar |
| Supabase Engine | powerful | Migrations e RLS críticos |
| API Architect | powerful | Design de API pública |
| Conversation Architect | fast | Mapeamento de fluxos |
| AI Safety | fast | Validações com checklist |
| Feedback Loop | fast | Coleta de métricas |
| DB Optimizer | fast | Análise de queries |
| UAZAPI Specialist | fast | Integração com padrões conhecidos |
| Multi-Channel Engineer | fast | Configuração de adapters |
| Automation Engine | fast | Configuração de workflows |
| SLA Analytics | fast | Queries e agregações |
| CRM Architect | fast | Mapeamento de dados |
| QA Lead | fast | Coleta de evidências |
| Workflow Architect | fast | Mapeamento de fluxos |
| DevOps Engineer | fast | Build e deploy automatizado |

## Integração Híbrida

### Como funciona

1. Usuário executa `/opensquad run squad-ia` ou pede "melhora o agente de suporte"
2. OpenSquad Runner lê o `squad.yaml` e identifica o pipeline
3. Para cada step, o Runner invoca o agente
4. O agente lê seu `.md` e aciona a skill correspondente do Claude Code
5. A skill executa com toda sua profundidade (prompts, guardrails, padrões)
6. Output é salvo em `squads/{name}/output/`
7. Em checkpoints, o usuário aprova antes de continuar

### Tratamento de erros

- **Falha em step:** Pipeline pausa, exibe erro, oferece opções: retry, skip, abort
- **Falha em skill:** Agente reporta erro com contexto, usuário decide próximo passo
- **Timeout:** Steps têm timeout de 10min (configurável), checkpoint automático se exceder

### Estado do pipeline

- Progresso salvo em `squads/{name}/output/{run-id}/state.json`
- Cada step gera output em `squads/{name}/output/{run-id}/step-{n}.md`
- Pipeline pode ser retomado de onde parou após interrupção

### Paralelismo

Steps dentro de um pipeline são sequenciais por padrão. Para paralelismo:
- Squads diferentes podem rodar em paralelo (ex: squad-infra + squad-ux)
- Steps marcados com `parallel: true` no YAML rodam simultaneamente via subagents

### Coordenação cross-squad

Pipelines como `nova-feature` envolvem agentes de múltiplos squads. O CTO atua como orquestrador cross-squad, delegando para os squads corretos e consolidando outputs.

## Arquivos a Criar

### Estrutura de diretórios

```
squads/
├── squad-lideranca/
│   ├── squad.yaml
│   ├── agents/
│   │   └── cto.md
│   └── output/
├── squad-ia/
│   ├── squad.yaml
│   ├── agents/
│   │   ├── orquestrador-ia.md
│   │   ├── prompt-engineer.md
│   │   ├── rag-engineer.md
│   │   ├── conversation-architect.md
│   │   ├── ai-safety.md
│   │   └── feedback-loop.md
│   └── output/
├── squad-infra/
│   ├── squad.yaml
│   ├── agents/
│   │   ├── supabase-engine.md
│   │   ├── security-agent.md
│   │   ├── db-optimizer.md
│   │   ├── uazapi-specialist.md
│   │   ├── multi-channel-engineer.md
│   │   ├── api-architect.md
│   │   └── devops-engineer.md
│   └── output/
├── squad-produto/
│   ├── squad.yaml
│   ├── agents/
│   │   ├── product-manager.md
│   │   ├── sla-analytics.md
│   │   ├── crm-architect.md
│   │   └── automation-engine.md
│   └── output/
├── squad-ux/
│   ├── squad.yaml
│   ├── agents/
│   │   ├── ux-expert.md
│   │   ├── ux-sismais.md
│   │   └── senior-frontend.md
│   └── output/
└── squad-qualidade/
    ├── squad.yaml
    ├── agents/
    │   ├── code-reviewer.md
    │   ├── qa-lead.md
    │   └── workflow-architect.md
    └── output/
```

### Formato `squad.yaml`

```yaml
name: Squad IA
code: squad-ia
description: Departamento de Inteligência Artificial — prompts, RAG, orquestração, segurança e feedback
icon: 🤖

agents:
  - name: Orquestrador IA
    file: agents/orquestrador-ia.md
    skill: ai-agent-orchestrator
    tier: powerful
    emoji: 🎯

  - name: Prompt Engineer
    file: agents/prompt-engineer.md
    skill: prompt-engineering-specialist
    tier: powerful
    emoji: ✍️

  - name: RAG Engineer
    file: agents/rag-engineer.md
    skill: rag-knowledge-engineer
    tier: powerful
    emoji: 📚

  - name: Conversation Architect
    file: agents/conversation-architect.md
    skill: conversation-flow-architect
    tier: fast
    emoji: 💬

  - name: AI Safety
    file: agents/ai-safety.md
    skill: ai-safety-guardrails
    tier: fast
    emoji: 🛡️

  - name: Feedback Loop
    file: agents/feedback-loop.md
    skill: ai-training-feedback-loop
    tier: fast
    emoji: 🔄

pipelines:
  melhoria-ia:
    description: Evoluir agentes IA do helpdesk
    steps:
      - agent: Prompt Engineer
        action: Ajustar system prompts e few-shot examples
      - agent: RAG Engineer
        action: Otimizar chunking, embeddings e re-ranking
      - agent: AI Safety
        action: Validar guardrails e compliance LGPD
      - agent: Feedback Loop
        action: Configurar métricas de melhoria contínua
        checkpoint: true
```

### Formato `agents/*.md`

```markdown
# Prompt Engineer

## Role
Especialista em engenharia de prompts e personalidades de agentes IA.

## Skill
prompt-engineering-specialist

## Tier
powerful

## Instructions
Ao ser acionado, invocar a skill `prompt-engineering-specialist` do Claude Code.
Seguir os padrões definidos na skill para criação de system prompts estruturados,
few-shot examples, guardrails de comportamento e tom de voz configurável.

## Context
- Projeto: Sismais Helpdesk AI-First
- Stack: OpenRouter (Gemini 2.0 Flash) + OpenAI (embeddings)
- Tabela de agentes: ai_agents (system_prompt, model, tools)
```

## Pré-requisitos

1. `npx opensquad init` no projeto
2. Criar estrutura de diretórios `squads/`
3. Escrever 24 arquivos de agente `.md`
4. Escrever 6 arquivos `squad.yaml`
5. Configurar `_opensquad/config.yaml` com tiers
6. Testar cada pipeline individualmente

## Fora de Escopo

- Não altera as skills existentes do Claude Code
- Não substitui o `/agents-orchestrator` atual — coexistem
- Não inclui dashboard visual (pode ser adicionado depois com `/opensquad dashboard`)
- Não inclui skills de publicação (Instagram, LinkedIn, etc.)
