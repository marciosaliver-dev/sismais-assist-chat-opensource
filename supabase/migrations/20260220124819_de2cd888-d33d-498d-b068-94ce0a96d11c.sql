
-- 1. Add summary_history to ai_conversations
ALTER TABLE ai_conversations 
ADD COLUMN IF NOT EXISTS summary_history JSONB DEFAULT '[]'::jsonb;

-- 2. New platform_ai_config table
CREATE TABLE IF NOT EXISTS platform_ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  extra_config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE platform_ai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access platform_ai_config" ON platform_ai_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Insert defaults
INSERT INTO platform_ai_config (feature, model, enabled, extra_config) VALUES
  ('summarization', 'google/gemini-2.5-flash', true, '{"max_tokens": 300}'::jsonb),
  ('audio_transcription', 'google/gemini-2.5-flash', true, '{"language": "pt"}'::jsonb),
  ('image_transcription', 'google/gemini-2.5-flash', true, '{}'::jsonb),
  ('copilot', 'google/gemini-2.5-flash', true, '{"max_suggestions": 3}'::jsonb),
  ('agent_executor', 'openai/gpt-5-mini', true, '{}'::jsonb)
ON CONFLICT (feature) DO NOTHING;
