
CREATE OR REPLACE FUNCTION public.fn_protect_locked_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_data_locked = true AND (
    NEW.human_agent_id IS DISTINCT FROM OLD.human_agent_id OR
    NEW.human_started_at IS DISTINCT FROM OLD.human_started_at OR
    NEW.first_human_response_at IS DISTINCT FROM OLD.first_human_response_at OR
    NEW.first_human_response_seconds IS DISTINCT FROM OLD.first_human_response_seconds OR
    NEW.queue_entered_at IS DISTINCT FROM OLD.queue_entered_at OR
    NEW.resolved_at IS DISTINCT FROM OLD.resolved_at OR
    NEW.resolution_seconds IS DISTINCT FROM OLD.resolution_seconds OR
    NEW.ai_resolved IS DISTINCT FROM OLD.ai_resolved
  ) THEN
    RAISE EXCEPTION 'Dados de desempenho protegidos -- nao podem ser alterados apos o inicio do atendimento.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_protect_locked_fields
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_locked_fields();
