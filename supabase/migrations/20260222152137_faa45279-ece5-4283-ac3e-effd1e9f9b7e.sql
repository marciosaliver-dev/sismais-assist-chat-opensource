
-- Add status_type column to kanban_stages
ALTER TABLE public.kanban_stages 
ADD COLUMN IF NOT EXISTS status_type text DEFAULT 'aguardando';

-- Populate based on heuristics
UPDATE public.kanban_stages SET status_type = 'finalizado' WHERE is_exit = true;
UPDATE public.kanban_stages SET status_type = 'aguardando' WHERE is_entry = true;
UPDATE public.kanban_stages SET status_type = 'em_atendimento' WHERE is_exit = false AND is_entry = false;

-- Add CHECK constraint
ALTER TABLE public.kanban_stages 
ADD CONSTRAINT kanban_stages_status_type_check 
CHECK (status_type IN ('aguardando', 'em_atendimento', 'finalizado'));
