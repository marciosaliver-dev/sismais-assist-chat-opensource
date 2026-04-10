ALTER TABLE ai_conversations 
ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
ADD COLUMN IF NOT EXISTS summary_last_message_id UUID;