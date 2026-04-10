
-- ==========================================
-- Flow Builder: 5 new tables
-- ==========================================

-- 1. flow_automations
CREATE TABLE public.flow_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '{}'::jsonb,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  whatsapp_instances UUID[] DEFAULT ARRAY[]::UUID[],
  is_active BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  avg_execution_time_ms INTEGER,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.flow_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access flow_automations" ON public.flow_automations
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_flow_automations_active ON public.flow_automations(is_active);
CREATE INDEX idx_flow_automations_trigger ON public.flow_automations(trigger_type);
CREATE INDEX idx_flow_automations_instances ON public.flow_automations USING GIN(whatsapp_instances);

CREATE TRIGGER update_flow_automations_updated_at
  BEFORE UPDATE ON public.flow_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. flow_versions
CREATE TABLE public.flow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.flow_automations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  variables JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(flow_id, version)
);

ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access flow_versions" ON public.flow_versions
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_flow_versions_flow ON public.flow_versions(flow_id, version DESC);

-- 3. flow_executions
CREATE TABLE public.flow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.flow_automations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id),
  trigger_data JSONB,
  executed_nodes JSONB DEFAULT '[]'::jsonb,
  current_node_id TEXT,
  status TEXT DEFAULT 'running',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  variables JSONB DEFAULT '{}'::jsonb,
  user_id UUID
);

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access flow_executions" ON public.flow_executions
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_flow_executions_flow ON public.flow_executions(flow_id);
CREATE INDEX idx_flow_executions_status ON public.flow_executions(status);
CREATE INDEX idx_flow_executions_conversation ON public.flow_executions(conversation_id);

-- 4. human_agents
CREATE TABLE public.human_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available',
  max_concurrent_conversations INTEGER DEFAULT 5,
  current_conversations_count INTEGER DEFAULT 0,
  specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  languages TEXT[] DEFAULT ARRAY['pt-BR']::TEXT[],
  whatsapp_instances UUID[] DEFAULT ARRAY[]::UUID[],
  total_conversations INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER,
  avg_resolution_time_seconds INTEGER,
  csat_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.human_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access human_agents" ON public.human_agents
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_human_agents_user ON public.human_agents(user_id);
CREATE INDEX idx_human_agents_online ON public.human_agents(is_online, is_active);
CREATE INDEX idx_human_agents_instances ON public.human_agents USING GIN(whatsapp_instances);

CREATE TRIGGER update_human_agents_updated_at
  BEFORE UPDATE ON public.human_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. agent_assignments
CREATE TABLE public.agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  ai_agent_id UUID REFERENCES public.ai_agents(id),
  human_agent_id UUID REFERENCES public.human_agents(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  unassigned_at TIMESTAMPTZ,
  reason TEXT,
  UNIQUE(conversation_id, assigned_at)
);

ALTER TABLE public.agent_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access agent_assignments" ON public.agent_assignments
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_agent_assignments_conversation ON public.agent_assignments(conversation_id);
CREATE INDEX idx_agent_assignments_human ON public.agent_assignments(human_agent_id) WHERE agent_type = 'human';
