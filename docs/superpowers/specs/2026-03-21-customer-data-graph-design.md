# Fase 2C — Customer Data Graph UI

## Resumo

Criar a camada de UI que consome a infraestrutura CRM 360 já existente (tabelas `crm_timeline`, `crm_data_sources`, `crm_score_history`, `crm_duplicate_candidates`, edge function `customer-360`, RPCs de merge/dedup). Quatro módulos independentes, todos seguindo o design system Sismais GMS.

---

## Módulo A — ClientDetail 360° (Redesign)

### Objetivo
Transformar `/clients/:id` de uma ficha básica para um painel CRM 360° com timeline unificada, scores visuais e dados de todas as fontes.

### Arquitetura da Página

```
┌─ Breadcrumb + Ações (Editar, Sync, Ver no Admin) ──────────────────┐
├─────────────────────────────────────────────────────────────────────┤
│  LEFT SIDEBAR (320px)              │  RIGHT PANEL (flex-1)         │
│  ┌─ Avatar + Nome + Empresa ─┐    │  ┌─ Tabs ──────────────────┐  │
│  ├─ Health Score Ring ────────┤    │  │ Timeline | Atendimentos │  │
│  │  health / engagement /     │    │  │ Contratos | Anotações   │  │
│  │  churn_risk gauges         │    │  ├─────────────────────────┤  │
│  ├─ Financial Summary ────────┤    │  │                         │  │
│  │  MRR, Dívida, Contratos    │    │  │  (conteúdo da tab)      │  │
│  ├─ Contact Info ─────────────┤    │  │                         │  │
│  ├─ Data Sources badges ──────┤    │  └─────────────────────────┘  │
│  ├─ Contatos ─────────────────┤    │                               │
│  └─ Quick Actions ────────────┘    │                               │
└────────────────────────────────────┴───────────────────────────────┘
```

### Componentes Novos

1. **`HealthScoreRing`** — Gauge circular (0-100) para health_score com cores:
   - 80-100: verde (#16A34A)
   - 50-79: amarelo (#FFB800)
   - 0-49: vermelho (#DC2626)
   - Sub-indicadores: engagement_score, churn_risk (badges)

2. **`FinancialSummary`** — Card com:
   - MRR total (formatado BRL)
   - Dívida total (vermelho se > 0)
   - Contratos ativos / total
   - Customer tier badge

3. **`DataSourceBadges`** — Chips mostrando de quais sistemas tem dados:
   - GL (verde se synced, cinza se stale)
   - Admin (verde/cinza)
   - Helpdesk (sempre verde)
   - WhatsApp (verde se tem perfil)

4. **`TimelineTab`** — Timeline vertical consumindo `crm_timeline`:
   - Ícones por event_type (message, ticket_created, ticket_resolved, contract_change, annotation, payment, system)
   - Cores por channel (whatsapp=verde, web=azul, phone=roxo, email=cinza, internal=navy)
   - Filtros: por event_type, por channel, por date range
   - Infinite scroll (50 por página)
   - Cada item mostra: ícone + título + descrição + actor_name + tempo relativo

5. **`ScoreHistoryChart`** — Mini sparkline (últimos 30 dias) dos scores, inline no sidebar

### Dados

- Hook `useCustomer360(clientId)` — chama edge function `customer-360` com `{ client_id, include_scores: true, include_whatsapp: true }`
- Hook `useCrmTimeline(clientId, filters)` — query em `crm_timeline` com paginação
- Reutiliza queries existentes de contacts, contracts, annotations

### Mudanças no ClientDetail.tsx Atual

- Mantém dialogs de edição (edit client, add contact, add contract)
- Substitui sidebar simples por sidebar com scores + financial + data sources
- Substitui tabs por 4 tabs: Timeline, Atendimentos, Contratos, Anotações
- Tab Contratos agora inclui dados do Admin (invoices) via `customer-360`

---

## Módulo B — Widget de Contexto no Inbox

### Objetivo
Enriquecer a `ClienteTab` existente no `AIAnalysisPanel` com resumo 360° quando um cliente está vinculado.

### Mudanças

A `ClienteTab` atual já mostra: search, link/unlink, contacts, contracts. Vamos adicionar um bloco **acima** dos contatos quando o cliente está vinculado:

1. **Mini Health Card** — health_score ring (compacto, 48px), MRR, dívida, tier
2. **Timeline Recente** — últimos 5 eventos do `crm_timeline` (compacto, sem filtros)
3. **Link "Ver ficha completa"** → navega para `/clients/:id`

### Dados

- Reutiliza `useCustomer360(clientId)` com `{ client_id, include_scores: false }` (versão light)
- Query em `crm_timeline` limitada a 5 eventos mais recentes

### Componentes

- **`ClienteContextCard`** — componente compacto com health + financial
- **`MiniTimeline`** — lista vertical de 5 itens, sem filtros

---

## Módulo C — Deduplicação/Merge

### Objetivo
UI para revisar candidatos a duplicata e executar merge.

### Página

Nova rota: `/clients/duplicates` (acessível via botão na página `/clients`)

### Layout

```
┌─ Header: "Clientes Duplicados" + badge count + btn "Detectar" ────┐
├───────────────────────────────────────────────────────────────────┤
│  Lista de candidatos (crm_duplicate_candidates where status=pending)│
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Card: Cliente A ←→ Cliente B                                 │ │
│  │ Score: 95% | Motivo: CNPJ igual | Ações: Merge | Rejeitar  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ...mais candidatos                                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│  Dialog de Merge:                                                 │
│  Side-by-side dos dois clientes com campo-a-campo                │
│  Seleção de qual manter como principal                           │
│  Confirmação com resumo do que será movido                       │
└───────────────────────────────────────────────────────────────────┘
```

### Componentes

1. **`DuplicatesList`** — Lista paginada de `crm_duplicate_candidates`
2. **`DuplicateCard`** — Card com dados dos dois clientes lado a lado, score, motivos
3. **`MergeDialog`** — Dialog full com comparação campo-a-campo, botão "Manter este" em cada lado, preview do merge, confirmação
4. **`DetectButton`** — Chama RPC `crm_detect_duplicates` e recarrega lista

### Dados

- Query em `crm_duplicate_candidates` com join em `helpdesk_clients` (client_a, client_b)
- Mutation para `crm_merge_clients` RPC
- Mutation para update status (rejected)

---

## Módulo D — Dashboard de Saúde de Clientes

### Objetivo
Nova tab "Clientes" no Dashboard principal mostrando visão macro da base.

### Localização

Adicionar tab "Clientes" (Users icon) no Dashboard existente, ao lado de "Visão Geral", "Qualidade", "Tempo por Etapa".

### Layout

```
┌─ KPI Cards ──────────────────────────────────────────────────────┐
│ Total Clientes | Health Médio | MRR Total | Churn Risk Count     │
├──────────────────────────────────────────────────────────────────┤
│  ┌─ Health Distribution ──┐  ┌─ Churn Risk List ──────────────┐ │
│  │ Donut: Bom/Médio/Ruim  │  │ Top 10 clientes em risco      │ │
│  │                        │  │ com health_score e delta       │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  ┌─ Score Trends (30d) ──────────────────────────────────────┐  │
│  │ Line chart: avg health, avg engagement over time           │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  ┌─ Recent Activity ─────────────────────────────────────────┐  │
│  │ Últimos 20 eventos do crm_timeline (all clients)           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Componentes

1. **`ClientHealthKPIs`** — 4 cards: total, avg health, MRR total, churn count
2. **`HealthDistribution`** — Donut chart (CSS-only, sem lib) com 3 faixas
3. **`ChurnRiskList`** — Tabela compacta dos top 10 clientes com churn_risk ou health < 50
4. **`ScoreTrends`** — Line chart (CSS-only ou mini SVG) dos últimos 30 dias
5. **`RecentClientActivity`** — Lista de eventos recentes do `crm_timeline`

### Dados

- Queries diretas no Supabase:
  - `helpdesk_clients` count, avg health_score, sum mrr_total, count where churn_risk=true
  - `crm_score_history` agrupado por dia (últimos 30)
  - `crm_timeline` últimos 20 eventos (all clients)

---

## Padrões Técnicos

### Hooks
- `useCustomer360(clientId)` — edge function call, staleTime 5min
- `useCrmTimeline(clientId?, filters?)` — query Supabase com paginação
- `useClientHealthMetrics()` — queries agregadas para dashboard
- `useDuplicateCandidates()` — query + mutations

### Componentes Compartilhados
- `HealthScoreRing` — usado no ClientDetail, ClienteTab, ChurnRiskList
- `TimelineItem` — usado no TimelineTab, MiniTimeline, RecentClientActivity
- `DataSourceBadge` — usado no ClientDetail, DuplicateCard

### Performance
- Paginação via cursor (não offset) no timeline
- staleTime de 5min para customer-360 (dados não mudam a cada segundo)
- Skeleton loading em todos os módulos

### Roteamento
- `/clients/:id` — ClientDetail 360° (redesign)
- `/clients/duplicates` — DuplicatesList (nova)
- Dashboard tab "Clientes" — inline no Dashboard existente

---

## Ordem de Implementação

1. **Hooks compartilhados** (useCustomer360, useCrmTimeline, useClientHealthMetrics)
2. **Componentes compartilhados** (HealthScoreRing, TimelineItem, DataSourceBadge)
3. **Módulo A** — ClientDetail 360° redesign
4. **Módulo B** — Widget no Inbox (ClienteTab enrichment)
5. **Módulo C** — Deduplicação/Merge
6. **Módulo D** — Dashboard tab Clientes
