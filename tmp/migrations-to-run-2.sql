-- ============================================
-- MIGRATION 2: ai_conversation_memory
-- Execute APOS a migration 1
-- ============================================

-- 1. Conversation context/memory table
CREATE TABLE IF NOT EXISTS public.ai_conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'summary', 'key_fact', 'customer_preference', 'intent_classification',
    'resolved_topic', 'pending_action', 'sentiment_snapshot', 'context_chunk'
  )),
  content TEXT NOT NULL,
  importance_score NUMERIC(3,2) DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memory_conversation ON ai_conversation_memory(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON ai_conversation_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON ai_conversation_memory(importance_score DESC) WHERE importance_score > 0.7;
CREATE INDEX IF NOT EXISTS idx_memory_expires ON ai_conversation_memory(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.ai_conversation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_conversation_memory" ON public.ai_conversation_memory FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ai_conversation_memory IS 'Memoria de conversacoes para contexto persistente entre interacoes do agente.';

-- 2. Customer long-term memory table
CREATE TABLE IF NOT EXISTS public.ai_customer_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference', 'history_summary', 'pain_point', 'success_story',
    'communication_style', 'purchase_history', 'support_history',
    'lifetime_value', 'churn_risk_factor'
  )),
  content TEXT NOT NULL,
  source TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_memory_client ON ai_customer_memory(client_id);
CREATE INDEX IF NOT EXISTS idx_customer_memory_type ON ai_customer_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_customer_memory_confidence ON ai_customer_memory(confidence_score DESC) WHERE confidence_score > 0.7;

ALTER TABLE public.ai_customer_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_customer_memory" ON public.ai_customer_memory FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ai_customer_memory IS 'Memoria de longo prazo sobre clientes para personalizacao do atendimento.';

-- 3. Session context table
CREATE TABLE IF NOT EXISTS public.ai_session_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  current_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  context_data JSONB DEFAULT '{}',
  turn_count INTEGER DEFAULT 0,
  last_intent TEXT,
  last_sentiment TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_session_id ON ai_session_context(session_id);
CREATE INDEX IF NOT EXISTS idx_session_conversation ON ai_session_context(conversation_id);
CREATE INDEX IF NOT EXISTS idx_session_active ON ai_session_context(is_active) WHERE is_active = true;

ALTER TABLE public.ai_session_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_session_context" ON public.ai_session_context FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ai_session_context IS 'Contexto de sessao para rastreamento de estado em conversacoes ativas.';

-- 4. Agent knowledge graph
CREATE TABLE IF NOT EXISTS public.ai_knowledge_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'product', 'service', 'issue', 'solution', 'agent', 'topic')),
  entity_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  related_entity_type TEXT NOT NULL,
  related_entity_id UUID NOT NULL,
  relation_strength NUMERIC(3,2) DEFAULT 0.5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_entity ON ai_knowledge_graph(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_graph_relation ON ai_knowledge_graph(relation_type);
CREATE INDEX IF NOT EXISTS idx_graph_related ON ai_knowledge_graph(related_entity_type, related_entity_id);

ALTER TABLE public.ai_knowledge_graph ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_knowledge_graph" ON public.ai_knowledge_graph FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ai_knowledge_graph IS 'Grafo de conhecimento para representar relacoes entre entidades do sistema.';

-- 5. Function: store_conversation_memory
CREATE OR REPLACE FUNCTION public.store_conversation_memory(
  p_conversation_id UUID,
  p_agent_id UUID,
  p_memory_type TEXT,
  p_content TEXT,
  p_importance_score NUMERIC DEFAULT 0.5,
  p_metadata JSONB DEFAULT '{}',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO public.ai_conversation_memory (
    conversation_id, agent_id, memory_type, content, importance_score, metadata, expires_at
  ) VALUES (
    p_conversation_id, p_agent_id, p_memory_type, p_content, p_importance_score, p_metadata, p_expires_at
  ) RETURNING id INTO v_memory_id;
  RETURN v_memory_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_conversation_memory TO service_role, authenticated;

-- 6. Function: get_conversation_memory
CREATE OR REPLACE FUNCTION public.get_conversation_memory(
  p_conversation_id UUID,
  p_memory_types TEXT[] DEFAULT NULL,
  p_min_importance NUMERIC DEFAULT 0,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID, memory_type TEXT, content TEXT, importance_score NUMERIC, metadata JSONB, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

-- 7. Function: store_customer_memory
CREATE OR REPLACE FUNCTION public.store_customer_memory(
  p_client_id UUID,
  p_memory_type TEXT,
  p_content TEXT,
  p_source TEXT DEFAULT NULL,
  p_confidence_score NUMERIC DEFAULT 0.5,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO public.ai_customer_memory (
    client_id, memory_type, content, source, confidence_score, metadata
  ) VALUES (
    p_client_id, p_memory_type, p_content, p_source, p_confidence_score, p_metadata
  ) RETURNING id INTO v_memory_id;
  RETURN v_memory_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_customer_memory TO service_role, authenticated;

-- 8. Function: get_customer_memory
CREATE OR REPLACE FUNCTION public.get_customer_memory(
  p_client_id UUID,
  p_memory_types TEXT[] DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID, memory_type TEXT, content TEXT, source TEXT, confidence_score NUMERIC, verified BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

-- 9. Function: generate_conversation_summary
CREATE OR REPLACE FUNCTION public.generate_conversation_summary(
  p_conversation_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_summary TEXT;
  v_key_points TEXT[];
  v_intents TEXT[];
  v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT DISTINCT content, memory_type 
    FROM ai_conversation_memory 
    WHERE conversation_id = p_conversation_id 
      AND memory_type IN ('key_fact', 'intent_classification', 'resolved_topic')
      AND importance_score >= 0.7
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    IF v_record.memory_type = 'key_fact' THEN
      v_key_points := array_append(v_key_points, v_record.content);
    ELSIF v_record.memory_type = 'intent_classification' THEN
      v_intents := array_append(v_intents, v_record.content);
    END IF;
  END LOOP;
  
  v_summary := 'Resumo da conversa: ';
  IF array_length(v_intents, 1) > 0 THEN
    v_summary := v_summary || 'Intencoes identificadas: ' || array_to_string(v_intents, ', ') || '. ';
  END IF;
  IF array_length(v_key_points, 1) > 0 THEN
    v_summary := v_summary || 'Pontos importantes: ' || array_to_string(v_key_points, '; ') || '. ';
  END IF;
  
  RETURN COALESCE(NULLIF(v_summary, 'Resumo da conversa: '), 'Sem informacoes relevantes armazenadas.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_conversation_summary TO service_role, authenticated;

-- 10. Function: update_session_context
CREATE OR REPLACE FUNCTION public.update_session_context(
  p_session_id TEXT,
  p_conversation_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_context_data JSONB DEFAULT NULL,
  p_intent TEXT DEFAULT NULL,
  p_sentiment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_context_id UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM ai_session_context WHERE session_id = p_session_id) INTO v_exists;
  
  IF v_exists THEN
    UPDATE ai_session_context
    SET 
      conversation_id = COALESCE(p_conversation_id, conversation_id),
      current_agent_id = COALESCE(p_agent_id, current_agent_id),
      context_data = COALESCE(p_context_data, context_data),
      last_intent = COALESCE(p_intent, last_intent),
      last_sentiment = COALESCE(p_sentiment, last_sentiment),
      turn_count = turn_count + 1,
      updated_at = NOW()
    WHERE session_id = p_session_id
    RETURNING id INTO v_context_id;
  ELSE
    INSERT INTO ai_session_context (
      session_id, conversation_id, current_agent_id, context_data, last_intent, last_sentiment
    ) VALUES (
      p_session_id, p_conversation_id, p_agent_id, p_context_data, p_intent, p_sentiment
    ) RETURNING id INTO v_context_id;
  END IF;
  
  RETURN v_context_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_session_context TO service_role, authenticated;

-- 11. View: ai_conversation_context
CREATE OR REPLACE VIEW public.ai_conversation_context AS
SELECT 
  c.id as conversation_id,
  c.customer_phone,
  c.status,
  c.handler_type,
  m.summary as conversation_summary,
  m.memory_count,
  m.high_importance_memories,
  s.turn_count,
  s.last_intent,
  s.last_sentiment,
  s.context_data
FROM ai_conversations c
LEFT JOIN LATERAL (
  SELECT 
    generate_conversation_summary(c.id) as summary,
    COUNT(*) as memory_count,
    COUNT(*) FILTER (WHERE importance_score > 0.7) as high_importance_memories
  FROM ai_conversation_memory
  WHERE conversation_id = c.id
) m ON true
LEFT JOIN LATERAL (
  SELECT *
  FROM ai_session_context
  WHERE conversation_id = c.id AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1
) s ON true;

GRANT SELECT ON public.ai_conversation_context TO service_role, authenticated;

SELECT 'Migration 2: ai_conversation_memory completed' as status;
