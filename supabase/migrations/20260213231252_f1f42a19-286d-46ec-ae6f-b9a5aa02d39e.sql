
-- Add bridge columns to ai_conversations
ALTER TABLE public.ai_conversations 
ADD COLUMN IF NOT EXISTS uazapi_chat_id TEXT,
ADD COLUMN IF NOT EXISTS communication_channel TEXT DEFAULT 'whatsapp';

CREATE INDEX IF NOT EXISTS idx_conversations_uazapi ON public.ai_conversations(uazapi_chat_id);

-- Add bridge columns to ai_messages
ALTER TABLE public.ai_messages
ADD COLUMN IF NOT EXISTS uazapi_message_id TEXT,
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Public read whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');
