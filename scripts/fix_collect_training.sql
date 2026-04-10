CREATE OR REPLACE FUNCTION public.collect_training_example(
  p_conversation_id UUID, p_agent_id UUID, p_user_message TEXT, p_agent_response TEXT,
  p_quality_score NUMERIC DEFAULT NULL, p_was_helpful BOOLEAN DEFAULT NULL,
  p_category TEXT DEFAULT NULL, p_response_time_ms INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL, p_cost_usd NUMERIC DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_example_id UUID; v_conversation RECORD;
BEGIN
  SELECT customer_phone, context INTO v_conversation
  FROM ai_conversations WHERE id = p_conversation_id;
  
  INSERT INTO ai_training_examples (
    conversation_id, agent_id, customer_phone,
    user_message, agent_response, quality_score, was_helpful, category,
    response_time_ms, tokens_used, cost_usd, source
  ) VALUES (
    p_conversation_id, p_agent_id, v_conversation.customer_phone,
    p_user_message, p_agent_response, p_quality_score, p_was_helpful, p_category,
    p_response_time_ms, p_tokens_used, p_cost_usd, 'automatic'
  ) RETURNING id INTO v_example_id;
  
  IF p_quality_score IS NOT NULL AND p_quality_score < 0.5 THEN
    INSERT INTO ai_prompt_adjustments (agent_id, trigger_type, description, new_content, status)
    VALUES (p_agent_id, 'low_score', 'Score baixo detectado: ' || COALESCE(p_quality_score::TEXT, 'N/A'), p_agent_response, 'pending');
  END IF;
  
  RETURN v_example_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.collect_training_example TO service_role, authenticated;
