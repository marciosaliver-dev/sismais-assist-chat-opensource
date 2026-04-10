-- ============================================================
-- Migration: Tabela de log do sync RAG
-- ============================================================

CREATE TABLE IF NOT EXISTS kb_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES ai_knowledge_base(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('embed_created', 'embed_updated', 'embed_deleted', 'embed_failed', 'stale_detected', 'chunk_created')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'retry')),
  error_message TEXT,
  chunks_processed INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_sync_log_article ON kb_sync_log(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_sync_log_status ON kb_sync_log(status) WHERE status = 'error';
CREATE INDEX IF NOT EXISTS idx_kb_sync_log_created ON kb_sync_log(created_at);

ALTER TABLE kb_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_sync_log_service" ON kb_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "kb_sync_log_read" ON kb_sync_log FOR SELECT TO authenticated USING (true);

-- Funcao para detectar artigos sem embedding
CREATE OR REPLACE FUNCTION detect_missing_embeddings()
RETURNS TABLE (article_id UUID, title TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT kb.id, kb.title
  FROM ai_knowledge_base kb
  WHERE kb.is_active = true
    AND kb.embedding IS NULL
    AND COALESCE(kb.rag_chunks, true) = true
    AND kb.content IS NOT NULL
    AND length(kb.content) > 50
  ORDER BY kb.updated_at DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
