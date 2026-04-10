
-- 1. Create ai_service_evaluations table
CREATE TABLE public.ai_service_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
  human_agent_id uuid REFERENCES human_agents(id),
  evaluation_type text NOT NULL DEFAULT 'ai',
  overall_score integer CHECK (overall_score BETWEEN 1 AND 10),
  criteria jsonb,
  summary text,
  strengths text[],
  improvements text[],
  conversation_summary text,
  model_used text,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_service_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read evaluations"
  ON public.ai_service_evaluations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert evaluations"
  ON public.ai_service_evaluations FOR INSERT TO authenticated WITH CHECK (true);

-- Index
CREATE INDEX idx_evaluations_conversation ON public.ai_service_evaluations(conversation_id);
CREATE INDEX idx_evaluations_agent ON public.ai_service_evaluations(human_agent_id);
CREATE INDEX idx_evaluations_created ON public.ai_service_evaluations(created_at DESC);

-- 2. Add human_agent_id to ticket_status_history
ALTER TABLE public.ticket_status_history ADD COLUMN IF NOT EXISTS human_agent_id uuid REFERENCES human_agents(id);

-- 3. Update trigger to capture human_agent_id
CREATE OR REPLACE FUNCTION public.log_ticket_status_or_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from_name text;
  v_to_name text;
BEGIN
  -- Status change
  IF NEW.ticket_status_id IS DISTINCT FROM OLD.ticket_status_id THEN
    SELECT name INTO v_from_name FROM ticket_statuses WHERE id = OLD.ticket_status_id;
    SELECT name INTO v_to_name FROM ticket_statuses WHERE id = NEW.ticket_status_id;
    INSERT INTO ticket_status_history
      (conversation_id, change_type, from_value, to_value, from_id, to_id, changed_by, human_agent_id)
    VALUES
      (NEW.id, 'status_change', v_from_name, v_to_name, OLD.ticket_status_id, NEW.ticket_status_id, 
       CASE WHEN NEW.human_agent_id IS NOT NULL THEN 'human_agent' ELSE 'system' END,
       NEW.human_agent_id);
  END IF;

  -- Stage change
  IF NEW.kanban_stage_id IS DISTINCT FROM OLD.kanban_stage_id THEN
    SELECT name INTO v_from_name FROM kanban_stages WHERE id = OLD.kanban_stage_id;
    SELECT name INTO v_to_name FROM kanban_stages WHERE id = NEW.kanban_stage_id;
    INSERT INTO ticket_status_history
      (conversation_id, change_type, from_value, to_value, from_id, to_id, changed_by, human_agent_id)
    VALUES
      (NEW.id, 'stage_change', v_from_name, v_to_name, OLD.kanban_stage_id, NEW.kanban_stage_id,
       CASE WHEN NEW.human_agent_id IS NOT NULL THEN 'human_agent' ELSE 'system' END,
       NEW.human_agent_id);
  END IF;

  RETURN NEW;
END;
$function$;
