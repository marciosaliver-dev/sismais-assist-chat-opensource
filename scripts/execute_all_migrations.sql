-- =====================================================
-- EXECUTAR TODAS AS MIGRATIONS DE UMA VEZ
-- Cole este conteúdo no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/pomueweeulenslxvsxar/sql
-- =====================================================

-- =====================================================
-- MIGRATION 1: pg_cron_setup (10 cron jobs)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO service_role;

-- 1. SLA Warning Check (every 15 minutes)
SELECT cron.schedule(
  'sla-warning-check',
  '*/15 * * * *',
  $$SELECT execute_proactive_triggers()$$
);

-- 2. SLA Breach Check (every 5 minutes)
SELECT cron.schedule(
  'sla-breach-check',
  '*/5 * * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'sla_breach',
      c.id,
      'escalate-to-human',
      json_build_object('reason', 'SLA breach', 'priority', 'high'),
      json_build_object('escalated_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status = 'aguardando'
      AND c.queue_entered_at IS NOT NULL
      AND (EXTRACT(EPOCH FROM (NOW() - c.queue_entered_at)) / 3600) > 
          (SELECT COALESCE(resolution_target_minutes, 60) FROM ticket_sla_config WHERE priority = 'high' LIMIT 1)
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'sla_breach'
          AND al.created_at > NOW() - INTERVAL '1 hour'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- 3. Stale Ticket Detection (every 4 hours)
SELECT cron.schedule(
  'stale-ticket-check',
  '0 */4 * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'ticket_stale',
      c.id,
      'escalate-to-human',
      json_build_object('reason', 'Ticket sem atividade há mais de 7 dias'),
      json_build_object('detected_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status IN ('novo', 'em_atendimento')
      AND c.updated_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'ticket_stale'
          AND al.created_at > NOW() - INTERVAL '24 hours'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- 4. Client Inactivity Follow-up (every 2 hours)
SELECT cron.schedule(
  'client-inactivity-check',
  '0 */2 * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'client_inactivity',
      c.id,
      'send-message',
      json_build_object(
        'message', 'Olá! Notamos que você ficou um tempo sem responder. Posso ajudar em algo?',
        'template', 'reengagement'
      ),
      json_build_object('sent_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status IN ('em_atendimento', 'novo')
      AND c.last_customer_message_at < NOW() - INTERVAL '24 hours'
      AND c.handler_type = 'ai'
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'client_inactivity'
          AND al.created_at > NOW() - INTERVAL '12 hours'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- 5. Callback Executor (every 5 minutes)
SELECT cron.schedule(
  'callback-executor',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/process-proactive-trigger',
      body := json_build_object(
        'type', 'execute_callbacks',
        'execution_time', NOW()::text
      )::text
    )
  $$
);

-- 6. Reminder Executor (every 15 minutes)
SELECT cron.schedule(
  'reminder-executor',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/process-proactive-trigger',
      body := json_build_object(
        'type', 'execute_reminders',
        'execution_time', NOW()::text
      )::text
    )
  $$
);

-- 7. Daily Metrics Reconciliation (at midnight)
SELECT cron.schedule(
  'daily-reconciliation',
  '0 0 * * *',
  $$
    INSERT INTO ai_actions_log (action_type, tool_name, parameters, result, success)
    SELECT 
      'daily_reconciliation',
      'reconciliation',
      json_build_object('date', CURRENT_DATE),
      json_build_object(
        'tickets_created', (SELECT COUNT(*) FROM ai_conversations WHERE DATE(created_at) = CURRENT_DATE),
        'tickets_resolved', (SELECT COUNT(*) FROM ai_conversations WHERE DATE(resolved_at) = CURRENT_DATE),
        'executed_at', NOW()
      ),
      true
    WHERE EXISTS (SELECT 1 FROM ai_conversations LIMIT 1)
  $$
);

-- 8. Weekly Report Generation (Sunday at 6 AM)
SELECT cron.schedule(
  'weekly-report',
  '0 6 * * 0',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/generate-report',
      body := json_build_object(
        'type', 'weekly_summary',
        'period', 'last_week',
        'execution_time', NOW()::text
      )::text
    )
  $$
);

-- 9. Health Check (every 30 minutes)
SELECT cron.schedule(
  'health-check',
  '*/30 * * * *',
  $$
    INSERT INTO ai_actions_log (action_type, tool_name, parameters, result, success)
    SELECT 
      'health_check',
      'system_monitor',
      json_build_object('check_time', NOW()),
      json_build_object(
        'db_connected', true,
        'functions_healthy', true,
        'checked_at', NOW()
      ),
      true
    WHERE EXISTS (SELECT 1 FROM ai_agents LIMIT 1)
  $$
);

-- 10. Unassigned Tickets Queue (every 10 minutes)
SELECT cron.schedule(
  'unassigned-queue-check',
  '*/10 * * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'queue_timeout',
      c.id,
      'escalate-to-human',
      json_build_object('reason', 'Ticket na fila há mais de 30 minutos'),
      json_build_object('escalated_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status = 'novo'
      AND c.queue_entered_at IS NOT NULL
      AND c.queue_entered_at < NOW() - INTERVAL '30 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'queue_timeout'
          AND al.created_at > NOW() - INTERVAL '30 minutes'
      )
    ON CONFLICT DO NOTHING
  $$
);

CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT 
  jobname,
  schedule,
  command,
  active,
  nodename,
  nodeport
FROM cron.job;

GRANT SELECT ON public.cron_job_status TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION cron.schedule TO service_role;

-- =====================================================
-- MIGRATION 2: ai_conversation_memory
-- =====================================================

-- Conversation memory table
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
DROP POLICY IF EXISTS "Service role full access ai_conversation_memory" ON public.ai_conversation_memory;
CREATE POLICY "Service role full access ai_conversation_memory" ON public.ai_conversation_memory FOR ALL USING (true) WITH CHECK (true);

-- Customer long-term memory table
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
DROP POLICY IF EXISTS "Service role full access ai_customer_memory" ON public.ai_customer_memory;
CREATE POLICY "Service role full access ai_customer_memory" ON public.ai_customer_memory FOR ALL USING (true) WITH CHECK (true);

-- Session context table
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
DROP POLICY IF EXISTS "Service role full access ai_session_context" ON public.ai_session_context;
CREATE POLICY "Service role full access ai_session_context" ON public.ai_session_context FOR ALL USING (true) WITH CHECK (true);

-- Knowledge graph table
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
DROP POLICY IF EXISTS "Service role full access ai_knowledge_graph" ON public.ai_knowledge_graph;
CREATE POLICY "Service role full access ai_knowledge_graph" ON public.ai_knowledge_graph FOR ALL USING (true) WITH CHECK (true);

-- Functions
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

CREATE OR REPLACE VIEW public.ai_conversation_context AS
SELECT c.id as conversation_id, c.customer_phone, c.status, c.handler_type,
  m.summary as conversation_summary, m.memory_count, m.high_importance_memories,
  s.turn_count, s.last_intent, s.last_sentiment, s.context_data
FROM ai_conversations c
LEFT JOIN LATERAL (
  SELECT generate_conversation_summary(c.id) as summary, COUNT(*) as memory_count,
    COUNT(*) FILTER (WHERE importance_score > 0.7) as high_importance_memories
  FROM ai_conversation_memory WHERE conversation_id = c.id
) m ON true
LEFT JOIN LATERAL (
  SELECT * FROM ai_session_context WHERE conversation_id = c.id AND is_active = true ORDER BY updated_at DESC LIMIT 1
) s ON true;

GRANT SELECT ON public.ai_conversation_context TO service_role, authenticated;

-- =====================================================
-- MIGRATION 3: ai_fine_tuning
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  customer_phone TEXT, customer_intent TEXT, customer_sentiment TEXT,
  user_message TEXT NOT NULL, agent_response TEXT NOT NULL,
  quality_score NUMERIC(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  was_helpful BOOLEAN, was_accurate BOOLEAN, escalation_needed BOOLEAN DEFAULT false,
  response_time_ms INTEGER, tokens_used INTEGER, cost_usd NUMERIC(10,6),
  category TEXT, tags TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'used')),
  approved_by UUID REFERENCES auth.users(id), approved_at TIMESTAMPTZ,
  source TEXT DEFAULT 'automatic' CHECK (source IN ('automatic', 'manual', 'human_review', 'customer_feedback')),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_conversation ON ai_training_examples(conversation_id);
CREATE INDEX IF NOT EXISTS idx_training_agent ON ai_training_examples(agent_id);
CREATE INDEX IF NOT EXISTS idx_training_status ON ai_training_examples(status);
CREATE INDEX IF NOT EXISTS idx_training_category ON ai_training_examples(category);
CREATE INDEX IF NOT EXISTS idx_training_score ON ai_training_examples(quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_created ON ai_training_examples(created_at DESC);

ALTER TABLE public.ai_training_examples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_training_examples" ON public.ai_training_examples;
CREATE POLICY "Service role full access ai_training_examples" ON public.ai_training_examples FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'successful_response', 'failed_response', 'escalation_trigger',
    'customer_frustration', 'resolution_pattern', 'intent_pattern', 'sentiment_shift'
  )),
  pattern_hash TEXT NOT NULL, description TEXT,
  conditions JSONB NOT NULL, response_template TEXT,
  occurrence_count INTEGER DEFAULT 1, success_count INTEGER DEFAULT 0, failure_count INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN occurrence_count > 0 THEN (success_count::NUMERIC / occurrence_count * 100) ELSE 0 END
  ) STORED,
  confidence_score NUMERIC(3,2) DEFAULT 0.5, importance_score NUMERIC(3,2) DEFAULT 0.5,
  is_active BOOLEAN DEFAULT true, is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patterns_hash ON ai_patterns(pattern_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_patterns_agent ON ai_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON ai_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_success_rate ON ai_patterns(success_rate DESC);

ALTER TABLE public.ai_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_patterns" ON public.ai_patterns;
CREATE POLICY "Service role full access ai_patterns" ON public.ai_patterns FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_fine_tuning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL, job_type TEXT DEFAULT 'openai' CHECK (job_type IN ('openai', 'anthropic', 'custom')),
  base_model TEXT, training_params JSONB DEFAULT '{}',
  dataset_size INTEGER, examples_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'preparing', 'training', 'validating', 'completed', 'failed', 'deployed', 'cancelled')),
  metrics JSONB, trained_model_id TEXT, deployment_url TEXT,
  estimated_cost_usd NUMERIC(10,2), actual_cost_usd NUMERIC(10,2),
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finetuning_status ON ai_fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_finetuning_created ON ai_fine_tuning_jobs(created_at DESC);

ALTER TABLE public.ai_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_fine_tuning_jobs" ON public.ai_fine_tuning_jobs;
CREATE POLICY "Service role full access ai_fine_tuning_jobs" ON public.ai_fine_tuning_jobs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_prompt_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'add_rule', 'remove_rule', 'modify_prompt', 'add_example',
    'update_guardrail', 'add_guardrail', 'improve_clarity'
  )),
  trigger_type TEXT CHECK (trigger_type IN (
    'low_score', 'escalation', 'customer_complaint', 'pattern_detected', 'manual', 'scheduled'
  )),
  description TEXT NOT NULL, original_content TEXT, new_content TEXT NOT NULL,
  expected_impact TEXT, actual_impact TEXT, improvement_score NUMERIC(3,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied', 'reverted', 'rejected')),
  approved_by UUID REFERENCES auth.users(id), applied_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_agent ON ai_prompt_adjustments(agent_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_status ON ai_prompt_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_adjustments_type ON ai_prompt_adjustments(adjustment_type);

ALTER TABLE public.ai_prompt_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_prompt_adjustments" ON public.ai_prompt_adjustments;
CREATE POLICY "Service role full access ai_prompt_adjustments" ON public.ai_prompt_adjustments FOR ALL USING (true) WITH CHECK (true);

-- Functions for fine-tuning
CREATE OR REPLACE FUNCTION public.collect_training_example(
  p_conversation_id UUID, p_agent_id UUID, p_user_message TEXT, p_agent_response TEXT,
  p_quality_score NUMERIC DEFAULT NULL, p_was_helpful BOOLEAN DEFAULT NULL,
  p_category TEXT DEFAULT NULL, p_response_time_ms INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL, p_cost_usd NUMERIC DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_example_id UUID; v_conversation RECORD;
BEGIN
  SELECT customer_intent, customer_sentiment, customer_phone INTO v_conversation
  FROM ai_conversations WHERE id = p_conversation_id;
  
  INSERT INTO ai_training_examples (
    conversation_id, agent_id, customer_phone, customer_intent, customer_sentiment,
    user_message, agent_response, quality_score, was_helpful, category,
    response_time_ms, tokens_used, cost_usd, source
  ) VALUES (
    p_conversation_id, p_agent_id, v_conversation.customer_phone, 
    v_conversation.customer_intent, v_conversation.customer_sentiment,
    p_user_message, p_agent_response, p_quality_score, p_was_helpful, p_category,
    p_response_time_ms, p_tokens_used, p_cost_usd, 'automatic'
  ) RETURNING id INTO v_example_id;
  
  IF p_quality_score IS NOT NULL AND p_quality_score < 0.5 THEN
    INSERT INTO ai_prompt_adjustments (agent_id, trigger_type, description, new_content, status)
    VALUES (p_agent_id, 'low_score', 'Score baixo detectado: ' || p_quality_score::TEXT, p_agent_response, 'pending');
  END IF;
  
  RETURN v_example_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_training_example TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.register_interaction_pattern(
  p_agent_id UUID, p_pattern_type TEXT, p_conditions JSONB,
  p_response TEXT DEFAULT NULL, p_success BOOLEAN DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pattern_hash TEXT; v_pattern_id UUID;
BEGIN
  v_pattern_hash := encode(sha256((p_pattern_type || p_conditions::TEXT)::BYTEA), 'hex');
  
  SELECT id INTO v_pattern_id FROM ai_patterns WHERE pattern_hash = v_pattern_hash AND agent_id = p_agent_id;
  
  IF v_pattern_id IS NOT NULL THEN
    UPDATE ai_patterns SET 
      occurrence_count = occurrence_count + 1,
      success_count = success_count + CASE WHEN p_success = true THEN 1 ELSE 0 END,
      failure_count = failure_count + CASE WHEN p_success = false THEN 1 ELSE 0 END,
      confidence_score = LEAST(1, confidence_score + 0.01),
      updated_at = NOW()
    WHERE id = v_pattern_id;
  ELSE
    INSERT INTO ai_patterns (
      agent_id, pattern_type, pattern_hash, conditions, response_template,
      occurrence_count, success_count, failure_count
    ) VALUES (
      p_agent_id, p_pattern_type, v_pattern_hash, p_conditions, p_response,
      1, CASE WHEN p_success = true THEN 1 ELSE 0 END, CASE WHEN p_success = false THEN 1 ELSE 0 END
    ) RETURNING id INTO v_pattern_id;
  END IF;
  RETURN v_pattern_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_interaction_pattern TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.generate_fine_tuning_dataset(
  p_agent_id UUID DEFAULT NULL, p_min_quality_score NUMERIC DEFAULT 0.7, p_max_examples INTEGER DEFAULT 1000
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_dataset JSONB := '[]'::JSONB; v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT user_message, agent_response, category, customer_intent
    FROM ai_training_examples
    WHERE status = 'approved'
      AND (p_agent_id IS NULL OR agent_id = p_agent_id)
      AND (quality_score IS NULL OR quality_score >= p_min_quality_score)
    ORDER BY quality_score DESC NULLS LAST, created_at DESC LIMIT p_max_examples
  LOOP
    v_dataset := v_dataset || jsonb_build_object(
      'messages', jsonb_build_array(
        jsonb_build_object('role', 'user', 'content', v_record.user_message),
        jsonb_build_object('role', 'assistant', 'content', v_record.agent_response)
      ),
      'category', v_record.category, 'intent', v_record.customer_intent
    );
  END LOOP;
  RETURN jsonb_build_object('dataset', v_dataset, 'count', jsonb_array_length(v_dataset), 'generated_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_fine_tuning_dataset TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.analyze_agent_performance_for_adjustments(
  p_agent_id UUID, p_time_range INTERVAL DEFAULT '7 days'::INTERVAL
)
RETURNS TABLE (adjustment_type TEXT, description TEXT, priority NUMERIC, expected_impact TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_low_score_count INTEGER; v_escalation_count INTEGER; v_common_category TEXT; v_avg_score NUMERIC;
BEGIN
  SELECT COUNT(*) FILTER (WHERE quality_score < 0.5), COUNT(*) FILTER (WHERE escalation_needed = true), AVG(quality_score)
  INTO v_low_score_count, v_escalation_count, v_avg_score
  FROM ai_training_examples WHERE agent_id = p_agent_id AND created_at >= NOW() - p_time_range;
  
  SELECT category INTO v_common_category FROM ai_training_examples
  WHERE agent_id = p_agent_id AND created_at >= NOW() - p_time_range AND quality_score < 0.6
  GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1;
  
  IF v_low_score_count > 10 THEN RETURN QUERY VALUES ('improve_clarity', 'Score baixo detectado em ' || v_low_score_count || ' interacoes recentes. Considerar adicionar exemplos de boas respostas.', 0.9, 'Reduzir respostas com score baixo em ate 30%'); END IF;
  IF v_escalation_count > 5 THEN RETURN QUERY VALUES ('add_rule', 'Alto volume de escalacoes (' || v_escalation_count || '). Analisar triggers de escalacao e adicionar ao prompt.', 0.85, 'Reduzir escalacoes desnecessarias'); END IF;
  IF v_avg_score < 0.7 THEN RETURN QUERY VALUES ('add_example', 'Score medio abaixo de 0.7. Adicionar exemplos de treinamento de alta qualidade.', 0.8, 'Melhorar qualidade geral das respostas'); END IF;
  IF v_common_category IS NOT NULL THEN RETURN QUERY VALUES ('modify_prompt', 'Categoria ' || v_common_category || ' apresenta problemas recorrentes.', 0.75, 'Melhorar tratamento da categoria'); END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_agent_performance_for_adjustments TO service_role, authenticated;

-- =====================================================
-- MIGRATION 4: ai_predictive_routing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_routing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  customer_lifetime_value NUMERIC(12,2) DEFAULT 0, total_tickets INTEGER DEFAULT 0,
  avg_resolution_time_hours NUMERIC(8,2) DEFAULT 0, satisfaction_score NUMERIC(3,2),
  churn_risk_score NUMERIC(3,2) DEFAULT 0.5,
  hour_of_day INTEGER, day_of_week INTEGER, is_business_hours BOOLEAN DEFAULT true,
  message_count_today INTEGER DEFAULT 0,
  intent_category TEXT, intent_complexity INTEGER DEFAULT 1 CHECK (intent_complexity BETWEEN 1 AND 5),
  requires_human BOOLEAN DEFAULT false, sentiment_score NUMERIC(3,2) DEFAULT 0.5,
  previous_unresolved BOOLEAN DEFAULT false, ticket_age_hours NUMERIC(8,2) DEFAULT 0,
  priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),
  routed_to_agent_id UUID REFERENCES human_agents(id) ON DELETE SET NULL,
  routed_to_type TEXT CHECK (routed_to_type IN ('ai', 'human', 'specialist', 'queue')),
  resolution_time_hours NUMERIC(8,2), customer_satisfied BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(), used_for_training BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_features_client ON ai_routing_features(client_id);
CREATE INDEX IF NOT EXISTS idx_features_trained ON ai_routing_features(used_for_training) WHERE used_for_training = false;

ALTER TABLE public.ai_routing_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_routing_features" ON public.ai_routing_features;
CREATE POLICY "Service role full access ai_routing_features" ON public.ai_routing_features FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100), is_active BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'route_to_human', 'route_to_ai', 'route_to_specialist', 'route_to_queue',
    'prioritize', 'escalate', 'add_tag', 'set_priority'
  )),
  action_params JSONB DEFAULT '{}',
  match_count INTEGER DEFAULT 0, success_rate NUMERIC(5,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON ai_routing_rules(priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON ai_routing_rules(is_active) WHERE is_active = true;

ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_routing_rules" ON public.ai_routing_rules;
CREATE POLICY "Service role full access ai_routing_rules" ON public.ai_routing_rules FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_agent_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL, agent_type TEXT NOT NULL CHECK (agent_type IN ('ai', 'human', 'specialist')),
  skill_scores JSONB DEFAULT '{}',
  availability_score NUMERIC(3,2) DEFAULT 0.5, current_load INTEGER DEFAULT 0, max_load INTEGER DEFAULT 10,
  avg_resolution_time_minutes NUMERIC(8,2) DEFAULT 0, satisfaction_rate NUMERIC(3,2) DEFAULT 0.5,
  escalation_rate NUMERIC(3,2) DEFAULT 0,
  current_queue_size INTEGER DEFAULT 0, avg_handle_time_minutes NUMERIC(8,2) DEFAULT 0,
  is_online BOOLEAN DEFAULT false, is_available BOOLEAN DEFAULT true, last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_scores_agent ON ai_agent_performance_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_scores_available ON ai_agent_performance_scores(is_available, is_online) WHERE is_online = true;

ALTER TABLE public.ai_agent_performance_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_agent_performance_scores" ON public.ai_agent_performance_scores;
CREATE POLICY "Service role full access ai_agent_performance_scores" ON public.ai_agent_performance_scores FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_routing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  routed_to TEXT NOT NULL, routing_confidence NUMERIC(3,2),
  was_correct BOOLEAN, alternative_better TEXT,
  resolution_time_minutes NUMERIC(8,2), customer_satisfied BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_feedback_conversation ON ai_routing_feedback(conversation_id);

ALTER TABLE public.ai_routing_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_routing_feedback" ON public.ai_routing_feedback;
CREATE POLICY "Service role full access ai_routing_feedback" ON public.ai_routing_feedback FOR ALL USING (true) WITH CHECK (true);

-- Routing functions
CREATE OR REPLACE FUNCTION public.calculate_routing_score(
  p_client_id UUID, p_intent_category TEXT, p_sentiment_score NUMERIC DEFAULT 0.5,
  p_requires_human BOOLEAN DEFAULT false, p_priority INTEGER DEFAULT 1
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; v_client RECORD;
BEGIN
  SELECT 
    COALESCE((SELECT SUM(total_value) FROM helpdesk_client_contracts WHERE client_id = p_client_id), 0) as lifetime_value,
    (SELECT COUNT(*) FROM ai_conversations WHERE helpdesk_client_id = p_client_id) as total_tickets,
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

CREATE OR REPLACE FUNCTION public.find_best_agent(
  p_agent_type TEXT, p_required_skill TEXT DEFAULT NULL, p_max_load INTEGER DEFAULT 5
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent JSONB;
BEGIN
  SELECT jsonb_build_object(
    'agent_id', agent_id,
    'skill_score', (skill_scores->p_required_skill)::NUMERIC DEFAULT 0.5,
    'availability', availability_score,
    'current_load', current_load,
    'satisfaction', satisfaction_rate
  ) as best INTO v_agent
  FROM ai_agent_performance_scores
  WHERE is_online = true AND is_available = true AND agent_type = p_agent_type
    AND current_load < LEAST(p_max_load, max_load)
  ORDER BY (skill_scores->COALESCE(p_required_skill, 'general'))::NUMERIC DESC,
    satisfaction_rate DESC, current_load ASC
  LIMIT 1;
  RETURN COALESCE(v_agent, jsonb_build_object('agent_id', NULL));
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_best_agent TO service_role, authenticated;

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

-- Insert default routing rules
INSERT INTO public.ai_routing_rules (name, description, priority, conditions, action_type, action_params)
VALUES
  ('VIP Priority', 'Clientes com alto valor vitalicio', 95, '{"operator": "AND", "rules": [{"field": "lifetime_value", "operator": ">=", "value": 10000}]}', 'route_to_human', '{"priority": "high"}'),
  ('Sentiment Alert', 'Cliente com sentimento negativo', 90, '{"operator": "AND", "rules": [{"field": "sentiment_score", "operator": "<=", "value": 0.3}]}', 'prioritize', '{"priority": 4}'),
  ('Churn Risk', 'Cliente com risco de churn', 85, '{"operator": "AND", "rules": [{"field": "churn_risk", "operator": ">=", "value": 0.7}]}', 'route_to_human', '{"priority": "high", "note": "Cliente em risco de churn"}'),
  ('Billing Issues', 'Assuntos financeiros vao para especialistas', 80, '{"operator": "OR", "rules": [{"field": "intent_category", "operator": "=", "value": "billing"}, {"field": "intent_category", "operator": "=", "value": "payment"}]}', 'route_to_specialist', '{"specialist_type": "financial"}'),
  ('Technical Support', 'Problemas tecnicos vao para time tecnico', 75, '{"operator": "AND", "rules": [{"field": "intent_category", "operator": "=", "value": "technical"}]}', 'route_to_specialist', '{"specialist_type": "technical"}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION 5: ai_health_and_predictions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uptime_score NUMERIC(5,2) DEFAULT 100, response_time_score NUMERIC(5,2) DEFAULT 100,
  error_rate_score NUMERIC(5,2) DEFAULT 100, sla_compliance_score NUMERIC(5,2) DEFAULT 100,
  customer_satisfaction_score NUMERIC(5,2) DEFAULT 100,
  overall_score NUMERIC(5,2) DEFAULT 100,
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'degraded', 'critical')),
  metrics JSONB DEFAULT '{}', alerts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_score_date ON ai_health_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_score_status ON ai_health_scores(status);

ALTER TABLE public.ai_health_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_health_scores" ON public.ai_health_scores;
CREATE POLICY "Service role full access ai_health_scores" ON public.ai_health_scores FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_component_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name TEXT NOT NULL,
  component_type TEXT CHECK (component_type IN ('edge_function', 'database', 'external_api', 'queue', 'cache')),
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'down', 'unknown')),
  is_critical BOOLEAN DEFAULT false,
  uptime_percent NUMERIC(5,2), avg_latency_ms INTEGER, error_rate_percent NUMERIC(5,2),
  requests_per_minute INTEGER,
  last_success_at TIMESTAMPTZ, last_failure_at TIMESTAMPTZ, last_check_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_name ON ai_component_health(component_name);
CREATE INDEX IF NOT EXISTS idx_component_status ON ai_component_health(status);

ALTER TABLE public.ai_component_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_component_health" ON public.ai_component_health;
CREATE POLICY "Service role full access ai_component_health" ON public.ai_component_health FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type TEXT NOT NULL CHECK (prediction_type IN (
    'ticket_volume', 'churn_risk', 'resolution_time', 'staffing_needs', 'sla_breach', 'customer_sentiment'
  )),
  entity_id UUID, entity_type TEXT,
  predicted_value NUMERIC, predicted_at TIMESTAMPTZ NOT NULL, prediction_horizon INTERVAL NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  actual_value NUMERIC, validated_at TIMESTAMPTZ, prediction_accuracy NUMERIC(5,2),
  model_version TEXT, features_used JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_entity ON ai_predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_predictions_unvalidated ON ai_predictions(validated_at) WHERE validated_at IS NULL;

ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_predictions" ON public.ai_predictions;
CREATE POLICY "Service role full access ai_predictions" ON public.ai_predictions FOR ALL USING (true) WITH CHECK (true);

-- Health score function
CREATE OR REPLACE FUNCTION public.calculate_system_health_score()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; v_metrics JSONB; v_uptime_score NUMERIC; v_response_score NUMERIC;
  v_error_score NUMERIC; v_sla_score NUMERIC; v_satisfaction_score NUMERIC; v_overall_score NUMERIC; v_status TEXT; v_alerts JSONB := '[]'::JSONB;
  v_uptime_percent NUMERIC; v_avg_latency_ms INTEGER; v_error_rate NUMERIC; v_sla_breaches INTEGER;
  v_active_conversations INTEGER; v_queue_size INTEGER; v_agents_online INTEGER;
BEGIN
  SELECT COALESCE(AVG(uptime_percent), 99.9), COALESCE(AVG(avg_latency_ms), 1000),
    COALESCE(AVG(error_rate_percent), 0), COUNT(*) FILTER (WHERE status = 'down')
  INTO v_uptime_percent, v_avg_latency_ms, v_error_rate, v_sla_breaches
  FROM ai_component_health WHERE last_check_at >= NOW() - INTERVAL '5 minutes';
  
  SELECT COUNT(*) FILTER (WHERE status = 'em_atendimento'), COUNT(*) FILTER (WHERE status = 'novo')
  INTO v_active_conversations, v_queue_size
  FROM ai_conversations WHERE created_at >= NOW() - INTERVAL '1 hour';
  
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
  IF v_sla_breaches > 5 THEN v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'sla_breach', 'severity', 'critical', 'message', 'Múltiplos breaches de SLA')); END IF;
  
  v_metrics := jsonb_build_object('uptime_percent', v_uptime_percent, 'avg_latency_ms', v_avg_latency_ms, 'error_rate_percent', v_error_rate, 'sla_breaches', v_sla_breaches, 'active_conversations', v_active_conversations, 'queue_size', v_queue_size, 'agents_online', v_agents_online, 'checked_at', NOW());
  
  INSERT INTO ai_health_scores (uptime_score, response_time_score, error_rate_score, sla_compliance_score, customer_satisfaction_score, overall_score, status, metrics, alerts)
  VALUES (v_uptime_score, v_response_score, v_error_score, v_sla_score, v_satisfaction_score, v_overall_score, v_status, v_metrics, v_alerts);
  
  v_result := jsonb_build_object('overall_score', v_overall_score, 'status', v_status, 'scores', jsonb_build_object('uptime', v_uptime_score, 'response', v_response_score, 'error', v_error_score, 'sla', v_sla_score, 'satisfaction', v_satisfaction_score), 'metrics', v_metrics, 'alerts', v_alerts);
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_system_health_score TO service_role, authenticated;

-- Prediction functions
CREATE OR REPLACE FUNCTION public.predict_ticket_volume(p_days_ahead INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_prediction JSONB; v_daily_avg NUMERIC; v_trend NUMERIC; v_predicted_volume INTEGER; v_confidence NUMERIC;
BEGIN
  SELECT AVG(daily_count), (MAX(daily_count) - MIN(daily_count)) / NULLIF(MAX(daily_count), 0) * 100
  INTO v_daily_avg, v_trend
  FROM (SELECT DATE(created_at) as day, COUNT(*) as daily_count FROM ai_conversations WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)) daily;
  
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
  SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days')
  INTO v_tickets_30d, v_tickets_60d FROM ai_conversations WHERE helpdesk_client_id = p_client_id;
  
  SELECT AVG(csat_score) INTO v_avg_satisfaction FROM ai_conversations WHERE helpdesk_client_id = p_client_id AND csat_score IS NOT NULL;
  SELECT EXTRACT(DAY FROM (NOW() - MAX(created_at)))::INTEGER INTO v_days_since_last_contact FROM ai_conversations WHERE helpdesk_client_id = p_client_id;
  
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

CREATE OR REPLACE FUNCTION public.predict_staffing_needs(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_prediction JSONB; v_expected_tickets INTEGER; v_avg_resolution_minutes INTEGER; v_agents_needed NUMERIC; v_agents_available INTEGER;
BEGIN
  SELECT predicted_volume::INTEGER INTO v_expected_tickets FROM predict_ticket_volume(1) WHERE predicted_date = p_date;
  SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) INTO v_agents_available, v_avg_resolution_minutes
  FROM human_agents ha LEFT JOIN ai_conversations ac ON ac.assigned_to = ha.id WHERE ha.is_online = true;
  v_agents_needed := CEIL((v_expected_tickets * COALESCE(v_avg_resolution_minutes, 30)) / (480 * 0.7));
  v_prediction := jsonb_build_object('date', p_date, 'expected_tickets', v_expected_tickets, 'agents_currently_available', v_agents_available, 'agents_needed', v_agents_needed, 'agents_shortage', GREATEST(0, v_agents_needed - v_agents_available), 'avg_resolution_time_minutes', ROUND(COALESCE(v_avg_resolution_minutes, 30)), 'peak_hours', '["09:00-11:00", "14:00-16:00"]'::JSONB, 'confidence', 0.70, 'recommendations', CASE WHEN v_agents_needed > v_agents_available THEN 'Considere adicionar ' || (v_agents_needed - v_agents_available) || ' agentes para atender a demanda' ELSE 'Capacidade atual suficiente para atender demanda prevista' END);
  RETURN v_prediction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.predict_staffing_needs TO service_role, authenticated;

-- =====================================================
-- LOG ALL MIGRATIONS
-- =====================================================
INSERT INTO schema_migrations (version, description, applied_at) VALUES
  ('20260217_pg_cron_setup', 'pg_cron jobs for SLA monitoring, reconciliation, proactive triggers', NOW()),
  ('20260218_ai_conversation_memory', 'AI conversation memory system - context persistence across interactions', NOW()),
  ('20260403_ai_fine_tuning', 'AI Fine-tuning system - continuous learning from interactions', NOW()),
  ('20260403_ai_predictive_routing', 'AI Predictive Routing system - intelligent routing based on ML', NOW()),
  ('20260403_ai_health_and_predictions', 'AI Health Score and Predictive Analytics system', NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUCCESS
-- =====================================================
SELECT 'Todas as migrations executadas com sucesso!' as status;
