
-- Tabela de etapas customizáveis do Kanban
CREATE TABLE public.ticket_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#45E5E5',
  icon TEXT DEFAULT 'circle',
  position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_final BOOLEAN DEFAULT false,
  auto_actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ticket_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ticket_stages" ON public.ticket_stages FOR SELECT USING (true);
CREATE POLICY "Authenticated insert ticket_stages" ON public.ticket_stages FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update ticket_stages" ON public.ticket_stages FOR UPDATE USING (true);
CREATE POLICY "Authenticated delete ticket_stages" ON public.ticket_stages FOR DELETE USING (true);

-- Tabela de histórico de movimentações
CREATE TABLE public.ticket_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.ticket_stages(id) ON DELETE SET NULL,
  to_stage_id UUID NOT NULL REFERENCES public.ticket_stages(id) ON DELETE CASCADE,
  moved_by TEXT DEFAULT 'user',
  moved_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.ticket_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ticket_stage_history" ON public.ticket_stage_history FOR SELECT USING (true);
CREATE POLICY "Authenticated insert ticket_stage_history" ON public.ticket_stage_history FOR INSERT WITH CHECK (true);

-- Adicionar stage_id na tabela de conversas
ALTER TABLE public.ai_conversations ADD COLUMN stage_id UUID REFERENCES public.ticket_stages(id) ON DELETE SET NULL;

-- Inserir etapas padrão
INSERT INTO public.ticket_stages (name, color, icon, position, is_default, is_final) VALUES
  ('Novo', '#22c55e', 'circle-plus', 0, true, false),
  ('Triagem IA', '#a855f7', 'bot', 1, false, false),
  ('Em Atendimento', '#3b82f6', 'headphones', 2, false, false),
  ('Aguardando Cliente', '#f59e0b', 'clock', 3, false, false),
  ('Resolvido', '#10b981', 'check-circle', 4, false, true),
  ('Fechado', '#6b7280', 'x-circle', 5, false, true);

-- Migrar dados existentes
UPDATE public.ai_conversations SET stage_id = (SELECT id FROM public.ticket_stages WHERE name = 'Em Atendimento') WHERE status = 'active' AND stage_id IS NULL;
UPDATE public.ai_conversations SET stage_id = (SELECT id FROM public.ticket_stages WHERE name = 'Resolvido') WHERE status = 'resolved' AND stage_id IS NULL;
UPDATE public.ai_conversations SET stage_id = (SELECT id FROM public.ticket_stages WHERE name = 'Aguardando Cliente') WHERE status = 'awaiting_csat' AND stage_id IS NULL;
UPDATE public.ai_conversations SET stage_id = (SELECT id FROM public.ticket_stages WHERE name = 'Novo') WHERE stage_id IS NULL;

-- Índices
CREATE INDEX idx_conversations_stage_id ON public.ai_conversations(stage_id);
CREATE INDEX idx_ticket_stages_position ON public.ticket_stages(position);
CREATE INDEX idx_ticket_stage_history_conversation ON public.ticket_stage_history(conversation_id);
