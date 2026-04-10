-- Migration: Unificar Base de Conhecimento e Central do Cliente
-- Adiciona flags is_public / feeds_ai, migra help_videos, atualiza search_knowledge
-- Created: 2026-03-07

-- 1. Adicionar colunas de visibilidade e metadados de vídeo
ALTER TABLE public.ai_knowledge_base
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feeds_ai BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK (difficulty_level IN ('iniciante','intermediario','avancado')),
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Migrar dados existentes: publicar manuais que já estão published
UPDATE public.ai_knowledge_base
  SET is_public = true
  WHERE source_type = 'manual'
    AND (metadata->>'status') = 'published';

-- 3. Migrar help_videos para ai_knowledge_base
INSERT INTO public.ai_knowledge_base (
  title, description, content_type, content, video_url, thumbnail_url,
  duration_seconds, difficulty_level, category, source,
  is_public, feeds_ai, is_active, sort_order
)
SELECT
  hv.title,
  hv.description,
  'video',
  COALESCE(hv.description, hv.title),
  hv.video_url,
  hv.thumbnail_url,
  hv.duration_seconds,
  hv.level,
  'tutorial',
  'help_video_migration',
  (hv.status = 'published'),
  true,
  true,
  0
FROM public.help_videos hv;

-- 4. Dropar tabela help_videos (dados já migrados)
DROP TABLE IF EXISTS public.help_videos CASCADE;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_knowledge_is_public ON public.ai_knowledge_base(is_public) WHERE is_public = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_feeds_ai ON public.ai_knowledge_base(feeds_ai) WHERE feeds_ai = true AND is_active = true;

-- 6. RLS: Permitir leitura pública de conteúdos is_public
CREATE POLICY "knowledge_public_read" ON public.ai_knowledge_base
  FOR SELECT USING (is_public = true AND is_active = true);

-- 7. Trigger: Invalidar embedding quando conteúdo muda (força re-embedding)
CREATE OR REPLACE FUNCTION public.nullify_embedding_on_content_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    NEW.embedding = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_knowledge_re_embed
  BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.nullify_embedding_on_content_change();

-- 8. Atualizar search_knowledge para filtrar feeds_ai
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL,
  filter_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  content_type TEXT,
  original_url TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.content_type,
    kb.original_url,
    (1 - (kb.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ai_knowledge_base kb
  WHERE
    kb.is_active = true
    AND kb.feeds_ai = true
    AND (filter_category IS NULL OR kb.category = filter_category)
    AND (filter_tags IS NULL OR kb.tags && filter_tags)
    AND (filter_product_id IS NULL OR kb.product_id = filter_product_id)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
