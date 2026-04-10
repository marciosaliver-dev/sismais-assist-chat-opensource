
CREATE OR REPLACE FUNCTION public.fn_trigger_flows_on_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://pomueweeulenslxvsxar.supabase.co'
  );
  _service_key text := current_setting('app.settings.service_role_key', true);
  _payload jsonb;
BEGIN
  -- Skip if service key is not available
  IF _service_key IS NULL THEN
    RETURN NEW;
  END IF;

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
$function$;
