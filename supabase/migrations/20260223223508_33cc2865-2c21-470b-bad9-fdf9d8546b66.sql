
-- Adicionar colunas auxiliares para novos eventos UAZAPI
ALTER TABLE public.uazapi_chats
  ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_typing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_online timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_labels text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS group_subject text,
  ADD COLUMN IF NOT EXISTS group_description text;
