
-- Remover CHECK constraint antigo e recriar com 'waiting'
ALTER TABLE ticket_statuses DROP CONSTRAINT ticket_statuses_status_type_check;
ALTER TABLE ticket_statuses ADD CONSTRAINT ticket_statuses_status_type_check 
  CHECK (status_type = ANY (ARRAY['queue'::text, 'in_progress'::text, 'waiting'::text, 'finished'::text, 'custom'::text]));

-- ============================================================
-- PARTE A: Atualizar ticket_statuses
-- ============================================================

UPDATE ticket_statuses SET 
  slug = 'pendente', name = 'Pendente', color = '#6b7280', 
  is_default = true, is_system = true, status_type = 'queue', icon = 'Clock'
WHERE id = 'b6cd17ce-091a-4587-bea3-8cb586b0883a';

UPDATE ticket_statuses SET 
  name = 'Em Atendimento', color = '#3b82f6', is_system = true, 
  status_type = 'in_progress', icon = 'Headphones', sort_order = 1
WHERE id = 'cc2ed1b3-bee3-40bf-83d3-03edbe91e7b1';

UPDATE ai_conversations SET status = 'em_andamento' WHERE status = 'em_atendimento_humano';
DELETE FROM ticket_statuses WHERE id = 'dc78963f-2c0f-4cd5-bdf7-72ea95380b01';

UPDATE ticket_statuses SET 
  status_type = 'waiting', is_system = true, icon = 'UserRound', sort_order = 2
WHERE id = '0627d29d-12e6-4c26-93d7-1bf84e4c3f9d';

UPDATE ticket_statuses SET 
  status_type = 'waiting', is_system = true, icon = 'Users', sort_order = 3
WHERE id = 'bca84dc7-c87b-46ed-aff4-e956bd17b689';

INSERT INTO ticket_statuses (name, slug, color, status_type, is_system, is_default, is_final, sort_order, icon)
VALUES ('Bug em Correção', 'bug_em_correcao', '#f97316', 'in_progress', true, false, false, 4, 'Bug')
ON CONFLICT DO NOTHING;

UPDATE ticket_statuses SET is_system = true, sort_order = 5, icon = 'CheckCircle' 
WHERE id = '58e9aa6b-97eb-4864-b1b4-0fc2051c59e9';

UPDATE ticket_statuses SET is_system = true, sort_order = 6
WHERE id = '267d29d7-b6dc-4c2f-8617-576d53bae86c';

UPDATE ticket_statuses SET is_system = true, sort_order = 7, icon = 'XCircle'
WHERE id = 'b88ca8f7-0ff0-4ee6-862a-e10fe5d989f4';

-- ============================================================
-- PARTE B: Expandir kanban_boards
-- ============================================================

ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS color text DEFAULT '#06b6d4';
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS board_type text DEFAULT 'custom';
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

UPDATE kanban_boards SET icon = 'Headphones', color = '#06b6d4', board_type = 'support', sort_order = 0
WHERE is_default = true;

INSERT INTO kanban_boards (name, description, icon, color, board_type, sort_order)
VALUES ('Onboarding', 'Fluxo de onboarding de novos clientes', 'Rocket', '#a855f7', 'onboarding', 1);

INSERT INTO kanban_boards (name, description, icon, color, board_type, sort_order)
VALUES ('Gestão de Cobranças', 'Gestão de inadimplência e cobranças', 'CreditCard', '#22c55e', 'billing', 2);

-- ============================================================
-- PARTE C: Renomear ticket_stages -> kanban_stages
-- ============================================================

ALTER TABLE ticket_stages RENAME TO kanban_stages;

ALTER TABLE kanban_stages ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE kanban_stages ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE kanban_stages ADD COLUMN IF NOT EXISTS is_entry boolean DEFAULT false;
ALTER TABLE kanban_stages ADD COLUMN IF NOT EXISTS is_exit boolean DEFAULT false;
ALTER TABLE kanban_stages ADD COLUMN IF NOT EXISTS wip_limit integer;
ALTER TABLE kanban_stages ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE kanban_stages RENAME COLUMN position TO sort_order;

UPDATE kanban_stages SET is_entry = is_default WHERE is_default = true;
UPDATE kanban_stages SET is_exit = is_final WHERE is_final = true;

UPDATE kanban_stages SET slug = 'fila', name = 'Fila', color = '#6b7280', icon = 'inbox' WHERE name = 'Novo';
UPDATE kanban_stages SET slug = 'triagem_ia', description = 'Triagem automática por IA' WHERE name = 'Triagem IA';
UPDATE kanban_stages SET slug = 'em_andamento', name = 'Em Andamento', color = '#3b82f6', icon = 'play' WHERE name = 'Em Atendimento';
UPDATE kanban_stages SET slug = 'aguardando_resposta', name = 'Aguardando Resposta', color = '#a855f7', icon = 'clock' WHERE name = 'Aguardando Cliente';
UPDATE kanban_stages SET slug = 'em_teste', name = 'Resolução em Teste', color = '#eab308', icon = 'flask-conical' WHERE name = 'Resolvido' AND is_exit = true;
UPDATE kanban_stages SET slug = 'concluido', name = 'Concluído', color = '#22c55e', icon = 'check-circle' WHERE name = 'Fechado';

-- Para o caso do Resolvido que virou em_teste, precisamos de um stage "Concluído" final
-- Se o "Fechado" virou "Concluído", está ok. Senão ajustar.

-- Inserir etapas para Onboarding
INSERT INTO kanban_stages (name, slug, color, icon, sort_order, is_entry, is_exit, board_id, active)
VALUES 
  ('Lead Novo', 'lead_novo', '#6b7280', 'user-plus', 0, true, false, (SELECT id FROM kanban_boards WHERE board_type = 'onboarding'), true),
  ('Contato Inicial', 'contato_inicial', '#60a5fa', 'phone', 1, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'onboarding'), true),
  ('Demonstração Agendada', 'demo_agendada', '#a855f7', 'calendar', 2, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'onboarding'), true),
  ('Em Implantação', 'em_implantacao', '#eab308', 'settings', 3, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'onboarding'), true),
  ('Treinamento', 'treinamento', '#f97316', 'graduation-cap', 4, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'onboarding'), true),
  ('Ativo', 'ativo', '#22c55e', 'check-circle', 5, false, true, (SELECT id FROM kanban_boards WHERE board_type = 'onboarding'), true);

-- Inserir etapas para Cobranças
INSERT INTO kanban_stages (name, slug, color, icon, sort_order, is_entry, is_exit, board_id, active)
VALUES 
  ('Inadimplente', 'inadimplente', '#ef4444', 'alert-triangle', 0, true, false, (SELECT id FROM kanban_boards WHERE board_type = 'billing'), true),
  ('Contato Realizado', 'contato_realizado', '#f97316', 'phone-outgoing', 1, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'billing'), true),
  ('Negociação em Andamento', 'negociando', '#eab308', 'handshake', 2, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'billing'), true),
  ('Acordo Firmado', 'acordo_firmado', '#3b82f6', 'file-check', 3, false, false, (SELECT id FROM kanban_boards WHERE board_type = 'billing'), true),
  ('Regularizado', 'regularizado', '#22c55e', 'check-circle', 4, false, true, (SELECT id FROM kanban_boards WHERE board_type = 'billing'), true),
  ('Cancelado', 'cancelado', '#6b7280', 'x-circle', 5, false, true, (SELECT id FROM kanban_boards WHERE board_type = 'billing'), true);

-- ============================================================
-- PARTE D: ai_conversations - novas colunas FK
-- ============================================================

ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS ticket_status_id uuid REFERENCES ticket_statuses(id) ON DELETE SET NULL;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS kanban_stage_id uuid REFERENCES kanban_stages(id) ON DELETE SET NULL;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS kanban_board_id uuid REFERENCES kanban_boards(id) ON DELETE SET NULL;

UPDATE ai_conversations ac SET ticket_status_id = ts.id 
FROM ticket_statuses ts WHERE ts.slug = ac.status AND ac.ticket_status_id IS NULL;

UPDATE ai_conversations SET kanban_stage_id = stage_id WHERE kanban_stage_id IS NULL AND stage_id IS NOT NULL;

UPDATE ai_conversations ac SET kanban_board_id = ks.board_id 
FROM kanban_stages ks WHERE ks.id = ac.kanban_stage_id AND ac.kanban_board_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_ticket_status_id ON ai_conversations(ticket_status_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_kanban_stage_id ON ai_conversations(kanban_stage_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_kanban_board_id ON ai_conversations(kanban_board_id);

-- ============================================================
-- PARTE E: Recriar kanban_stage_automations
-- ============================================================

DROP TABLE IF EXISTS kanban_stage_automations;

CREATE TABLE kanban_stage_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_stage_id uuid NOT NULL REFERENCES kanban_stages(id) ON DELETE CASCADE,
  flow_automation_id uuid REFERENCES flow_automations(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  action_type text NOT NULL,
  action_config jsonb DEFAULT '{}',
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kanban_stage_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access kanban_stage_automations" 
  ON kanban_stage_automations FOR ALL 
  USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGER: Atualizar set_queue_entered_at para usar ticket_status_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_queue_entered_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_type TEXT;
  v_is_final BOOLEAN;
BEGIN
  IF NEW.ticket_status_id IS NOT NULL THEN
    SELECT status_type, is_final INTO v_status_type, v_is_final
    FROM ticket_statuses WHERE id = NEW.ticket_status_id LIMIT 1;
  ELSIF NEW.status IS NOT NULL THEN
    SELECT status_type, is_final INTO v_status_type, v_is_final
    FROM ticket_statuses WHERE slug = NEW.status LIMIT 1;
  ELSE
    RETURN NEW;
  END IF;

  IF v_status_type = 'queue' THEN
    IF NEW.queue_entered_at IS NULL THEN
      NEW.queue_entered_at := now();
    END IF;
  ELSE
    IF v_status_type = 'in_progress' THEN
      IF NEW.first_human_response_at IS NULL THEN
        NEW.first_human_response_at := now();
        IF NEW.queue_entered_at IS NOT NULL THEN
          NEW.first_human_response_seconds :=
            EXTRACT(EPOCH FROM (now() - NEW.queue_entered_at))::integer;
        END IF;
      END IF;
    END IF;

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

    NEW.queue_entered_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Sync trigger: sincronizar campos legados
CREATE OR REPLACE FUNCTION public.sync_stage_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kanban_stage_id IS DISTINCT FROM OLD.kanban_stage_id AND NEW.kanban_stage_id IS NOT NULL THEN
    NEW.stage_id := NEW.kanban_stage_id;
    SELECT board_id INTO NEW.kanban_board_id FROM kanban_stages WHERE id = NEW.kanban_stage_id;
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id IS NOT NULL THEN
    NEW.kanban_stage_id := NEW.stage_id;
    SELECT board_id INTO NEW.kanban_board_id FROM kanban_stages WHERE id = NEW.stage_id;
  END IF;

  IF NEW.ticket_status_id IS DISTINCT FROM OLD.ticket_status_id AND NEW.ticket_status_id IS NOT NULL THEN
    SELECT slug INTO NEW.status FROM ticket_statuses WHERE id = NEW.ticket_status_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_stage_fields ON ai_conversations;
CREATE TRIGGER trg_sync_stage_fields
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION sync_stage_fields();
