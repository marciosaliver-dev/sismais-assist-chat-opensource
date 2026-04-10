
-- Novas colunas para enriquecimento de contato
ALTER TABLE uazapi_chats ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
ALTER TABLE uazapi_chats ADD COLUMN IF NOT EXISTS enrichment_status jsonb DEFAULT '{}';
ALTER TABLE uazapi_chats ADD COLUMN IF NOT EXISTS whatsapp_status text;
ALTER TABLE uazapi_chats ADD COLUMN IF NOT EXISTS push_name text;
ALTER TABLE uazapi_chats ADD COLUMN IF NOT EXISTS history_imported_at timestamptz;

-- Campo para marcar mensagens importadas via histórico
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS imported_from_history boolean DEFAULT false;
