
-- Add "Atendimento IA" stage to the Suporte board
-- First, get the suporte board and shift existing stages sort_order

-- Shift existing stages to make room (sort_order >= 1 gets +1)
UPDATE kanban_stages
SET sort_order = sort_order + 1
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'suporte' LIMIT 1)
  AND sort_order >= 1;

-- Remove is_entry and is_default from the current "Fila" stage
UPDATE kanban_stages
SET is_entry = false, is_default = false
WHERE board_id = (SELECT id FROM kanban_boards WHERE slug = 'suporte' LIMIT 1)
  AND slug = 'fila';

-- Insert the new "Atendimento IA" stage
INSERT INTO kanban_stages (
  name, slug, board_id, sort_order, status_type, is_entry, is_default,
  icon, color, description, active
)
SELECT
  'Atendimento IA',
  'atendimento_ia',
  id,
  1,
  'em_atendimento',
  true,
  true,
  'bot',
  '#8B5CF6',
  'Conversas sendo atendidas pela IA. Ao escalar para humano, movem para Fila.',
  true
FROM kanban_boards
WHERE slug = 'suporte'
LIMIT 1;
