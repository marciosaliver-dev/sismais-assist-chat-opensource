-- Memory Functions
CREATE OR REPLACE FUNCTION public.store_conversation_memory(p_conversation_id UUID, p_agent_id UUID, p_memory_type TEXT, p_content TEXT, p_importance_score NUMERIC DEFAULT 0.5, p_metadata JSONB DEFAULT '{}', p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_memory_id UUID;
BEGIN
  INSERT INTO public.ai_conversation_memory (conversation_id, agent_id, memory_type, content, importance_score, metadata, expires_at)
  VALUES (p_conversation_id, p_agent_id, p_memory_type, p_content, p_importance_score, p_metadata, p_expires_at)
  RETURNING id INTO v_memory_id;
  RETURN v_memory_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.store_conversation_memory TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.get_conversation_memory(p_conversation_id UUID, p_memory_types TEXT[] DEFAULT NULL, p_min_importance NUMERIC DEFAULT 0, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (id UUID, memory_type TEXT, content TEXT, importance_score NUMERIC, metadata JSONB, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.memory_type, m.content, m.importance_score, m.metadata, m.created_at
  FROM public.ai_conversation_memory m
  WHERE m.conversation_id = p_conversation_id
    AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
    AND m.importance_score >= p_min_importance
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY m.importance_score DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_conversation_memory TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.store_customer_memory(p_client_id UUID, p_memory_type TEXT, p_content TEXT, p_source TEXT DEFAULT NULL, p_confidence_score NUMERIC DEFAULT 0.5, p_metadata JSONB DEFAULT '{}')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_memory_id UUID;
BEGIN
  INSERT INTO public.ai_customer_memory (client_id, memory_type, content, source, confidence_score, metadata)
  VALUES (p_client_id, p_memory_type, p_content, p_source, p_confidence_score, p_metadata)
  RETURNING id INTO v_memory_id;
  RETURN v_memory_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.store_customer_memory TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_memory(p_client_id UUID, p_memory_types TEXT[] DEFAULT NULL, p_min_confidence NUMERIC DEFAULT 0, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (id UUID, memory_type TEXT, content TEXT, source TEXT, confidence_score NUMERIC, verified BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.memory_type, m.content, m.source, m.confidence_score, m.verified, m.created_at
  FROM public.ai_customer_memory m
  WHERE m.client_id = p_client_id
    AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
    AND m.confidence_score >= p_min_confidence
  ORDER BY m.confidence_score DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_customer_memory TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.generate_conversation_summary(p_conversation_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_summary TEXT; v_key_points TEXT[]; v_intents TEXT[]; v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT DISTINCT content, memory_type FROM ai_conversation_memory 
    WHERE conversation_id = p_conversation_id 
      AND memory_type IN ('key_fact', 'intent_classification', 'resolved_topic')
      AND importance_score >= 0.7
    ORDER BY created_at DESC LIMIT 10
  LOOP
    IF v_record.memory_type = 'key_fact' THEN v_key_points := array_append(v_key_points, v_record.content);
    ELSIF v_record.memory_type = 'intent_classification' THEN v_intents := array_append(v_intents, v_record.content);
    END IF;
  END LOOP;
  v_summary := 'Resumo da conversa: ';
  IF array_length(v_intents, 1) > 0 THEN v_summary := v_summary || 'Intenções identificadas: ' || array_to_string(v_intents, ', ') || '. '; END IF;
  IF array_length(v_key_points, 1) > 0 THEN v_summary := v_summary || 'Pontos importantes: ' || array_to_string(v_key_points, '; ') || '. '; END IF;
  RETURN COALESCE(NULLIF(v_summary, 'Resumo da conversa: '), 'Sem informações relevantes armazenadas.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_conversation_summary TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.update_session_context(p_session_id TEXT, p_conversation_id UUID DEFAULT NULL, p_agent_id UUID DEFAULT NULL, p_context_data JSONB DEFAULT NULL, p_intent TEXT DEFAULT NULL, p_sentiment TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_context_id UUID; v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM ai_session_context WHERE session_id = p_session_id) INTO v_exists;
  IF v_exists THEN
    UPDATE ai_session_context SET conversation_id = COALESCE(p_conversation_id, conversation_id), current_agent_id = COALESCE(p_agent_id, current_agent_id), context_data = COALESCE(p_context_data, context_data), last_intent = COALESCE(p_intent, last_intent), last_sentiment = COALESCE(p_sentiment, last_sentiment), turn_count = turn_count + 1, updated_at = NOW()
    WHERE session_id = p_session_id RETURNING id INTO v_context_id;
  ELSE
    INSERT INTO ai_session_context (session_id, conversation_id, current_agent_id, context_data, last_intent, last_sentiment)
    VALUES (p_session_id, p_conversation_id, p_agent_id, p_context_data, p_intent, p_sentiment)
    RETURNING id INTO v_context_id;
  END IF;
  RETURN v_context_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_session_context TO service_role, authenticated;

-- Fine-tuning Functions
CREATE OR REPLACE FUNCTION public.collect_training_example(p_conversation_id UUID, p_agent_id UUID, p_user_message TEXT, p_agent_response TEXT, p_quality_score NUMERIC DEFAULT NULL, p_was_helpful BOOLEAN DEFAULT NULL, p_category TEXT DEFAULT NULL, p_response_time_ms INTEGER DEFAULT NULL, p_tokens_used INTEGER DEFAULT NULL, p_cost_usd NUMERIC DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_example_id UUID; v_conversation RECORD;
BEGIN
  SELECT customer_intent, customer_sentiment, customer_phone INTO v_conversation FROM ai_conversations WHERE id = p_conversation_id;
  INSERT INTO ai_training_examples (conversation_id, agent_id, customer_phone, customer_intent, customer_sentiment, user_message, agent_response, quality_score, was_helpful, category, response_time_ms, tokens_used, cost_usd, source)
  VALUES (p_conversation_id, p_agent_id, v_conversation.customer_phone, v_conversation.customer_intent, v_conversation.customer_sentiment, p_user_message, p_agent_response, p_quality_score, p_was_helpful, p_category, p_response_time_ms, p_tokens_used, p_cost_usd, 'automatic')
  RETURNING id INTO v_example_id;
  IF p_quality_score IS NOT NULL AND p_quality_score < 0.5 THEN
    INSERT INTO ai_prompt_adjustments (agent_id, trigger_type, description, new_content, status)
    VALUES (p_agent_id, 'low_score', 'Score baixo detectado: ' || p_quality_score::TEXT, p_agent_response, 'pending');
  END IF;
  RETURN v_example_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.collect_training_example TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.register_interaction_pattern(p_agent_id UUID, p_pattern_type TEXT, p_conditions JSONB, p_response TEXT DEFAULT NULL, p_success BOOLEAN DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pattern_hash TEXT; v_pattern_id UUID;
BEGIN
  v_pattern_hash := encode(sha256((p_pattern_type || p_conditions::TEXT)::BYTEA), 'hex');
  SELECT id INTO v_pattern_id FROM ai_patterns WHERE pattern_hash = v_pattern_hash AND agent_id = p_agent_id;
  IF v_pattern_id IS NOT NULL THEN
    UPDATE ai_patterns SET occurrence_count = occurrence_count + 1, success_count = success_count + CASE WHEN p_success = true THEN 1 ELSE 0 END, failure_count = failure_count + CASE WHEN p_success = false THEN 1 ELSE 0 END, confidence_score = LEAST(1, confidence_score + 0.01), updated_at = NOW()
    WHERE id = v_pattern_id;
  ELSE
    INSERT INTO ai_patterns (agent_id, pattern_type, pattern_hash, conditions, response_template, occurrence_count, success_count, failure_count)
    VALUES (p_agent_id, p_pattern_type, v_pattern_hash, p_conditions, p_response, 1, CASE WHEN p_success = true THEN 1 ELSE 0 END, CASE WHEN p_success = false THEN 1 ELSE 0 END)
    RETURNING id INTO v_pattern_id;
  END IF;
  RETURN v_pattern_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_interaction_pattern TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.generate_fine_tuning_dataset(p_agent_id UUID DEFAULT NULL, p_min_quality_score NUMERIC DEFAULT 0.7, p_max_examples INTEGER DEFAULT 1000)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_dataset JSONB := '[]'::JSONB; v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT user_message, agent_response, category, customer_intent
    FROM ai_training_examples
    WHERE status = 'approved' AND (p_agent_id IS NULL OR agent_id = p_agent_id) AND (quality_score IS NULL OR quality_score >= p_min_quality_score)
    ORDER BY quality_score DESC NULLS LAST, created_at DESC LIMIT p_max_examples
  LOOP
    v_dataset := v_dataset || jsonb_build_object('messages', jsonb_build_array(jsonb_build_object('role', 'user', 'content', v_record.user_message), jsonb_build_object('role', 'assistant', 'content', v_record.agent_response)), 'category', v_record.category, 'intent', v_record.customer_intent);
  END LOOP;
  RETURN jsonb_build_object('dataset', v_dataset, 'count', jsonb_array_length(v_dataset), 'generated_at', NOW());
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_fine_tuning_dataset TO service_role, authenticated;

-- Routing Functions
CREATE OR REPLACE FUNCTION public.calculate_routing_score(p_client_id UUID, p_intent_category TEXT, p_sentiment_score NUMERIC DEFAULT 0.5, p_requires_human BOOLEAN DEFAULT false, p_priority INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; v_client RECORD;
BEGIN
  SELECT COALESCE((SELECT SUM(total_value) FROM helpdesk_client_contracts WHERE client_id = p_client_id), 0) as lifetime_value, (SELECT COUNT(*) FROM ai_conversations WHERE helpdesk_client_id = p_client_id) as total_tickets, COALESCE((SELECT AVG(csat_score) FROM ai_conversations WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL), 0.5) as satisfaction INTO v_client;
  v_result := jsonb_build_object('route_to', CASE WHEN p_requires_human THEN 'human' WHEN v_client.satisfaction < 0.3 THEN 'human' WHEN p_sentiment_score < 0.3 THEN 'human' WHEN p_priority >= 4 THEN 'human' ELSE 'ai' END, 'confidence', CASE WHEN p_requires_human THEN 0.95 WHEN v_client.satisfaction < 0.3 OR p_sentiment_score < 0.3 THEN 0.85 ELSE 0.70 END, 'reason', CASE WHEN p_requires_human THEN 'Requer atendimento humano' WHEN v_client.satisfaction < 0.3 THEN 'Cliente com baixa satisfacao previa' WHEN p_sentiment_score < 0.3 THEN 'Sentimento negativo detectado' WHEN p_priority >= 4 THEN 'Prioridade alta' ELSE 'Atendimento automatico' END, 'priority_adjustment', CASE WHEN v_client.satisfaction > 0.8 THEN 1 WHEN v_client.satisfaction < 0.5 THEN 2 ELSE 0 END, 'customer_ltv', v_client.lifetime_value, 'recommended_agent_type', CASE WHEN p_intent_category IN ('billing', 'payment') THEN 'financial' WHEN p_intent_category IN ('technical', 'support') THEN 'technical' ELSE 'general' END);
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_routing_score TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.find_best_agent(p_agent_type TEXT, p_required_skill TEXT DEFAULT NULL, p_max_load INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent JSONB;
BEGIN
  SELECT jsonb_build_object('agent_id', agent_id, 'skill_score', (skill_scores->p_required_skill)::NUMERIC DEFAULT 0.5, 'availability', availability_score, 'current_load', current_load, 'satisfaction', satisfaction_rate) as best INTO v_agent
  FROM ai_agent_performance_scores
  WHERE is_online = true AND is_available = true AND agent_type = p_agent_type AND current_load < LEAST(p_max_load, max_load)
  ORDER BY (skill_scores->COALESCE(p_required_skill, 'general'))::NUMERIC DESC, satisfaction_rate DESC, current_load ASC LIMIT 1;
  RETURN COALESCE(v_agent, jsonb_build_object('agent_id', NULL));
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_best_agent TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.record_routing_outcome(p_conversation_id UUID, p_routed_to TEXT, p_routing_confidence NUMERIC DEFAULT NULL, p_resolution_time_minutes NUMERIC DEFAULT NULL, p_customer_satisfied BOOLEAN DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_feedback_id UUID;
BEGIN
  INSERT INTO ai_routing_feedback (conversation_id, routed_to, routing_confidence, resolution_time_minutes, customer_satisfied)
  VALUES (p_conversation_id, p_routed_to, p_routing_confidence, p_resolution_time_minutes, p_customer_satisfied)
  RETURNING id INTO v_feedback_id;
  RETURN v_feedback_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_routing_outcome TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.analyze_routing_accuracy(p_time_range INTERVAL DEFAULT '7 days'::INTERVAL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total INTEGER; v_correct INTEGER; v_by_type RECORD;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE was_correct = true) INTO v_total, v_correct FROM ai_routing_feedback WHERE created_at >= NOW() - p_time_range;
  SELECT routed_to, COUNT(*) as total, COUNT(*) FILTER (WHERE was_correct = true) as correct, AVG(routing_confidence) as avg_confidence INTO v_by_type FROM ai_routing_feedback WHERE created_at >= NOW() - p_time_range GROUP BY routed_to;
  RETURN jsonb_build_object('period', p_time_range, 'total_routings', v_total, 'correct_routings', v_correct, 'accuracy_rate', CASE WHEN v_total > 0 THEN (v_correct::NUMERIC / v_total * 100) ELSE 0 END, 'by_routed_type', v_by_type, 'recommendations', CASE WHEN v_total > 0 AND (v_correct::NUMERIC / v_total) < 0.7 THEN 'Taxa de acerto abaixo de 70%. Recomenda-se revisar regras de roteamento.' ELSE 'Roteamento com performance aceitavel.' END);
END;
$$;
GRANT EXECUTE ON FUNCTION public.analyze_routing_accuracy TO service_role, authenticated;

-- Health and Prediction Functions
CREATE OR REPLACE FUNCTION public.calculate_system_health_score()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; v_metrics JSONB; v_uptime_score NUMERIC; v_response_score NUMERIC; v_error_score NUMERIC; v_sla_score NUMERIC; v_satisfaction_score NUMERIC; v_overall_score NUMERIC; v_status TEXT; v_alerts JSONB := '[]'::JSONB;
  v_uptime_percent NUMERIC; v_avg_latency_ms INTEGER; v_error_rate NUMERIC; v_sla_breaches INTEGER; v_active_conversations INTEGER; v_queue_size INTEGER; v_agents_online INTEGER;
BEGIN
  SELECT COALESCE(AVG(uptime_percent), 99.9), COALESCE(AVG(avg_latency_ms), 1000), COALESCE(AVG(error_rate_percent), 0), COUNT(*) FILTER (WHERE status = 'down') INTO v_uptime_percent, v_avg_latency_ms, v_error_rate, v_sla_breaches FROM ai_component_health WHERE last_check_at >= NOW() - INTERVAL '5 minutes';
  SELECT COUNT(*) FILTER (WHERE status = 'em_atendimento'), COUNT(*) FILTER (WHERE status = 'novo') INTO v_active_conversations, v_queue_size FROM ai_conversations WHERE created_at >= NOW() - INTERVAL '1 hour';
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

CREATE OR REPLACE FUNCTION public.predict_ticket_volume(p_days_ahead INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_prediction JSONB; v_daily_avg NUMERIC; v_trend NUMERIC; v_predicted_volume INTEGER; v_confidence NUMERIC;
BEGIN
  SELECT AVG(daily_count), (MAX(daily_count) - MIN(daily_count)) / NULLIF(MAX(daily_count), 0) * 100 INTO v_daily_avg, v_trend FROM (SELECT DATE(created_at) as day, COUNT(*) as daily_count FROM ai_conversations WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)) daily;
  v_predicted_volume := ROUND(v_daily_avg * (1 + COALESCE(v_trend / 100, 0)));
  v_confidence := LEAST(0.95, 0.5 + (v_daily_avg / 100) * 0.45);
  v_prediction := jsonb_build_object('predicted_date', CURRENT_DATE + p_days_ahead, 'predicted_volume', v_predicted_volume, 'daily_average', ROUND(v_daily_avg), 'trend_percent', ROUND(COALESCE(v_trend, 0), 2), 'confidence', v_confidence, 'prediction_horizon', p_days_ahead || ' days', 'model', 'simple_moving_average_30d');
  RETURN v_prediction;
END;
$$;
GRANT EXECUTE ON FUNCTION public.predict_ticket_volume TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.calculate_churn_risk(p_client_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_risk JSONB; v_tickets_30d INTEGER; v_tickets_60d INTEGER; v_avg_satisfaction NUMERIC; v_days_since_last_contact INTEGER; v_risk_score NUMERIC; v_risk_level TEXT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') INTO v_tickets_30d, v_tickets_60d FROM ai_conversations WHERE helpdesk_client_id = p_client_id;
  SELECT AVG(csat_score) INTO v_avg_satisfaction FROM ai_conversations WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL;
  SELECT EXTRACT(DAY FROM (NOW() - MAX(created_at)))::INTEGER INTO v_days_since_last_contact FROM ai_conversations WHERE helpdesk_client_id = p_client_id;
  v_risk_score := 0.5;
  IF v_avg_satisfaction < 0.5 THEN v_risk_score := v_risk_score + 0.3; ELSIF v_avg_satisfaction < 0.7 THEN v_risk_score := v_risk_score + 0.15; END IF;
  IF v_tickets_30d > v_tickets_60d * 1.5 THEN v_risk_score := v_risk_score + 0.2; END IF;
  IF v_days_since_last_contact > 30 THEN v_risk_score := v_risk_score + 0.15; END IF;
  v_risk_score := LEAST(1, GREATEST(0, v_risk_score));
  v_risk_level := CASE WHEN v_risk_score >= 0.7 THEN 'high' WHEN v_risk_score >= 0.4 THEN 'medium' ELSE 'low' END;
  v_risk := jsonb_build_object('client_id', p_client_id, 'risk_score', ROUND(v_risk_score, 2), 'risk_level', v_risk_level, 'factors', jsonb_build_array(CASE WHEN v_avg_satisfaction < 0.5 THEN 'Baixa satisfacao' END, CASE WHEN v_tickets_30d > v_tickets_60d * 1.5 THEN 'Aumento de tickets' END, CASE WHEN v_days_since_last_contact > 30 THEN 'Cliente inativo' END), 'metrics', jsonb_build_object('tickets_30d', v_tickets_30d, 'tickets_60d', v_tickets_60d, 'avg_satisfaction', ROUND(COALESCE(v_avg_satisfaction, 0), 2), 'days_since_contact', v_days_since_last_contact), 'confidence', 0.75, 'recommended_action', CASE WHEN v_risk_level = 'high' THEN 'Contato proativo imediato' WHEN v_risk_level = 'medium' THEN 'Agendar check-in' ELSE 'Manter monitoramento' END);
  RETURN v_risk;
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_churn_risk TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.predict_staffing_needs(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_prediction JSONB; v_expected_tickets INTEGER; v_avg_resolution_minutes INTEGER; v_agents_needed NUMERIC; v_agents_available INTEGER;
BEGIN
  SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) INTO v_agents_available, v_avg_resolution_minutes FROM human_agents ha LEFT JOIN ai_conversations ac ON ac.assigned_to = ha.id WHERE ha.is_online = true;
  v_agents_needed := CEIL((30 * COALESCE(v_avg_resolution_minutes, 30)) / (480 * 0.7));
  v_prediction := jsonb_build_object('date', p_date, 'expected_tickets', 30, 'agents_currently_available', COALESCE(v_agents_available, 0), 'agents_needed', v_agents_needed, 'agents_shortage', GREATEST(0, v_agents_needed - COALESCE(v_agents_available, 0)), 'avg_resolution_time_minutes', ROUND(COALESCE(v_avg_resolution_minutes, 30)), 'peak_hours', '["09:00-11:00", "14:00-16:00"]'::JSONB, 'confidence', 0.70, 'recommendations', CASE WHEN v_agents_needed > COALESCE(v_agents_available, 0) THEN 'Considere adicionar ' || (v_agents_needed - COALESCE(v_agents_available, 0)) || ' agentes para atender a demanda' ELSE 'Capacidade atual suficiente para atender demanda prevista' END);
  RETURN v_prediction;
END;
$$;
GRANT EXECUTE ON FUNCTION public.predict_staffing_needs TO service_role, authenticated;

-- Insert default routing rules
INSERT INTO public.ai_routing_rules (name, description, priority, conditions, action_type, action_params)
VALUES
  ('VIP Priority', 'Clientes com alto valor vitalicio', 95, '{"operator": "AND", "rules": [{"field": "lifetime_value", "operator": ">=", "value": 10000}]}', 'route_to_human', '{"priority": "high"}'),
  ('Sentiment Alert', 'Cliente com sentimento negativo', 90, '{"operator": "AND", "rules": [{"field": "sentiment_score", "operator": "<=", "value": 0.3}]}', 'prioritize', '{"priority": 4}'),
  ('Churn Risk', 'Cliente com risco de churn', 85, '{"operator": "AND", "rules": [{"field": "churn_risk", "operator": ">=", "value": 0.7}]}', 'route_to_human', '{"priority": "high", "note": "Cliente em risco de churn"}'),
  ('Billing Issues', 'Assuntos financeiros vao para especialistas', 80, '{"operator": "OR", "rules": [{"field": "intent_category", "operator": "=", "value": "billing"}, {"field": "intent_category", "operator": "=", "value": "payment"}]}', 'route_to_specialist', '{"specialist_type": "financial"}'),
  ('Technical Support', 'Problemas tecnicos vao para time tecnico', 75, '{"operator": "AND", "rules": [{"field": "intent_category", "operator": "=", "value": "technical"}]}', 'route_to_specialist', '{"specialist_type": "technical"}')
ON CONFLICT DO NOTHING;

SELECT 'All functions created successfully' as status;
