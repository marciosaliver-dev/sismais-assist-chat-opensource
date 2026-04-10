-- Meta WhatsApp 24h Window + Related Conversations
-- Adds fields for tracking the 24h messaging window (Meta policy)
-- and cross-channel conversation linking (UAZAPI fallback)

-- 1. Campo para tracking da janela de 24h
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;

-- 2. Campo para conversas relacionadas (fallback UAZAPI ↔ Meta)
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS related_conversation_id UUID REFERENCES ai_conversations(id);

-- 3. Índice para busca de conversas por número + canal
CREATE INDEX IF NOT EXISTS idx_conversations_channel_chat
ON ai_conversations(channel_chat_id, communication_channel);

-- 4. Índice parcial para janela de 24h (apenas conversas Meta)
CREATE INDEX IF NOT EXISTS idx_conversations_last_customer_msg
ON ai_conversations(last_customer_message_at)
WHERE communication_channel = 'meta_whatsapp';

-- 5. Backfill: setar last_customer_message_at para conversas Meta existentes
UPDATE ai_conversations ac
SET last_customer_message_at = (
  SELECT MAX(created_at)
  FROM ai_messages am
  WHERE am.conversation_id = ac.id
    AND am.role = 'user'
)
WHERE ac.communication_channel = 'meta_whatsapp'
  AND ac.last_customer_message_at IS NULL;
