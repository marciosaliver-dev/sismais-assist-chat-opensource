
CREATE TABLE public.kanban_stage_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_status_id uuid NOT NULL REFERENCES public.ticket_statuses(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.flow_automations(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('on_enter', 'on_exit')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_status_id, flow_id, trigger_type)
);

ALTER TABLE public.kanban_stage_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access kanban_stage_automations"
  ON public.kanban_stage_automations
  FOR ALL
  USING (true)
  WITH CHECK (true);
