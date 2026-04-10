
-- 1. Add new columns to ai_conversations
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS human_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_data_locked boolean NOT NULL DEFAULT false;

-- 2. Migrate existing statuses
UPDATE public.ai_conversations SET status = 'aguardando'
WHERE status IN ('pendente', 'novo', 'active', 'aguardando_cliente', 'aguardando_interno', 'escalado');

UPDATE public.ai_conversations SET status = 'em_atendimento'
WHERE status IN ('em_andamento', 'em_atendimento_humano', 'bug_em_correcao');

UPDATE public.ai_conversations SET status = 'finalizado'
WHERE status IN ('resolvido', 'fechado', 'awaiting_csat');

-- 3. Clean ticket_statuses and insert the 3 fixed statuses
DELETE FROM public.ticket_statuses;

INSERT INTO public.ticket_statuses (slug, name, color, icon, is_system, is_default, is_final, status_type, sort_order)
VALUES
  ('aguardando', 'Aguardando', '#6b7280', 'Clock', true, true, false, 'queue', 0),
  ('em_atendimento', 'Em Atendimento', '#3b82f6', 'Headphones', true, false, false, 'in_progress', 1),
  ('finalizado', 'Finalizado', '#22c55e', 'CheckCircle2', true, false, true, 'finished', 2);

-- 4. Create trigger function for status automation
CREATE OR REPLACE FUNCTION public.fn_ticket_status_automation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Transition to em_atendimento
    IF NEW.status = 'em_atendimento' THEN
      IF NEW.human_started_at IS NULL THEN
        NEW.human_started_at := now();
      END IF;
      IF NEW.first_human_response_at IS NULL THEN
        NEW.first_human_response_at := now();
      END IF;
      NEW.first_human_response_seconds := EXTRACT(EPOCH FROM now() - COALESCE(NEW.queue_entered_at, NEW.started_at))::integer;
    END IF;

    -- Transition to finalizado
    IF NEW.status = 'finalizado' THEN
      IF NEW.resolved_at IS NULL THEN
        NEW.resolved_at := now();
      END IF;
      IF NEW.human_started_at IS NOT NULL THEN
        -- Human attended: calculate resolution time from human_started_at
        NEW.resolution_seconds := EXTRACT(EPOCH FROM now() - NEW.human_started_at)::integer;
      ELSE
        -- AI only resolution
        NEW.ai_resolved := true;
      END IF;
      NEW.is_data_locked := true;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Create trigger
DROP TRIGGER IF EXISTS trg_ticket_status_automation ON public.ai_conversations;
CREATE TRIGGER trg_ticket_status_automation
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ticket_status_automation();
