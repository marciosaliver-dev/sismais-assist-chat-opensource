
-- Migration 1: ticket_statuses - add status_type and is_system columns
ALTER TABLE ticket_statuses
  ADD COLUMN status_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (status_type IN ('queue','in_progress','finished','custom')),
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT false;

UPDATE ticket_statuses SET status_type = 'queue' WHERE slug = 'novo';
UPDATE ticket_statuses SET status_type = 'in_progress' WHERE slug IN ('em_andamento','aguardando_cliente','aguardando_interno','escalado');
UPDATE ticket_statuses SET status_type = 'finished' WHERE slug IN ('resolvido','fechado');

INSERT INTO ticket_statuses (name, slug, status_type, is_system, color, icon, is_final, sort_order)
VALUES
  ('Pendente','pendente','queue',true,'#374151','Clock',false,0),
  ('Em Atendimento','em_atendimento_humano','in_progress',true,'#3b82f6','Headphones',false,0),
  ('Finalizado','finalizado','finished',true,'#166534','CheckCircle2',true,0);

-- Migration 2: ai_conversations - add quality tracking columns
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_human_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_human_response_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS resolution_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS human_agent_id UUID REFERENCES human_agents(id),
  ADD COLUMN IF NOT EXISTS queue_position INTEGER,
  ADD COLUMN IF NOT EXISTS csat_score INTEGER,
  ADD COLUMN IF NOT EXISTS csat_comment TEXT,
  ADD COLUMN IF NOT EXISTS csat_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS csat_responded_at TIMESTAMPTZ;

-- Migration 3: ticket_sla_config table
CREATE TABLE ticket_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  first_response_target_minutes INTEGER NOT NULL,
  resolution_target_minutes INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(priority)
);

ALTER TABLE ticket_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access ticket_sla_config"
  ON ticket_sla_config FOR ALL USING (true) WITH CHECK (true);

INSERT INTO ticket_sla_config (name, priority, first_response_target_minutes, resolution_target_minutes)
VALUES
  ('Baixa','low',240,2880),
  ('Média','medium',60,480),
  ('Alta','high',15,120),
  ('Crítica','critical',5,60);
