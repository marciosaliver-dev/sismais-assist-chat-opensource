-- Migration: AI Cost Daily Summary (Onda 6A)
-- Creates materialized view aggregating ai_api_logs by day/agent/function/model
-- Refreshed hourly via pg_cron. Used by ai-cost-monitor edge function
-- for daily cost spike alerting.
--
-- Rationale: ai_api_logs captures each LLM call but there was no aggregation
-- layer. Running ad-hoc GROUP BY queries on the raw table becomes expensive
-- as volume grows. A materialized view gives us fast reads for dashboards
-- and monitoring, refreshed every hour (fresh enough for cost alerts).
--
-- Rollback:
--   SELECT cron.unschedule('refresh-ai-cost-daily');
--   DROP MATERIALIZED VIEW IF EXISTS ai_cost_daily_summary CASCADE;

-- ========================================================================
-- 1. Materialized View
-- ========================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS ai_cost_daily_summary AS
SELECT
  DATE(created_at)                                          AS day,
  agent_id,
  edge_function,
  model,
  COUNT(*)                                                  AS calls,
  COALESCE(SUM(prompt_tokens), 0)                           AS prompt_tokens,
  COALESCE(SUM(completion_tokens), 0)                       AS completion_tokens,
  COALESCE(SUM(total_tokens), 0)                            AS total_tokens,
  COALESCE(SUM(cost_usd), 0)                                AS cost_usd,
  ROUND(AVG(NULLIF(latency_ms, 0))::numeric, 2)             AS avg_latency_ms,
  COUNT(*) FILTER (WHERE status = 'success')                AS successes,
  COUNT(*) FILTER (WHERE status = 'error')                  AS errors,
  COUNT(*) FILTER (WHERE status = 'timeout')                AS timeouts,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'success')::numeric
    / NULLIF(COUNT(*), 0) * 100,
    2
  )                                                          AS success_rate_pct
FROM ai_api_logs
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3, 4;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_cost_daily_pk
  ON ai_cost_daily_summary (day, agent_id, edge_function, model);

-- Query-optimized indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_ai_cost_daily_day
  ON ai_cost_daily_summary (day DESC);

CREATE INDEX IF NOT EXISTS idx_ai_cost_daily_agent_day
  ON ai_cost_daily_summary (agent_id, day DESC);

-- Comment for documentation
COMMENT ON MATERIALIZED VIEW ai_cost_daily_summary IS
'Daily aggregation of ai_api_logs by agent/edge_function/model. Refreshed hourly via pg_cron. Used by ai-cost-monitor for spike alerting. Window: last 90 days.';

-- ========================================================================
-- 2. Hourly refresh cron job
-- ========================================================================
-- Runs at the top of every hour. CONCURRENTLY prevents blocking reads
-- during refresh (requires the unique index above).
SELECT cron.schedule(
  'refresh-ai-cost-daily',
  '5 * * * *',  -- 5 minutes past every hour
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY ai_cost_daily_summary$$
);

-- ========================================================================
-- 3. RLS — materialized views don't support RLS directly.
-- Access is controlled via GRANTs. Restrict to authenticated users only.
-- ========================================================================
REVOKE ALL ON ai_cost_daily_summary FROM PUBLIC;
REVOKE ALL ON ai_cost_daily_summary FROM anon;
GRANT SELECT ON ai_cost_daily_summary TO authenticated;
GRANT SELECT ON ai_cost_daily_summary TO service_role;
