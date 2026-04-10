-- Migration: Add RAG feedback loop - adjusted scores based on ratings
-- This enables the AI to learn which documents are helpful vs. not

-- Create function to get adjusted RAG scores considering quality ratings
CREATE OR REPLACE FUNCTION search_knowledge_with_quality(
  query_embedding JSONB,
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
  category TEXT,
  tags TEXT[],
  similarity FLOAT,
  relevance_score FLOAT,
  quality_bonus FLOAT,
  usage_count INT,
  avg_rating FLOAT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH 
    -- First get vector similarity results
    base_results AS (
      SELECT 
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        kb.tags,
        kb.embedding <=> query_embedding::vector AS distance,
        1 - (kb.embedding <=> query_embedding::vector) AS similarity,
        kb.usage_count,
        kb.updated_at
      FROM ai_knowledge_base kb
      WHERE kb.is_active = true
        AND (filter_category IS NULL OR kb.category = filter_category)
        AND (filter_tags IS NULL OR kb.tags && filter_tags)
        AND (filter_product_id IS NULL OR kb.product_id = filter_product_id)
        AND (1 - (kb.embedding <=> query_embedding::vector)) >= match_threshold
      ORDER BY kb.embedding <=> query_embedding::vector
      LIMIT match_count * 3  -- Get more to filter after quality adjustment
    ),
    -- Calculate quality bonus from ratings
    quality_scores AS (
      SELECT 
        kr.knowledge_id,
        COALESCE(AVG(kr.rating), 0) as avg_rating,
        COUNT(*) as rating_count,
        -- Documents with negative avg rating get penalised, positive get bonus
        CASE 
          WHEN AVG(kr.rating) < 0 THEN -0.15  -- Penalise bad docs
          WHEN AVG(kr.rating) > 0 THEN 0.05   -- Small bonus for good docs
          ELSE 0
        END as quality_bonus
      FROM ai_knowledge_ratings kr
      GROUP BY kr.knowledge_id
    )
    -- Final ranking with quality adjustment
    SELECT
      br.id,
      br.title,
      br.content,
      br.category,
      br.tags,
      br.similarity,
      (br.similarity + COALESCE(qs.quality_bonus, 0))::FLOAT as relevance_score,
      COALESCE(qs.quality_bonus, 0) as quality_bonus,
      COALESCE(br.usage_count, 0) as usage_count,
      COALESCE(qs.avg_rating, 0) as avg_rating,
      br.updated_at
    FROM base_results br
    LEFT JOIN quality_scores qs ON qs.knowledge_id = br.id
    ORDER BY (br.similarity + COALESCE(qs.quality_bonus, 0)) DESC
    LIMIT match_count;
END;
$$;

-- Create function to penalise low-rated documents
CREATE OR REPLACE FUNCTION penalise_knowledge_document(
  knowledge_id_param UUID,
  penalty_amount FLOAT DEFAULT -0.1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert a penalty rating
  INSERT INTO ai_knowledge_ratings (knowledge_id, rating, query_text)
  VALUES (knowledge_id_param, penalty_amount, 'auto-penalty');
END;
$$;

-- Create view for document quality dashboard
CREATE OR REPLACE VIEW knowledge_quality_report AS
SELECT 
  kb.id,
  kb.title,
  kb.category,
  kb.is_active,
  kb.usage_count,
  COALESCE(AVG(kr.rating), 0) as avg_rating,
  COUNT(kr.id) as rating_count,
  SUM(CASE WHEN kr.rating > 0 THEN 1 ELSE 0 END) as positive_ratings,
  SUM(CASE WHEN kr.rating < 0 THEN 1 ELSE 0 END) as negative_ratings,
  MAX(kr.created_at) as last_rated_at
FROM ai_knowledge_base kb
LEFT JOIN ai_knowledge_ratings kr ON kr.knowledge_id = kb.id
GROUP BY kb.id, kb.title, kb.category, kb.is_active, kb.usage_count
ORDER BY avg_rating ASC, rating_count DESC;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION search_knowledge_with_quality TO service_role;
GRANT EXECUTE ON FUNCTION penalise_knowledge_document TO service_role;
GRANT SELECT ON knowledge_quality_report TO service_role;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260214_rag_feedback_loop', 'Add RAG feedback loop with quality-adjusted scores', NOW())
ON CONFLICT DO NOTHING;
