-- Migration: ai_health_and_predictions
-- Sistema de health score e predictive analytics

-- 1. Tabela de health score history
CREATE TABLE IF NOT EXISTS public.ai_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scores parciais
  uptime_score NUMERIC(5,2) DEFAULT 100,
  response_time_score NUMERIC(5,2) DEFAULT 100,
  error_rate_score NUMERIC(5,2) DEFAULT 100,
  sla_compliance_score NUMERIC(5,2) DEFAULT 100,
  customer_satisfaction_score NUMERIC(5,2) DEFAULT 100,
  
  -- Score geral (media ponderada)
  overall_score NUMERIC(5,2) DEFAULT 100,
  
  -- Status
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'degraded', 'critical')),
  
  -- Metricas brutas
  metrics JSONB DEFAULT '{}',
  /*
    {
      "uptime_percent": 99.9,
      "avg_response_time_ms": 1200,
      "error_rate_percent": 2.5,
      "sla_breaches": 3,
      "active_conversations": 45,
      "queue_size": 12,
      "human_agent_available": 5
    }
  */
  
  -- Alertas gerados
  alerts JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_score_date ON ai_health_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_score_status ON ai_health_scores(status);

ALTER TABLE public.ai_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_health_scores" ON public.ai_health_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_health_scores" ON public.ai_health_scores FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_health_scores IS 'Historico de health score do sistema.';

-- 2. Tabela de metricas de componentes
CREATE TABLE IF NOT EXISTS public.ai_component_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  component_name TEXT NOT NULL,
  component_type TEXT CHECK (component_type IN (
    'edge_function', 'database', 'external_api', 'queue', 'cache'
  )),
  
  -- Status
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'down', 'unknown')),
  is_critical BOOLEAN DEFAULT false,
  
  -- Metricas
  uptime_percent NUMERIC(5,2),
  avg_latency_ms INTEGER,
  error_rate_percent NUMERIC(5,2),
  requests_per_minute INTEGER,
  
  -- Timestamps
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_name ON ai_component_health(component_name);
CREATE INDEX IF NOT EXISTS idx_component_status ON ai_component_health(status);

ALTER TABLE public.ai_component_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_component_health" ON public.ai_component_health FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_component_health" ON public.ai_component_health FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_component_health IS 'Health de componentes individuais do sistema.';

-- 3. Tabela de previsoes
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prediction_type TEXT NOT NULL CHECK (prediction_type IN (
    'ticket_volume', 'churn_risk', 'resolution_time',
    'staffing_needs', 'sla_breach', 'customer_sentiment'
  )),
  
  -- Contexto
  entity_id UUID,
  entity_type TEXT,
  
  -- Predicao
  predicted_value NUMERIC,
  predicted_at TIMESTAMPTZ NOT NULL,
  prediction_horizon INTERVAL NOT NULL,
  -- Ex: INTERVAL '1 day', INTERVAL '7 days'
  
  -- Confianca
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Validacao
  actual_value NUMERIC,
  validated_at TIMESTAMPTZ,
  prediction_accuracy NUMERIC(5,2),
  
  -- Modelo/contexto
  model_version TEXT,
  features_used JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_entity ON ai_predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_predictions_unvalidated ON ai_predictions(validated_at) WHERE validated_at IS NULL;

ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_predictions" ON public.ai_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_predictions" ON public.ai_predictions FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_predictions IS 'Predicoes de curto e longo prazo do sistema.';

-- 4. Funcao para calcular health score
CREATE OR REPLACE FUNCTION public.calculate_system_health_score()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_metrics JSONB;
  v_uptime_score NUMERIC;
  v_response_score NUMERIC;
  v_error_score NUMERIC;
  v_sla_score NUMERIC;
  v_satisfaction_score NUMERIC;
  v_overall_score NUMERIC;
  v_status TEXT;
  v_alerts JSONB := '[]'::JSONB;
  
  -- Metricas atuais
  v_uptime_percent NUMERIC;
  v_avg_latency_ms INTEGER;
  v_error_rate NUMERIC;
  v_sla_breaches INTEGER;
  v_active_conversations INTEGER;
  v_queue_size INTEGER;
  v_agents_online INTEGER;
BEGIN
  -- Obter metricas dos ultimos 5 minutos
  SELECT 
    COALESCE(AVG(uptime_percent), 99.9),
    COALESCE(AVG(avg_latency_ms), 1000),
    COALESCE(AVG(error_rate_percent), 0),
    COUNT(*) FILTER (WHERE status = 'down')
  INTO v_uptime_percent, v_avg_latency_ms, v_error_rate, v_sla_breaches
  FROM ai_component_health
  WHERE last_check_at >= NOW() - INTERVAL '5 minutes';
  
  -- Obter metricas de conversas
  SELECT 
    COUNT(*) FILTER (WHERE status = 'em_atendimento'),
    COUNT(*) FILTER (WHERE status = 'novo')
  INTO v_active_conversations, v_queue_size
  FROM ai_conversations
  WHERE created_at >= NOW() - INTERVAL '1 hour';
  
  -- Obter agentes online
  SELECT COUNT(*) INTO v_agents_online
  FROM human_agents
  WHERE is_online = true;
  
  -- Calcular scores
  
  -- Uptime Score (0-100)
  v_uptime_score := LEAST(100, GREATEST(0, v_uptime_percent));
  
  -- Response Time Score (meta: <2000ms)
  v_response_score := CASE
    WHEN v_avg_latency_ms <= 500 THEN 100
    WHEN v_avg_latency_ms <= 1000 THEN 90
    WHEN v_avg_latency_ms <= 2000 THEN 75
    WHEN v_avg_latency_ms <= 5000 THEN 50
    ELSE 25
  END;
  
  -- Error Rate Score (meta: <5%)
  v_error_score := CASE
    WHEN v_error_rate <= 1 THEN 100
    WHEN v_error_rate <= 3 THEN 90
    WHEN v_error_rate <= 5 THEN 75
    WHEN v_error_rate <= 10 THEN 50
    ELSE 25
  END;
  
  -- SLA Compliance (baseado em breaches recentes)
  v_sla_score := CASE
    WHEN v_sla_breaches = 0 THEN 100
    WHEN v_sla_breaches <= 2 THEN 85
    WHEN v_sla_breaches <= 5 THEN 70
    WHEN v_sla_breaches <= 10 THEN 50
    ELSE 25
  END;
  
  -- Satisfaction Score (padrao por enquanto)
  v_satisfaction_score := 87;
  
  -- Overall Score (media ponderada)
  v_overall_score := (
    v_uptime_score * 0.20 +
    v_response_score * 0.25 +
    v_error_score * 0.25 +
    v_sla_score * 0.15 +
    v_satisfaction_score * 0.15
  );
  
  -- Status
  v_status := CASE
    WHEN v_overall_score >= 90 THEN 'healthy'
    WHEN v_overall_score >= 75 THEN 'warning'
    WHEN v_overall_score >= 50 THEN 'degraded'
    ELSE 'critical'
  END;
  
  -- Gerar alertas
  IF v_error_rate > 5 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('type', 'high_error_rate', 'severity', 'high', 'message', 'Taxa de erro acima de 5%')
    );
  END IF;
  
  IF v_avg_latency_ms > 3000 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('type', 'high_latency', 'severity', 'medium', 'message', 'Latencia elevada detectada')
    );
  END IF;
  
  IF v_queue_size > 20 AND v_agents_online < 3 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('type', 'queue_overflow', 'severity', 'high', 'message', 'Fila crescendo com poucos agentes')
    );
  END IF;
  
  IF v_sla_breaches > 5 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('type', 'sla_breach', 'severity', 'critical', 'message', 'Múltiplos breaches de SLA')
    );
  END IF;
  
  v_metrics := jsonb_build_object(
    'uptime_percent', v_uptime_percent,
    'avg_latency_ms', v_avg_latency_ms,
    'error_rate_percent', v_error_rate,
    'sla_breaches', v_sla_breaches,
    'active_conversations', v_active_conversations,
    'queue_size', v_queue_size,
    'agents_online', v_agents_online,
    'checked_at', NOW()
  );
  
  -- Inserir registro
  INSERT INTO ai_health_scores (
    uptime_score, response_time_score, error_rate_score,
    sla_compliance_score, customer_satisfaction_score,
    overall_score, status, metrics, alerts
  ) VALUES (
    v_uptime_score, v_response_score, v_error_score,
    v_sla_score, v_satisfaction_score,
    v_overall_score, v_status, v_metrics, v_alerts
  );
  
  v_result := jsonb_build_object(
    'overall_score', v_overall_score,
    'status', v_status,
    'scores', jsonb_build_object(
      'uptime', v_uptime_score,
      'response', v_response_score,
      'error', v_error_score,
      'sla', v_sla_score,
      'satisfaction', v_satisfaction_score
    ),
    'metrics', v_metrics,
    'alerts', v_alerts
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_system_health_score TO service_role, authenticated;

-- 5. Funcao para prever volume de tickets
CREATE OR REPLACE FUNCTION public.predict_ticket_volume(
  p_days_ahead INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prediction JSONB;
  v_daily_avg NUMERIC;
  v_trend NUMERIC;
  v_predicted_volume INTEGER;
  v_confidence NUMERIC;
BEGIN
  -- Calcular media diaria dos ultimos 30 dias
  SELECT 
    AVG(daily_count),
    (MAX(daily_count) - MIN(daily_count)) / NULLIF(MAX(daily_count), 0) * 100
  INTO v_daily_avg, v_trend
  FROM (
    SELECT DATE(created_at) as day, COUNT(*) as daily_count
    FROM ai_conversations
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
  ) daily;
  
  -- Calcular previsao
  v_predicted_volume := ROUND(v_daily_avg * (1 + COALESCE(v_trend / 100, 0)));
  
  -- Confianca baseada no volume de dados
  v_confidence := LEAST(0.95, 0.5 + (v_daily_avg / 100) * 0.45);
  
  v_prediction := jsonb_build_object(
    'predicted_date', CURRENT_DATE + p_days_ahead,
    'predicted_volume', v_predicted_volume,
    'daily_average', ROUND(v_daily_avg),
    'trend_percent', ROUND(COALESCE(v_trend, 0), 2),
    'confidence', v_confidence,
    'prediction_horizon', p_days_ahead || ' days',
    'model', 'simple_moving_average_30d'
  );
  
  RETURN v_prediction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.predict_ticket_volume TO service_role, authenticated;

-- 6. Funcao para calcular risco de churn
CREATE OR REPLACE FUNCTION public.calculate_churn_risk(
  p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_risk JSONB;
  v_tickets_30d INTEGER;
  v_tickets_60d INTEGER;
  v_avg_satisfaction NUMERIC;
  v_days_since_last_contact INTEGER;
  v_sentiment_trend TEXT;
  v_risk_score NUMERIC;
  v_risk_level TEXT;
BEGIN
  -- Contar tickets nos ultimos 30 e 60 dias
  SELECT 
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days')
  INTO v_tickets_30d, v_tickets_60d
  FROM ai_conversations
  WHERE helpdesk_client_id = p_client_id;
  
  -- Satisfacao media
  SELECT AVG(csat_score)
  INTO v_avg_satisfaction
  FROM ai_conversations
  WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL;
  
  -- Dias desde ultimo contato
  SELECT EXTRACT(DAY FROM (NOW() - MAX(created_at)))::INTEGER
  INTO v_days_since_last_contact
  FROM ai_conversations
  WHERE helpdesk_client_id = p_client_id;
  
  -- Calcular score de risco
  v_risk_score := 0.5;
  
  -- Baixa satisfacao
  IF v_avg_satisfaction < 0.5 THEN
    v_risk_score := v_risk_score + 0.3;
  ELSIF v_avg_satisfaction < 0.7 THEN
    v_risk_score := v_risk_score + 0.15;
  END IF;
  
  -- Aumento de tickets (possivel insatisfacao)
  IF v_tickets_30d > v_tickets_60d * 1.5 THEN
    v_risk_score := v_risk_score + 0.2;
  END IF;
  
  -- Inatividade
  IF v_days_since_last_contact > 30 THEN
    v_risk_score := v_risk_score + 0.15;
  END IF;
  
  -- Limitar a 0-1
  v_risk_score := LEAST(1, GREATEST(0, v_risk_score));
  
  -- Nivel de risco
  v_risk_level := CASE
    WHEN v_risk_score >= 0.7 THEN 'high'
    WHEN v_risk_score >= 0.4 THEN 'medium'
    ELSE 'low'
  END;
  
  v_risk := jsonb_build_object(
    'client_id', p_client_id,
    'risk_score', ROUND(v_risk_score, 2),
    'risk_level', v_risk_level,
    'factors', jsonb_build_array(
      CASE WHEN v_avg_satisfaction < 0.5 THEN 'Baixa satisfacao' END,
      CASE WHEN v_tickets_30d > v_tickets_60d * 1.5 THEN 'Aumento de tickets' END,
      CASE WHEN v_days_since_last_contact > 30 THEN 'Cliente inativo' END
    ),
    'metrics', jsonb_build_object(
      'tickets_30d', v_tickets_30d,
      'tickets_60d', v_tickets_60d,
      'avg_satisfaction', ROUND(COALESCE(v_avg_satisfaction, 0), 2),
      'days_since_contact', v_days_since_last_contact
    ),
    'confidence', 0.75,
    'recommended_action', CASE
      WHEN v_risk_level = 'high' THEN 'Contato proativo imediato'
      WHEN v_risk_level = 'medium' THEN 'Agendar check-in'
      ELSE 'Manter monitoramento'
    END
  );
  
  RETURN v_risk;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_churn_risk TO service_role, authenticated;

-- 7. Funcao para prever necessidades de staffing
CREATE OR REPLACE FUNCTION public.predict_staffing_needs(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_prediction JSONB;
  v_expected_tickets INTEGER;
  v_avg_resolution_minutes INTEGER;
  v_target_sla_minutes INTEGER;
  v_agents_needed NUMERIC;
  v_agents_available INTEGER;
  v_peak_hours JSONB;
BEGIN
  -- Obter volume esperado
  SELECT (predict_ticket_volume(1)->>'predicted_volume')::INTEGER
  INTO v_expected_tickets;
  
  -- Metricas atuais
  SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60)
  INTO v_agents_available, v_avg_resolution_minutes
  FROM human_agents ha
  LEFT JOIN ai_conversations ac ON ac.assigned_to = ha.id
  WHERE ha.is_online = true;
  
  -- Meta SLA (30 minutos padrao)
  v_target_sla_minutes := 30;
  
  -- Calcular agentes necessarios
  -- (tickets * tempo_medio) / (janela_horaria * disponibilidade)
  v_agents_needed := CEIL(
    (v_expected_tickets * v_avg_resolution_minutes) / 
    (480 * 0.7)  -- 8 horas * 70% utilidade
  );
  
  -- Horarios de pico
  v_peak_hours := '["09:00-11:00", "14:00-16:00"]'::JSONB;
  
  v_prediction := jsonb_build_object(
    'date', p_date,
    'expected_tickets', v_expected_tickets,
    'agents_currently_available', v_agents_available,
    'agents_needed', v_agents_needed,
    'agents_shortage', GREATEST(0, v_agents_needed - v_agents_available),
    'avg_resolution_time_minutes', ROUND(v_avg_resolution_minutes),
    'peak_hours', v_peak_hours,
    'confidence', 0.70,
    'recommendations', CASE
      WHEN v_agents_needed > v_agents_available THEN
        'Considere adicionar ' || (v_agents_needed - v_agents_available) || ' agentes para atender a demanda'
      ELSE
        'Capacidade atual suficiente para atender demanda prevista'
    END
  );
  
  RETURN v_prediction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.predict_staffing_needs TO service_role, authenticated;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260403_ai_health_and_predictions', 'AI Health Score and Predictive Analytics system', NOW())
ON CONFLICT DO NOTHING;
