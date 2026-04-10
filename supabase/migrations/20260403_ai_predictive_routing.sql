-- Migration: ai_predictive_routing
-- Sistema de roteamento inteligente baseado em ML e historico

-- 1. Tabela de features para ML
CREATE TABLE IF NOT EXISTS public.ai_routing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificadores
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  
  -- Features do cliente
  customer_lifetime_value NUMERIC(12,2) DEFAULT 0,
  total_tickets INTEGER DEFAULT 0,
  avg_resolution_time_hours NUMERIC(8,2) DEFAULT 0,
  satisfaction_score NUMERIC(3,2),
  churn_risk_score NUMERIC(3,2) DEFAULT 0.5,
  
  -- Features da interacao atual
  hour_of_day INTEGER,
  day_of_week INTEGER,
  is_business_hours BOOLEAN DEFAULT true,
  message_count_today INTEGER DEFAULT 0,
  
  -- Features de intent
  intent_category TEXT,
  intent_complexity INTEGER DEFAULT 1 CHECK (intent_complexity BETWEEN 1 AND 5),
  requires_human BOOLEAN DEFAULT false,
  sentiment_score NUMERIC(3,2) DEFAULT 0.5,
  
  -- Features de contexto
  previous_unresolved BOOLEAN DEFAULT false,
  ticket_age_hours NUMERIC(8,2) DEFAULT 0,
  priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),
  
  -- Resultado (para treino)
  routed_to_agent_id UUID REFERENCES human_agents(id) ON DELETE SET NULL,
  routed_to_type TEXT CHECK (routed_to_type IN ('ai', 'human', 'specialist', 'queue')),
  resolution_time_hours NUMERIC(8,2),
  customer_satisfied BOOLEAN,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_for_training BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_features_client ON ai_routing_features(client_id);
CREATE INDEX IF NOT EXISTS idx_features_trained ON ai_routing_features(used_for_training) WHERE used_for_training = false;

ALTER TABLE public.ai_routing_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_routing_features" ON public.ai_routing_features FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_routing_features" ON public.ai_routing_features FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_routing_features IS 'Features para modelo de roteamento preditivo.';

-- 2. Tabela de regras de roteamento
CREATE TABLE IF NOT EXISTS public.ai_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  is_active BOOLEAN DEFAULT true,
  
  -- Condicoes (JSONB)
  conditions JSONB NOT NULL,
  /*
    Exemplo:
    {
      "operator": "AND",
      "rules": [
        {"field": "churn_risk_score", "operator": ">=", "value": 0.7},
        {"field": "sentiment_score", "operator": "<=", "value": 0.3}
      ]
    }
  */
  
  -- Acao
  action_type TEXT NOT NULL CHECK (action_type IN (
    'route_to_human',
    'route_to_ai',
    'route_to_specialist',
    'route_to_queue',
    'prioritize',
    'escalate',
    'add_tag',
    'set_priority'
  )),
  action_params JSONB DEFAULT '{}',
  
  -- Estatisticas
  match_count INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON ai_routing_rules(priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON ai_routing_rules(is_active) WHERE is_active = true;

ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_routing_rules" ON public.ai_routing_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_routing_rules" ON public.ai_routing_rules FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_routing_rules IS 'Regras de roteamento baseadas em condicoes.';

-- 3. Tabela de performance de agentes
CREATE TABLE IF NOT EXISTS public.ai_agent_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('ai', 'human', 'specialist')),
  
  -- Scores
  skill_scores JSONB DEFAULT '{}',
  /*
    {
      "technical": 0.85,
      "billing": 0.92,
      "sales": 0.78,
      "general": 0.90
    }
  */
  
  availability_score NUMERIC(3,2) DEFAULT 0.5,
  current_load INTEGER DEFAULT 0,
  max_load INTEGER DEFAULT 10,
  
  -- Performance
  avg_resolution_time_minutes NUMERIC(8,2) DEFAULT 0,
  satisfaction_rate NUMERIC(3,2) DEFAULT 0.5,
  escalation_rate NUMERIC(3,2) DEFAULT 0,
  
  -- Carga de trabalho
  current_queue_size INTEGER DEFAULT 0,
  avg_handle_time_minutes NUMERIC(8,2) DEFAULT 0,
  
  -- Status
  is_online BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_scores_agent ON ai_agent_performance_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_scores_available ON ai_agent_performance_scores(is_available, is_online) WHERE is_online = true;

ALTER TABLE public.ai_agent_performance_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_agent_performance_scores" ON public.ai_agent_performance_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_agent_performance_scores" ON public.ai_agent_performance_scores FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_agent_performance_scores IS 'Scores de performance dos agentes para roteamento.';

-- 4. Tabela de feedback de roteamento
CREATE TABLE IF NOT EXISTS public.ai_routing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  
  -- Decisao tomada
  routed_to TEXT NOT NULL,
  routing_confidence NUMERIC(3,2),
  
  -- Avaliacao
  was_correct BOOLEAN,
  alternative_better TEXT,
  
  -- Resultado
  resolution_time_minutes NUMERIC(8,2),
  customer_satisfied BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_feedback_conversation ON ai_routing_feedback(conversation_id);

ALTER TABLE public.ai_routing_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_routing_feedback" ON public.ai_routing_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_routing_feedback" ON public.ai_routing_feedback FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_routing_feedback IS 'Feedback sobre a decisao de roteamento.';

-- 5. Funcao para calcular score de roteamento
CREATE OR REPLACE FUNCTION public.calculate_routing_score(
  p_client_id UUID,
  p_intent_category TEXT,
  p_sentiment_score NUMERIC DEFAULT 0.5,
  p_requires_human BOOLEAN DEFAULT false,
  p_priority INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_client RECORD;
  v_best_agent JSONB;
  v_rules JSONB;
  v_rule RECORD;
BEGIN
  -- Pegar dados do cliente
  SELECT 
    COALESCE((SELECT SUM(total_value) FROM helpdesk_client_contracts WHERE client_id = p_client_id), 0) as lifetime_value,
    (SELECT COUNT(*) FROM ai_conversations WHERE helpdesk_client_id = p_client_id) as total_tickets,
    COALESCE((SELECT AVG(csat_score) FROM ai_conversations WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL), 0.5) as satisfaction
  INTO v_client;
  
  -- Verificar regras de roteamento
  FOR v_rule IN 
    SELECT * FROM ai_routing_rules 
    WHERE is_active = true 
    ORDER BY priority DESC
    LIMIT 10
  LOOP
    -- TODO: Implementar evaluacao de condicoes JSONB
    -- Por agora, aceitar todas
    EXIT;
  END LOOP;
  
  -- Calcular score baseado em heuristicas
  v_result := jsonb_build_object(
    'route_to', CASE 
      WHEN p_requires_human THEN 'human'
      WHEN v_client.satisfaction < 0.3 THEN 'human'
      WHEN p_sentiment_score < 0.3 THEN 'human'
      WHEN p_priority >= 4 THEN 'human'
      ELSE 'ai'
    END,
    'confidence', CASE
      WHEN p_requires_human THEN 0.95
      WHEN v_client.satisfaction < 0.3 OR p_sentiment_score < 0.3 THEN 0.85
      ELSE 0.70
    END,
    'reason', CASE
      WHEN p_requires_human THEN 'Requer atendimento humano'
      WHEN v_client.satisfaction < 0.3 THEN 'Cliente com baixa satisfacao previa'
      WHEN p_sentiment_score < 0.3 THEN 'Sentimento negativo detectado'
      WHEN p_priority >= 4 THEN 'Prioridade alta'
      ELSE 'Atendimento automatico'
    END,
    'priority_adjustment', CASE
      WHEN v_client.satisfaction > 0.8 THEN 1
      WHEN v_client.satisfaction < 0.5 THEN 2
      ELSE 0
    END,
    'customer_ltv', v_client.lifetime_value,
    'recommended_agent_type', CASE
      WHEN p_intent_category IN ('billing', 'payment') THEN 'financial'
      WHEN p_intent_category IN ('technical', 'support') THEN 'technical'
      ELSE 'general'
    END
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_routing_score TO service_role, authenticated;

-- 6. Funcao para encontrar melhor agente
CREATE OR REPLACE FUNCTION public.find_best_agent(
  p_agent_type TEXT,
  p_required_skill TEXT DEFAULT NULL,
  p_max_load INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent JSONB;
BEGIN
  -- Encontrar agente com melhor score
  SELECT 
    jsonb_build_object(
      'agent_id', agent_id,
      'skill_score', (skill_scores->p_required_skill)::NUMERIC DEFAULT 0.5,
      'availability', availability_score,
      'current_load', current_load,
      'satisfaction', satisfaction_rate
    ) as best
  INTO v_agent
  FROM ai_agent_performance_scores
  WHERE is_online = true
    AND is_available = true
    AND agent_type = p_agent_type
    AND current_load < LEAST(p_max_load, max_load)
  ORDER BY 
    (skill_scores->COALESCE(p_required_skill, 'general'))::NUMERIC DESC,
    satisfaction_rate DESC,
    current_load ASC
  LIMIT 1;
  
  RETURN COALESCE(v_agent, jsonb_build_object('agent_id', NULL));
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_best_agent TO service_role, authenticated;

-- 7. Funcao para registrar resultado de roteamento
CREATE OR REPLACE FUNCTION public.record_routing_outcome(
  p_conversation_id UUID,
  p_routed_to TEXT,
  p_routing_confidence NUMERIC DEFAULT NULL,
  p_resolution_time_minutes NUMERIC DEFAULT NULL,
  p_customer_satisfied BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_feedback_id UUID;
BEGIN
  INSERT INTO ai_routing_feedback (
    conversation_id, routed_to, routing_confidence, 
    resolution_time_minutes, customer_satisfied
  ) VALUES (
    p_conversation_id, p_routed_to, p_routing_confidence,
    p_resolution_time_minutes, p_customer_satisfied
  ) RETURNING id INTO v_feedback_id;
  
  RETURN v_feedback_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_routing_outcome TO service_role, authenticated;

-- 8. Funcao para analisar accuracy do roteamento
CREATE OR REPLACE FUNCTION public.analyze_routing_accuracy(
  p_time_range INTERVAL DEFAULT '7 days'::INTERVAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_correct INTEGER;
  v_by_type RECORD;
  v_by_intent JSONB := '[]'::JSONB;
BEGIN
  -- Overall accuracy
  SELECT COUNT(*), COUNT(*) FILTER (WHERE was_correct = true)
  INTO v_total, v_correct
  FROM ai_routing_feedback
  WHERE created_at >= NOW() - p_time_range;
  
  -- By routed type
  SELECT 
    routed_to,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE was_correct = true) as correct,
    AVG(routing_confidence) as avg_confidence
  INTO v_by_type
  FROM ai_routing_feedback
  WHERE created_at >= NOW() - p_time_range
  GROUP BY routed_to;
  
  RETURN jsonb_build_object(
    'period', p_time_range,
    'total_routings', v_total,
    'correct_routings', v_correct,
    'accuracy_rate', CASE WHEN v_total > 0 THEN (v_correct::NUMERIC / v_total * 100) ELSE 0 END,
    'by_routed_type', v_by_type,
    'recommendations', CASE
      WHEN v_total > 0 AND (v_correct::NUMERIC / v_total) < 0.7 THEN
        'Taxa de acerto abaixo de 70%. Recomenda-se revisar regras de roteamento.'
      ELSE
        'Roteamento com performance aceitavel.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_routing_accuracy TO service_role, authenticated;

-- Insert default routing rules
INSERT INTO public.ai_routing_rules (name, description, priority, conditions, action_type, action_params)
VALUES
  (
    'VIP Priority',
    'Clientes com alto valor vitalicio',
    95,
    '{"operator": "AND", "rules": [{"field": "lifetime_value", "operator": ">=", "value": 10000}]}',
    'route_to_human',
    '{"priority": "high"}'
  ),
  (
    'Sentiment Alert',
    'Cliente com sentimento negativo',
    90,
    '{"operator": "AND", "rules": [{"field": "sentiment_score", "operator": "<=", "value": 0.3}]}',
    'prioritize',
    '{"priority": 4}'
  ),
  (
    'Churn Risk',
    'Cliente com risco de churn',
    85,
    '{"operator": "AND", "rules": [{"field": "churn_risk", "operator": ">=", "value": 0.7}]}',
    'route_to_human',
    '{"priority": "high", "note": "Cliente em risco de churn"}'
  ),
  (
    'Billing Issues',
    'Assuntos financeiros vao para especialistas',
    80,
    '{"operator": "OR", "rules": [{"field": "intent_category", "operator": "=", "value": "billing"}, {"field": "intent_category", "operator": "=", "value": "payment"}]}',
    'route_to_specialist',
    '{"specialist_type": "financial"}'
  ),
  (
    'Technical Support',
    'Problemas tecnicos vao para time tecnico',
    75,
    '{"operator": "AND", "rules": [{"field": "intent_category", "operator": "=", "value": "technical"}]}',
    'route_to_specialist',
    '{"specialist_type": "technical"}'
  )
ON CONFLICT DO NOTHING;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260403_ai_predictive_routing', 'AI Predictive Routing system - intelligent routing based on ML', NOW())
ON CONFLICT DO NOTHING;
