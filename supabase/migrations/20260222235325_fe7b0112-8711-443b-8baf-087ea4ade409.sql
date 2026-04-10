-- Remove the trigger that conflicts with webhook CSAT handling
-- The trigger capture_csat_from_message sets csat_responded_at immediately on INSERT,
-- preventing the webhook from detecting and processing the CSAT response properly.
DROP TRIGGER IF EXISTS capture_csat_from_message ON public.ai_messages;

-- Keep the function for reference but it won't be called anymore
-- DROP FUNCTION IF EXISTS public.capture_csat_from_message();
