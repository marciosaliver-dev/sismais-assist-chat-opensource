
-- Criar tabela de boards
CREATE TABLE IF NOT EXISTS public.kanban_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kanban_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access kanban_boards" ON kanban_boards FOR ALL USING (true) WITH CHECK (true);

-- Board padrao
INSERT INTO kanban_boards (name, description, is_default) VALUES ('Suporte', 'Board principal de atendimento', true);

-- Adicionar board_id em ticket_stages
ALTER TABLE ticket_stages ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES kanban_boards(id);

-- Vincular stages existentes ao board padrao
UPDATE ticket_stages SET board_id = (SELECT id FROM kanban_boards WHERE is_default = true LIMIT 1);

-- Adicionar coluna ticket_stage_id em kanban_stage_automations
ALTER TABLE kanban_stage_automations ADD COLUMN IF NOT EXISTS ticket_stage_id uuid REFERENCES ticket_stages(id);
