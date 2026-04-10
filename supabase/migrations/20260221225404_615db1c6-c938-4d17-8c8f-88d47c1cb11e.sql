
-- 1. Substituir set_queue_entered_at para incluir in_progress e finished
CREATE OR REPLACE FUNCTION public.set_queue_entered_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status_type TEXT;
  v_is_final BOOLEAN;
BEGIN
  SELECT status_type, is_final INTO v_status_type, v_is_final
  FROM ticket_statuses
  WHERE slug = NEW.status
  LIMIT 1;

  -- Queue: definir queue_entered_at
  IF v_status_type = 'queue' THEN
    IF NEW.queue_entered_at IS NULL THEN
      NEW.queue_entered_at := now();
    END IF;
  ELSE
    -- Saindo da fila

    -- In Progress: registrar primeira resposta humana
    IF v_status_type = 'in_progress' THEN
      IF NEW.first_human_response_at IS NULL THEN
        NEW.first_human_response_at := now();
        IF NEW.queue_entered_at IS NOT NULL THEN
          NEW.first_human_response_seconds :=
            EXTRACT(EPOCH FROM (now() - NEW.queue_entered_at))::integer;
        END IF;
      END IF;
    END IF;

    -- Finished/Final: registrar resolucao
    IF v_status_type = 'finished' OR v_is_final = true THEN
      IF NEW.resolved_at IS NULL THEN
        NEW.resolved_at := now();
        IF NEW.queue_entered_at IS NOT NULL THEN
          NEW.resolution_seconds :=
            EXTRACT(EPOCH FROM (now() - NEW.queue_entered_at))::integer;
        ELSIF NEW.started_at IS NOT NULL THEN
          NEW.resolution_seconds :=
            EXTRACT(EPOCH FROM (now() - NEW.started_at))::integer;
        END IF;
      END IF;
    END IF;

    -- Limpar queue_entered_at ao sair da fila
    NEW.queue_entered_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Funcao para primeira resposta humana via mensagem
CREATE OR REPLACE FUNCTION public.set_first_human_response_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'human_agent' AND NEW.conversation_id IS NOT NULL THEN
    UPDATE ai_conversations
    SET
      first_human_response_at = now(),
      first_human_response_seconds =
        CASE WHEN queue_entered_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (now() - queue_entered_at))::integer
          ELSE NULL
        END
    WHERE id = NEW.conversation_id
      AND first_human_response_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_first_human_response
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  WHEN (NEW.role = 'human_agent')
  EXECUTE FUNCTION set_first_human_response_on_message();

-- 3. Funcao para capturar CSAT via mensagem do cliente
CREATE OR REPLACE FUNCTION public.capture_csat_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score integer;
  v_conv RECORD;
BEGIN
  IF NEW.role = 'user' AND NEW.conversation_id IS NOT NULL THEN
    v_score := NULLIF(TRIM(NEW.content), '')::integer;

    IF v_score IS NOT NULL AND v_score BETWEEN 1 AND 5 THEN
      SELECT csat_sent_at, csat_score INTO v_conv
      FROM ai_conversations
      WHERE id = NEW.conversation_id;

      IF v_conv.csat_sent_at IS NOT NULL AND v_conv.csat_score IS NULL THEN
        UPDATE ai_conversations
        SET
          csat_score = v_score,
          csat_responded_at = now()
        WHERE id = NEW.conversation_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_capture_csat
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION capture_csat_from_message();
