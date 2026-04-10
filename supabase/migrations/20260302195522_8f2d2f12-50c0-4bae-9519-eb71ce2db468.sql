
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS whatsapp_instance_id uuid;
CREATE INDEX IF NOT EXISTS idx_ai_messages_whatsapp_instance ON public.ai_messages(whatsapp_instance_id);

-- Backfill existing messages from conversation's instance
UPDATE public.ai_messages m
SET whatsapp_instance_id = c.whatsapp_instance_id
FROM public.ai_conversations c
WHERE m.conversation_id = c.id
  AND c.whatsapp_instance_id IS NOT NULL
  AND m.whatsapp_instance_id IS NULL;
