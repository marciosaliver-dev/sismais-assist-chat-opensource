
-- Tabela
CREATE TABLE ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  changed_by text DEFAULT 'system',
  change_type text NOT NULL CHECK (change_type IN ('status_change', 'stage_change')),
  from_value text,
  to_value text,
  from_id uuid,
  to_id uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX idx_tsh_conversation ON ticket_status_history(conversation_id);
CREATE INDEX idx_tsh_created ON ticket_status_history(created_at DESC);

-- RLS
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access ticket_status_history"
  ON ticket_status_history FOR ALL
  USING (true) WITH CHECK (true);

-- Funcao do trigger
CREATE OR REPLACE FUNCTION log_ticket_status_or_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from_name text;
  v_to_name text;
BEGIN
  -- Status change
  IF NEW.ticket_status_id IS DISTINCT FROM OLD.ticket_status_id THEN
    SELECT name INTO v_from_name FROM ticket_statuses WHERE id = OLD.ticket_status_id;
    SELECT name INTO v_to_name FROM ticket_statuses WHERE id = NEW.ticket_status_id;
    INSERT INTO ticket_status_history
      (conversation_id, change_type, from_value, to_value, from_id, to_id, changed_by)
    VALUES
      (NEW.id, 'status_change', v_from_name, v_to_name, OLD.ticket_status_id, NEW.ticket_status_id, 'system');
  END IF;

  -- Stage change
  IF NEW.kanban_stage_id IS DISTINCT FROM OLD.kanban_stage_id THEN
    SELECT name INTO v_from_name FROM kanban_stages WHERE id = OLD.kanban_stage_id;
    SELECT name INTO v_to_name FROM kanban_stages WHERE id = NEW.kanban_stage_id;
    INSERT INTO ticket_status_history
      (conversation_id, change_type, from_value, to_value, from_id, to_id, changed_by)
    VALUES
      (NEW.id, 'stage_change', v_from_name, v_to_name, OLD.kanban_stage_id, NEW.kanban_stage_id, 'system');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER trg_log_status_stage_change
  AFTER UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_status_or_stage_change();
