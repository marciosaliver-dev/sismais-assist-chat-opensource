# TV Dashboard v3 — Design Spec

**Data:** 2026-04-02
**Status:** Aprovado
**Abordagem:** Backend Consolidado + Realtime Híbrido

---

## Problema

O TV Dashboard atual faz ~33 round-trips ao Supabase a cada 30 segundos (7 queries principais com ~26 sub-queries). A mesma tabela `ai_conversations` é consultada 5+ vezes por ciclo. Não usa Supabase Realtime. Quando as queries recarregam, o React re-renderiza tudo, causando flash de loading e lentidão. Informações ficam pequenas e ilegíveis em TV na parede.

## Requisitos

- **Uso dual:** TV na parede (sem interação, legível a 5m) + desktop do gestor (clicável, denso)
- **Realtime híbrido:** fila e SLA instantâneos via websocket, KPIs/ranking via polling 30-60s
- **Prioridade de informação:** Fila > SLA > KPIs > Carga por agente > Ranking > IA vs Humano
- **Visual:** Scoreboard (números gigantes) + Datadog (grid denso onde precisa)
- **Cards de fila ricos:** ticket, tempo ao vivo, cliente, status, humor, assunto, handler, barra SLA

---

## Arquitetura de Dados

### Edge Function: `tv-dashboard-data`

1 função que executa 1 query SQL consolidada com CTEs e retorna todos os dados em ~100-200ms.

```
Frontend                     Supabase
   │                            │
   ├─ fetch /tv-dashboard-data ─►  1 SQL com CTEs:
   │    (a cada 30s)            │   - active_convs (aguardando + em_atendimento)
   │                            │   - resolved_today (finalizados do dia)
   │◄─ JSON completo ──────────┤   - agents, boards, stages
   │                            │
   ├─ Realtime subscribe ──────►  ai_conversations
   │    (INSERT/UPDATE)         │   filtro: status IN (aguardando, em_atendimento)
   │◄─ push instantâneo ───────┤   → atualiza fila + recalcula SLA local
```

**SQL com CTEs MATERIALIZED:**
- `active` — conversas aguardando + em_atendimento (filtro is_discarded)
- `resolved` — conversas finalizadas hoje
- `boards` — kanban_boards (id, name, color)
- `stages` — kanban_stages ativas com thresholds
- `agents` — human_agents ativos

**Retorno JSON (~2-5KB):**
```json
{
  "generatedAt": "2026-04-02T18:00:00Z",
  "nextRefreshMs": 30000,
  "kpis": {
    "totalWaiting": 7, "totalInProgress": 3, "totalOpen": 10,
    "resolvedToday": 23, "aiResolvedToday": 15, "humanResolvedToday": 8,
    "avgCsatToday": 4.2, "aiCsatToday": 4.5, "humanCsatToday": 3.8,
    "avgWaitingMinutes": 12, "oldestWaitingMinutes": 45,
    "avgResolutionSecondsToday": 840, "aiAvgResolutionSeconds": 120, "humanAvgResolutionSeconds": 1500,
    "resolvedPerHour": 3.2, "fcrRate": 85, "escalationRate": 22,
    "backlog": 15, "oldestTicketMinutes": 180
  },
  "queue": [{
    "id": "uuid", "ticketNumber": "#1234", "customerName": "JR Gráfica",
    "customerPhone": "559291991867", "subject": "Erro ao gerar boleto",
    "status": "aguardando", "startedAt": "2026-04-02T17:48:00Z",
    "boardName": "Suporte", "boardColor": "#45E5E5",
    "agentName": "João", "handlerType": "human",
    "satisfactionScore": 2, "slaThresholdMinutes": 30,
    "tags": ["Financeiro"]
  }],
  "agents": [{
    "agentId": "uuid", "agentName": "João", "isOnline": true,
    "activeTickets": 3, "waitingTickets": 1, "inProgressTickets": 2,
    "slaViolated": 0, "slaAtRisk": 1,
    "resolvedToday": 5, "avgResolutionSeconds": 900, "avgCsat": 4.1
  }],
  "ranking": [{
    "agentId": "uuid", "agentName": "Maria", "resolved": 8,
    "avgResolutionSeconds": 600, "avgCsat": 4.8
  }],
  "staleTickets": [{
    "id": "uuid", "ticketNumber": "#1230", "customerName": "Auto Peças",
    "subject": "Sistema travando", "boardName": "Suporte",
    "agentName": "Pedro", "staleMinutes": 95, "status": "em_atendimento"
  }],
  "stageBreakdown": [{
    "stageId": "uuid", "stageName": "Triagem", "stageColor": "#45E5E5",
    "count": 3, "violatedCount": 1, "atRiskCount": 1
  }]
}
```

### Segurança
- JWT obrigatório (rota dentro do app autenticado)
- Modo quiosque TV: aceita `?pin=XXXX` validado contra config no banco
- Edge function retorna `Cache-Control: max-age=10` para CDN

### Realtime Subscription

```typescript
supabase.channel('tv-queue')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ai_conversations',
    filter: 'status=in.(aguardando,em_atendimento)'
  }, handleRealtimeChange)
  .subscribe()
```

**Resiliência:**
- Se Realtime desconecta → polling cai para 15s automaticamente
- Quando reconecta → volta para 30s
- Heartbeat visual: "AO VIVO" verde (Realtime ok), amarelo (fallback polling)
- Deduplicação por `id + updated_at`
- Reconexão com backoff exponencial

**Merge Strategy:**
- Polling (30s) → dados completos → setState(fullData)
- Realtime (instantâneo) → patch parcial → atualiza só o item na fila + recalcula contadores locais
- NÃO recalcula KPIs pesados no Realtime (espera próximo polling)

---

## Hook: `useTVDashboardData`

Substitui `useTVDashboardMetrics` (7 queries → 1 fetch + 1 subscription):

```typescript
export function useTVDashboardData() {
  // 1 useQuery: fetch da edge function a cada 30s
  //   - placeholderData: keepPreviousData (sem flash)
  //   - respects nextRefreshMs do server
  //   - retry: 3

  // 1 useEffect: Realtime subscription
  //   - merge eventos com dados do polling
  //   - fallback polling 15s se Realtime desconecta

  // Return: { data, isLoading, isRealtime }
}
```

---

## Layout Visual

### Detecção de Modo

```typescript
const isTVMode = new URLSearchParams(location.search).has('mode', 'tv')
  || (window.innerWidth >= 1920 && !window.matchMedia('(pointer: fine)').matches)
```

### Modo TV (fullscreen, `?mode=tv` ou TV detectada)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SCOREBOARD BAR — 4 mega-números (120px altura)                     │
│  font 64-72px · background reativo por severidade                   │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │                                  │
│   PAINEL PRINCIPAL (rotativo)    │   FILA AO VIVO (fixo)           │
│   70% largura                    │   30% largura                   │
│                                  │                                  │
│   View 1: KPIs expandidos        │   Cards ricos com:              │
│   View 2: Carga por agente       │   - Ticket # + status           │
│   View 3: SLA compliance         │   - Timer ao vivo               │
│   View 4: Ranking performance    │   - Cliente + telefone          │
│                                  │   - Assunto (1 linha)           │
│                                  │   - Humor emoji + label         │
│                                  │   - Handler (IA/Humano)         │
│                                  │   - Barra SLA visual            │
│                                  │   (auto-scroll se > 6 items)    │
│                                  │                                  │
├──────────────────────────────────┴──────────────────────────────────┤
│  TICKER — alertas SLA em scroll horizontal (vermelho pulsante)      │
└─────────────────────────────────────────────────────────────────────┘
```

**Scoreboard Bar (topo fixo ~120px):**
- 4 números: Na Fila | Resolvidos Hoje | CSAT | Tempo Médio
- Font: Poppins 64-72px bold
- Background reativo: navy (normal) → amarelo (fila 5-10) → vermelho pulsante (fila >10)

**Painel Principal (rotação 20s):**
- 4 views, números 32-48px
- Transição fade 300ms

**Fila ao Vivo (fixo direita, Realtime):**
- Cards ricos (~100px altura, font 14-16px)
- Max 6-7 visíveis, auto-scroll suave CSS
- Ordenado por urgência SLA (mais urgente no topo)

**Ticker (rodapé):**
- Alertas SLA em scroll horizontal
- Vermelho pulsante para violações

### Modo Desktop (padrão)

- Scoreboard compacto (números 24px, 1 linha)
- Cards de fila compactos (~80px), clicáveis → abre ticket
- Agentes clicáveis → abre perfil
- 5 tabs manuais (sem rotação automática)
- Tab extra: Comparativo IA vs Humano
- Sidebar fila colapsa em telas <1440px

### Card de Fila (TVQueueCard)

```
┌─────────────────────────────────────┐
│  #1234  ●  Aguardando     ⏱ 12min  │
│  ─────────────────────────────────  │
│  👤 JR Gráfica & Papelaria         │
│  📱 55 92 9199-1867                 │
│  ─────────────────────────────────  │
│  📋 Erro ao gerar boleto no ERP    │
│  🏷 Suporte · Financeiro           │
│  ─────────────────────────────────  │
│  😤 Frustrado    🤖 IA → 👤 João   │
│  ████████████░░░░  SLA 12/30min    │
└─────────────────────────────────────┘
```

**Humor do cliente (satisfaction_score):**

| Score | Emoji | Label | Cor |
|-------|-------|-------|-----|
| 4-5 | 😊 | Satisfeito | #16A34A |
| 3-4 | 😐 | Neutro | #666666 |
| 2-3 | 😤 | Frustrado | #FFB800 |
| 1-2 | 🔥 | Irritado | #DC2626 |
| null | 🤷 | Sem dados | #666666 |

**Cores por severidade (timer/SLA):**

| Condição | Cor | Uso |
|----------|-----|-----|
| Normal | #45E5E5 cyan | Timer <15min, SLA ok |
| Atenção | #FFB800 yellow | Timer 15-30min, SLA 70%+ |
| Crítico | #DC2626 red | Timer >30min, SLA violado |
| Pulsante | #DC2626 + animation | Timer >60min, SLA grave |

---

## Componentes

### Arquivos novos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `supabase/functions/tv-dashboard-data/index.ts` | Edge function — 1 SQL consolidado |
| `src/hooks/useTVDashboardData.ts` | 1 useQuery + 1 Realtime subscription |
| `src/components/tv-dashboard/TVScoreboard.tsx` | Barra 4 mega-números |
| `src/components/tv-dashboard/TVQueueCard.tsx` | Card rico de fila |

### Arquivos reescritos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/TVDashboard.tsx` | Detecta modo TV/Desktop, novo layout |
| `src/components/tv-dashboard/TVQueuePanel.tsx` | Lista de TVQueueCards + auto-scroll + Realtime |
| `src/components/tv-dashboard/TVOverviewView.tsx` | KPIs grandes para modo TV |
| `src/components/tv-dashboard/TVAgentWorkloadView.tsx` | Carga por agente indicadores maiores |
| `src/components/tv-dashboard/TVSLAView.tsx` | SLA compliance donut grande |
| `src/components/tv-dashboard/TVPerformanceView.tsx` | Ranking barras grandes |
| `src/components/tv-dashboard/TVNavBar.tsx` | Tabs + indicador AO VIVO + modo |

### Arquivos deletados (consolidados)

| Arquivo | Absorvido por |
|---------|--------------|
| `src/hooks/useTVDashboardMetrics.ts` | `useTVDashboardData.ts` |
| `src/components/tv-dashboard/TVKPIStrip.tsx` | `TVScoreboard.tsx` |
| `src/components/tv-dashboard/TVQueueView.tsx` | `TVQueuePanel.tsx` |
| `src/components/tv-dashboard/TVStaleTickets.tsx` | Ticker no TVDashboard |
| `src/components/tv-dashboard/TVAgentRanking.tsx` | `TVPerformanceView.tsx` |
| `src/components/tv-dashboard/TVAIComparisonView.tsx` | Tab desktop only |

---

## Migration e Índices

```sql
-- Índice parcial para conversas ativas (fila + em atendimento)
CREATE INDEX CONCURRENTLY idx_conv_active_tv
ON ai_conversations (status, started_at)
WHERE status IN ('aguardando', 'em_atendimento')
AND (is_discarded IS NULL OR is_discarded = false);

-- Índice para resolvidos do dia (KPIs)
CREATE INDEX CONCURRENTLY idx_conv_resolved_today
ON ai_conversations (resolved_at, status)
WHERE status = 'finalizado';

-- Índice para último stage change (stale tickets)
CREATE INDEX CONCURRENTLY idx_status_history_latest
ON ticket_status_history (conversation_id, created_at DESC);
```

---

## Resumo de Decisões

| Aspecto | Decisão |
|---------|---------|
| Dados | 1 edge function SQL consolidada + Realtime para fila |
| Round-trips | 33 → 1 (polling) + eventos Realtime |
| Refresh | Polling 30s + Realtime instantâneo para fila/SLA |
| Resiliência | Fallback polling 15s se Realtime cai |
| Segurança | JWT obrigatório + modo PIN para quiosque TV |
| Layout TV | Scoreboard 72px + Cards ricos + Painel rotativo |
| Layout Desktop | Compacto + Clicável + 5 tabs manuais |
| Performance | Índices parciais + Cache CDN 10s + keepPreviousData |
| Componentes | 4 novos + 7 reescritos + 1 edge function |
| Deletados | 5 componentes + 1 hook |
