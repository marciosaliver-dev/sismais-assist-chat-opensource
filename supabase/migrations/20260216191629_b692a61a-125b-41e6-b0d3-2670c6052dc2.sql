
-- Add sequential ticket number to conversations
ALTER TABLE public.ai_conversations ADD COLUMN ticket_number SERIAL;

-- Create unique index for ticket_number
CREATE UNIQUE INDEX idx_ai_conversations_ticket_number ON public.ai_conversations(ticket_number);
