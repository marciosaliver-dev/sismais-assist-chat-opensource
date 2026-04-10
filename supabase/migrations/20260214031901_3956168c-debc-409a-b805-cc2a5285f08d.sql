
-- Incrementar conversas do agente
CREATE OR REPLACE FUNCTION public.increment_agent_conversation(p_agent_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_agents
  SET total_conversations = COALESCE(total_conversations, 0) + 1
  WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Incrementar sucesso do agente
CREATE OR REPLACE FUNCTION public.increment_agent_success(p_agent_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_agents
  SET 
    total_conversations = COALESCE(total_conversations, 0) + 1,
    success_rate = (
      (COALESCE(success_rate, 0) * COALESCE(total_conversations, 0) + 1) / (COALESCE(total_conversations, 0) + 1)
    )
  WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ajustar confidence threshold do agente
CREATE OR REPLACE FUNCTION public.adjust_agent_confidence(
  p_agent_id UUID,
  p_adjustment DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_agents
  SET confidence_threshold = GREATEST(0.60, LEAST(0.95, 
    COALESCE(confidence_threshold, 0.70) + p_adjustment
  ))
  WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
