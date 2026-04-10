
-- Function to trigger flows when status or kanban_stage_id changes on ai_conversations
CREATE OR REPLACE FUNCTION public.fn_trigger_flows_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
  _payload jsonb;
BEGIN
  -- Detect status change
  IF OLD.ticket_status_id IS DISTINCT FROM NEW.ticket_status_id THEN
    _payload := jsonb_build_object(
      'trigger_type', 'status_changed',
      'conversation_id', NEW.id,
      'data', jsonb_build_object(
        'from_status', OLD.ticket_status_id,
        'to_status', NEW.ticket_status_id
      )
    );

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/trigger-flows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := _payload
    );
  END IF;

  -- Detect kanban stage change
  IF OLD.kanban_stage_id IS DISTINCT FROM NEW.kanban_stage_id THEN
    _payload := jsonb_build_object(
      'trigger_type', 'stage_changed',
      'conversation_id', NEW.id,
      'data', jsonb_build_object(
        'from_stage_id', OLD.kanban_stage_id,
        'to_stage_id', NEW.kanban_stage_id
      )
    );

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/trigger-flows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := _payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on ai_conversations
DROP TRIGGER IF EXISTS trg_flow_status_stage_change ON public.ai_conversations;
CREATE TRIGGER trg_flow_status_stage_change
  AFTER UPDATE ON public.ai_conversations
  FOR EACH ROW
  WHEN (OLD.ticket_status_id IS DISTINCT FROM NEW.ticket_status_id 
     OR OLD.kanban_stage_id IS DISTINCT FROM NEW.kanban_stage_id)
  EXECUTE FUNCTION public.fn_trigger_flows_on_change();
