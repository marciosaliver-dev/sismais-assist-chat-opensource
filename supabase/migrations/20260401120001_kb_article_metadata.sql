-- ============================================================
-- Migration: Metadados de artigo KB para 6 templates
-- ============================================================

ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS estimated_time TEXT,
  ADD COLUMN IF NOT EXISTS audience_tier TEXT CHECK (audience_tier IN ('tier1', 'tier2', 'tier3')),
  ADD COLUMN IF NOT EXISTS rag_chunks BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'draft')),
  ADD COLUMN IF NOT EXISTS article_template TEXT CHECK (article_template IN ('how-to', 'faq', 'troubleshooting', 'tutorial', 'internal-procedure', 'release-notes')),
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

CREATE INDEX IF NOT EXISTS idx_kb_article_template ON ai_knowledge_base(article_template) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_audience_tier ON ai_knowledge_base(audience_tier) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_visibility ON ai_knowledge_base(visibility) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_stale_detection ON ai_knowledge_base(last_reviewed_at) WHERE is_active = true;

COMMENT ON COLUMN ai_knowledge_base.rag_chunks IS 'Se false, artigo nao gera embeddings (ex: procedimentos internos)';
COMMENT ON COLUMN ai_knowledge_base.article_template IS 'Template: how-to, faq, troubleshooting, tutorial, internal-procedure, release-notes';
COMMENT ON COLUMN ai_knowledge_base.visibility IS 'public=visivel para clientes, internal=apenas agentes, draft=rascunho';
