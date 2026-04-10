-- Adicionar flag is_ai_validation na tabela kanban_stages
ALTER TABLE public.kanban_stages ADD COLUMN IF NOT EXISTS is_ai_validation boolean DEFAULT false;

-- Inserir etapa "Fechado por IA" em todos os boards que tenham etapa final (is_exit=true)
-- Fica posicionada imediatamente antes da etapa final
INSERT INTO public.kanban_stages (name, slug, color, icon, sort_order, board_id, is_entry, is_exit, is_ai_validation, status_type, active)
SELECT DISTINCT ON (exit_stage.board_id)
  'Fechado por IA',
  'fechado_por_ia',
  '#7C3AED',
  'bot',
  exit_stage.sort_order,
  exit_stage.board_id,
  false,
  false,
  true,
  'em_atendimento',
  true
FROM public.kanban_stages exit_stage
WHERE exit_stage.is_exit = true
  AND exit_stage.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_stages ks
    WHERE ks.board_id = exit_stage.board_id AND ks.slug = 'fechado_por_ia'
  )
ORDER BY exit_stage.board_id, exit_stage.sort_order ASC;

-- Empurrar a etapa final 1 posição para frente
UPDATE public.kanban_stages
SET sort_order = sort_order + 1
WHERE is_exit = true
  AND active = true
  AND EXISTS (
    SELECT 1 FROM public.kanban_stages ks
    WHERE ks.board_id = kanban_stages.board_id AND ks.slug = 'fechado_por_ia'
  );
