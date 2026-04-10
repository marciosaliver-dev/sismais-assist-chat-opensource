-- Migration: ai_fine_tuning
-- Sistema de aprendizado continuo e geracao de dados para fine-tuning

-- 1. Tabela de feedback para treinamento
CREATE TABLE IF NOT EXISTS public.ai_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  
  -- Contexto
  customer_phone TEXT,
  customer_intent TEXT,
  customer_sentiment TEXT,
  
  -- Interacao
  user_message TEXT NOT NULL,
  agent_response TEXT NOT NULL,
  
  -- Avaliacao
  quality_score NUMERIC(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  was_helpful BOOLEAN,
  was_accurate BOOLEAN,
  escalation_needed BOOLEAN DEFAULT false,
  
  -- Metricas
  response_time_ms INTEGER,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  
  -- Tags para categorizacao
  category TEXT,
  tags TEXT[],
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'used')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Fonte
  source TEXT DEFAULT 'automatic' CHECK (source IN ('automatic', 'manual', 'human_review', 'customer_feedback')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_conversation ON ai_training_examples(conversation_id);
CREATE INDEX IF NOT EXISTS idx_training_agent ON ai_training_examples(agent_id);
CREATE INDEX IF NOT EXISTS idx_training_status ON ai_training_examples(status);
CREATE INDEX IF NOT EXISTS idx_training_category ON ai_training_examples(category);
CREATE INDEX IF NOT EXISTS idx_training_score ON ai_training_examples(quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_created ON ai_training_examples(created_at DESC);

ALTER TABLE public.ai_training_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_training_examples" ON public.ai_training_examples FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_training_examples" ON public.ai_training_examples FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_training_examples IS 'Exemplos de treinamento coletados automaticamente do atendimento.';

-- 2. Tabela de patterns de sucesso/falha
CREATE TABLE IF NOT EXISTS public.ai_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'successful_response',
    'failed_response',
    'escalation_trigger',
    'customer_frustration',
    'resolution_pattern',
    'intent_pattern',
    'sentiment_shift'
  )),
  
  pattern_hash TEXT NOT NULL,
  description TEXT,
  
  -- Contexto
  conditions JSONB NOT NULL,
  response_template TEXT,
  
  -- Metricas
  occurrence_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  success_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN occurrence_count > 0 
    THEN (success_count::NUMERIC / occurrence_count * 100) 
    ELSE 0 
    END
  ) STORED,
  
  -- Relevancia
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  importance_score NUMERIC(3,2) DEFAULT 0.5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patterns_hash ON ai_patterns(pattern_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_patterns_agent ON ai_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON ai_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_success_rate ON ai_patterns(success_rate DESC);

ALTER TABLE public.ai_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_patterns" ON public.ai_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_patterns" ON public.ai_patterns FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_patterns IS 'Padroes identificados de sucesso e falha nas interacoes.';

-- 3. Tabela de fine-tuning jobs
CREATE TABLE IF NOT EXISTS public.ai_fine_tuning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  job_type TEXT DEFAULT 'openai' CHECK (job_type IN ('openai', 'anthropic', 'custom')),
  
  -- Config
  base_model TEXT,
  training_params JSONB DEFAULT '{}',
  
  -- Dados
  dataset_size INTEGER,
  examples_used INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'preparing', 'training', 'validating', 
    'completed', 'failed', 'deployed', 'cancelled'
  )),
  
  -- Resultados
  metrics JSONB,
  trained_model_id TEXT,
  deployment_url TEXT,
  
  -- Custos
  estimated_cost_usd NUMERIC(10,2),
  actual_cost_usd NUMERIC(10,2),
  
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finetuning_status ON ai_fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_finetuning_created ON ai_fine_tuning_jobs(created_at DESC);

ALTER TABLE public.ai_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_fine_tuning_jobs" ON public.ai_fine_tuning_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_fine_tuning_jobs" ON public.ai_fine_tuning_jobs FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_fine_tuning_jobs IS 'Jobs de fine-tuning para melhorar modelos de IA.';

-- 4. Tabela de ajustes automaticos de prompt
CREATE TABLE IF NOT EXISTS public.ai_prompt_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'add_rule',
    'remove_rule',
    'modify_prompt',
    'add_example',
    'update_guardrail',
    'add_guardrail',
    'improve_clarity'
  )),
  
  trigger_type TEXT CHECK (trigger_type IN (
    'low_score', 'escalation', 'customer_complaint', 
    'pattern_detected', 'manual', 'scheduled'
  )),
  
  description TEXT NOT NULL,
  original_content TEXT,
  new_content TEXT NOT NULL,
  
  -- Avaliacao
  expected_impact TEXT,
  actual_impact TEXT,
  improvement_score NUMERIC(3,2),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'applied', 'reverted', 'rejected'
  )),
  
  approved_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_agent ON ai_prompt_adjustments(agent_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_status ON ai_prompt_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_adjustments_type ON ai_prompt_adjustments(adjustment_type);

ALTER TABLE public.ai_prompt_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_prompt_adjustments" ON public.ai_prompt_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_prompt_adjustments" ON public.ai_prompt_adjustments FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_prompt_adjustments IS 'Ajustes automaticos de prompt baseados em feedback.';

-- 5. Funcao para coletar exemplo de treinamento
CREATE OR REPLACE FUNCTION public.collect_training_example(
  p_conversation_id UUID,
  p_agent_id UUID,
  p_user_message TEXT,
  p_agent_response TEXT,
  p_quality_score NUMERIC DEFAULT NULL,
  p_was_helpful BOOLEAN DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_cost_usd NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_example_id UUID;
  v_conversation RECORD;
  v_intent TEXT;
  v_sentiment TEXT;
BEGIN
  -- Pegar contexto da conversa
  SELECT customer_intent, customer_sentiment, customer_phone
  INTO v_conversation
  FROM ai_conversations
  WHERE id = p_conversation_id;
  
  -- Inserir exemplo
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
  
  -- Se score baixo, criar alerta para revisao
  IF p_quality_score IS NOT NULL AND p_quality_score < 0.5 THEN
    INSERT INTO ai_prompt_adjustments (
      agent_id, trigger_type, description, new_content, status
    ) VALUES (
      p_agent_id, 'low_score',
      'Score baixo detectado: ' || p_quality_score::TEXT,
      p_agent_response,
      'pending'
    );
  END IF;
  
  RETURN v_example_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_training_example TO service_role, authenticated;

-- 6. Funcao para detectar e registrar patterns
CREATE OR REPLACE FUNCTION public.register_interaction_pattern(
  p_agent_id UUID,
  p_pattern_type TEXT,
  p_conditions JSONB,
  p_response TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pattern_hash TEXT;
  v_pattern_id UUID;
BEGIN
  -- Gerar hash unico para o pattern
  v_pattern_hash := encode(
    sha256(
      (p_pattern_type || p_conditions::TEXT)::BYTEA
    ),
    'hex'
  );
  
  -- Verificar se ja existe
  SELECT id INTO v_pattern_id
  FROM ai_patterns
  WHERE pattern_hash = v_pattern_hash AND agent_id = p_agent_id;
  
  IF v_pattern_id IS NOT NULL THEN
    -- Atualizar contadores
    UPDATE ai_patterns
    SET 
      occurrence_count = occurrence_count + 1,
      success_count = success_count + CASE WHEN p_success = true THEN 1 ELSE 0 END,
      failure_count = failure_count + CASE WHEN p_success = false THEN 1 ELSE 0 END,
      confidence_score = LEAST(1, confidence_score + 0.01),
      updated_at = NOW()
    WHERE id = v_pattern_id;
  ELSE
    -- Criar novo pattern
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

-- 7. Funcao para gerar dataset de fine-tuning
CREATE OR REPLACE FUNCTION public.generate_fine_tuning_dataset(
  p_agent_id UUID DEFAULT NULL,
  p_min_quality_score NUMERIC DEFAULT 0.7,
  p_max_examples INTEGER DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dataset JSONB := '[]'::JSONB;
  v_record RECORD;
BEGIN
  FOR v_record IN 
    SELECT 
      user_message,
      agent_response,
      category,
      customer_intent
    FROM ai_training_examples
    WHERE status = 'approved'
      AND (p_agent_id IS NULL OR agent_id = p_agent_id)
      AND (quality_score IS NULL OR quality_score >= p_min_quality_score)
    ORDER BY quality_score DESC NULLS LAST, created_at DESC
    LIMIT p_max_examples
  LOOP
    v_dataset := v_dataset || jsonb_build_object(
      'messages', jsonb_build_array(
        jsonb_build_object('role', 'user', 'content', v_record.user_message),
        jsonb_build_object('role', 'assistant', 'content', v_record.agent_response)
      ),
      'category', v_record.category,
      'intent', v_record.customer_intent
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'dataset', v_dataset,
    'count', jsonb_array_length(v_dataset),
    'generated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_fine_tuning_dataset TO service_role, authenticated;

-- 8. Funcao para analisar performance e sugerir ajustes
CREATE OR REPLACE FUNCTION public.analyze_agent_performance_for_adjustments(
  p_agent_id UUID,
  p_time_range INTERVAL DEFAULT '7 days'::INTERVAL
)
RETURNS TABLE (
  adjustment_type TEXT,
  description TEXT,
  priority NUMERIC,
  expected_impact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_low_score_count INTEGER;
  v_escalation_count INTEGER;
  v_common_category TEXT;
  v_avg_score NUMERIC;
BEGIN
  -- Contar problemas
  SELECT 
    COUNT(*) FILTER (WHERE quality_score < 0.5),
    COUNT(*) FILTER (WHERE escalation_needed = true),
    AVG(quality_score)
  INTO v_low_score_count, v_escalation_count, v_avg_score
  FROM ai_training_examples
  WHERE agent_id = p_agent_id
    AND created_at >= NOW() - p_time_range;
  
  -- Encontrar categoria mais problematica
  SELECT category INTO v_common_category
  FROM ai_training_examples
  WHERE agent_id = p_agent_id
    AND created_at >= NOW() - p_time_range
    AND quality_score < 0.6
  GROUP BY category
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Gerar sugestoes baseadas nos problemas
  IF v_low_score_count > 10 THEN
    RETURN QUERY VALUES (
      'improve_clarity',
      'Score baixo detectado em ' || v_low_score_count || ' interacoes recentes. Considerar adicionar exemplos de boas respostas.',
      0.9,
      'Reduzir respostas com score baixo em ate 30%'
    );
  END IF;
  
  IF v_escalation_count > 5 THEN
    RETURN QUERY VALUES (
      'add_rule',
      'Alto volume de escalacoes (' || v_escalation_count || '). Analisar triggers de escalacao e adicionar ao prompt.',
      0.85,
      'Reduzir escalacoes desnecessarias'
    );
  END IF;
  
  IF v_avg_score < 0.7 THEN
    RETURN QUERY VALUES (
      'add_example',
      'Score medio abaixo de 0.7. Adicionar exemplos de treinamento de alta qualidade.',
      0.8,
      'Melhorar qualidade geral das respostas'
    );
  END IF;
  
  IF v_common_category IS NOT NULL THEN
    RETURN QUERY VALUES (
      'modify_prompt',
      'Categoria ' || v_common_category || ' apresenta problemas recorrentes.',
      0.75,
      'Melhorar tratamento da categoria'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_agent_performance_for_adjustments TO service_role, authenticated;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260403_ai_fine_tuning', 'AI Fine-tuning system - continuous learning from interactions', NOW())
ON CONFLICT DO NOTHING;
