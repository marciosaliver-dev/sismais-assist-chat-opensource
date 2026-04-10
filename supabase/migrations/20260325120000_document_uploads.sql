-- Migration: document uploads + prompt versioning
-- Date: 2026-03-25

-- 1. Add file columns to ai_knowledge_base
ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 2. Create storage bucket for knowledge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-documents', 'knowledge-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for storage bucket
CREATE POLICY "Authenticated users can upload knowledge documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'knowledge-documents');

CREATE POLICY "Authenticated users can read knowledge documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-documents');

CREATE POLICY "Authenticated users can delete knowledge documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'knowledge-documents');

-- 4. Prompt history table
CREATE TABLE IF NOT EXISTS ai_agent_prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_history_agent_created
ON ai_agent_prompt_history (agent_id, created_at);

ALTER TABLE ai_agent_prompt_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage prompt history"
ON ai_agent_prompt_history FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 5. Trigger to auto-save prompt history on system_prompt change
CREATE OR REPLACE FUNCTION save_prompt_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.system_prompt IS DISTINCT FROM NEW.system_prompt THEN
    INSERT INTO ai_agent_prompt_history (agent_id, system_prompt, version)
    SELECT NEW.id, OLD.system_prompt,
           COALESCE((SELECT MAX(version) FROM ai_agent_prompt_history WHERE agent_id = NEW.id), 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_save_prompt_history ON ai_agents;
CREATE TRIGGER trg_save_prompt_history
BEFORE UPDATE ON ai_agents
FOR EACH ROW
EXECUTE FUNCTION save_prompt_history();
