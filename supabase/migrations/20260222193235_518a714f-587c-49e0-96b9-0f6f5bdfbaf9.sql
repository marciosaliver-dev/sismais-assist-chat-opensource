
-- Campos de deleção em uazapi_messages
ALTER TABLE uazapi_messages 
  ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_content_preserved JSONB;

-- Campos de edição em uazapi_messages
ALTER TABLE uazapi_messages 
  ADD COLUMN IF NOT EXISTS edited_by_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]';

-- Campos de deleção em ai_messages
ALTER TABLE ai_messages 
  ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Campos de edição em ai_messages
ALTER TABLE ai_messages 
  ADD COLUMN IF NOT EXISTS edited_by_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]';

-- RLS: impedir DELETE físico em uazapi_messages por authenticated users
CREATE POLICY "no_delete_messages" ON uazapi_messages
  FOR DELETE TO authenticated
  USING (false);
