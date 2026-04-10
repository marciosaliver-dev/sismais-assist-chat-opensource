-- Adiciona role "lider" (Líder do Suporte) ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'lider';
