
-- Create macros table
CREATE TABLE public.macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'zap',
  color TEXT DEFAULT '#14b8a6',
  message TEXT,
  actions JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.macros ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated read macros" ON public.macros FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated write macros" ON public.macros FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update macros" ON public.macros FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete macros" ON public.macros FOR DELETE USING (auth.uid() IS NOT NULL);

-- Seed data
INSERT INTO public.macros (name, description, icon, color, actions, sort_order) VALUES
  ('Mensagem de Boas-Vindas', 'Enviar template de abertura', 'message-circle', '#14b8a6', '[{"type": "send_message", "message": "Olá! Bem-vindo ao nosso suporte. Como posso ajudar?"}]'::jsonb, 0),
  ('Solicitar Dados', 'Pedir informações complementares', 'clipboard-list', '#f59e0b', '[{"type": "send_message", "message": "Para dar continuidade, preciso de algumas informações:\n\n1. Seu nome completo\n2. Número do contrato\n3. Descrição detalhada do problema"}]'::jsonb, 1),
  ('Encerrar com Agradecimento', 'Finalizar com mensagem de agradecimento', 'heart', '#ef4444', '[{"type": "send_message", "message": "Obrigado pelo contato! Fico feliz em ter ajudado. Se precisar de algo mais, estou à disposição. Tenha um ótimo dia!"}]'::jsonb, 2);

-- Update sync_stage_fields to auto-set status from stage's status_type
CREATE OR REPLACE FUNCTION sync_stage_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_status_type TEXT;
  v_status_id UUID;
  v_status_slug TEXT;
BEGIN
  IF NEW.kanban_stage_id IS DISTINCT FROM OLD.kanban_stage_id AND NEW.kanban_stage_id IS NOT NULL THEN
    NEW.stage_id := NEW.kanban_stage_id;
    SELECT board_id INTO NEW.kanban_board_id FROM kanban_stages WHERE id = NEW.kanban_stage_id;
    
    -- AUTO-SET STATUS from stage's status_type
    SELECT status_type INTO v_status_type FROM kanban_stages WHERE id = NEW.kanban_stage_id;
    IF v_status_type IS NOT NULL THEN
      SELECT id, slug INTO v_status_id, v_status_slug 
      FROM ticket_statuses WHERE slug = v_status_type AND active = true LIMIT 1;
      IF v_status_id IS NOT NULL THEN
        NEW.ticket_status_id := v_status_id;
        NEW.status := v_status_slug;
      END IF;
    END IF;
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id IS NOT NULL THEN
    NEW.kanban_stage_id := NEW.stage_id;
    SELECT board_id INTO NEW.kanban_board_id FROM kanban_stages WHERE id = NEW.stage_id;
    
    -- AUTO-SET STATUS from stage's status_type
    SELECT status_type INTO v_status_type FROM kanban_stages WHERE id = NEW.stage_id;
    IF v_status_type IS NOT NULL THEN
      SELECT id, slug INTO v_status_id, v_status_slug 
      FROM ticket_statuses WHERE slug = v_status_type AND active = true LIMIT 1;
      IF v_status_id IS NOT NULL THEN
        NEW.ticket_status_id := v_status_id;
        NEW.status := v_status_slug;
      END IF;
    END IF;
  END IF;

  IF NEW.ticket_status_id IS DISTINCT FROM OLD.ticket_status_id AND NEW.ticket_status_id IS NOT NULL THEN
    SELECT slug INTO NEW.status FROM ticket_statuses WHERE id = NEW.ticket_status_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
