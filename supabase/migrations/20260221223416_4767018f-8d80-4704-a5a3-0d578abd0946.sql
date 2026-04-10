
-- Function to auto-set queue_entered_at when status changes to a queue-type status
CREATE OR REPLACE FUNCTION public.set_queue_entered_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status_type TEXT;
BEGIN
  -- Look up the status_type for the new status slug
  SELECT status_type INTO v_status_type
  FROM ticket_statuses
  WHERE slug = NEW.status
  LIMIT 1;

  IF v_status_type = 'queue' THEN
    -- Entering queue: set timestamp if not already set
    IF NEW.queue_entered_at IS NULL THEN
      NEW.queue_entered_at := now();
    END IF;
  ELSE
    -- Leaving queue: clear the timestamp for future re-entries
    NEW.queue_entered_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on status changes
CREATE TRIGGER trg_set_queue_entered_at
  BEFORE UPDATE OF status ON ai_conversations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION set_queue_entered_at();

-- Also trigger on INSERT to handle new conversations entering queue directly
CREATE TRIGGER trg_set_queue_entered_at_insert
  BEFORE INSERT ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_queue_entered_at();
