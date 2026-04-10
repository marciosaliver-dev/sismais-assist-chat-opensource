-- Add ai_conversations and ai_messages to the Supabase Realtime publication
-- so that postgres_changes events are actually emitted for these tables.
-- Without this, all realtime subscriptions on these tables in the frontend
-- (kanban-realtime, kanban-new-messages, kanban-escalation, inbox, etc.)
-- were silently inert — the system only worked due to polling fallback.

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
