
-- Função para incrementar votos na knowledge base
CREATE OR REPLACE FUNCTION public.increment_vote(
  doc_id UUID,
  vote_field TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF vote_field = 'helpful_count' THEN
    UPDATE ai_knowledge_base
    SET helpful_count = COALESCE(helpful_count, 0) + 1
    WHERE id = doc_id;
  ELSIF vote_field = 'not_helpful_count' THEN
    UPDATE ai_knowledge_base
    SET not_helpful_count = COALESCE(not_helpful_count, 0) + 1
    WHERE id = doc_id;
  ELSE
    RAISE EXCEPTION 'Invalid vote_field: %', vote_field;
  END IF;
END;
$$;
