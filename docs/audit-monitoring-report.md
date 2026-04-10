# Audit Report: Monitoring & Logging Infrastructure

**Project**: Sismais Helpdesk (sismais-assist-chat)
**Date**: 2026-03-30
**Auditor**: Backend Architect Agent
**Scope**: API logs, AI consumption dashboard, agent activity, backend logging, database schemas

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [API Logs Page](#1-api-logs-page)
3. [AI Consumption Dashboard](#2-ai-consumption-dashboard)
4. [Agent Activity Page](#3-agent-activity-page)
5. [Backend Logging Infrastructure](#4-backend-logging-infrastructure)
6. [Database Schema Analysis](#5-database-schema-analysis)
7. [Dashboard Main Page](#6-dashboard-main-page)
8. [Data Fetching Patterns](#7-data-fetching-patterns)
9. [Improvement Proposals](#8-improvement-proposals)
10. [Priority Matrix](#9-priority-matrix)

---

## Executive Summary

The monitoring infrastructure is **functional but immature**. There are three separate logging tables (`ai_messages`, `ai_api_logs`, `ai_usage_log`) with overlapping purposes and no unified strategy. The frontend dashboards are well-designed visually but suffer from client-side aggregation of unbounded datasets, no real-time capabilities, no alerting, and missing migration files for two of the three log tables. The pipeline-metrics system exists but is gated behind a feature flag and has no frontend exposure.

**Critical findings**:
- `ai_api_logs` and `ai_usage_log` tables have **no migration files** -- schema is untracked
- `useApiLogStats` fetches **all rows** to compute aggregates client-side (performance bomb)
- **Zero alerting** on cost thresholds or error rate spikes
- **No real-time** log streaming anywhere
- **No data retention policy** on `ai_api_logs` or `ai_usage_log`
- **No CSV export** on the ApiLogs page

---

## 1. API Logs Page

**File**: `src/pages/ApiLogs.tsx`

### Current State

| Feature | Status |
|---------|--------|
| Table with expandable rows | OK |
| Period filter (today/7d/30d/all) | OK |
| Edge function filter | OK |
| Status filter (success/error/timeout) | OK |
| Pagination (50 rows/page) | OK |
| Summary metrics (calls, cost, latency, error rate) | OK |
| Manual refresh button | OK |
| Request/response detail expansion | OK |

### Issues Found

#### CRITICAL -- Stats query fetches all rows client-side (P0)

```typescript
// useApiLogStats lines 98-123
// Fetches ALL rows matching period, then reduces in JS
const { data, error } = await query  // unbounded SELECT *
const rows = (data || []) as ApiLog[]
const totalCost = rows.reduce(...)
```

For a 30-day window with thousands of API calls, this fetches the entire dataset just to compute 4 aggregate numbers. This should be a database-side aggregation (SQL `SUM`, `AVG`, `COUNT`).

**Severity**: CRITICAL -- will degrade as data grows, potential browser OOM.

#### CRITICAL -- Edge functions list also fetches all rows (P0)

```typescript
// useEdgeFunctions lines 127-145
// Fetches all rows just to get DISTINCT edge_function values
const { data, error } = await query  // full table scan
const unique = [...new Set(data.map(r => r.edge_function))]
```

Should use `SELECT DISTINCT edge_function` or a Supabase RPC.

**Severity**: CRITICAL -- same unbounded fetch problem.

#### HIGH -- No real-time updates (P1)

The page has a manual "Atualizar" button but no auto-refresh or WebSocket subscription. For a log viewer, this is a significant gap -- operators must manually poll.

#### HIGH -- No CSV/JSON export (P1)

Unlike the AI Consumption Dashboard which has CSV export, ApiLogs has no export capability.

#### MEDIUM -- Missing filters (P2)

- No model filter (the column exists in the table)
- No conversation ID search
- No date range picker (only presets)
- No text search across error messages
- No latency threshold filter (e.g., "show only calls > 2000ms")

#### MEDIUM -- No cost conversion to BRL (P2)

Costs are displayed only in USD. The AI Consumption Dashboard converts to BRL but ApiLogs does not.

#### LOW -- `(supabase as any)` type casting (P3)

```typescript
let query = (supabase as any).from('ai_api_logs')
```

This suggests `ai_api_logs` is not in the generated Supabase types, likely because it has no tracked migration.

---

## 2. AI Consumption Dashboard

**File**: `src/pages/AIConsumptionDashboard.tsx`

### Current State

| Feature | Status |
|---------|--------|
| 7 tabs (Overview, Messages, Features, Agents, Models, Performance, Top Conversations) | OK |
| Period selector (today/week/month/year) | OK |
| KPI cards with trend comparison vs previous period | OK |
| Cost/tokens area chart | OK |
| Per-agent breakdown with progress bars | OK |
| Per-model breakdown | OK |
| Per-feature pie chart (from ai_usage_log) | OK |
| Hourly performance chart | OK |
| Top 10 most expensive conversations | OK |
| CSV export | OK |
| BRL conversion via live exchange rate | OK |

### Issues Found

#### HIGH -- useAIConsumption fetches all rows (P1)

```typescript
// useAIAnalytics.ts line 10-14
const { data, error } = await query;  // SELECT * with no limit
const logs = (data || []) as any[];
const total_tokens = logs.reduce(...)
```

Fetches all `ai_messages` rows for the period to compute aggregates. For a "year" period, this could be tens of thousands of rows loaded into memory.

#### HIGH -- useAIMessagesLog has a 200 row hard limit (P1)

```typescript
.limit(200)
```

The Messages tab shows at most 200 records with no pagination. Users cannot see beyond this limit. The "Total do Periodo" footer sums only the visible 200 rows, making it inaccurate.

#### MEDIUM -- Performance tab avgTime is always 0 (P2)

```typescript
// useHourlyStats line 63
avgTime: 0,  // hardcoded
```

The "Tempo Medio" line on the performance chart is always flat at zero. The `ai_messages` table has no latency/response_time column, so this metric cannot be populated from the current schema.

#### MEDIUM -- No alerting on cost thresholds (P2)

No mechanism to warn users when daily/weekly/monthly costs exceed a configurable threshold.

#### MEDIUM -- Exchange rate fallback is stale (P2)

```typescript
const FALLBACK_RATE = 5.5
```

The hardcoded fallback rate of 5.5 BRL/USD may drift significantly. As of March 2026, this should be periodically reviewed.

#### LOW -- CSV export only covers Messages tab (P3)

Only `messagesLog` data is exported. Agent, model, and feature breakdowns cannot be exported.

---

## 3. Agent Activity Page

**File**: `src/pages/AgentActivity.tsx`

### Current State

| Feature | Status |
|---------|--------|
| Agent header with specialty badge and active status | OK |
| Date presets (today/7d/30d) | OK |
| 4 KPI cards (conversations, AI resolution rate, avg confidence, total cost) | OK |
| Conversations tab with status and AI resolution | OK |
| Messages tab with confidence, cost, tools, intent | OK |
| Audit tab with guardrails triggered and response time | OK |

### Issues Found

#### HIGH -- No CSAT tracking per agent (P1)

The KPI cards show conversations, resolution rate, confidence, and cost, but **CSAT is missing**. The `ai_conversations` table has `csat_rating` but it is not surfaced on this page.

#### HIGH -- No pagination on any tab (P1)

Conversations, messages, and audit logs are rendered without pagination or virtualization. For a busy agent over 30 days, this could render thousands of rows.

#### MEDIUM -- Clicking a conversation navigates to generic Kanban (P2)

```typescript
onClick={() => navigate(`/kanban/support`)}
```

Clicking a conversation row navigates to `/kanban/support` instead of the specific conversation. This breaks the drill-down UX.

#### MEDIUM -- Missing KPIs (P2)

- Average response time per agent
- Escalation rate
- First response time
- Messages per conversation
- Tool usage frequency
- Token consumption trend

#### LOW -- No export capability (P3)

No way to export agent activity data.

---

## 4. Backend Logging Infrastructure

### 4.1 logger.ts (simple logger)

**File**: `supabase/functions/_shared/logger.ts`

Simple JSON logger outputting to console. Outputs structured JSON with timestamp, level, function name, and arbitrary data. No correlation ID support.

### 4.2 structured-log.ts (advanced logger)

**File**: `supabase/functions/_shared/structured-log.ts`

More advanced logger with:
- Correlation ID (`requestId`) generation and propagation
- `x-request-id` header extraction/propagation
- `generateRequestId()` with format `req_<timestamp_base36>_<random>`

### 4.3 structured-logger.ts (deprecated wrapper)

**File**: `supabase/functions/_shared/structured-logger.ts`

Re-exports everything from `structured-log.ts`. Deprecated but still importable.

### 4.4 log-ai-cost.ts

**File**: `supabase/functions/_shared/log-ai-cost.ts`

Inserts into `ai_usage_log` table. Fire-and-forget (never fails the main operation).

### 4.5 pipeline-metrics.ts

**File**: `supabase/functions/_shared/pipeline-metrics.ts`

Inserts into `pipeline_metrics` table. Gated behind `FF_PIPELINE_METRICS` feature flag. Fire-and-forget.

### Issues Found

#### HIGH -- Two parallel logging systems with no unification (P1)

There are three separate log destinations:
1. `ai_messages` -- per-message token/cost tracking (used by AI Consumption Dashboard)
2. `ai_api_logs` -- per-API-call logging (used by API Logs page)
3. `ai_usage_log` -- per-feature cost logging (used by Features tab)

Plus `pipeline_metrics` for operational metrics. These overlap significantly but are never correlated. A single API call may be logged in `ai_messages` AND `ai_api_logs` AND `ai_usage_log` with no shared key.

#### HIGH -- No error classification taxonomy (P1)

Errors are stored as free-text `error_message`. There is no structured error categorization (rate_limit, auth_failure, timeout, model_error, context_length_exceeded, etc.) which makes it impossible to build error dashboards or alerting rules.

#### MEDIUM -- logger.ts has no correlation ID (P2)

The simple `logger.ts` does not support correlation IDs. Only `structured-log.ts` does. If some edge functions use the simple logger, tracing is broken.

#### MEDIUM -- pipeline-metrics is feature-flagged off by default (P2)

The `FF_PIPELINE_METRICS` env var must be `'true'` for any metrics to be recorded. There is no frontend UI for this data, so even when enabled, it is invisible.

#### LOW -- log-ai-cost.ts silently swallows errors (P3)

```typescript
console.warn(`[log-ai-cost] Failed to log cost: ${(err as Error).message}`)
```

Cost logging failures are only warned to console, never tracked or alerted on. If the `ai_usage_log` table is misconfigured, all feature cost data silently disappears.

---

## 5. Database Schema Analysis

### 5.1 ai_messages (has migration)

**Migration**: `20260213202505_190362f2-a270-4232-90b4-bb9332c1dc85.sql`

```sql
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES ai_conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_id UUID REFERENCES ai_agents(id),
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL,
  intent TEXT,
  confidence DECIMAL,
  tools_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX idx_messages_created ON ai_messages(created_at DESC);
```

**Issues**:
- No index on `agent_id` -- agent consumption queries do full scans
- No index on `model_used` -- model consumption queries do full scans
- No index on `total_tokens IS NOT NULL` -- all analytics queries filter on this
- No `latency_ms` column -- performance tab shows 0
- `content TEXT NOT NULL` stores full message content alongside analytics data -- bloats the table
- No retention/archival strategy -- table grows indefinitely
- Missing composite index for the common query pattern: `(created_at DESC, total_tokens) WHERE total_tokens IS NOT NULL`

### 5.2 ai_api_logs (NO migration found)

**CRITICAL**: No migration file exists. The table is referenced in `ApiLogs.tsx` and `openrouter-client.ts` but its schema is not version-controlled. This means:
- Schema changes cannot be tracked or rolled back
- Indexes may be missing or inconsistent across environments
- Column types are unknown/undocumented

Based on the TypeScript interface, the expected schema is:

```typescript
interface ApiLog {
  id: string
  created_at: string
  edge_function: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number | null
  status: string
  error_message: string | null
  conversation_id: string | null
  agent_id: string | null
  request_summary: any   // JSONB
  response_summary: any  // JSONB
}
```

### 5.3 ai_usage_log (NO migration found)

**CRITICAL**: No migration file exists. Schema is inferred from `log-ai-cost.ts`:

```typescript
// Columns: model, feature, input_tokens, output_tokens, cost_usd, conversation_id
```

### 5.4 pipeline_metrics (has migration)

**Migration**: `20260319120003_pipeline_metrics.sql`

Well-structured with:
- Proper indexes on `created_at`, `edge_function`, `event_type`, and `success=false`
- RLS enabled with authenticated read policy
- 30-day cleanup function (but not scheduled as a cron)

**Issue**: The `cleanup_old_pipeline_metrics()` function exists but is never called automatically. There is no `pg_cron` job or Supabase scheduled function to invoke it.

---

## 6. Dashboard Main Page

**File**: `src/pages/Dashboard.tsx`

### AI-Related Metrics on Main Dashboard

| Metric | Source |
|--------|--------|
| IA Resolveu % | `todayStats.aiResolvedPercent` |
| CSAT Medio | `todayStats.avgCsat` |
| Agent cards with AI metrics | `agentMetrics` |
| CostMetrics component | `todayCosts` |
| AI Learning Insights | Dedicated component |

The main dashboard has **auto-refresh every 60 seconds** via `setInterval`, which is the only screen with any form of automatic updates.

**Issue**: The 60-second polling is not resource-efficient. It calls `queryClient.invalidateQueries()` which invalidates ALL queries, not just dashboard ones.

---

## 7. Data Fetching Patterns

**File**: `src/hooks/useAIAnalytics.ts`

### Issues Found

#### CRITICAL -- All aggregation is client-side (P0)

Every hook (`useAIConsumption`, `useAgentConsumption`, `useModelConsumption`, `useFeatureConsumption`) fetches raw rows and aggregates in JavaScript. This pattern:

1. Transfers excessive data over the network
2. Consumes browser memory proportional to dataset size
3. Blocks the main thread during reduce operations
4. Gets worse linearly as data grows

**Solution**: Create Supabase RPC functions (database functions) for aggregation:

```sql
CREATE FUNCTION get_ai_consumption_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(total_tokens bigint, total_cost numeric, total_calls bigint, avg_latency numeric)
AS $$
  SELECT
    COALESCE(SUM(total_tokens), 0),
    COALESCE(SUM(cost_usd), 0),
    COUNT(*),
    COALESCE(AVG(latency_ms), 0)
  FROM ai_messages
  WHERE created_at BETWEEN p_start AND p_end
    AND total_tokens IS NOT NULL;
$$ LANGUAGE sql STABLE;
```

#### HIGH -- `as any` casting throughout (P1)

Both `ai_api_logs` and `ai_usage_log` are accessed via `(supabase as any).from(...)`, bypassing TypeScript type safety. This happens because these tables have no migrations and therefore no generated types.

---

## 8. Improvement Proposals

### 8.1 Real-Time Log Streaming (HIGH PRIORITY)

**Implementation**: Use Supabase Realtime to subscribe to `ai_api_logs` inserts.

```typescript
useEffect(() => {
  const channel = supabase
    .channel('api-logs-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ai_api_logs',
    }, (payload) => {
      queryClient.setQueryData(['api-logs', ...], (old) => ({
        ...old,
        rows: [payload.new, ...old.rows].slice(0, PAGE_SIZE),
        total: old.total + 1,
      }))
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [])
```

**Effort**: 2-3 hours. **Impact**: High -- eliminates manual polling.

### 8.2 Cost Alert System (HIGH PRIORITY)

**Implementation**: Create a Supabase Edge Function triggered by `pg_cron` that checks daily cost against configurable thresholds.

```sql
-- Table for alert configuration
CREATE TABLE ai_cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  threshold_usd DECIMAL NOT NULL,
  webhook_url TEXT,          -- for Slack/Discord notifications
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Edge function (scheduled daily):
1. Query `SUM(cost_usd)` from `ai_messages` for current day/week/month
2. Compare against thresholds in `ai_cost_alerts`
3. Fire webhook or send email if exceeded

**Effort**: 1 day. **Impact**: Prevents cost surprises.

### 8.3 Server-Side Aggregation (CRITICAL PRIORITY)

Replace all client-side `reduce()` operations with Supabase RPC functions.

Create these database functions:
- `get_ai_consumption_summary(start, end)` -- totals for KPI cards
- `get_ai_consumption_by_agent(start, end)` -- grouped by agent
- `get_ai_consumption_by_model(start, end)` -- grouped by model
- `get_ai_consumption_by_feature(start, end)` -- grouped by feature
- `get_ai_consumption_daily(start, end)` -- daily time series for charts
- `get_api_log_stats(start, end)` -- aggregates for ApiLogs page

**Effort**: 1 day. **Impact**: Critical -- prevents performance degradation.

### 8.4 Unified Log Schema (MEDIUM PRIORITY)

Consolidate `ai_api_logs`, `ai_usage_log`, and the token fields in `ai_messages` into a single normalized design:

- `ai_messages` keeps conversation content (role, content, intent, sentiment)
- `ai_api_calls` (renamed from `ai_api_logs`) is the single source of truth for all API call metrics (tokens, cost, latency, model, status, error)
- Foreign key from `ai_messages.id` to `ai_api_calls.message_id`
- Drop `ai_usage_log` -- its `feature` field becomes a column on `ai_api_calls`

**Effort**: 2-3 days (migration + backend + frontend). **Impact**: Eliminates data inconsistency.

### 8.5 Missing Migration Files (CRITICAL PRIORITY)

Create migration files for:
1. `ai_api_logs` -- with proper indexes on `(created_at DESC)`, `(edge_function, created_at DESC)`, `(status, created_at DESC) WHERE status != 'success'`
2. `ai_usage_log` -- with proper indexes on `(created_at DESC)`, `(feature, created_at DESC)`

Also add the missing indexes on `ai_messages`:
```sql
CREATE INDEX idx_messages_agent ON ai_messages(agent_id);
CREATE INDEX idx_messages_model ON ai_messages(model_used);
CREATE INDEX idx_messages_tokens ON ai_messages(created_at DESC) WHERE total_tokens IS NOT NULL;
```

**Effort**: 2 hours. **Impact**: Critical for schema traceability and query performance.

### 8.6 Data Retention Strategy (MEDIUM PRIORITY)

- `ai_messages`: Keep 90 days hot, archive older to a `ai_messages_archive` table or delete
- `ai_api_logs`: Keep 30 days (detailed), roll up to daily aggregates for historical
- `pipeline_metrics`: Already has cleanup function -- schedule it via `pg_cron`
- `ai_usage_log`: Keep 90 days, roll up monthly

```sql
-- Schedule cleanup (add to migration)
SELECT cron.schedule('cleanup-pipeline-metrics', '0 3 * * *', 'SELECT cleanup_old_pipeline_metrics()');
SELECT cron.schedule('cleanup-api-logs', '0 3 * * *', $$DELETE FROM ai_api_logs WHERE created_at < now() - interval '30 days'$$);
```

**Effort**: Half day. **Impact**: Prevents unbounded table growth.

### 8.7 Error Categorization (MEDIUM PRIORITY)

Add an `error_category` enum column to `ai_api_logs`:

```sql
CREATE TYPE ai_error_category AS ENUM (
  'rate_limit', 'auth_failure', 'timeout', 'model_error',
  'context_length', 'content_filter', 'network', 'unknown'
);
ALTER TABLE ai_api_logs ADD COLUMN error_category ai_error_category;
```

Backend: Parse error messages in `openrouter-client.ts` to classify before inserting.

**Effort**: Half day. **Impact**: Enables error dashboards and targeted alerting.

### 8.8 CSV Export on ApiLogs Page (LOW PRIORITY)

Port the `downloadCSV` helper from `AIConsumptionDashboard.tsx` to `ApiLogs.tsx`.

**Effort**: 1 hour. **Impact**: Low -- operational convenience.

### 8.9 Model Performance Comparison Dashboard (LOW PRIORITY)

New tab or page showing:
- Latency p50/p95/p99 per model
- Error rate per model
- Cost per token per model
- Tokens/second throughput

Requires the `latency_ms` column to be consistently populated.

**Effort**: 1-2 days. **Impact**: Helps optimize model selection.

### 8.10 A/B Testing Framework for Prompts (LOW PRIORITY -- LONG TERM)

Track prompt versions, assign conversations to variants, measure resolution rate and CSAT per variant.

**Effort**: 1-2 weeks. **Impact**: High long-term, but requires significant design work.

---

## 9. Priority Matrix

### Quick Wins (< 1 day, high impact)

| # | Item | Effort | Severity |
|---|------|--------|----------|
| 1 | Create migration files for `ai_api_logs` and `ai_usage_log` | 2h | CRITICAL |
| 2 | Add missing indexes on `ai_messages` | 30min | HIGH |
| 3 | Schedule `cleanup_old_pipeline_metrics` via pg_cron | 30min | MEDIUM |
| 4 | Add CSV export to ApiLogs page | 1h | LOW |
| 5 | Fix agent activity conversation click to navigate to specific conversation | 30min | MEDIUM |

### Short-Term (1-3 days, critical fixes)

| # | Item | Effort | Severity |
|---|------|--------|----------|
| 6 | Replace all client-side aggregation with Supabase RPCs | 1d | CRITICAL |
| 7 | Add real-time log streaming via Supabase Realtime | 3h | HIGH |
| 8 | Add cost threshold alerting system | 1d | HIGH |
| 9 | Add error categorization to ai_api_logs | 0.5d | MEDIUM |
| 10 | Fix Performance tab avgTime always being 0 | 3h | MEDIUM |
| 11 | Add pagination to Agent Activity tabs | 3h | HIGH |
| 12 | Add BRL conversion to ApiLogs page | 1h | MEDIUM |

### Medium-Term (1-2 weeks)

| # | Item | Effort | Severity |
|---|------|--------|----------|
| 13 | Unify log schema (ai_api_logs + ai_usage_log + ai_messages tokens) | 3d | HIGH |
| 14 | Implement data retention/archival strategy | 1d | MEDIUM |
| 15 | Add model filter, date picker, text search to ApiLogs | 1d | MEDIUM |
| 16 | Pipeline metrics frontend dashboard | 2d | MEDIUM |
| 17 | Model performance comparison dashboard | 2d | LOW |
| 18 | Add CSAT and additional KPIs to Agent Activity | 1d | HIGH |

### Long-Term (> 2 weeks)

| # | Item | Effort | Severity |
|---|------|--------|----------|
| 19 | A/B testing framework for prompts | 2w | LOW |
| 20 | Move to dedicated observability stack (Grafana/Datadog) | 2-4w | LOW |
| 21 | Anomaly detection on cost/error patterns | 1-2w | LOW |

---

## Summary of Findings by Severity

| Severity | Count | Key Items |
|----------|-------|-----------|
| CRITICAL | 4 | Client-side aggregation (3 locations), missing migrations |
| HIGH | 8 | No real-time, no alerting, no pagination, missing CSAT, type safety |
| MEDIUM | 8 | Missing filters, hardcoded avgTime=0, retention, error classification |
| LOW | 4 | CSV export, model comparison, A/B testing, exchange rate fallback |

**Recommended immediate action**: Items 1, 2, and 6 from the Quick Wins and Short-Term lists. These address the most critical performance and schema management issues.
