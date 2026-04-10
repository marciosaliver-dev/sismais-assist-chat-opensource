-- Migration: RAG Improvements
-- Adds hybrid search (vector + full-text), knowledge ratings, staleness detection
-- Created: 2026-03-19

-- 1. Add full-text search vector column
ALTER TABLE public.ai_knowledge_base
  ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- 2. Populate fts_vector from existing content
UPDATE public.ai_knowledge_base
  SET fts_vector = to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(content, ''))
  WHERE fts_vector IS NULL;

-- 3. GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_knowledge_fts ON public.ai_knowledge_base USING gin(fts_vector);

-- 4. Trigger to auto-update fts_vector on content change
CREATE OR REPLACE FUNCTION update_knowledge_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts_vector := to_tsvector('portuguese', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_fts ON public.ai_knowledge_base;
CREATE TRIGGER trg_knowledge_fts
  BEFORE INSERT OR UPDATE OF title, content ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_fts();

-- 5. Add staleness tracking columns
ALTER TABLE public.ai_knowledge_base
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staleness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrieval_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_usefulness FLOAT DEFAULT 0;

-- 6. Knowledge ratings table for retrieval quality feedback
CREATE TABLE IF NOT EXISTS public.ai_knowledge_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES public.ai_knowledge_base(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN -1 AND 1),  -- -1=irrelevant, 0=partial, 1=helpful
  query_text TEXT,
  similarity_score FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_ratings_kid ON public.ai_knowledge_ratings(knowledge_id);

-- 7. Hybrid search function (RRF: Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION search_knowledge_hybrid(
  query_embedding VECTOR(1536),
  query_text TEXT DEFAULT '',
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL,
  filter_product_id UUID DEFAULT NULL,
  vector_weight FLOAT DEFAULT 0.6,
  text_weight FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  content_type TEXT,
  original_url TEXT,
  similarity FLOAT,
  text_rank FLOAT,
  combined_score FLOAT
) AS $$
DECLARE
  k_rrf CONSTANT INT := 60;  -- RRF smoothing constant
  ts_query tsquery;
BEGIN
  -- Build tsquery from plain text (handles Portuguese stemming)
  IF query_text IS NOT NULL AND query_text != '' THEN
    ts_query := plainto_tsquery('portuguese', query_text);
  ELSE
    ts_query := NULL;
  END IF;

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      kb.id,
      kb.title,
      kb.content,
      kb.content_type,
      kb.original_url,
      (1 - (kb.embedding <=> query_embedding))::FLOAT AS vec_sim,
      ROW_NUMBER() OVER (ORDER BY kb.embedding <=> query_embedding) AS vec_rank
    FROM ai_knowledge_base kb
    WHERE
      kb.is_active = true
      AND kb.feeds_ai = true
      AND kb.embedding IS NOT NULL
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_tags IS NULL OR kb.tags && filter_tags)
      AND (filter_product_id IS NULL OR kb.product_id = filter_product_id)
      AND 1 - (kb.embedding <=> query_embedding) > match_threshold * 0.8  -- slightly relaxed for fusion
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count * 3  -- fetch more for fusion
  ),
  text_results AS (
    SELECT
      kb.id,
      ts_rank_cd(kb.fts_vector, ts_query, 32) AS txt_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kb.fts_vector, ts_query, 32) DESC) AS txt_rank_pos
    FROM ai_knowledge_base kb
    WHERE
      ts_query IS NOT NULL
      AND kb.is_active = true
      AND kb.feeds_ai = true
      AND kb.fts_vector @@ ts_query
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_tags IS NULL OR kb.tags && filter_tags)
      AND (filter_product_id IS NULL OR kb.product_id = filter_product_id)
    ORDER BY ts_rank_cd(kb.fts_vector, ts_query, 32) DESC
    LIMIT match_count * 3
  ),
  fused AS (
    SELECT
      vr.id,
      vr.title,
      vr.content,
      vr.content_type,
      vr.original_url,
      vr.vec_sim,
      COALESCE(tr.txt_rank, 0) AS txt_rank,
      -- RRF formula: 1/(k+rank_vector)*weight_v + 1/(k+rank_text)*weight_t
      (vector_weight / (k_rrf + vr.vec_rank)
       + CASE WHEN tr.txt_rank_pos IS NOT NULL
              THEN text_weight / (k_rrf + tr.txt_rank_pos)
              ELSE 0 END
      ) AS rrf_score
    FROM vector_results vr
    LEFT JOIN text_results tr ON tr.id = vr.id
  )
  SELECT
    f.id,
    f.title,
    f.content,
    f.content_type,
    f.original_url,
    f.vec_sim AS similarity,
    f.txt_rank AS text_rank,
    f.rrf_score AS combined_score
  FROM fused f
  WHERE f.vec_sim > match_threshold
  ORDER BY f.rrf_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Function to increment retrieval count (for staleness tracking)
CREATE OR REPLACE FUNCTION increment_retrieval_count(doc_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE ai_knowledge_base
  SET retrieval_count = retrieval_count + 1
  WHERE id = ANY(doc_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. View for stale documents (not verified in 90 days or low usefulness)
CREATE OR REPLACE VIEW knowledge_stale_docs AS
SELECT
  kb.id,
  kb.title,
  kb.category,
  kb.updated_at,
  kb.last_verified_at,
  kb.retrieval_count,
  kb.avg_usefulness,
  EXTRACT(EPOCH FROM (now() - COALESCE(kb.last_verified_at, kb.updated_at, kb.created_at))) / 86400.0 AS days_since_verified,
  CASE
    WHEN kb.last_verified_at IS NULL AND kb.updated_at < now() - interval '60 days' THEN 'never_verified'
    WHEN kb.last_verified_at < now() - interval '90 days' THEN 'stale'
    WHEN kb.avg_usefulness < 0.3 AND kb.retrieval_count > 5 THEN 'low_usefulness'
    ELSE 'ok'
  END AS staleness_status
FROM ai_knowledge_base kb
WHERE kb.is_active = true
ORDER BY
  CASE
    WHEN kb.last_verified_at IS NULL THEN 0
    WHEN kb.last_verified_at < now() - interval '90 days' THEN 1
    WHEN kb.avg_usefulness < 0.3 AND kb.retrieval_count > 5 THEN 2
    ELSE 3
  END,
  kb.updated_at ASC;
