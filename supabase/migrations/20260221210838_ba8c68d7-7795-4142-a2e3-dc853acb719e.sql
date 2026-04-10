
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS reaction_to_message_id text;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS reaction_emoji text;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS quoted_message_id text;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS quoted_content text;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS quoted_sender_name text;
