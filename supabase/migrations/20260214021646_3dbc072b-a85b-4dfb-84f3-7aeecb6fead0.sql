
-- Add priority column to ai_conversations for queue ordering
ALTER TABLE public.ai_conversations
ADD COLUMN priority text DEFAULT 'medium',
ADD COLUMN priority_score integer DEFAULT 50,
ADD COLUMN ai_suggested_priority text DEFAULT NULL,
ADD COLUMN priority_reason text DEFAULT NULL;

-- Create index for efficient priority + arrival ordering
CREATE INDEX idx_ai_conversations_priority_queue 
ON public.ai_conversations (status, priority_score DESC, started_at ASC);
