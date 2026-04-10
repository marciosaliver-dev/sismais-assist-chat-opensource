-- AI Conversation Memory Tables
CREATE TABLE IF NOT EXISTS public.ai_conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('summary', 'key_fact', 'customer_preference', 'intent_classification', 'resolved_topic', 'pending_action', 'sentiment_snapshot', 'context_chunk')),
  content TEXT NOT NULL,
  importance_score NUMERIC(3,2) DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_memory_conversation ON ai_conversation_memory(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON ai_conversation_memory(memory_type);
ALTER TABLE public.ai_conversation_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_conversation_memory" ON public.ai_conversation_memory;
CREATE POLICY "Service role full access ai_conversation_memory" ON public.ai_conversation_memory FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_customer_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'history_summary', 'pain_point', 'success_story', 'communication_style', 'purchase_history', 'support_history', 'lifetime_value', 'churn_risk_factor')),
  content TEXT NOT NULL,
  source TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_memory_client ON ai_customer_memory(client_id);
ALTER TABLE public.ai_customer_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_customer_memory" ON public.ai_customer_memory;
CREATE POLICY "Service role full access ai_customer_memory" ON public.ai_customer_memory FOR ALL USING (true) WITH CHECK (true);

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
ALTER TABLE public.ai_session_context ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_session_context" ON public.ai_session_context;
CREATE POLICY "Service role full access ai_session_context" ON public.ai_session_context FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  related_entity_type TEXT NOT NULL,
  related_entity_id UUID NOT NULL,
  relation_strength NUMERIC(3,2) DEFAULT 0.5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_graph_entity ON ai_knowledge_graph(entity_type, entity_id);
ALTER TABLE public.ai_knowledge_graph ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_knowledge_graph" ON public.ai_knowledge_graph;
CREATE POLICY "Service role full access ai_knowledge_graph" ON public.ai_knowledge_graph FOR ALL USING (true) WITH CHECK (true);

-- AI Training Examples
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
ALTER TABLE public.ai_training_examples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_training_examples" ON public.ai_training_examples;
CREATE POLICY "Service role full access ai_training_examples" ON public.ai_training_examples FOR ALL USING (true) WITH CHECK (true);

-- AI Patterns
CREATE TABLE IF NOT EXISTS public.ai_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('successful_response', 'failed_response', 'escalation_trigger', 'customer_frustration', 'resolution_pattern', 'intent_pattern', 'sentiment_shift')),
  pattern_hash TEXT NOT NULL, description TEXT,
  conditions JSONB NOT NULL, response_template TEXT,
  occurrence_count INTEGER DEFAULT 1, success_count INTEGER DEFAULT 0, failure_count INTEGER DEFAULT 0,
  confidence_score NUMERIC(3,2) DEFAULT 0.5, importance_score NUMERIC(3,2) DEFAULT 0.5,
  is_active BOOLEAN DEFAULT true, is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patterns_agent ON ai_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON ai_patterns(pattern_type);
ALTER TABLE public.ai_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_patterns" ON public.ai_patterns;
CREATE POLICY "Service role full access ai_patterns" ON public.ai_patterns FOR ALL USING (true) WITH CHECK (true);

-- Fine-tuning Jobs
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
ALTER TABLE public.ai_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_fine_tuning_jobs" ON public.ai_fine_tuning_jobs;
CREATE POLICY "Service role full access ai_fine_tuning_jobs" ON public.ai_fine_tuning_jobs FOR ALL USING (true) WITH CHECK (true);

-- Prompt Adjustments
CREATE TABLE IF NOT EXISTS public.ai_prompt_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add_rule', 'remove_rule', 'modify_prompt', 'add_example', 'update_guardrail', 'add_guardrail', 'improve_clarity')),
  trigger_type TEXT CHECK (trigger_type IN ('low_score', 'escalation', 'customer_complaint', 'pattern_detected', 'manual', 'scheduled')),
  description TEXT NOT NULL, original_content TEXT, new_content TEXT NOT NULL,
  expected_impact TEXT, actual_impact TEXT, improvement_score NUMERIC(3,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied', 'reverted', 'rejected')),
  approved_by UUID REFERENCES auth.users(id), applied_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adjustments_agent ON ai_prompt_adjustments(agent_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_status ON ai_prompt_adjustments(status);
ALTER TABLE public.ai_prompt_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_prompt_adjustments" ON public.ai_prompt_adjustments;
CREATE POLICY "Service role full access ai_prompt_adjustments" ON public.ai_prompt_adjustments FOR ALL USING (true) WITH CHECK (true);

-- Routing Features
CREATE TABLE IF NOT EXISTS public.ai_routing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  customer_lifetime_value NUMERIC(12,2) DEFAULT 0, total_tickets INTEGER DEFAULT 0,
  avg_resolution_time_hours NUMERIC(8,2) DEFAULT 0, satisfaction_score NUMERIC(3,2),
  churn_risk_score NUMERIC(3,2) DEFAULT 0.5,
  hour_of_day INTEGER, day_of_week INTEGER, is_business_hours BOOLEAN DEFAULT true,
  message_count_today INTEGER DEFAULT 0,
  intent_category TEXT, intent_complexity INTEGER DEFAULT 1,
  requires_human BOOLEAN DEFAULT false, sentiment_score NUMERIC(3,2) DEFAULT 0.5,
  previous_unresolved BOOLEAN DEFAULT false, ticket_age_hours NUMERIC(8,2) DEFAULT 0,
  priority_level INTEGER DEFAULT 1,
  routed_to_agent_id UUID REFERENCES human_agents(id) ON DELETE SET NULL,
  routed_to_type TEXT CHECK (routed_to_type IN ('ai', 'human', 'specialist', 'queue')),
  resolution_time_hours NUMERIC(8,2), customer_satisfied BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(), used_for_training BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_features_client ON ai_routing_features(client_id);
ALTER TABLE public.ai_routing_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_routing_features" ON public.ai_routing_features;
CREATE POLICY "Service role full access ai_routing_features" ON public.ai_routing_features FOR ALL USING (true) WITH CHECK (true);

-- Routing Rules
CREATE TABLE IF NOT EXISTS public.ai_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100), is_active BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('route_to_human', 'route_to_ai', 'route_to_specialist', 'route_to_queue', 'prioritize', 'escalate', 'add_tag', 'set_priority')),
  action_params JSONB DEFAULT '{}',
  match_count INTEGER DEFAULT 0, success_rate NUMERIC(5,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON ai_routing_rules(priority DESC) WHERE is_active = true;
ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_routing_rules" ON public.ai_routing_rules;
CREATE POLICY "Service role full access ai_routing_rules" ON public.ai_routing_rules FOR ALL USING (true) WITH CHECK (true);

-- Agent Performance Scores
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
ALTER TABLE public.ai_agent_performance_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_agent_performance_scores" ON public.ai_agent_performance_scores;
CREATE POLICY "Service role full access ai_agent_performance_scores" ON public.ai_agent_performance_scores FOR ALL USING (true) WITH CHECK (true);

-- Routing Feedback
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

-- Health Scores
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
ALTER TABLE public.ai_health_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_health_scores" ON public.ai_health_scores;
CREATE POLICY "Service role full access ai_health_scores" ON public.ai_health_scores FOR ALL USING (true) WITH CHECK (true);

-- Component Health
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
ALTER TABLE public.ai_component_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_component_health" ON public.ai_component_health;
CREATE POLICY "Service role full access ai_component_health" ON public.ai_component_health FOR ALL USING (true) WITH CHECK (true);

-- Predictions
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('ticket_volume', 'churn_risk', 'resolution_time', 'staffing_needs', 'sla_breach', 'customer_sentiment')),
  entity_id UUID, entity_type TEXT,
  predicted_value NUMERIC, predicted_at TIMESTAMPTZ NOT NULL, prediction_horizon INTERVAL NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  actual_value NUMERIC, validated_at TIMESTAMPTZ, prediction_accuracy NUMERIC(5,2),
  model_version TEXT, features_used JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_entity ON ai_predictions(entity_type, entity_id);
ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access ai_predictions" ON public.ai_predictions;
CREATE POLICY "Service role full access ai_predictions" ON public.ai_predictions FOR ALL USING (true) WITH CHECK (true);

SELECT 'All tables created successfully' as status;
