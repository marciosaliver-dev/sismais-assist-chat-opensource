-- Migration: Central do Cliente — help_videos e help_tickets
-- Created: 2026-03-06

-- Tabela de vídeos tutoriais
CREATE TABLE public.help_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL DEFAULT 'geral' CHECK (module IN ('vendas_pdv','financeiro','estoque','fiscal_nfe','geral')),
  level TEXT NOT NULL DEFAULT 'iniciante' CHECK (level IN ('iniciante','intermediario','avancado')),
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de chamados do portal do cliente (sem auth obrigatória)
CREATE TABLE public.help_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_help_videos_status ON public.help_videos(status);
CREATE INDEX idx_help_videos_module ON public.help_videos(module);
CREATE INDEX idx_help_tickets_status ON public.help_tickets(status);
CREATE INDEX idx_help_tickets_email ON public.help_tickets(contact_email);

-- RLS
ALTER TABLE public.help_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;

-- help_videos: leitura pública de publicados, acesso total para autenticados
CREATE POLICY "help_videos_public_read" ON public.help_videos
  FOR SELECT USING (status = 'published');

CREATE POLICY "help_videos_authenticated_all" ON public.help_videos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- help_tickets: qualquer pessoa pode criar e ler (filtro por email feito no app)
CREATE POLICY "help_tickets_public_insert" ON public.help_tickets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "help_tickets_public_read" ON public.help_tickets
  FOR SELECT USING (true);

CREATE POLICY "help_tickets_authenticated_all" ON public.help_tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Função updated_at (cria se não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER trg_help_videos_updated_at
  BEFORE UPDATE ON public.help_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_help_tickets_updated_at
  BEFORE UPDATE ON public.help_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
