
-- Insert missing statuses
INSERT INTO ticket_statuses (name, slug, color, sort_order, active, is_final)
VALUES
  ('Aguardando Interno', 'aguardando_interno', '#f97316', 4, true, false),
  ('Escalado', 'escalado', '#ef4444', 6, true, false);

-- Adjust sort_order for existing statuses
UPDATE ticket_statuses SET sort_order = 5 WHERE slug = 'resolvido';
UPDATE ticket_statuses SET sort_order = 7 WHERE slug = 'fechado';

-- Migrate existing conversation statuses to new slugs
UPDATE ai_conversations SET status = 'novo' WHERE status = 'new';
UPDATE ai_conversations SET status = 'em_andamento' WHERE status IN ('active', 'in_progress');
UPDATE ai_conversations SET status = 'aguardando_cliente' WHERE status IN ('waiting', 'waiting_customer');
UPDATE ai_conversations SET status = 'resolvido' WHERE status IN ('resolved', 'awaiting_csat');
UPDATE ai_conversations SET status = 'fechado' WHERE status = 'closed';
UPDATE ai_conversations SET status = 'aguardando_interno' WHERE status = 'waiting_internal';
UPDATE ai_conversations SET status = 'escalado' WHERE status = 'escalated';
