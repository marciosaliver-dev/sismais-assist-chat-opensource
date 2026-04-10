CREATE OR REPLACE FUNCTION public.predict_ticket_volume(p_days_ahead INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_prediction JSONB; v_daily_avg NUMERIC; v_trend NUMERIC; v_predicted_volume INTEGER; v_confidence NUMERIC;
BEGIN
  SELECT AVG(daily_count), (MAX(daily_count) - MIN(daily_count)) / NULLIF(MAX(daily_count), 0) * 100
  INTO v_daily_avg, v_trend
  FROM (SELECT DATE(started_at) as day, COUNT(*) as daily_count FROM ai_conversations WHERE started_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(started_at)) daily;
  
  v_predicted_volume := ROUND(v_daily_avg * (1 + COALESCE(v_trend / 100, 0)));
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

CREATE OR REPLACE FUNCTION public.calculate_churn_risk(p_client_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_risk JSONB; v_tickets_30d INTEGER; v_tickets_60d INTEGER; v_avg_satisfaction NUMERIC; v_days_since_last_contact INTEGER; v_risk_score NUMERIC; v_risk_level TEXT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '30 days'), COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '60 days' AND started_at < NOW() - INTERVAL '30 days')
  INTO v_tickets_30d, v_tickets_60d FROM ai_conversations WHERE helpdesk_client_id = p_client_id;
  
  SELECT AVG(csat_score) INTO v_avg_satisfaction FROM ai_conversations WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL;
  SELECT EXTRACT(DAY FROM (NOW() - MAX(started_at)))::INTEGER INTO v_days_since_last_contact FROM ai_conversations WHERE helpdesk_client_id = p_client_id;
  
  v_risk_score := 0.5;
  IF v_avg_satisfaction < 0.5 THEN v_risk_score := v_risk_score + 0.3; ELSIF v_avg_satisfaction < 0.7 THEN v_risk_score := v_risk_score + 0.15; END IF;
  IF v_tickets_30d > v_tickets_60d * 1.5 THEN v_risk_score := v_risk_score + 0.2; END IF;
  IF v_days_since_last_contact > 30 THEN v_risk_score := v_risk_score + 0.15; END IF;
  v_risk_score := LEAST(1, GREATEST(0, v_risk_score));
  v_risk_level := CASE WHEN v_risk_score >= 0.7 THEN 'high' WHEN v_risk_score >= 0.4 THEN 'medium' ELSE 'low' END;
  
  v_risk := jsonb_build_object('client_id', p_client_id, 'risk_score', ROUND(v_risk_score, 2), 'risk_level', v_risk_level,
    'factors', jsonb_build_array(CASE WHEN v_avg_satisfaction < 0.5 THEN 'Baixa satisfacao' END, CASE WHEN v_tickets_30d > v_tickets_60d * 1.5 THEN 'Aumento de tickets' END, CASE WHEN v_days_since_last_contact > 30 THEN 'Cliente inativo' END),
    'metrics', jsonb_build_object('tickets_30d', v_tickets_30d, 'tickets_60d', v_tickets_60d, 'avg_satisfaction', ROUND(COALESCE(v_avg_satisfaction, 0), 2), 'days_since_contact', v_days_since_last_contact),
    'confidence', 0.75,
    'recommended_action', CASE WHEN v_risk_level = 'high' THEN 'Contato proativo imediato' WHEN v_risk_level = 'medium' THEN 'Agendar check-in' ELSE 'Manter monitoramento' END
  );
  RETURN v_risk;
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_churn_risk TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.calculate_system_health_score()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; v_metrics JSONB; v_uptime_score NUMERIC; v_response_score NUMERIC; v_error_score NUMERIC; v_sla_score NUMERIC; v_satisfaction_score NUMERIC; v_overall_score NUMERIC; v_status TEXT; v_alerts JSONB := '[]'::JSONB;
  v_uptime_percent NUMERIC; v_avg_latency_ms INTEGER; v_error_rate NUMERIC; v_sla_breaches INTEGER; v_active_conversations INTEGER; v_queue_size INTEGER; v_agents_online INTEGER;
BEGIN
  SELECT COALESCE(AVG(uptime_percent), 99.9), COALESCE(AVG(avg_latency_ms), 1000), COALESCE(AVG(error_rate_percent), 0), COUNT(*) FILTER (WHERE status = 'down') INTO v_uptime_percent, v_avg_latency_ms, v_error_rate, v_sla_breaches FROM ai_component_health WHERE last_check_at >= NOW() - INTERVAL '5 minutes';
  
  SELECT COUNT(*) FILTER (WHERE status = 'em_atendimento'), COUNT(*) FILTER (WHERE status = 'novo') INTO v_active_conversations, v_queue_size FROM ai_conversations WHERE started_at >= NOW() - INTERVAL '1 hour';
  
  SELECT COUNT(*) INTO v_agents_online FROM human_agents WHERE is_online = true;
  
  v_uptime_score := LEAST(100, GREATEST(0, v_uptime_percent));
  v_response_score := CASE WHEN v_avg_latency_ms <= 500 THEN 100 WHEN v_avg_latency_ms <= 1000 THEN 90 WHEN v_avg_latency_ms <= 2000 THEN 75 WHEN v_avg_latency_ms <= 5000 THEN 50 ELSE 25 END;
  v_error_score := CASE WHEN v_error_rate <= 1 THEN 100 WHEN v_error_rate <= 3 THEN 90 WHEN v_error_rate <= 5 THEN 75 WHEN v_error_rate <= 10 THEN 50 ELSE 25 END;
  v_sla_score := CASE WHEN v_sla_breaches = 0 THEN 100 WHEN v_sla_breaches <= 2 THEN 85 WHEN v_sla_breaches <= 5 THEN 70 WHEN v_sla_breaches <= 10 THEN 50 ELSE 25 END;
  v_satisfaction_score := 87;
  
  v_overall_score := (v_uptime_score * 0.20 + v_response_score * 0.25 + v_error_score * 0.25 + v_sla_score * 0.15 + v_satisfaction_score * 0.15);
  v_status := CASE WHEN v_overall_score >= 90 THEN 'healthy' WHEN v_overall_score >= 75 THEN 'warning' WHEN v_overall_score >= 50 THEN 'degraded' ELSE 'critical' END;
  
  IF v_error_rate > 5 THEN v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'high_error_rate', 'severity', 'high', 'message', 'Taxa de erro acima de 5%')); END IF;
  IF v_avg_latency_ms > 3000 THEN v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'high_latency', 'severity', 'medium', 'message', 'Latencia elevada detectada')); END IF;
  IF v_queue_size > 20 AND v_agents_online < 3 THEN v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'queue_overflow', 'severity', 'high', 'message', 'Fila crescendo com poucos agentes')); END IF;
  
  v_metrics := jsonb_build_object('uptime_percent', v_uptime_percent, 'avg_latency_ms', v_avg_latency_ms, 'error_rate_percent', v_error_rate, 'sla_breaches', v_sla_breaches, 'active_conversations', v_active_conversations, 'queue_size', v_queue_size, 'agents_online', v_agents_online, 'checked_at', NOW());
  
  INSERT INTO ai_health_scores (uptime_score, response_time_score, error_rate_score, sla_compliance_score, customer_satisfaction_score, overall_score, status, metrics, alerts)
  VALUES (v_uptime_score, v_response_score, v_error_score, v_sla_score, v_satisfaction_score, v_overall_score, v_status, v_metrics, v_alerts);
  
  v_result := jsonb_build_object('overall_score', v_overall_score, 'status', v_status, 'scores', jsonb_build_object('uptime', v_uptime_score, 'response', v_response_score, 'error', v_error_score, 'sla', v_sla_score, 'satisfaction', v_satisfaction_score), 'metrics', v_metrics, 'alerts', v_alerts);
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_system_health_score TO service_role, authenticated;

SELECT 'Functions updated successfully' as status;
