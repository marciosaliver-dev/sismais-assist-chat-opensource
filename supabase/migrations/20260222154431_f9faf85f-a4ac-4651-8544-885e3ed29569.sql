
-- 1. Create outgoing_webhooks table
CREATE TABLE public.outgoing_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  headers jsonb NOT NULL DEFAULT '{}',
  event_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  body_template text,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outgoing_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access outgoing_webhooks"
  ON public.outgoing_webhooks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Create outgoing_webhook_queue table
CREATE TABLE public.outgoing_webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.outgoing_webhooks(id) ON DELETE CASCADE,
  conversation_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}',
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outgoing_webhook_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access outgoing_webhook_queue"
  ON public.outgoing_webhook_queue FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role access for triggers
CREATE POLICY "Service role access outgoing_webhook_queue"
  ON public.outgoing_webhook_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role access outgoing_webhooks"
  ON public.outgoing_webhooks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Add outgoing_webhook_id to webhook_logs
ALTER TABLE public.webhook_logs
  ADD COLUMN outgoing_webhook_id uuid REFERENCES public.outgoing_webhooks(id) ON DELETE SET NULL;

-- 4. Create trigger function
CREATE OR REPLACE FUNCTION public.fn_dispatch_outgoing_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  detected_events text[];
  evt text;
  wh record;
  queue_id uuid;
BEGIN
  detected_events := ARRAY[]::text[];

  -- Detect events
  IF TG_OP = 'INSERT' THEN
    detected_events := array_append(detected_events, 'conversation_created');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Status changes
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      IF NEW.status = 'aguardando' THEN
        detected_events := array_append(detected_events, 'status_aguardando');
      ELSIF NEW.status = 'em_atendimento' THEN
        detected_events := array_append(detected_events, 'status_em_atendimento');
      ELSIF NEW.status = 'finalizado' THEN
        detected_events := array_append(detected_events, 'status_finalizado');
      END IF;
    END IF;

    -- Human started
    IF OLD.human_started_at IS NULL AND NEW.human_started_at IS NOT NULL THEN
      detected_events := array_append(detected_events, 'human_started');
    END IF;

    -- Stage changed
    IF OLD.kanban_stage_id IS DISTINCT FROM NEW.kanban_stage_id AND NEW.kanban_stage_id IS NOT NULL THEN
      detected_events := array_append(detected_events, 'stage_changed');
    END IF;

    -- Board changed
    IF OLD.kanban_board_id IS DISTINCT FROM NEW.kanban_board_id AND NEW.kanban_board_id IS NOT NULL THEN
      detected_events := array_append(detected_events, 'board_changed');
    END IF;

    -- Client linked
    IF OLD.helpdesk_client_id IS NULL AND NEW.helpdesk_client_id IS NOT NULL THEN
      detected_events := array_append(detected_events, 'client_linked');
    END IF;

    -- CSAT responded
    IF OLD.csat_score IS NULL AND NEW.csat_score IS NOT NULL THEN
      detected_events := array_append(detected_events, 'csat_responded');
    END IF;

    -- Agent assigned
    IF OLD.human_agent_id IS DISTINCT FROM NEW.human_agent_id AND NEW.human_agent_id IS NOT NULL THEN
      detected_events := array_append(detected_events, 'agent_assigned');
    END IF;
  END IF;

  -- For each detected event, find matching webhooks and queue them
  FOREACH evt IN ARRAY detected_events LOOP
    FOR wh IN
      SELECT id FROM public.outgoing_webhooks
      WHERE event_type = evt AND is_active = true
    LOOP
      INSERT INTO public.outgoing_webhook_queue (webhook_id, conversation_id, event_type, event_data)
      VALUES (wh.id, NEW.id, evt, jsonb_build_object(
        'conversation_id', NEW.id,
        'status', NEW.status,
        'priority', NEW.priority,
        'kanban_board_id', NEW.kanban_board_id,
        'kanban_stage_id', NEW.kanban_stage_id,
        'helpdesk_client_id', NEW.helpdesk_client_id,
        'human_agent_id', NEW.human_agent_id,
        'csat_score', NEW.csat_score,
        'ticket_number', NEW.ticket_number
      ))
      RETURNING id INTO queue_id;

      -- Call webhook-sender via pg_net
      PERFORM net.http_post(
        url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/webhook-sender',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('queue_id', queue_id)
      );
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 5. Create trigger on ai_conversations
CREATE TRIGGER trg_dispatch_outgoing_webhooks
  AFTER INSERT OR UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_dispatch_outgoing_webhooks();
