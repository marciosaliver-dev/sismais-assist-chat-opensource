CREATE OR REPLACE FUNCTION public.find_best_agent(p_agent_type TEXT, p_required_skill TEXT DEFAULT NULL, p_max_load INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent JSONB;
BEGIN
  SELECT jsonb_build_object(
    'agent_id', agent_id,
    'skill_score', COALESCE((skill_scores->p_required_skill)::NUMERIC, 0.5),
    'availability', availability_score,
    'current_load', current_load,
    'satisfaction', satisfaction_rate
  ) as best INTO v_agent
  FROM ai_agent_performance_scores
  WHERE is_online = true AND is_available = true AND agent_type = p_agent_type
    AND current_load < LEAST(p_max_load, max_load)
  ORDER BY COALESCE((skill_scores->COALESCE(p_required_skill, 'general'))::NUMERIC, 0.5) DESC,
    satisfaction_rate DESC, current_load ASC
  LIMIT 1;
  RETURN COALESCE(v_agent, jsonb_build_object('agent_id', NULL));
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_best_agent TO service_role, authenticated;
