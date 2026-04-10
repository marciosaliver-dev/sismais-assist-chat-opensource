ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS slug text;
UPDATE kanban_boards SET slug = board_type WHERE slug IS NULL;
ALTER TABLE kanban_boards ADD CONSTRAINT kanban_boards_slug_key UNIQUE (slug);