-- Fix: allow transfers to change human_agent_id even when is_data_locked = true
-- The lock should only protect SLA timing metrics, not the current agent assignment.
-- Transfer history is already audited via transfer_audit_logs and agent_assignments.

CREATE OR REPLACE FUNCTION public.fn_protect_locked_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow finalization: when status is changing to 'finalizado', permit resolved_at and resolution_seconds updates
  IF OLD.is_data_locked = true AND NOT (
    NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'finalizado'
  ) AND (
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
$function$;
