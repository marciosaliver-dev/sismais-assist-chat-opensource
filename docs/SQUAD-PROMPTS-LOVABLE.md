# Squad de Especialistas — Sismais AI Helpdesk & CRM
## Prompts para Lovable | AI-First Development

> **Filosofia:** O sistema é AI-FIRST. A IA faz 90% do trabalho. O humano supervisiona, aprova e intervém em exceções. Cada módulo deve ter automação nativa e inteligência embutida.

---

## Visão da Arquitetura AI-First

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE IA CENTRAL                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Triagem  │ │ Suporte  │ │ Vendas   │ │  Financeiro  │    │
│  │  Agent   │ │  Agent   │ │  Agent   │ │    Agent     │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘    │
│       │            │            │               │            │
│  ┌────▼────────────▼────────────▼───────────────▼───────┐    │
│  │              ORQUESTRADOR INTELIGENTE                 │    │
│  │   (Classifica, Roteia, Escala, Aprende)               │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐    │
│  │           MOTOR DE AUTOMAÇÕES + FLOWS                 │    │
│  │  (Triggers → Condições → Ações → Feedback Loop)       │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Copilot  │ │Analytics │ │   RAG    │ │  Learning    │    │
│  │  Agent   │ │  Agent   │ │  Engine  │ │    Loop      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
           │                    │                   │
    ┌──────▼──────┐    ┌───────▼───────┐   ┌───────▼───────┐
    │  WhatsApp   │    │   CRM/CS      │   │  Integrações  │
    │  UAZAPI     │    │   Pipeline    │   │  Externas     │
    └─────────────┘    └───────────────┘   └───────────────┘
```

---

## SQUAD DE ESPECIALISTAS

### 1. Arquiteto de CRM & Pipeline (Inspirado: Salesforce + HubSpot + Pipedrive)
### 2. Especialista em Customer Success (Inspirado: Gainsight + Totango + ChurnZero)
### 3. Engenheiro de Helpdesk & Ticketing (Inspirado: Zendesk + Freshdesk + Intercom)
### 4. Arquiteto de IA & Automações (Inspirado: ChatGPT Enterprise + Drift + Ada)
### 5. Designer de UX/UI (Inspirado: Linear + Notion + HubSpot)
### 6. Engenheiro de Integrações & Dados (Inspirado: Segment + Zapier + n8n)

---

## PROMPTS PARA LOVABLE

---

### PROMPT 1 — CRM Pipeline Completo (Funil de Vendas AI-First)

```
Crie um módulo completo de CRM Pipeline para o sistema Sismais AI. O sistema usa React 18 + TypeScript + Vite, TailwindCSS + shadcn/ui, Supabase como backend, e React Query v5.

CONTEXTO DO PROJETO:
- Já existe: sistema de agentes IA, inbox WhatsApp, Kanban de tickets, clientes
- Stack: React 18, TypeScript, TailwindCSS, shadcn/ui, Supabase, React Query v5
- Supabase client: import { supabase } from '@/integrations/supabase/client'
- Toast: import { toast } from 'sonner'
- Ícones: lucide-react
- CSS helper: cn() de @/lib/utils

FILOSOFIA AI-FIRST:
A IA deve fazer o máximo do trabalho. O humano apenas supervisiona e aprova.

REQUISITOS DO CRM PIPELINE:

1. **Página /crm/pipeline** — Visão Kanban do funil de vendas
   - Colunas configuráveis: Prospecting → Qualification → Proposal → Negotiation → Closed Won → Closed Lost
   - Cards de deals com: nome do contato, empresa, valor, probabilidade %, próximo passo, agente IA responsável
   - Drag-and-drop entre estágios (já temos @dnd-kit instalado)
   - Ao mover um deal, a IA automaticamente sugere a próxima ação
   - Filtros: por valor, por agente, por data, por probabilidade
   - Barra de resumo no topo: total pipeline, weighted pipeline, deals this month, win rate

2. **Página /crm/deals/:id** — Detalhe do Deal
   - Timeline de atividades (calls, emails, WhatsApp, meetings, notas)
   - Painel lateral: info do contato, empresa, histórico de compras
   - IA Insights Panel:
     - Score de probabilidade de fechamento (calculado pela IA)
     - Sugestão de próxima ação
     - Análise de sentimento das últimas interações
     - Deals similares que fecharam (pattern matching)
   - Botão "Ask AI" que permite perguntar qualquer coisa sobre o deal
   - Seção de stakeholders (decision makers, influencers, champions)

3. **Página /crm/contacts** — Gestão de Contatos
   - Lista de contatos com busca, filtros, tags
   - Enriquecimento automático via IA (busca dados públicos)
   - Score de engajamento (baseado em interações WhatsApp + email)
   - Merge de contatos duplicados (sugestão automática da IA)
   - Timeline de todas as interações por contato

4. **Página /crm/companies** — Gestão de Empresas
   - Hierarquia: empresa pai → subsidiárias
   - Health score por empresa (calculado automaticamente)
   - Receita total, contratos ativos, tickets abertos
   - Mapa de stakeholders

5. **Componentes AI-First necessários:**
   - `<AIPipelineInsights />` — widget com insights gerais do pipeline
   - `<AINextBestAction />` — sugestão contextual de próxima ação
   - `<AIDealScoring />` — scoring automático de deals
   - `<AIActivitySuggestion />` — sugere atividades baseado em padrões

6. **Tabelas Supabase necessárias** (criar via SQL migration):
   - crm_deals (id, name, value, currency, stage, probability, expected_close_date, contact_id, company_id, owner_agent_id, ai_score, ai_insights jsonb, created_at, updated_at)
   - crm_deal_activities (id, deal_id, type, title, description, ai_generated boolean, created_by, created_at)
   - crm_contacts (id, name, email, phone, company_id, position, tags text[], engagement_score, ai_enrichment jsonb, source, created_at)
   - crm_companies (id, name, domain, industry, size, revenue, health_score, parent_company_id, metadata jsonb, created_at)
   - crm_pipeline_stages (id, name, order, probability_default, color, is_won, is_lost)
   - crm_deal_stakeholders (id, deal_id, contact_id, role: 'decision_maker' | 'influencer' | 'champion' | 'blocker')

7. **Edge Functions:**
   - ai-deal-scoring: Analisa deal e retorna score + insights
   - ai-next-best-action: Sugere próxima ação para deal
   - ai-contact-enrichment: Enriquece dados de contato

DESIGN:
- Estilo moderno tipo Linear/HubSpot
- Dark mode first com suporte a light mode
- Cards com glassmorphism sutil
- Indicadores visuais de AI (ícone de sparkles ✨ em tudo que a IA gerou/sugeriu)
- Animações suaves com Tailwind transitions
- Responsivo (mobile-first para agentes em campo)

IMPORTANTE:
- Todos os componentes devem estar em src/components/crm/
- Páginas em src/pages/crm/
- Hooks em src/hooks/useCrm*.ts
- Seguir os padrões existentes do projeto
- React Query para todas as queries e mutations
- Invalidar cache após mutations
- RLS no Supabase para segurança
```

---

### PROMPT 2 — Customer Success Module (Health Score + Playbooks)

```
Crie o módulo de Customer Success (CS) para o Sismais AI, inspirado em Gainsight e Totango.

CONTEXTO:
- Projeto existente com React 18 + TypeScript + TailwindCSS + shadcn/ui + Supabase
- Já existem: clientes (helpdesk_clients), contatos, agentes IA, Kanban
- A IA deve calcular health scores e disparar playbooks automaticamente
- Edge function calculate-health-scores já existe mas precisa de UI

FILOSOFIA AI-FIRST:
O Customer Success Manager (CSM) humano recebe alertas e dashboards prontos. A IA monitora continuamente, detecta riscos e executa playbooks de retenção automaticamente.

REQUISITOS:

1. **Página /cs/dashboard** — Customer Success Dashboard
   - Distribuição de health scores (gráfico de barras: Healthy/At Risk/Red)
   - NRR (Net Revenue Retention) em tempo real
   - Churn risk alerts (top 10 clientes em risco)
   - Expansion opportunities (clientes com potencial de upsell)
   - Timeline de eventos recentes (onboarding, churn, upgrade, downgrade)
   - KPIs: CSAT, NPS, CES, Time to Value, Adoption Rate

2. **Página /cs/clients/:id** — Visão 360° do Cliente
   - Health Score visual (gauge chart: 0-100 com cores)
   - Componentes do score: Usage, Support, Financial, Engagement, Sentiment
   - Lifecycle stage: Trial → Onboarding → Adoption → Expansion → Renewal → Churned
   - Timeline unificada: tickets, mensagens WhatsApp, atividades CRM, pagamentos
   - Contratos e renovações (tabela com datas, valores, status)
   - Risk indicators (IA identifica sinais de churn)
   - Success milestones (checkpoints de sucesso)
   - Playbooks ativos (automações em execução para este cliente)

3. **Página /cs/playbooks** — Playbooks Automatizados
   - Lista de playbooks com status (active/draft/paused)
   - Builder visual de playbooks (similar ao flow-builder existente)
   - Templates: Onboarding 30/60/90, Risk Mitigation, Expansion, Renewal, Re-engagement
   - Cada playbook tem: triggers, conditions, actions (email, WhatsApp, task, alert)
   - A IA pode criar playbooks baseada em padrões de sucesso/churn
   - Métricas por playbook: clientes impactados, success rate, churn prevented

4. **Página /cs/segments** — Segmentação Inteligente
   - Segmentos dinâmicos baseados em regras (health score, MRR, uso, etc.)
   - Segmentos criados pela IA baseado em clustering
   - Ações em massa por segmento (enviar mensagem, criar task, mudar stage)
   - Comparação entre segmentos (métricas lado a lado)

5. **Componentes AI-First:**
   - `<HealthScoreGauge />` — visualização do health score
   - `<ChurnRiskAlert />` — alerta visual de risco
   - `<AICSMAssistant />` — chat inline onde o CSM pergunta sobre o cliente
   - `<LifecycleTracker />` — timeline do lifecycle stage
   - `<PlaybookBuilder />` — editor visual de playbooks
   - `<SuccessMilestones />` — checklist de milestones

6. **Tabelas Supabase:**
   - cs_health_scores (id, client_id, overall_score, usage_score, support_score, financial_score, engagement_score, sentiment_score, calculated_at, factors jsonb)
   - cs_lifecycle_stages (id, client_id, stage, started_at, completed_at, ai_notes)
   - cs_playbooks (id, name, description, trigger_rules jsonb, actions jsonb, is_active, template_type, success_rate, created_at)
   - cs_playbook_executions (id, playbook_id, client_id, status, started_at, completed_at, results jsonb)
   - cs_milestones (id, client_id, name, description, completed boolean, completed_at, ai_detected boolean)
   - cs_segments (id, name, rules jsonb, client_count, ai_generated boolean, created_at)
   - cs_risk_alerts (id, client_id, risk_type, severity, description, ai_recommendation, status, created_at)

7. **Edge Functions:**
   - cs-health-calculator: Calcula health score multidimensional
   - cs-churn-predictor: Prediz probabilidade de churn com fatores
   - cs-playbook-engine: Executa playbooks automaticamente
   - cs-segment-builder: Cria segmentos com IA (clustering)

DESIGN:
- Dashboard com cards de gradiente sutil indicando saúde
- Verde/Amarelo/Vermelho como linguagem visual principal
- Gráficos Recharts (já instalado) para visualizações
- Cards de risco com borda vermelha pulsante (animate-pulse)
- Interface de playbook drag-and-drop (similar ao flow-builder existente)
```

---

### PROMPT 3 — Helpdesk Avançado com SLA & Automação Inteligente

```
Evolua o sistema de Helpdesk do Sismais AI para nível enterprise, inspirado em Zendesk + Freshdesk + Intercom.

CONTEXTO:
- Já existe: Kanban de tickets, fila de atendimento, inbox WhatsApp, agentes IA
- Edge function sla-alert-check já existe
- Pipeline WhatsApp → orchestrator → agent-executor já funciona
- Precisa de UI avançada e automações de helpdesk

FILOSOFIA AI-FIRST:
A IA categoriza, prioriza, roteia e resolve 80% dos tickets automaticamente. O humano só intervém em casos complexos. Cada ticket tem sugestões de resolução em tempo real.

REQUISITOS:

1. **Página /helpdesk/tickets** — Central de Tickets Inteligente
   - Tabela avançada com colunas: ID, Assunto, Cliente, Prioridade, Status, SLA, Agente (IA/Humano), Tempo resposta, Sentiment
   - A IA auto-categoriza e auto-prioriza cada ticket
   - Filtros avançados: status, prioridade, canal, agente, SLA (within/breached/at-risk), tags, data
   - Saved views (ex: "Meus tickets", "SLA crítico", "Esperando cliente")
   - Bulk actions: merge tickets, change status, assign, add tags
   - Indicador visual de tickets que a IA pode resolver sozinha vs precisa humano

2. **Página /helpdesk/tickets/:id** — Detalhe do Ticket
   - Thread de mensagens (multi-canal: WhatsApp, email, web)
   - Painel AI Assistant lateral:
     - Sugestão de resposta (gerada pela IA baseada no RAG + histórico)
     - Artigos relevantes da base de conhecimento
     - Tickets similares já resolvidos
     - Sentiment analysis em tempo real
     - Macro suggestions (baseado no contexto)
   - SLA timer visual (countdown com cores: verde → amarelo → vermelho)
   - Customer context: info do cliente, contratos, histórico, health score
   - Internal notes (visíveis apenas para agentes)
   - Tags e campos customizáveis
   - Satisfaction survey após resolução (CSAT)

3. **Página /helpdesk/sla** — Gestão de SLA
   - Policies: definir SLA por prioridade (P1=1h, P2=4h, P3=8h, P4=24h)
   - SLA por cliente/plano (premium = SLA mais rígido)
   - Dashboard de SLA: % within SLA, tickets breached, at-risk
   - Escalation rules: o que acontece quando SLA é violado
   - A IA monitora e alerta ANTES de violar SLA

4. **Página /helpdesk/csat** — Satisfação & Qualidade
   - CSAT score geral e por agente (IA vs humano)
   - NPS por período
   - Quality Assurance: IA avalia qualidade das respostas dos agentes
   - Feedback loop: respostas mal avaliadas alimentam o treinamento da IA
   - Relatórios automáticos (gerados pela IA)

5. **Página /helpdesk/automations** — Automações de Helpdesk
   - Trigger rules visuais: WHEN [evento] IF [condição] THEN [ação]
   - Exemplos de automações:
     - Auto-assign baseado em skill/carga
     - Auto-reply com IA quando fora do horário
     - Escalate quando sentiment negativo por 3 msgs seguidas
     - Close ticket inativo há 7 dias
     - Reopen quando cliente responde
     - Notificar gerente quando SLA at-risk
   - Log de execuções de automações

6. **Componentes AI-First:**
   - `<AISuggestedReply />` — resposta sugerida com botão "Send" e "Edit"
   - `<SLATimer />` — countdown visual do SLA
   - `<TicketSentimentBadge />` — indicador de sentimento
   - `<SimilarTickets />` — tickets parecidos resolvidos
   - `<KBArticleSuggestions />` — artigos relevantes do knowledge base
   - `<AutoCategorizeBadge />` — categoria atribuída pela IA
   - `<CSATWidget />` — widget de pesquisa de satisfação

7. **Tabelas Supabase:**
   - helpdesk_tickets (id, subject, description, status, priority, category, subcategory, channel, sla_policy_id, sla_first_response_at, sla_resolution_at, sla_breached boolean, client_id, contact_id, assigned_to_agent_id, assigned_to_human_id, ai_category, ai_priority, ai_sentiment, ai_suggested_resolution, tags text[], custom_fields jsonb, csat_score, resolved_at, created_at, updated_at)
   - helpdesk_ticket_messages (id, ticket_id, sender_type, sender_id, content, is_internal boolean, channel, ai_generated boolean, created_at)
   - helpdesk_sla_policies (id, name, priority, first_response_minutes, resolution_minutes, business_hours_only boolean, applies_to jsonb)
   - helpdesk_csat_responses (id, ticket_id, score, comment, created_at)
   - helpdesk_ticket_automations (id, name, trigger_event, conditions jsonb, actions jsonb, is_active, execution_count, last_executed_at)
   - helpdesk_quality_reviews (id, ticket_id, agent_id, ai_quality_score, ai_feedback, reviewed_at)

8. **Edge Functions:**
   - helpdesk-auto-categorize: Categoriza e prioriza ticket com IA
   - helpdesk-suggest-reply: Gera sugestão de resposta usando RAG
   - helpdesk-similar-tickets: Busca tickets similares com embeddings
   - helpdesk-quality-review: Avalia qualidade da resposta do agente
   - helpdesk-csat-analyze: Analisa tendências de satisfação
```

---

### PROMPT 4 — Motor de Automações Inteligentes (AI Workflows)

```
Crie um motor de automações inteligente e visual para o Sismais AI, inspirado em n8n + Zapier + HubSpot Workflows, mas com IA nativa.

CONTEXTO:
- Já existe: flow-builder básico com ReactFlow, automations page, automation-executor
- Precisa evoluir para um sistema completo de workflows com IA

FILOSOFIA AI-FIRST:
A IA não apenas executa automações — ela CRIA automações. O sistema aprende padrões de uso e sugere automações. O usuário apenas aprova.

REQUISITOS:

1. **Página /automations/studio** — Automation Studio (evolução do flow-builder)
   - Canvas visual com ReactFlow (já instalado)
   - Nodes disponíveis:
     **Triggers:**
     - New message (WhatsApp/email)
     - Ticket created/updated
     - Deal stage changed
     - Health score changed
     - SLA at-risk
     - Scheduled (cron)
     - Webhook received
     - Client event (contract renewal, payment due)

     **AI Actions:**
     - AI Classify (classifica input com LLM)
     - AI Generate Response (gera resposta)
     - AI Summarize (resume conversas)
     - AI Sentiment (analisa sentimento)
     - AI Decision (toma decisão baseada em critérios)
     - AI Extract (extrai dados de texto)

     **Actions:**
     - Send WhatsApp message
     - Create ticket
     - Update deal
     - Assign agent
     - Add tag
     - Create task
     - Send notification
     - Call webhook
     - Wait/Delay
     - Run sub-flow

     **Conditions:**
     - If/Else
     - Switch (múltiplos caminhos)
     - Filter
     - Loop

   - Painel de configuração lateral para cada node
   - Test mode: simular fluxo com dados de teste
   - Versioning: histórico de versões do fluxo
   - AI Assistant no canvas: "Descreva o que quer automatizar" → IA cria o fluxo

2. **Página /automations/library** — Biblioteca de Templates
   - Templates pré-configurados por categoria:
     - Onboarding automático de clientes
     - Follow-up inteligente pós-venda
     - Escalação automática de tickets críticos
     - Re-engagement de clientes inativos
     - Cobrança automática com negociação IA
     - Qualificação de leads automática
     - NPS automático pós-atendimento
   - "Create with AI" — descrever em linguagem natural
   - Marketplace de automações compartilhadas

3. **Página /automations/monitor** — Monitoramento
   - Execuções em tempo real (live feed)
   - Métricas: execuções/dia, success rate, average duration, errors
   - Log detalhado de cada execução (input → steps → output)
   - Alertas quando automação falha
   - A IA sugere correções para automações com falhas recorrentes

4. **Componentes:**
   - `<FlowCanvas />` — canvas principal com ReactFlow
   - `<NodePalette />` — paleta de nodes arrastáveis
   - `<NodeConfigPanel />` — painel de configuração do node selecionado
   - `<AIFlowGenerator />` — input de linguagem natural para criar fluxos
   - `<ExecutionTimeline />` — timeline visual de execução
   - `<AutomationTemplateCard />` — card de template

5. **Tabelas Supabase:**
   - automation_flows (id, name, description, nodes jsonb, edges jsonb, is_active, version, trigger_type, ai_generated boolean, execution_count, last_executed_at, created_at)
   - automation_executions (id, flow_id, status, trigger_data jsonb, steps jsonb, started_at, completed_at, error_message, duration_ms)
   - automation_templates (id, name, description, category, nodes jsonb, edges jsonb, usage_count, rating)
   - automation_suggestions (id, description, suggested_flow jsonb, reason, confidence, status, created_at)

6. **Edge Functions:**
   - automation-engine: Motor de execução de fluxos (interpreta nodes/edges)
   - ai-flow-generator: Converte linguagem natural em fluxo
   - automation-monitor: Monitora e alerta sobre falhas
```

---

### PROMPT 5 — Dashboard Inteligente com Métricas AI-Driven

```
Redesenhe o Dashboard principal (/dashboard) do Sismais AI como um command center inteligente, inspirado em Datadog + Linear + HubSpot.

CONTEXTO:
- Dashboard existente com StatsRow, AgentCard, PerformanceChart, etc.
- Precisa evoluir para um dashboard AI-driven com insights proativos

FILOSOFIA AI-FIRST:
O dashboard não apenas mostra dados — ele INTERPRETA dados e sugere ações. A IA identifica anomalias, tendências e oportunidades antes do humano perceber.

REQUISITOS:

1. **AI Command Center** — Header inteligente
   - Greeting personalizado: "Bom dia, [Nome]. Aqui está o que precisa da sua atenção:"
   - AI Daily Briefing: resumo gerado pela IA dos principais eventos/métricas
   - Action items prioritizados pela IA (ex: "3 deals com SLA crítico", "2 clientes em risco de churn")
   - Quick actions: botões para ações frequentes

2. **Real-time Metrics Grid**
   - KPI Cards animados:
     - Tickets abertos / resolvidos hoje
     - CSAT score atual
     - Revenue pipeline (total + weighted)
     - Health score médio dos clientes
     - IA resolution rate (% tickets resolvidos sem humano)
     - Tempo médio de resposta
     - NPS score
     - Active conversations
   - Cada card com sparkline (mini-gráfico de tendência)
   - Indicadores de tendência (↑↓) com cor

3. **AI Insights Panel** — Painel de Insights
   - Anomaly detection: "Volume de tickets 40% acima da média"
   - Trend analysis: "CSAT caiu 5 pontos esta semana"
   - Opportunity alerts: "Cliente X tem padrão de expansão"
   - Performance highlights: "Agente IA Support resolveu 92% dos tickets"
   - Cada insight com botão de ação sugerida

4. **Gráficos Interativos** (Recharts)
   - Tickets por período (line chart com comparação período anterior)
   - Revenue pipeline por estágio (funnel chart)
   - Distribuição de health scores (pie/donut chart)
   - CSAT evolution (line chart)
   - AI vs Human resolution (stacked bar)
   - Top categorias de tickets (horizontal bar)

5. **Activity Feed** — Feed de atividades em tempo real
   - Real-time updates via Supabase Realtime
   - Filtro por tipo: tickets, deals, churn alerts, AI actions
   - Cada atividade com ícone, timestamp, ator (IA/humano)

6. **Agent Performance** — Performance dos Agentes IA
   - Cards por agente com: resolutions, CSAT, avg response time
   - Comparação IA vs Humano em métricas chave
   - IA Learning curve (melhoria ao longo do tempo)

7. **Componentes:**
   - `<AIBriefing />` — briefing diário gerado pela IA
   - `<KPICard />` — card de KPI com sparkline e tendência
   - `<AnomalyAlert />` — alerta de anomalia
   - `<InsightCard />` — card de insight com ação sugerida
   - `<ActivityFeed />` — feed de atividades real-time
   - `<AgentPerformanceCard />` — performance por agente

8. **Edge Functions:**
   - dashboard-briefing: Gera briefing diário personalizado
   - dashboard-anomaly-detection: Detecta anomalias nas métricas
   - dashboard-insights: Gera insights e recomendações
```

---

### PROMPT 6 — Inbox Omnichannel com Copilot Integrado

```
Evolua o Inbox do Sismais AI para um inbox omnichannel enterprise com Copilot integrado, inspirado em Intercom + Front + Zendesk.

CONTEXTO:
- Inbox existente com conversas WhatsApp
- Copilot existe mas precisa ser integrado ao inbox
- Pipeline de mensagens WhatsApp já funciona

FILOSOFIA AI-FIRST:
O agente humano nunca começa do zero. O Copilot já tem a resposta sugerida, contexto do cliente, histórico relevante, e sugestões de ação. O humano apenas valida e envia.

REQUISITOS:

1. **Layout 3-panel** (como Intercom)
   - Panel esquerdo: Lista de conversas com filtros
     - Filtros: All, Mine, Unassigned, AI-handled, Bot
     - Search com IA (busca semântica, não apenas texto)
     - Status badges: active, waiting, snoozed, resolved
     - Unread counter, priority indicator, SLA timer mini
     - AI confidence indicator (alta/média/baixa)

   - Panel central: Thread de conversa
     - Mensagens com timestamp, read receipts
     - Typing indicator
     - Rich messages: imagens, docs, áudio (com transcrição IA), vídeo
     - Internal notes inline (highlight amarelo)
     - AI-generated reply com botões: Send, Edit, Regenerate, Discard
     - Macro selector (/) para respostas rápidas
     - Canned responses com variáveis ({{nome}}, {{empresa}})
     - Reply/Note toggle

   - Panel direito: Context & Copilot
     - Aba "Customer": dados do cliente, contratos, health score
     - Aba "Copilot": chat com IA sobre esta conversa
     - Aba "History": histórico de interações
     - Aba "Knowledge": artigos relevantes do KB
     - Aba "Tickets": tickets relacionados
     - Aba "Actions": ações rápidas (create ticket, tag, assign, snooze)

2. **Copilot Integrado:**
   - Chat inline onde o agente pergunta sobre o cliente
   - "Summarize this conversation" — resume a conversa atual
   - "Draft a reply" — gera rascunho de resposta
   - "What's the client's history?" — busca histórico
   - "Find similar cases" — busca casos similares
   - Proativo: sugere ações baseado no contexto
   - Tone selector: formal, casual, empático, técnico

3. **Smart Routing:**
   - IA decide se pode resolver sozinha ou precisa de humano
   - Se precisa de humano: roteia para o agente com melhor skill match
   - Round-robin com balanceamento de carga
   - Priority override: tickets P1 vão para o agente sênior

4. **Productivity Features:**
   - Keyboard shortcuts (k: next, j: previous, r: reply, n: note, etc.)
   - Snooze (adiar conversa para depois)
   - Merge conversations
   - Bulk actions
   - Quick reply templates
   - Conversation tags
   - Auto-translate (IA traduz mensagens em outros idiomas)

5. **Componentes:**
   - `<ConversationList />` — lista de conversas com filtros
   - `<ConversationThread />` — thread de mensagens
   - `<CustomerContextPanel />` — painel de contexto
   - `<CopilotChat />` — chat com o Copilot
   - `<AISuggestedReply />` — resposta sugerida
   - `<MacroSelector />` — seletor de macros (command palette)
   - `<SLAIndicator />` — indicador visual de SLA na conversa
```

---

### PROMPT 7 — Knowledge Base & RAG Avançado

```
Evolua o Knowledge Base do Sismais AI para um sistema de conhecimento inteligente com RAG avançado, inspirado em Notion + Confluence + Guru.

CONTEXTO:
- Knowledge base existe com documentos e embeddings
- RAG search e semantic search já funcionam
- Precisa de UI avançada e auto-learning

FILOSOFIA AI-FIRST:
A base de conhecimento se auto-alimenta. A IA identifica gaps de conhecimento baseado em tickets não resolvidos e cria artigos automaticamente.

REQUISITOS:

1. **Página /knowledge/base** — Base de Conhecimento
   - Hierarquia: Categorias → Subcategorias → Artigos
   - Editor de artigos rich-text (markdown)
   - Versionamento de artigos (histórico de edições)
   - Status: draft, published, archived, review_needed
   - Tags e metadados
   - AI writing assistant: "Write an article about [topic]"
   - AI review: verifica se artigo está atualizado e correto

2. **Página /knowledge/gaps** — Gap Analysis
   - Tickets não resolvidos por falta de conhecimento
   - Perguntas frequentes sem artigo correspondente
   - IA sugere artigos para criar baseado nos gaps
   - Botão "Generate Article" — IA cria rascunho do artigo
   - Priority score por gap (baseado em frequência)

3. **Página /knowledge/training** — Treinamento da IA
   - Q&A pairs para fine-tuning
   - Correções de respostas da IA (feedback loop)
   - Importação de fontes externas (URLs, PDFs, docs)
   - Sync automático com fontes (re-crawl periódico)
   - Métricas de acurácia do RAG

4. **Componentes:**
   - `<ArticleEditor />` — editor de artigos com AI assist
   - `<KnowledgeTree />` — árvore de navegação
   - `<GapAnalysisCard />` — card de gap identificado
   - `<RAGAccuracyChart />` — métricas de acurácia
   - `<AIArticleGenerator />` — gerador de artigos com IA
   - `<SourceSyncStatus />` — status de sync de fontes

5. **Edge Functions:**
   - knowledge-gap-analyzer: Analisa gaps na base de conhecimento
   - knowledge-auto-generate: Gera artigos automaticamente
   - knowledge-accuracy-check: Verifica acurácia dos artigos
```

---

### PROMPT 8 — Relatórios & Analytics AI-Driven

```
Crie o módulo de Relatórios e Analytics AI-driven para o Sismais AI, inspirado em Metabase + Looker + HubSpot Reports.

CONTEXTO:
- Edge function generate-report já existe
- Recharts já está instalado
- Precisa de UI completa de relatórios

FILOSOFIA AI-FIRST:
O usuário não precisa criar relatórios — a IA gera relatórios automaticamente e envia insights por WhatsApp/email. O usuário pode perguntar em linguagem natural: "Qual o CSAT desta semana?" e a IA responde com gráfico.

REQUISITOS:

1. **Página /analytics/dashboard** — Analytics Dashboard
   - Relatórios predefinidos:
     - Performance geral (tickets, resoluções, CSAT)
     - Performance por agente (IA vs humano)
     - CRM pipeline analytics
     - Customer health overview
     - Revenue analytics
     - SLA compliance
   - Período selecionável: hoje, 7d, 30d, 90d, custom
   - Comparação com período anterior
   - Export: PDF, CSV, Google Sheets

2. **Página /analytics/reports** — Report Builder
   - Drag-and-drop report builder
   - Métricas disponíveis: todas as tabelas do sistema
   - Visualizações: line, bar, pie, donut, table, funnel, gauge, heatmap
   - Filtros e segmentação
   - Agendamento: enviar relatório por email/WhatsApp diário/semanal/mensal
   - "Ask AI" — perguntar em linguagem natural e receber relatório

3. **Página /analytics/ai-insights** — AI Insights
   - Insights gerados automaticamente pela IA
   - Categorias: Performance, Trends, Anomalies, Opportunities, Risks
   - Cada insight com: descrição, impacto, ação sugerida, dados de suporte
   - A IA prioriza insights por impacto no negócio

4. **Componentes:**
   - `<ReportBuilder />` — builder visual de relatórios
   - `<ChartWidget />` — widget de gráfico configurável
   - `<AIInsightFeed />` — feed de insights da IA
   - `<NaturalLanguageQuery />` — input de pergunta em linguagem natural
   - `<ReportScheduler />` — agendador de relatórios
   - `<ExportButton />` — botão de export multi-formato

5. **Edge Functions:**
   - analytics-natural-query: Converte pergunta em query SQL + gráfico
   - analytics-auto-insights: Gera insights automaticamente
   - analytics-report-generator: Gera relatório PDF
   - analytics-scheduler: Envia relatórios agendados
```

---

### PROMPT 9 — Sistema de Notificações Inteligente & Command Palette

```
Crie um sistema de notificações inteligente e uma Command Palette para o Sismais AI, inspirado em Slack + Linear + Superhuman.

CONTEXTO:
- Componente de notificações existe em src/components/notifications/
- Precisa evoluir para um sistema AI-driven completo

FILOSOFIA AI-FIRST:
A IA filtra e prioriza notificações. O usuário só vê o que realmente importa. Notificações de baixa prioridade são agrupadas em um digest. A IA aprende as preferências do usuário.

REQUISITOS:

1. **Notification Center** — Centro de Notificações
   - Dropdown no header com notificações recentes
   - Categorias: Urgent (vermelho), Important (amarelo), Info (azul), AI Updates (roxo)
   - AI digest: agrupa notificações similares ("5 tickets resolvidos pela IA")
   - Mark as read, mark all as read, snooze
   - Notification preferences: configurar por tipo e canal

2. **Command Palette** (Cmd+K / Ctrl+K)
   - Search global: pages, contacts, tickets, deals, knowledge articles
   - Quick actions: "Create ticket", "Send message to [contact]", "Open deal [name]"
   - AI commands: "Summarize today", "Show churn risks", "Draft reply for ticket #123"
   - Recent items
   - Keyboard navigation

3. **Smart Notifications:**
   - IA prioriza: SLA breach > churn risk > new ticket > deal update > info
   - Browser push notifications para urgentes
   - Sound notifications configuráveis
   - Do Not Disturb mode
   - AI summary no final do dia: "Hoje: 45 tickets resolvidos, CSAT 4.2, 2 deals fechados"

4. **Componentes:**
   - `<NotificationCenter />` — centro de notificações
   - `<CommandPalette />` — command palette global
   - `<NotificationToast />` — toast notification styled
   - `<AIDigest />` — digest de notificações agrupadas
   - `<NotificationPreferences />` — preferências

5. **Tabelas:**
   - notifications (id, user_id, type, category, title, message, data jsonb, read boolean, ai_priority, grouped_count, created_at)
   - notification_preferences (id, user_id, type, channel, enabled boolean)
```

---

### PROMPT 10 — Configurações & Admin com IA

```
Crie o módulo de Configurações e Administração completo para o Sismais AI, com setup wizard guiado por IA.

CONTEXTO:
- Settings page existe mas é básica
- Admin pages existem (users, permissions, integrations)
- Precisa de setup wizard e configurações avançadas

FILOSOFIA AI-FIRST:
O setup inicial é guiado por IA conversacional. O admin configura o sistema conversando com a IA: "Quero que tickets P1 tenham SLA de 1 hora" e a IA configura.

REQUISITOS:

1. **Página /settings/wizard** — Setup Wizard AI-Guided
   - Onboarding step-by-step conversacional
   - Steps: Empresa → WhatsApp → Agentes IA → SLA → Automações → Knowledge Base
   - A IA faz perguntas e configura baseado nas respostas
   - Progress indicator
   - "Configure with AI" — describe your business and AI configures everything

2. **Página /settings/general** — Configurações Gerais
   - Empresa: nome, logo, timezone, idioma, horário de atendimento
   - Branding: cores, logo para WhatsApp, assinatura
   - Business hours: horários por dia da semana
   - Holiday calendar

3. **Página /settings/ai** — Configurações de IA (evoluir existente)
   - Global AI behavior: tone, language, fallback behavior
   - Confidence threshold: quando escalar para humano
   - Token budget: limite de gastos com IA por dia/mês
   - Model selection: qual modelo usar por tipo de tarefa
   - AI personas: personalidades diferentes para agentes
   - Forbidden topics: assuntos que a IA não deve tratar

4. **Página /settings/channels** — Canais de Comunicação
   - WhatsApp (UAZAPI): instâncias, templates, horários
   - Email: SMTP config, templates
   - Webchat: widget para site
   - API: webhooks de entrada/saída

5. **Página /admin/roles** — Roles & Permissões Granulares
   - RBAC: Admin, Manager, Agent, Viewer
   - Permissões por módulo: CRM, Helpdesk, CS, KB, Analytics
   - Custom roles
   - Audit log: quem fez o quê e quando

6. **Componentes:**
   - `<SetupWizard />` — wizard de configuração
   - `<AIConfigChat />` — chat para configurar via IA
   - `<BusinessHoursEditor />` — editor de horários
   - `<RolePermissionMatrix />` — matrix de permissões
   - `<AuditLog />` — log de auditoria
   - `<ChannelConfigCard />` — card de configuração de canal

7. **Tabelas:**
   - system_config (id, key, value jsonb, updated_by, updated_at)
   - audit_log (id, user_id, action, entity_type, entity_id, old_data jsonb, new_data jsonb, ip_address, created_at)
   - business_hours (id, day_of_week, start_time, end_time, is_active)
   - holidays (id, name, date, recurring boolean)
```

---

## ORDEM DE EXECUÇÃO RECOMENDADA

| Fase | Sprint | Módulo | Prompt |
|------|--------|--------|--------|
| 1 | Sprint 1 | Dashboard AI Command Center | Prompt 5 |
| 1 | Sprint 1 | Inbox Omnichannel + Copilot | Prompt 6 |
| 2 | Sprint 2 | Helpdesk Avançado + SLA | Prompt 3 |
| 2 | Sprint 2 | Knowledge Base + RAG | Prompt 7 |
| 3 | Sprint 3 | CRM Pipeline | Prompt 1 |
| 3 | Sprint 3 | Customer Success | Prompt 2 |
| 4 | Sprint 4 | Motor de Automações | Prompt 4 |
| 4 | Sprint 4 | Analytics & Reports | Prompt 8 |
| 5 | Sprint 5 | Notificações + Command Palette | Prompt 9 |
| 5 | Sprint 5 | Settings & Admin | Prompt 10 |

---

## NOTAS PARA CADA PROMPT NO LOVABLE

Antes de colar cada prompt no Lovable, **adicione este prefixo padrão**:

```
PROJETO: Sismais AI Helpdesk & CRM
STACK: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Supabase + React Query v5
REPOSITÓRIO EXISTENTE: Já possui páginas, componentes, hooks e edge functions
SUPABASE: Client em @/integrations/supabase/client
TIPOS: @/integrations/supabase/types (não editar)
TOAST: import { toast } from 'sonner'
ÍCONES: lucide-react
CSS: cn() de @/lib/utils
ROTEAMENTO: React Router v6 (adicionar rotas em App.tsx)
DESIGN: Dark mode first, shadcn/ui components, gradientes sutis, glassmorphism
IMPORTANTE: Componente funcional TypeScript, React Query para data fetching, RLS no Supabase
```

---

## MÉTRICAS DE SUCESSO POR MÓDULO

| Módulo | Métrica AI-First |
|--------|-----------------|
| Helpdesk | 80%+ tickets resolvidos sem humano |
| CRM | 100% deals com AI score e next action |
| CS | 0 churns sem alerta prévio da IA |
| Automations | 50+ automações rodando em produção |
| KB | 0 gaps de conhecimento não identificados |
| Dashboard | 0 anomalias não detectadas pela IA |
| Inbox | 100% conversas com resposta sugerida |
| Analytics | 0 relatórios criados manualmente |

---

## INSPIRAÇÕES POR MÓDULO

| Módulo | Referências |
|--------|------------|
| CRM Pipeline | Pipedrive (visual), HubSpot (automação), Salesforce (enterprise) |
| Customer Success | Gainsight (health score), Totango (playbooks), ChurnZero (engagement) |
| Helpdesk | Zendesk (ticketing), Freshdesk (automação), Intercom (conversational) |
| Automações | n8n (visual), HubSpot Workflows (smart), Zapier (templates) |
| Dashboard | Datadog (monitoring), Linear (design), Mixpanel (analytics) |
| Inbox | Intercom (3-panel), Front (collaborative), Superhuman (keyboard-first) |
| Knowledge | Notion (editor), Confluence (hierarchy), Guru (AI verification) |
| Analytics | Metabase (visual), Looker (drill-down), HubSpot Reports (templates) |
| Notificações | Slack (smart), Linear (priorities), Superhuman (AI filter) |
| Settings | Stripe (wizard), HubSpot (guided setup), Intercom (AI config) |
