ALTER TABLE public.uazapi_instances
ADD COLUMN kanban_board_id uuid REFERENCES public.kanban_boards(id) ON DELETE SET NULL;