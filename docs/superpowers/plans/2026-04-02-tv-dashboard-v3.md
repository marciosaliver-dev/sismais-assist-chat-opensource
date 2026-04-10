# TV Dashboard v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TV Dashboard's 33 Supabase round-trips with 1 consolidated edge function + Realtime subscription, and redesign the UI for dual TV/Desktop mode with scoreboard numbers and rich queue cards.

**Architecture:** Single edge function (`tv-dashboard-data`) with CTE-based SQL returns all data in 1 call. Supabase Realtime subscription on `ai_conversations` pushes instant queue updates. Frontend detects TV vs Desktop mode and renders appropriate layout. New `useTVDashboardData` hook replaces 7 separate queries.

**Tech Stack:** Deno (edge function), PostgreSQL CTEs, Supabase Realtime, React 18, TanStack Query v5, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-04-02-tv-dashboard-v3-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/functions/tv-dashboard-data/index.ts` | Edge function: 1 SQL query returns all TV dashboard data |
| `supabase/migrations/20260402200000_tv_dashboard_indexes.sql` | Performance indexes for TV dashboard queries |
| `src/hooks/useTVDashboardData.ts` | 1 useQuery + 1 Realtime subscription, replaces useTVDashboardMetrics |
| `src/components/tv-dashboard/TVScoreboard.tsx` | Top bar with 4 mega-numbers (72px in TV mode) |
| `src/components/tv-dashboard/TVQueueCard.tsx` | Rich queue card: ticket, client, humor, SLA bar, timer |

### Rewritten Files
| File | Change |
|------|--------|
| `src/pages/TVDashboard.tsx` | Dual mode detection, new layout, uses new hook |
| `src/components/tv-dashboard/TVQueuePanel.tsx` | TVQueueCard list, auto-scroll, Realtime indicator |
| `src/components/tv-dashboard/TVNavBar.tsx` | Add live indicator, mode toggle, reduce to 4 TV tabs |
| `src/components/tv-dashboard/TVOverviewView.tsx` | Large KPI cards for TV mode |
| `src/components/tv-dashboard/TVAgentWorkloadView.tsx` | Larger indicators, TV-friendly layout |
| `src/components/tv-dashboard/TVSLAView.tsx` | Large donut, bigger numbers |
| `src/components/tv-dashboard/TVPerformanceView.tsx` | Large bars, TV-friendly ranking |

### Deleted Files
| File | Reason |
|------|--------|
| `src/hooks/useTVDashboardMetrics.ts` | Replaced by useTVDashboardData |
| `src/components/tv-dashboard/TVKPIStrip.tsx` | Absorbed by TVScoreboard |
| `src/components/tv-dashboard/TVQueueView.tsx` | Absorbed by TVQueuePanel |
| `src/components/tv-dashboard/TVStaleTickets.tsx` | Ticker integrated in TVDashboard |
| `src/components/tv-dashboard/TVAgentRanking.tsx` | Absorbed by TVPerformanceView |
| `src/components/tv-dashboard/TVAIComparisonView.tsx` | Desktop-only tab, kept but not in TV rotation |

---

## Task 1: Database Indexes

**Files:**
- Create: `supabase/migrations/20260402200000_tv_dashboard_indexes.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Índice parcial para conversas ativas (fila + em atendimento)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_active_tv
ON ai_conversations (status, started_at)
WHERE status IN ('aguardando', 'em_atendimento')
AND (is_discarded IS NULL OR is_discarded = false);

-- Índice para resolvidos do dia (KPIs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_resolved_today
ON ai_conversations (resolved_at, status)
WHERE status = 'finalizado';

-- Índice para último stage change (stale tickets)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_status_history_latest
ON ticket_status_history (conversation_id, created_at DESC);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `apply_migration` with project_id `pomueweeulenslxvsxar`, name `tv_dashboard_indexes`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260402200000_tv_dashboard_indexes.sql
git commit -m "feat(tv-dashboard): add performance indexes for consolidated query"
```

---

## Task 2: Edge Function `tv-dashboard-data`

**Files:**
- Create: `supabase/functions/tv-dashboard-data/index.ts`

- [ ] **Step 1: Create the edge function**

The function must:
1. Handle CORS preflight
2. Create a Supabase service client
3. Execute ONE SQL query with CTEs that returns all data
4. Return JSON with `generatedAt`, `nextRefreshMs`, and all data sections

SQL CTEs needed:
- `active_convs`: all conversations with status IN ('aguardando','em_atendimento') AND (is_discarded IS NULL OR is_discarded = false), joined with kanban_boards, human_agents, ai_agents, kanban_stages
- `resolved_today`: conversations with status='finalizado' AND resolved_at >= CURRENT_DATE, joined with human_agents
- `boards`: all kanban_boards (id, name, color)
- `stages`: active kanban_stages with thresholds
- `agents_active`: human_agents where is_active=true
- `stale_history`: latest ticket_status_history per conversation via DISTINCT ON

From these CTEs, compute and return:
- `kpis`: totalWaiting, totalInProgress, totalOpen, resolvedToday, aiResolvedToday, humanResolvedToday, avgCsatToday (overall/ai/human), avgWaitingMinutes, oldestWaitingMinutes, avgResolutionSecondsToday (overall/ai/human), resolvedPerHour, fcrRate, escalationRate, backlog, oldestTicketMinutes, avgMessagesPerConversation
- `queue`: array of active queue items with ticketNumber, customerName, customerPhone, subject, status, startedAt, boardName, boardColor, agentName, handlerType, satisfactionScore, slaThresholdMinutes, tags
- `agents`: array of agent workload with name, isOnline, activeTickets, waitingTickets, inProgressTickets, slaViolated, slaAtRisk, resolvedToday, avgResolutionSeconds, avgCsat
- `ranking`: array of agent ranking by resolved count today
- `staleTickets`: conversations open >30min since last stage change, with staleMinutes
- `stageBreakdown`: count per stage with violated/atRisk counts

The SQL should use `json_build_object` and `json_agg` to return everything as a single JSON result.

Import `corsHeaders`, `jsonResponse`, `errorResponse` from `../_shared/supabase-helpers.ts`. Import `createServiceClient` for DB access. Import `cachedQuery` from `../_shared/cache.ts` for caching boards/stages (5 min TTL).

Set response header `Cache-Control: public, max-age=10`.

- [ ] **Step 2: Test locally by reading the function**

Verify the SQL is syntactically correct, all CTEs are referenced, all JSON fields match the spec.

- [ ] **Step 3: Deploy edge function via Supabase MCP**

Deploy `tv-dashboard-data` with project_id `pomueweeulenslxvsxar`, verify_jwt: false (TV kiosk mode needs unauthenticated access, PIN validation is internal).

- [ ] **Step 4: Test the deployed function**

Call the function via `supabase.functions.invoke('tv-dashboard-data')` and verify the response shape matches the spec.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/tv-dashboard-data/index.ts
git commit -m "feat(tv-dashboard): add consolidated edge function with single SQL query"
```

---

## Task 3: Hook `useTVDashboardData`

**Files:**
- Create: `src/hooks/useTVDashboardData.ts`

- [ ] **Step 1: Define TypeScript interfaces**

Define all interfaces matching the edge function response:
- `TVDashboardResponse` — top-level with generatedAt, nextRefreshMs, kpis, queue, agents, ranking, staleTickets, stageBreakdown
- `TVKPIs` — reuse/extend from existing types
- `TVQueueItem` — with satisfactionScore, slaThresholdMinutes, customerPhone, tags
- `TVAgentWorkload` — with sla fields
- `TVAgentRank` — resolved, avgResolutionSeconds, avgCsat
- `TVStaleTicket` — with staleMinutes
- `TVStageCount` — with violated/atRisk counts

- [ ] **Step 2: Implement the useQuery for polling**

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const { data, isLoading } = useQuery({
  queryKey: ['tv-dashboard-v3'],
  queryFn: async () => {
    const { data, error } = await supabase.functions.invoke('tv-dashboard-data')
    if (error) throw error
    return data as TVDashboardResponse
  },
  refetchInterval: (query) => query.state.data?.nextRefreshMs ?? 30000,
  placeholderData: keepPreviousData,
  retry: 3,
})
```

- [ ] **Step 3: Implement Realtime subscription**

```typescript
const [isRealtime, setIsRealtime] = useState(true)
const queryClient = useQueryClient()

useEffect(() => {
  const channel = supabase.channel('tv-queue-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ai_conversations',
      filter: 'status=in.(aguardando,em_atendimento)',
    }, (payload) => {
      // Merge: update queue item in cached data
      queryClient.setQueryData<TVDashboardResponse>(['tv-dashboard-v3'], (old) => {
        if (!old) return old
        return mergeRealtimeEvent(old, payload)
      })
    })
    .subscribe((status) => {
      setIsRealtime(status === 'SUBSCRIBED')
    })

  return () => { supabase.removeChannel(channel) }
}, [queryClient])
```

- [ ] **Step 4: Implement mergeRealtimeEvent helper**

This function takes the current data and a Realtime payload, and:
- For INSERT: adds the new conversation to queue array, increments kpis.totalWaiting
- For UPDATE: updates the matching queue item, adjusts counters if status changed
- For DELETE: removes from queue, decrements counters
- Does NOT recalculate heavy KPIs (CSAT, TMA) — those wait for next polling cycle

- [ ] **Step 5: Implement fallback logic**

If Realtime disconnects, reduce refetchInterval to 15000ms. When reconnected, restore to 30000ms.

- [ ] **Step 6: Export the hook**

```typescript
export function useTVDashboardData(): {
  data: TVDashboardResponse | undefined
  isLoading: boolean
  isRealtime: boolean
}
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useTVDashboardData.ts
git commit -m "feat(tv-dashboard): add consolidated hook with polling + realtime"
```

---

## Task 4: TVScoreboard Component

**Files:**
- Create: `src/components/tv-dashboard/TVScoreboard.tsx`

- [ ] **Step 1: Create the scoreboard component**

Props: `{ kpis: TVKPIs, isTVMode: boolean }`

Renders a top bar with 4 mega-numbers:
1. **Na Fila** — kpis.totalWaiting (icon: Users)
2. **Resolvidos** — kpis.resolvedToday (icon: CheckCircle)
3. **CSAT** — kpis.avgCsatToday formatted to 1 decimal (icon: Star)
4. **Tempo Médio** — kpis.avgResolutionSecondsToday formatted as "Xmin" or "Xh Ym" (icon: Clock)

TV mode: font-size 64-72px Poppins bold, height 120px
Desktop mode: font-size 24px, height 56px, single row

Background color logic based on kpis.totalWaiting:
- 0-4: navy `#071520` (normal)
- 5-10: `rgba(255,184,0,0.15)` with yellow text accent
- >10: `rgba(220,38,38,0.15)` with red pulsing animation

Each number has a label above (10px uppercase) and the number below. Use inline styles with GMS tokens.

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVScoreboard.tsx
git commit -m "feat(tv-dashboard): add TVScoreboard with reactive background"
```

---

## Task 5: TVQueueCard Component

**Files:**
- Create: `src/components/tv-dashboard/TVQueueCard.tsx`

- [ ] **Step 1: Create the queue card component**

Props: `{ item: TVQueueItem, isTVMode: boolean }`

Layout (see spec for wireframe):
- Row 1: `#ticketNumber` + status badge + live timer (incrementing every second via useEffect/setInterval)
- Row 2: Customer name + phone
- Row 3: Subject (1 line truncated)
- Row 4: Board tag + category tags
- Row 5: Humor emoji+label + handler (IA/Human icon+name)
- Row 6: SLA progress bar (elapsed / threshold)

Timer: calculate elapsed from `item.startedAt` using `Date.now()`, update every second with `useEffect` + `setInterval`. Color changes per severity thresholds.

Humor mapping from `item.satisfactionScore`:
- 4-5: 😊 Satisfeito (#16A34A)
- 3-4: 😐 Neutro (#666)
- 2-3: 😤 Frustrado (#FFB800)
- 1-2: 🔥 Irritado (#DC2626)
- null: 🤷 Sem dados (#666)

SLA bar: `width: Math.min(100, (elapsed/threshold)*100)%`, color gradient via severity.

TV mode: card height ~110px, font 14-16px
Desktop mode: card height ~85px, font 12-13px, cursor pointer

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVQueueCard.tsx
git commit -m "feat(tv-dashboard): add TVQueueCard with live timer, humor, SLA bar"
```

---

## Task 6: Rewrite TVQueuePanel

**Files:**
- Modify: `src/components/tv-dashboard/TVQueuePanel.tsx`

- [ ] **Step 1: Rewrite TVQueuePanel**

Props: `{ queue: TVQueueItem[], kpis: TVKPIs, isRealtime: boolean, isTVMode: boolean }`

Layout:
- Header: "Fila ao Vivo" + Realtime indicator (green dot pulsing = realtime, yellow = polling fallback) + count badge
- Mini KPI strip: Avg wait | Max wait | Total open (compact)
- Scrollable list of `TVQueueCard` components
- Sorted by SLA urgency: tickets closest to violating threshold appear first (sort by `elapsed/threshold` descending)
- TV mode: auto-scroll via CSS animation when items > 6, smooth loop
- Desktop mode: manual scroll, cards are clickable

Auto-scroll implementation for TV mode:
```css
@keyframes tv-queue-scroll {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
```
Duplicate the items list (items + items) and animate, creating infinite scroll effect. Only activate when queue.length > 6.

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVQueuePanel.tsx
git commit -m "feat(tv-dashboard): rewrite TVQueuePanel with rich cards and auto-scroll"
```

---

## Task 7: Rewrite TVNavBar

**Files:**
- Modify: `src/components/tv-dashboard/TVNavBar.tsx`

- [ ] **Step 1: Rewrite TVNavBar**

Changes from current:
- Reduce to 4 tabs in TV mode (Overview, Carga, SLA, Ranking) — remove AI Comparison
- Keep 5 tabs in Desktop mode (add AI Comparison as 5th)
- Add "AO VIVO" indicator: green dot pulsing when `isRealtime=true`, yellow dot when false
- Add mode toggle button (TV/Desktop) visible only on desktop
- Keep existing: clock, queue badge, progress bar, pause logic

Props: add `isRealtime: boolean`, `isTVMode: boolean`, `onToggleMode: () => void`

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVNavBar.tsx
git commit -m "feat(tv-dashboard): update TVNavBar with realtime indicator and mode toggle"
```

---

## Task 8: Rewrite TVOverviewView

**Files:**
- Modify: `src/components/tv-dashboard/TVOverviewView.tsx`

- [ ] **Step 1: Rewrite for TV-friendly layout**

Accept `isTVMode: boolean` prop in addition to existing data props.

TV mode changes:
- KPI cards: numbers 48px Poppins bold instead of 32px
- Queue-by-board section: bars thicker (16px), labels 16px
- Stage breakdown: larger chips with counts
- Remove dense grid, use 2-column layout with generous spacing
- Top performers: show top 3 only with large numbers

Desktop mode: keep current dense layout but with updated data from new hook.

Adapt all data props to match new `TVDashboardResponse` shape.

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVOverviewView.tsx
git commit -m "feat(tv-dashboard): rewrite TVOverviewView for dual TV/desktop mode"
```

---

## Task 9: Rewrite TVAgentWorkloadView

**Files:**
- Modify: `src/components/tv-dashboard/TVAgentWorkloadView.tsx`

- [ ] **Step 1: Rewrite for TV-friendly layout**

Accept `isTVMode: boolean` prop.

TV mode changes:
- Agent name: 20px font
- Online/offline indicator: larger dot (12px)
- Workload bars: 14px height, label 16px
- SLA badges: 14px font
- Max 8 agents visible, auto-scroll if more

Desktop mode: keep tabular layout with all agents visible.

Adapt props to `TVAgentWorkload[]` from new hook.

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVAgentWorkloadView.tsx
git commit -m "feat(tv-dashboard): rewrite TVAgentWorkloadView for TV mode"
```

---

## Task 10: Rewrite TVSLAView

**Files:**
- Modify: `src/components/tv-dashboard/TVSLAView.tsx`

- [ ] **Step 1: Rewrite for TV-friendly layout**

Accept `isTVMode: boolean` prop.

TV mode changes:
- Donut chart: 250px diameter (up from ~180px)
- Compliance percentage: 64px font
- Violated tickets list: 16px font, max 5 shown
- SLA by board: larger bars

Desktop mode: keep current layout with slightly larger text.

Adapt props to new data shapes.

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVSLAView.tsx
git commit -m "feat(tv-dashboard): rewrite TVSLAView for TV mode"
```

---

## Task 11: Rewrite TVPerformanceView

**Files:**
- Modify: `src/components/tv-dashboard/TVPerformanceView.tsx`

- [ ] **Step 1: Rewrite for TV-friendly layout**

Accept `isTVMode: boolean` prop.

TV mode changes:
- Spotlight card: agent name 32px, resolved count 64px
- Medal display: 48px emoji
- Progress bars: 14px height
- Show top 5 only

Desktop mode: show all agents with compact bars.

Adapt props to `TVAgentRank[]` from new hook.

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVPerformanceView.tsx
git commit -m "feat(tv-dashboard): rewrite TVPerformanceView for TV mode"
```

---

## Task 12: Rewrite TVDashboard Page

**Files:**
- Modify: `src/pages/TVDashboard.tsx`

- [ ] **Step 1: Rewrite the main page**

This is the orchestrator. Changes:

1. Replace `useTVDashboardMetrics()` with `useTVDashboardData()`
2. Add TV mode detection:
```typescript
const [isTVMode, setIsTVMode] = useState(() => {
  return new URLSearchParams(window.location.search).get('mode') === 'tv'
    || (window.innerWidth >= 1920 && !window.matchMedia('(pointer: fine)').matches)
})
```
3. Reduce TV rotation to 4 views (no AI Comparison)
4. Update `useTVAutoRotation` VIEW_COUNT to be dynamic based on mode
5. New layout structure:
   - TVScoreboard (top, always visible)
   - TVNavBar (below scoreboard)
   - Main area: TVQueuePanel (right 30%) + Rotatable views (left 70%)
   - Ticker (bottom) with stale tickets scroll
6. Alert banner for SLA violations (keep existing)
7. Loading state: only show on initial load, use timeout fallback

Pass `isTVMode` to all child components.

- [ ] **Step 2: Commit**

```bash
git add src/pages/TVDashboard.tsx
git commit -m "feat(tv-dashboard): rewrite page with dual mode and new data hook"
```

---

## Task 13: Delete Old Files

**Files:**
- Delete: `src/hooks/useTVDashboardMetrics.ts`
- Delete: `src/components/tv-dashboard/TVKPIStrip.tsx`
- Delete: `src/components/tv-dashboard/TVQueueView.tsx`
- Delete: `src/components/tv-dashboard/TVStaleTickets.tsx`
- Delete: `src/components/tv-dashboard/TVAgentRanking.tsx`

- [ ] **Step 1: Remove old files**

```bash
git rm src/hooks/useTVDashboardMetrics.ts
git rm src/components/tv-dashboard/TVKPIStrip.tsx
git rm src/components/tv-dashboard/TVQueueView.tsx
git rm src/components/tv-dashboard/TVStaleTickets.tsx
git rm src/components/tv-dashboard/TVAgentRanking.tsx
```

- [ ] **Step 2: Remove any remaining imports of deleted files**

Search for imports of the deleted files across the codebase and remove them. The only consumer should be `TVDashboard.tsx` which was already rewritten.

Keep `TVAIComparisonView.tsx` — it's used as a desktop-only tab.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(tv-dashboard): remove old metrics hook and consolidated components"
```

---

## Task 14: Update useTVAutoRotation

**Files:**
- Modify: `src/hooks/useTVAutoRotation.ts`

- [ ] **Step 1: Make VIEW_COUNT configurable**

Change from hardcoded `VIEW_COUNT = 5` to accept a parameter:

```typescript
export function useTVAutoRotation(viewCount = 5): UseTVAutoRotationReturn {
  // ... existing logic but using viewCount instead of VIEW_COUNT constant
}
```

This allows TVDashboard to pass 4 for TV mode and 5 for desktop mode.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTVAutoRotation.ts
git commit -m "refactor(tv-dashboard): make auto-rotation view count configurable"
```

---

## Task 15: Final Verification and Deploy

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Fix any issues found**

If TS or build fails, fix the issues before proceeding.

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(tv-dashboard): address build issues from v3 rewrite"
```

- [ ] **Step 5: Deploy via /deploy-update**

Run the deploy-update skill to push, merge, deploy edge function, notify Discord, and register in system_updates.
