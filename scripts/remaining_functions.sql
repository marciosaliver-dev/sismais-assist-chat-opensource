-- Memory Functions
CREATE OR REPLACE FUNCTION public.store_conversation_memory(
  p_conversation_id UUID, p_agent_id UUID, p_memory_type TEXT, p_content TEXT,
  p_importance_score NUMERIC DEFAULT 0.5, p_metadata JSONB DEFAULT '{}', p_expires_at TIMESTAMPTZ DEFAULT NULL
)
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

CREATE OR REPLACE FUNCTION public.get_conversation_memory(
  p_conversation_id UUID, p_memory_types TEXT[] DEFAULT NULL,
  p_min_importance NUMERIC DEFAULT 0, p_limit INTEGER DEFAULT 50
)
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

CREATE OR REPLACE FUNCTION public.store_customer_memory(
  p_client_id UUID, p_memory_type TEXT, p_content TEXT,
  p_source TEXT DEFAULT NULL, p_confidence_score NUMERIC DEFAULT 0.5, p_metadata JSONB DEFAULT '{}'
)
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

CREATE OR REPLACE FUNCTION public.get_customer_memory(
  p_client_id UUID, p_memory_types TEXT[] DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0, p_limit INTEGER DEFAULT 20
)
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

CREATE OR REPLACE FUNCTION public.update_session_context(
  p_session_id TEXT, p_conversation_id UUID DEFAULT NULL, p_agent_id UUID DEFAULT NULL,
  p_context_data JSONB DEFAULT NULL, p_intent TEXT DEFAULT NULL, p_sentiment TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_context_id UUID; v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM ai_session_context WHERE session_id = p_session_id) INTO v_exists;
  IF v_exists THEN
    UPDATE ai_session_context SET 
      conversation_id = COALESCE(p_conversation_id, conversation_id),
      current_agent_id = COALESCE(p_agent_id, current_agent_id),
      context_data = COALESCE(p_context_data, context_data),
      last_intent = COALESCE(p_intent, last_intent),
      last_sentiment = COALESCE(p_sentiment, last_sentiment),
      turn_count = turn_count + 1, updated_at = NOW()
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

-- Routing Functions
CREATE OR REPLACE FUNCTION public.calculate_routing_score(
  p_client_id UUID, p_intent_category TEXT, p_sentiment_score NUMERIC DEFAULT 0.5,
  p_requires_human BOOLEAN DEFAULT false, p_priority INTEGER DEFAULT 1
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; v_client RECORD;
BEGIN
  SELECT 
    COALESCE((SELECT SUM(total_value) FROM helpdesk_client_contracts WHERE client_id = p_client_id), 0) as lifetime_value,
    COALESCE((SELECT AVG(csat_score) FROM ai_conversations WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL), 0.5) as satisfaction
  INTO v_client;
  
  v_result := jsonb_build_object(
    'route_to', CASE WHEN p_requires_human THEN 'human' WHEN v_client.satisfaction < 0.3 THEN 'human' WHEN p_sentiment_score < 0.3 THEN 'human' WHEN p_priority >= 4 THEN 'human' ELSE 'ai' END,
    'confidence', CASE WHEN p_requires_human THEN 0.95 WHEN v_client.satisfaction < 0.3 OR p_sentiment_score < 0.3 THEN 0.85 ELSE 0.70 END,
    'reason', CASE WHEN p_requires_human THEN 'Requer atendimento humano' WHEN v_client.satisfaction < 0.3 THEN 'Cliente com baixa satisfacao previa' WHEN p_sentiment_score < 0.3 THEN 'Sentimento negativo detectado' WHEN p_priority >= 4 THEN 'Prioridade alta' ELSE 'Atendimento automatico' END,
    'priority_adjustment', CASE WHEN v_client.satisfaction > 0.8 THEN 1 WHEN v_client.satisfaction < 0.5 THEN 2 ELSE 0 END,
    'customer_ltv', v_client.lifetime_value,
    'recommended_agent_type', CASE WHEN p_intent_category IN ('billing', 'payment') THEN 'financial' WHEN p_intent_category IN ('technical', 'support') THEN 'technical' ELSE 'general' END
  );
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_routing_score TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.record_routing_outcome(
  p_conversation_id UUID, p_routed_to TEXT, p_routing_confidence NUMERIC DEFAULT NULL,
  p_resolution_time_minutes NUMERIC DEFAULT NULL, p_customer_satisfied BOOLEAN DEFAULT NULL
)
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
  SELECT COUNT(*), COUNT(*) FILTER (WHERE was_correct = true)
  INTO v_total, v_correct
  FROM ai_routing_feedback WHERE created_at >= NOW() - p_time_range;
  
  SELECT routed_to, COUNT(*) as total, COUNT(*) FILTER (WHERE was_correct = true) as correct, AVG(routing_confidence) as avg_confidence
  INTO v_by_type
  FROM ai_routing_feedback WHERE created_at >= NOW() - p_time_range GROUP BY routed_to;
  
  RETURN jsonb_build_object(
    'period', p_time_range,
    'total_routings', v_total, 'correct_routings', v_correct,
    'accuracy_rate', CASE WHEN v_total > 0 THEN (v_correct::NUMERIC / v_total * 100) ELSE 0 END,
    'by_routed_type', v_by_type,
    'recommendations', CASE WHEN v_total > 0 AND (v_correct::NUMERIC / v_total) < 0.7 THEN 'Taxa de acerto abaixo de 70%. Recomenda-se revisar regras de roteamento.' ELSE 'Roteamento com performance aceitavel.' END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.analyze_routing_accuracy TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.predict_ticket_volume(p_days_ahead INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_prediction JSONB; v_daily_avg NUMERIC; v_trend NUMERIC; v_predicted_volume INTEGER; v_confidence NUMERIC;
BEGIN
  SELECT AVG(daily_count), (MAX(daily_count) - MIN(daily_count)) / NULLIF(MAX(daily_count), 0) * 100
  INTO v_daily_avg, v_trend
  FROM (SELECT DATE(created_at) as day, COUNT(*) as daily_count FROM ai_conversations WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)) daily;
  
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

SELECT 'Remaining functions created' as status;
