
-- Analytics Snapshots (daily metrics)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_conversations INTEGER DEFAULT 0,
  ai_handled INTEGER DEFAULT 0,
  human_handled INTEGER DEFAULT 0,
  hybrid_handled INTEGER DEFAULT 0,
  ai_resolution_rate DECIMAL(5,2),
  avg_response_time_seconds INTEGER,
  avg_resolution_time_seconds INTEGER,
  avg_csat DECIMAL(3,2),
  csat_responses_count INTEGER DEFAULT 0,
  total_escalations INTEGER DEFAULT 0,
  total_ai_cost_usd DECIMAL(10,4) DEFAULT 0,
  total_ai_cost_brl DECIMAL(10,2) DEFAULT 0,
  total_tokens_used BIGINT DEFAULT 0,
  active_agents_count INTEGER DEFAULT 0,
  avg_agent_confidence DECIMAL(3,2),
  automations_executed INTEGER DEFAULT 0,
  automations_success_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read analytics_snapshots" ON analytics_snapshots FOR SELECT USING (true);
CREATE POLICY "Service role write analytics_snapshots" ON analytics_snapshots FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON analytics_snapshots(snapshot_date DESC);

-- Customer Health Scores
CREATE TABLE IF NOT EXISTS customer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  health_score INTEGER DEFAULT 50,
  risk_level TEXT DEFAULT 'green',
  recency_days INTEGER,
  frequency_30d INTEGER,
  avg_csat DECIMAL(3,2),
  escalation_rate DECIMAL(5,2),
  payment_status TEXT DEFAULT 'ok',
  churn_probability DECIMAL(5,2) DEFAULT 0,
  churn_risk_factors JSONB DEFAULT '[]'::jsonb,
  customer_since DATE,
  total_interactions INTEGER DEFAULT 0,
  avg_resolution_time_seconds INTEGER,
  segment TEXT DEFAULT 'regular',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read customer_health_scores" ON customer_health_scores FOR SELECT USING (true);
CREATE POLICY "Service role write customer_health_scores" ON customer_health_scores FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_health_scores_risk ON customer_health_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_health_scores_score ON customer_health_scores(health_score);
CREATE INDEX IF NOT EXISTS idx_health_scores_churn ON customer_health_scores(churn_probability DESC);

-- Analytics Reports
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  filters JSONB DEFAULT '{}'::jsonb,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  generated_by UUID,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access analytics_reports" ON analytics_reports FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_date ON analytics_reports(generated_at DESC);

-- Function: get_analytics_kpis
CREATE OR REPLACE FUNCTION get_analytics_kpis(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_conversations BIGINT,
  ai_handled BIGINT,
  human_handled BIGINT,
  ai_resolution_rate DECIMAL,
  avg_response_time_seconds INTEGER,
  avg_csat DECIMAL,
  total_ai_cost_usd DECIMAL,
  total_ai_cost_brl DECIMAL,
  total_tokens_used BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_conversations,
    COUNT(*) FILTER (WHERE c.handler_type = 'ai')::BIGINT as ai_handled,
    COUNT(*) FILTER (WHERE c.handler_type = 'human')::BIGINT as human_handled,
    ROUND(
      COUNT(*) FILTER (WHERE c.handler_type = 'ai')::DECIMAL / 
      NULLIF(COUNT(*)::DECIMAL, 0) * 100, 
      2
    ) as ai_resolution_rate,
    COALESCE(AVG(c.resolution_time_seconds), 0)::INTEGER as avg_response_time_seconds,
    ROUND(COALESCE(AVG(c.csat_rating), 0)::DECIMAL, 2) as avg_csat,
    ROUND(COALESCE((
      SELECT SUM(m.cost_usd) FROM ai_messages m 
      JOIN ai_conversations cc ON cc.id = m.conversation_id
      WHERE cc.started_at::DATE BETWEEN p_start_date AND p_end_date
    ), 0)::DECIMAL, 4) as total_ai_cost_usd,
    ROUND(COALESCE((
      SELECT SUM(m.cost_usd) * 5.5 FROM ai_messages m 
      JOIN ai_conversations cc ON cc.id = m.conversation_id
      WHERE cc.started_at::DATE BETWEEN p_start_date AND p_end_date
    ), 0)::DECIMAL, 2) as total_ai_cost_brl,
    COALESCE((
      SELECT SUM(COALESCE(m.prompt_tokens, 0) + COALESCE(m.completion_tokens, 0)) FROM ai_messages m 
      JOIN ai_conversations cc ON cc.id = m.conversation_id
      WHERE cc.started_at::DATE BETWEEN p_start_date AND p_end_date
    ), 0)::BIGINT as total_tokens_used
  FROM ai_conversations c
  WHERE c.started_at::DATE BETWEEN p_start_date AND p_end_date;
END;
$$;

-- Function: get_agent_performance
CREATE OR REPLACE FUNCTION get_agent_performance(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  conversations_count BIGINT,
  success_rate DECIMAL,
  avg_confidence DECIMAL,
  avg_csat DECIMAL,
  total_cost_brl DECIMAL,
  escalation_rate DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as agent_id,
    a.name as agent_name,
    COUNT(DISTINCT m.conversation_id)::BIGINT as conversations_count,
    ROUND(COALESCE(a.success_rate, 0) * 100, 2) as success_rate,
    ROUND(COALESCE(AVG(m.confidence), 0), 2) as avg_confidence,
    ROUND(COALESCE(AVG(c.csat_rating), 0), 2) as avg_csat,
    ROUND(COALESCE(SUM(m.cost_usd) * 5.5, 0), 2) as total_cost_brl,
    ROUND(
      COUNT(*) FILTER (WHERE c.handler_type = 'human')::DECIMAL / 
      NULLIF(COUNT(DISTINCT m.conversation_id)::DECIMAL, 0) * 100,
      2
    ) as escalation_rate
  FROM ai_agents a
  LEFT JOIN ai_messages m ON m.agent_id = a.id 
    AND m.created_at::DATE BETWEEN p_start_date AND p_end_date
  LEFT JOIN ai_conversations c ON c.id = m.conversation_id
  GROUP BY a.id, a.name, a.success_rate
  ORDER BY conversations_count DESC;
END;
$$;

-- Function: get_churn_statistics
CREATE OR REPLACE FUNCTION get_churn_statistics()
RETURNS TABLE (
  total_customers BIGINT,
  at_risk_count BIGINT,
  high_risk_count BIGINT,
  avg_health_score DECIMAL,
  avg_churn_probability DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_customers,
    COUNT(*) FILTER (WHERE chs.risk_level IN ('yellow', 'red'))::BIGINT as at_risk_count,
    COUNT(*) FILTER (WHERE chs.risk_level = 'red')::BIGINT as high_risk_count,
    ROUND(COALESCE(AVG(chs.health_score), 0), 2) as avg_health_score,
    ROUND(COALESCE(AVG(chs.churn_probability), 0), 2) as avg_churn_probability
  FROM customer_health_scores chs;
END;
$$;
