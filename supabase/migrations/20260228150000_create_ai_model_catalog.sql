-- Migration: Create AI Model Catalog + Seed Models + Extend Platform AI Config
-- This migration creates a centralized model catalog as the single source of truth
-- for all available LLM models, their pricing, capabilities, and recommendations.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Create ai_model_catalog table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard'
    CHECK (tier IN ('nano', 'economic', 'standard', 'premium', 'enterprise')),
  description TEXT,
  input_cost_per_1m NUMERIC(10,4) NOT NULL DEFAULT 0.10,
  output_cost_per_1m NUMERIC(10,4) NOT NULL DEFAULT 0.40,
  max_context_window INTEGER DEFAULT 128000,
  max_output_tokens INTEGER DEFAULT 8192,
  input_modalities TEXT[] DEFAULT '{text}',
  output_modalities TEXT[] DEFAULT '{text}',
  capabilities TEXT[] DEFAULT '{}',
  recommended_for TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_model_catalog_tier ON ai_model_catalog(tier);
CREATE INDEX IF NOT EXISTS idx_model_catalog_active ON ai_model_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_model_catalog_provider ON ai_model_catalog(provider);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_model_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_model_catalog_updated_at
  BEFORE UPDATE ON ai_model_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_model_catalog_updated_at();

-- RLS
ALTER TABLE ai_model_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read model catalog"
  ON ai_model_catalog FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage model catalog"
  ON ai_model_catalog FOR ALL
  USING (auth.role() = 'authenticated');


-- ═══════════════════════════════════════════════════════════════════
-- 2. Seed models (NANO → ECONOMIC → STANDARD → PREMIUM → TTS)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO ai_model_catalog (
  model_id, display_name, provider, tier, description,
  input_cost_per_1m, output_cost_per_1m,
  max_context_window, max_output_tokens,
  input_modalities, output_modalities,
  capabilities, recommended_for, sort_order
) VALUES

-- ── NANO TIER ($0.02-0.10) ──
('text-embedding-3-small', 'Text Embedding 3 Small', 'openai', 'nano',
 'Modelo de embeddings para busca semântica RAG. Ultraeconômico.',
 0.02, 0.00, 8191, 0,
 '{text}', '{embedding}',
 '{embedding}',
 '{embedding}', 5),

('google/gemini-2.0-flash-lite-001', 'Gemini 2.0 Flash Lite', 'google', 'nano',
 'Ultrarápido e ultraeconômico. Ideal para classificação, triagem e orquestração.',
 0.075, 0.30, 128000, 4096,
 '{text}', '{text}',
 '{text}',
 '{triage,orchestrator,analyzer}', 10),

-- ── ECONÔMICO TIER ($0.10-0.25) ──
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'google', 'economic',
 'Rápido e econômico com boa qualidade. Ideal para agentes de suporte e financeiro.',
 0.10, 0.40, 128000, 8192,
 '{text,image}', '{text}',
 '{text,vision,function_calling}',
 '{support,financial,sales,triage}', 20),

('openai/gpt-4o-mini', 'GPT-4o Mini', 'openai', 'economic',
 'Modelo compacto da OpenAI, bom raciocínio a custo baixo.',
 0.15, 0.60, 128000, 4096,
 '{text,image}', '{text}',
 '{text,vision,function_calling}',
 '{support,financial}', 25),

('openai/gpt-5-mini', 'GPT-5 Mini', 'openai', 'economic',
 'Modelo mais recente da OpenAI. Excelente raciocínio, 400K contexto, multimodal.',
 0.25, 2.00, 400000, 128000,
 '{text,image,file}', '{text}',
 '{text,vision,function_calling,reasoning}',
 '{support,financial,sales,copilot}', 28),

-- ── PADRÃO TIER ($0.25-1.00) ──
('google/gemini-2.5-flash-preview', 'Gemini 2.5 Flash', 'google', 'standard',
 'Excelente raciocínio a custo moderado. Ideal para copiloto e resumos.',
 0.25, 1.00, 1000000, 8192,
 '{text,image,audio,video}', '{text}',
 '{text,vision,audio,function_calling,reasoning}',
 '{copilot,sales,support,summarizer,transcription}', 30),

('google/gemini-3-flash-preview', 'Gemini 3 Flash', 'google', 'standard',
 'Modelo de última geração Google. Raciocínio near-Pro, 1M contexto, multimodal completo.',
 0.50, 3.00, 1048576, 8192,
 '{text,image,audio,video,file}', '{text}',
 '{text,vision,audio,function_calling,reasoning}',
 '{copilot,support,sales,transcription,summarizer}', 32),

('anthropic/claude-3-5-haiku', 'Claude 3.5 Haiku', 'anthropic', 'standard',
 'Rápido e conciso. Bom para suporte e copiloto.',
 0.80, 4.00, 200000, 4096,
 '{text}', '{text}',
 '{text,function_calling}',
 '{copilot,support}', 35),

-- ── PREMIUM TIER ($1.00-3.00+) ──
('openai/gpt-5', 'GPT-5', 'openai', 'premium',
 'Modelo flagship OpenAI. Raciocínio avançado, menor alucinação, multimodal.',
 1.25, 10.00, 400000, 128000,
 '{text,image,file}', '{text}',
 '{text,vision,function_calling,reasoning}',
 '{copilot,analytics}', 40),

('google/gemini-2.5-pro-preview', 'Gemini 2.5 Pro', 'google', 'premium',
 'Raciocínio avançado Google para tarefas complexas.',
 1.25, 5.00, 1000000, 8192,
 '{text,image,audio,video}', '{text}',
 '{text,vision,audio,function_calling,reasoning}',
 '{copilot,analytics}', 42),

('openai/gpt-4o', 'GPT-4o', 'openai', 'premium',
 'Modelo multimodal completo da OpenAI.',
 2.50, 10.00, 128000, 4096,
 '{text,image,audio}', '{text,audio}',
 '{text,vision,audio,function_calling,reasoning}',
 '{copilot,analytics}', 45),

('anthropic/claude-3-5-sonnet', 'Claude 3.5 Sonnet', 'anthropic', 'premium',
 'Alta qualidade em código e raciocínio complexo.',
 3.00, 15.00, 200000, 8192,
 '{text,image}', '{text}',
 '{text,vision,function_calling,reasoning}',
 '{copilot,analytics}', 50),

-- ── TTS / ÁUDIO ──
('openai/tts-1', 'OpenAI TTS-1', 'openai', 'standard',
 'Text-to-Speech da OpenAI. Gera áudio natural em múltiplos idiomas e vozes.',
 15.00, 0.00, 4096, 0,
 '{text}', '{audio}',
 '{tts}',
 '{tts}', 60),

('openai/tts-1-hd', 'OpenAI TTS-1 HD', 'openai', 'premium',
 'Text-to-Speech HD da OpenAI. Áudio de alta qualidade.',
 30.00, 0.00, 4096, 0,
 '{text}', '{audio}',
 '{tts}',
 '{tts}', 61)

ON CONFLICT (model_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 3. Extend platform_ai_config with system functions + defaults
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO platform_ai_config (feature, model, enabled, extra_config)
VALUES
  ('orchestrator', 'google/gemini-2.0-flash-lite-001', true,
   '{"temperature": 0.1, "max_tokens": 200}'::jsonb),
  ('message_analyzer', 'google/gemini-2.0-flash-lite-001', true,
   '{"temperature": 0.2, "max_tokens": 300}'::jsonb),
  ('embedding', 'text-embedding-3-small', true,
   '{}'::jsonb),
  ('tts', 'openai/tts-1', true,
   '{"voice": "nova", "speed": 1.0, "enabled_for_agents": false}'::jsonb),
  ('default_model_triage', 'google/gemini-2.0-flash-lite-001', true,
   '{"temperature": 0.1, "max_tokens": 300}'::jsonb),
  ('default_model_support', 'google/gemini-2.0-flash-001', true,
   '{"temperature": 0.3, "max_tokens": 1500}'::jsonb),
  ('default_model_financial', 'google/gemini-2.0-flash-001', true,
   '{"temperature": 0.2, "max_tokens": 1000}'::jsonb),
  ('default_model_sales', 'google/gemini-2.0-flash-001', true,
   '{"temperature": 0.4, "max_tokens": 1200}'::jsonb),
  ('default_model_copilot', 'google/gemini-2.5-flash-preview', true,
   '{"temperature": 0.3, "max_tokens": 1500}'::jsonb)
ON CONFLICT (feature) DO NOTHING;
