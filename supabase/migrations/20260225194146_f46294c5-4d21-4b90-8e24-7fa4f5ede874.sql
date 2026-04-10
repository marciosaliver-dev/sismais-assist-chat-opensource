-- Primeiro remover duplicatas existentes, mantendo apenas a mais antiga
DELETE FROM ai_messages a
USING ai_messages b
WHERE a.uazapi_message_id IS NOT NULL
  AND a.uazapi_message_id = b.uazapi_message_id
  AND a.created_at > b.created_at;

-- Agora criar o índice único para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_messages_uazapi_unique 
  ON ai_messages(uazapi_message_id) 
  WHERE uazapi_message_id IS NOT NULL;