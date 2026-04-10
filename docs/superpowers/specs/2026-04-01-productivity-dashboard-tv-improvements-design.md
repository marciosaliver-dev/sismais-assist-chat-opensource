# Spec: Aba Produtividade + Melhorias TV Dashboard

## Contexto

O dashboard principal tem 5 abas (Visao Geral, Qualidade, Tempo por Etapa, Demanda, Clientes) com filtros globais multi-select. O TV Dashboard tem 5 views rotativas. A auditoria revelou gaps em metricas de produtividade, custo por resolucao e visibilidade de fila no TV. Este spec cobre duas entregas:

1. **Nova aba "Produtividade"** no Dashboard principal
2. **Melhorias no TV Dashboard** — fila com cards de clientes, volume por agente/etapa, badge de fila na navbar

---

## Parte 1: Aba Produtividade

### Localizacao
Nova aba no Dashboard.tsx, posicao 6 (apos "Clientes"). Icone: `Gauge` do lucide-react. Label: "Produtividade".

### Filtros
Usa os filtros globais do DashboardFilterContext (periodo, categorias, modulos, boards, equipes, agentes IA). Nenhum filtro local adicional.

### Hook: useProductivityMetrics.ts
Recebe `DashboardFilters`. Queries em `ai_conversations`:

**Dados a buscar (periodo atual + periodo anterior para comparativo):**
- select: `id, status, ai_resolved, resolution_seconds, first_human_response_seconds, agent_switches_count, csat_rating, reopened_at, ticket_category_id, human_agent_id, current_agent_id, handler_type, ai_messages_count, started_at, resolved_at`
- Periodo anterior = mesma duracao, deslocada para tras

**KPIs computados (10):**

| KPI | Calculo | Comparativo |
|-----|---------|-------------|
| Throughput | resolvidos / horas no periodo | % vs anterior |
| FCR Rate | % finalizados com agent_switches_count <= 1 | % vs anterior |
| Custo/Resolucao IA | sum(cost_usd) de ai_messages no periodo / tickets resolvidos por IA | % vs anterior |
| Economia IA | (humanResolvedTMA * aiResolvedCount * custoHoraHumano) - custoIAreal | % vs anterior |
| Backlog Velocity | (entradas - saidas) por dia, media | vs anterior |
| Handle Time | resolution_seconds medio (so finalizados) | % vs anterior |
| Escalation Rate | % handler_type=hybrid ou human_started_at com ai_resolved=false | % vs anterior |
| Reopen Rate | % com reopened_at nao null / finalizados | % vs anterior |
| One-Touch % | % finalizados com ai_messages_count <= 2 | % vs anterior |
| CSAT Trend | media csat_rating | delta vs anterior |

**Constantes:**
- custoHoraHumano = R$ 25 (configuravel via constante)
- Taxa USD/BRL = 5.8

**FCR por Categoria:** Agrupar por ticket_category_id, calcular FCR % de cada.

**FCR por Agente:** Agrupar por human_agent_id + current_agent_id, calcular FCR %, TMA, CSAT, score composto.

**Custo por Categoria:** Buscar ai_messages com join por conversation_id, agrupar custo por categoria.

**ROI de Automacoes:**
- ticketsDesviados = ai_resolved=true count
- economiaHoras = ticketsDesviados * (humanTMA medio / 3600)
- taxaSucesso = ai_resolved / (total onde handler_type inclui 'ai')
- trendSemanal = agrupar por semana, contar ai_resolved

### Componente: ProductivityDashboard.tsx

**Layout (scroll vertical, 5 secoes):**

**Secao 1: KPI Strip**
- Usar ReportKPICards com columns=5 (2 linhas)
- Cada card mostra valor + badge com ↑X% ou ↓X% (verde=bom, vermelho=ruim)
- Logica de "bom/ruim" invertida para Handle Time e Escalation (menor = melhor)

**Secao 2: FCR Breakdown**
- Grid 2 colunas (lg)
- Esquerda: BarChart horizontal (Recharts) — top 10 categorias por FCR%. Barras coloridas por faixa (>=80 verde, 60-79 amarelo, <60 vermelho)
- Direita: Table (shadcn) — agentes ordenados por Score. Colunas: Rank, Agente, Tipo (badge IA/Humano), Tickets, FCR%, TMA, CSAT, Score (barra visual 0-100)

**Secao 3: Custo por Resolucao**
- 3 cards grandes em grid
  - Card IA: custo medio/ticket em BRL, total gasto, total resolvidos. Icone Bot, accent cyan
  - Card Humano: custo estimado/ticket, total resolvidos. Icone UserCheck, accent navy
  - Card Economia: valor economizado, % economia. Icone TrendingDown, accent success
- Abaixo: BarChart horizontal — custo medio por categoria (top 8)

**Secao 4: ROI de Automacoes**
- 4 cards em linha: Tickets Desviados, Economia em Horas, Taxa de Sucesso IA, Economia em R$
- Abaixo: LineChart — evolucao semanal da resolucao IA (ultimas 8 semanas)

**Secao 5: Ranking de Agentes**
- Table completa com sorting. Colunas: #, Agente, Tipo, Tickets, FCR%, TMA, CSAT, Escalacoes, Score
- Score = (FCR*0.4 + CSAT_normalizado*0.3 + velocidade_normalizada*0.3) * 100
- Barra visual colorida no score (verde >=80, amarelo >=60, vermelho <60)

---

## Parte 2: Melhorias TV Dashboard

### 2.1 Fila com Cards de Clientes (TVQueuePanel)

Substituir a lista simples do TVQueuePanel por **cards individuais** que mostram:

```
┌─────────────────────────────────┐
│ 🟢 #1234  João Silva        12m │  ← timer ao vivo
│ Erro ao fazer login             │  ← subject truncado
│ [Suporte] → Ana P.             │  ← board + agente
└─────────────────────────────────┘
```

**Regras visuais de alerta:**
- Borda esquerda verde: <= 50% do threshold da etapa
- Borda esquerda amarela: 50-99% do threshold
- Borda esquerda vermelha + pulso: >= 100% do threshold (SLA estourado)
- Timer incrementa a cada segundo (useEffect com setInterval 1s)

**Dados necessarios:** Ja existem em `activeQueue` (ActiveQueueItem) — id, ticketNumber, customerName, subject, boardName, boardColor, agentName, elapsedMinutes. Precisa adicionar `slaThresholdMinutes` ao tipo.

### 2.2 Volume por Agente na TVOverviewView

No painel "Top Performers" da overview, adicionar badges de carga:
- Badge cyan: X atendendo
- Badge amarelo: X na fila
- Badge total ao lado do nome

Dados ja existem em `agentWorkload` (activeTickets, waitingTickets, inProgressTickets).

### 2.3 Badge de Fila na TVNavBar

Adicionar ao lado do clock um badge grande com a contagem da fila:
- Verde (<=5), Amarelo (6-15), Vermelho (>15)
- Pulsa quando vermelho
- Sempre visivel independente da view

Dados: usar `kpis.totalWaiting` ja disponivel.

### 2.4 Expandir ActiveQueueItem com SLA threshold

No hook useTVDashboardMetrics, na query de activeQueue:
- Adicionar join com kanban_stages para obter queue_alert_threshold_minutes
- Adicionar campo slaThresholdMinutes ao ActiveQueueItem
- Default 60 minutos se nao configurado

---

## Verificacao

1. `npm run build` sem erros
2. Aba Produtividade renderiza com dados reais
3. Filtros globais afetam todas as metricas
4. Comparativo mostra ↑↓% corretos
5. TV Dashboard: cards na fila com timer incrementando
6. TV Dashboard: alertas visuais quando SLA estoura
7. TV Dashboard: badge de fila na navbar
