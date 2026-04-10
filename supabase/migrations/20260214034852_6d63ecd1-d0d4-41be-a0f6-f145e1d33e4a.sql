
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_conversations_tags ON ai_conversations USING GIN(tags);
