
-- Tabela ai_model_catalog
CREATE TABLE public.ai_model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  description TEXT,
  input_cost_per_1m NUMERIC DEFAULT 0,
  output_cost_per_1m NUMERIC DEFAULT 0,
  max_context_window INTEGER DEFAULT 128000,
  max_output_tokens INTEGER DEFAULT 4096,
  input_modalities TEXT[] DEFAULT '{text}',
  output_modalities TEXT[] DEFAULT '{text}',
  capabilities TEXT[] DEFAULT '{text}',
  recommended_for TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_ai_model_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_model_catalog_updated_at
  BEFORE UPDATE ON public.ai_model_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_model_catalog_updated_at();

-- RLS
ALTER TABLE public.ai_model_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ai_model_catalog"
  ON public.ai_model_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin write ai_model_catalog"
  ON public.ai_model_catalog FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed com modelos populares
INSERT INTO public.ai_model_catalog (model_id, display_name, provider, tier, description, input_cost_per_1m, output_cost_per_1m, max_context_window, max_output_tokens, capabilities, recommended_for, is_active, sort_order) VALUES
  ('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'google', 'economic', 'Fast and efficient model from Google', 0.10, 0.40, 1000000, 8192, '{text,vision,function_calling}', '{support,triage}', true, 1),
  ('google/gemini-2.5-flash-preview', 'Gemini 2.5 Flash', 'google', 'standard', 'Latest Gemini Flash with reasoning', 0.15, 0.60, 1000000, 8192, '{text,vision,function_calling,reasoning}', '{support,triage,copilot}', true, 2),
  ('openai/gpt-4o-mini', 'GPT-4o Mini', 'openai', 'economic', 'Compact and affordable GPT-4o variant', 0.15, 0.60, 128000, 4096, '{text,vision,function_calling}', '{support,sdr}', true, 3),
  ('openai/gpt-4o', 'GPT-4o', 'openai', 'standard', 'OpenAI flagship multimodal model', 2.50, 10.00, 128000, 4096, '{text,vision,function_calling}', '{copilot,analytics}', true, 4),
  ('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'anthropic', 'standard', 'Balanced performance from Anthropic', 3.00, 15.00, 200000, 8192, '{text,vision,function_calling}', '{copilot,support}', true, 5),
  ('meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 'meta-llama', 'economic', 'Open-source large model from Meta', 0.40, 0.40, 131072, 4096, '{text,function_calling}', '{support}', true, 6);
