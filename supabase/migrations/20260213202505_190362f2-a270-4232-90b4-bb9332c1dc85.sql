
-- Extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Agentes de IA
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  specialty TEXT NOT NULL,
  avatar_url TEXT,
  color TEXT DEFAULT '#45E5E5',
  provider TEXT DEFAULT 'openrouter',
  model TEXT NOT NULL DEFAULT 'google/gemini-flash-1.5',
  temperature DECIMAL DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 1000,
  system_prompt TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  language TEXT DEFAULT 'pt-BR',
  tools JSONB DEFAULT '[]',
  rag_enabled BOOLEAN DEFAULT true,
  rag_top_k INTEGER DEFAULT 5,
  rag_similarity_threshold DECIMAL DEFAULT 0.75,
  knowledge_base_filter JSONB,
  learning_enabled BOOLEAN DEFAULT true,
  confidence_threshold DECIMAL DEFAULT 0.70,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  success_rate DECIMAL DEFAULT 0,
  avg_confidence DECIMAL DEFAULT 0,
  avg_csat DECIMAL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Regras de Roteamento
CREATE TABLE ai_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  keywords TEXT[],
  keywords_operator TEXT DEFAULT 'OR',
  intent_patterns TEXT[],
  sentiment_filter TEXT[],
  customer_plan_filter TEXT[],
  customer_status_filter TEXT[],
  business_hours_only BOOLEAN DEFAULT false,
  min_confidence DECIMAL DEFAULT 0.70,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Conversas
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  current_agent_id UUID REFERENCES ai_agents(id),
  handler_type TEXT DEFAULT 'ai',
  agent_history JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  ai_messages_count INTEGER DEFAULT 0,
  human_messages_count INTEGER DEFAULT 0,
  agent_switches_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_time_seconds INTEGER,
  resolved_by TEXT,
  resolution_summary TEXT,
  csat_rating INTEGER,
  csat_feedback TEXT,
  rated_at TIMESTAMPTZ
);

-- Validation trigger for csat_rating
CREATE OR REPLACE FUNCTION validate_csat_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.csat_rating IS NOT NULL AND (NEW.csat_rating < 1 OR NEW.csat_rating > 5) THEN
    RAISE EXCEPTION 'csat_rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_csat
BEFORE INSERT OR UPDATE ON ai_conversations
FOR EACH ROW EXECUTE FUNCTION validate_csat_rating();

-- 4. Mensagens
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_id UUID REFERENCES ai_agents(id),
  user_id UUID REFERENCES auth.users(id),
  intent TEXT,
  intent_confidence DECIMAL,
  sentiment TEXT,
  sentiment_score DECIMAL,
  urgency TEXT,
  model_used TEXT,
  confidence DECIMAL,
  tools_used TEXT[],
  rag_sources JSONB,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL,
  was_helpful BOOLEAN,
  human_override TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Base de Conhecimento (RAG)
CREATE TABLE ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  original_url TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  transcript TEXT,
  ocr_text TEXT,
  source TEXT,
  tags TEXT[],
  related_products TEXT[],
  embedding VECTOR(1536),
  chunk_index INTEGER DEFAULT 0,
  parent_doc_id UUID REFERENCES ai_knowledge_base(id),
  access_level TEXT DEFAULT 'all',
  agent_filter UUID[],
  last_crawled_at TIMESTAMPTZ,
  crawl_frequency TEXT,
  usage_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Aprendizado
CREATE TABLE ai_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES ai_messages(id),
  agent_id UUID REFERENCES ai_agents(id),
  conversation_id UUID REFERENCES ai_conversations(id),
  feedback_type TEXT NOT NULL,
  feedback_source TEXT NOT NULL,
  original_response TEXT,
  corrected_response TEXT,
  user_message TEXT,
  rag_sources_used JSONB,
  learning_action TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Ferramentas
CREATE TABLE ai_agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  description TEXT NOT NULL,
  function_type TEXT NOT NULL,
  endpoint TEXT,
  method TEXT DEFAULT 'POST',
  parameters_schema JSONB NOT NULL,
  requires_auth BOOLEAN DEFAULT true,
  auth_type TEXT,
  timeout_ms INTEGER DEFAULT 5000,
  retry_on_failure BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 2,
  examples JSONB,
  is_active BOOLEAN DEFAULT true,
  allowed_agents UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES ai_agent_tools(id),
  agent_id UUID REFERENCES ai_agents(id),
  conversation_id UUID REFERENCES ai_conversations(id),
  message_id UUID REFERENCES ai_messages(id),
  input_params JSONB,
  output_result JSONB,
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. WhatsApp Business API
CREATE TABLE whatsapp_business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id TEXT NOT NULL UNIQUE,
  phone_number_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT,
  status TEXT DEFAULT 'active',
  quality_rating TEXT,
  messaging_limit_tier TEXT,
  current_limit INTEGER,
  webhook_url TEXT,
  webhook_events TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id UUID REFERENCES whatsapp_business_accounts(id),
  message_id TEXT UNIQUE,
  conversation_id TEXT,
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  direction TEXT NOT NULL,
  type TEXT,
  text_body TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  interactive_type TEXT,
  interactive_payload JSONB,
  status TEXT,
  status_timestamp TIMESTAMPTZ,
  conversation_category TEXT,
  conversation_origin TEXT,
  is_billable BOOLEAN,
  internal_conversation_id UUID REFERENCES ai_conversations(id),
  internal_message_id UUID REFERENCES ai_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Automações
CREATE TABLE ai_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  schedule_cron TEXT,
  schedule_timezone TEXT DEFAULT 'America/Sao_Paulo',
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_agents_specialty ON ai_agents(specialty);
CREATE INDEX idx_agents_active ON ai_agents(is_active) WHERE is_active = true;
CREATE INDEX idx_routing_agent ON ai_routing_rules(agent_id);
CREATE INDEX idx_routing_priority ON ai_routing_rules(priority DESC);
CREATE INDEX idx_conversations_phone ON ai_conversations(customer_phone);
CREATE INDEX idx_conversations_status ON ai_conversations(status);
CREATE INDEX idx_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX idx_messages_created ON ai_messages(created_at DESC);
CREATE INDEX idx_knowledge_category ON ai_knowledge_base(category);
CREATE INDEX idx_knowledge_type ON ai_knowledge_base(content_type);
CREATE INDEX idx_knowledge_active ON ai_knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX idx_learning_agent ON ai_learning_feedback(agent_id);
CREATE INDEX idx_learning_created ON ai_learning_feedback(created_at DESC);
CREATE INDEX idx_tool_exec_tool ON ai_tool_executions(tool_id);
CREATE INDEX idx_tool_exec_agent ON ai_tool_executions(agent_id);
CREATE INDEX idx_wa_messages_phone ON whatsapp_messages(from_phone);
CREATE INDEX idx_wa_messages_internal ON whatsapp_messages(internal_conversation_id);

-- RLS POLICIES
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automations ENABLE ROW LEVEL SECURITY;

-- Service role access for edge functions (anon can't access, only service_role and authenticated)
CREATE POLICY "Authenticated read agents" ON ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage agents" ON ai_agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update agents" ON ai_agents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete agents" ON ai_agents FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated access" ON ai_routing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_knowledge_base FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_learning_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_agent_tools FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_tool_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON whatsapp_business_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access" ON ai_automations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role policies for edge functions
CREATE POLICY "Service role full access" ON ai_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_knowledge_base FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Função de busca vetorial
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  content_type TEXT,
  original_url TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.content_type,
    kb.original_url,
    (1 - (kb.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ai_knowledge_base kb
  WHERE 
    kb.is_active = true
    AND (filter_category IS NULL OR kb.category = filter_category)
    AND (filter_tags IS NULL OR kb.tags && filter_tags)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_knowledge_base_updated_at BEFORE UPDATE ON ai_knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_business_accounts_updated_at BEFORE UPDATE ON whatsapp_business_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SEED: 3 agentes iniciais
INSERT INTO ai_agents (name, description, specialty, color, system_prompt, confidence_threshold, priority) VALUES
('Agente de Triagem', 'Primeiro contato com cliente, coleta informações e direciona', 'triage', '#45E5E5', 'Você é o Agente de Triagem da Sismais. Sua função é dar boas-vindas, entender a necessidade do cliente e direcioná-lo para o agente especializado correto. Seja breve, amigável e objetivo.', 0.80, 100),
('Agente Financeiro', 'Especialista em questões de pagamento e cobranças', 'financial', '#FFB800', 'Você é o Agente Financeiro da Sismais. Ajuda clientes com débitos, boletos, negociações. SEMPRE consulte o débito antes de responder. Ofereça segunda via automaticamente. Seja empático mas objetivo.', 0.75, 90),
('Agente de Suporte Técnico', 'Resolve problemas técnicos do sistema', 'support', '#10293F', 'Você é o Agente de Suporte Técnico da Sismais. Resolve problemas do sistema Mais Simples. Use a base de conhecimento para dar instruções passo a passo. Se problema for complexo, transfira para humano.', 0.70, 80);
