-- ============================================================
-- Migration: kb_versioning_analytics_workflow
-- Adds versioning, analytics, and approval workflow to knowledge base
-- Following best practices from Helpjuice, Zendesk, Notion
-- ============================================================

-- 1. Add workflow status column
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT 'draft' 
    CHECK (workflow_status IN ('draft', 'pending_review', 'published', 'archived', 'deprecated'));

ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

-- 2. Create versioning table
CREATE TABLE IF NOT EXISTS ai_knowledge_base_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES ai_knowledge_base(id) ON DELETE CASCADE,
  title_snapshot TEXT NOT NULL,
  content_snapshot TEXT NOT NULL,
  category_snapshot TEXT,
  tags_snapshot TEXT[],
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_summary TEXT,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_document ON ai_knowledge_base_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_versions_created ON ai_knowledge_base_versions(created_at DESC);

-- 3. Create analytics table
CREATE TABLE IF NOT EXISTS ai_knowledge_base_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES ai_knowledge_base(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'search', 'helpful', 'not_helpful', 'copy', 'share', 'print')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID,
  source TEXT CHECK (source IN ('widget', 'agent', 'internal', 'api', 'search')),
  search_query TEXT,
  referrer_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_analytics_document ON ai_knowledge_base_analytics(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_created ON ai_knowledge_base_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_event ON ai_knowledge_base_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_session ON ai_knowledge_base_analytics(session_id);

-- 4. Create approvals workflow table
CREATE TABLE IF NOT EXISTS knowledge_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES ai_knowledge_base(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  comments TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kb_approvals_document ON knowledge_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_approvals_status ON knowledge_approvals(status);
CREATE INDEX IF NOT EXISTS idx_kb_approvals_requested ON knowledge_approvals(requested_by);

-- 5. Create saved searches table
CREATE TABLE IF NOT EXISTS knowledge_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_saved_searches_user ON knowledge_saved_searches(user_id);

-- 6. Create comments table for collaboration
CREATE TABLE IF NOT EXISTS knowledge_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES ai_knowledge_base(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES knowledge_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[],
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kb_comments_document ON knowledge_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_comments_parent ON knowledge_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_kb_comments_created ON knowledge_comments(created_at DESC);

-- 7. Enable RLS on new tables
ALTER TABLE ai_knowledge_base_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_comments ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for versions
CREATE POLICY "kb_versions_select" ON ai_knowledge_base_versions 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_versions_insert" ON ai_knowledge_base_versions 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "kb_versions_update" ON ai_knowledge_base_versions 
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "kb_versions_delete" ON ai_knowledge_base_versions 
  FOR DELETE TO authenticated USING (true);

-- 9. RLS policies for analytics
CREATE POLICY "kb_analytics_select" ON ai_knowledge_base_analytics 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_analytics_insert" ON ai_knowledge_base_analytics 
  FOR INSERT TO authenticated WITH CHECK (true);

-- 10. RLS policies for approvals
CREATE POLICY "kb_approvals_select" ON knowledge_approvals 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_approvals_insert" ON knowledge_approvals 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "kb_approvals_update" ON knowledge_approvals
  FOR UPDATE TO authenticated USING (auth.uid() != requested_by);

-- 11. RLS policies for saved searches
CREATE POLICY "kb_saved_searches_select" ON knowledge_saved_searches 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_saved_searches_insert" ON knowledge_saved_searches 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kb_saved_searches_update" ON knowledge_saved_searches 
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "kb_saved_searches_delete" ON knowledge_saved_searches 
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 12. RLS policies for comments
CREATE POLICY "kb_comments_select" ON knowledge_comments 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb_comments_insert" ON knowledge_comments 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kb_comments_update" ON knowledge_comments 
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "kb_comments_delete" ON knowledge_comments 
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 13. Create function to record version on update
CREATE OR REPLACE FUNCTION public.record_knowledge_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_version INTEGER;
BEGIN
  -- Only create version if content changed
  IF OLD.content = NEW.content AND OLD.title = NEW.title THEN
    RETURN NEW;
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM ai_knowledge_base_versions WHERE document_id = NEW.id;

  -- Insert version snapshot
  INSERT INTO ai_knowledge_base_versions (
    document_id,
    title_snapshot,
    content_snapshot,
    category_snapshot,
    tags_snapshot,
    changed_by,
    change_summary,
    version_number
  ) VALUES (
    NEW.id,
    OLD.title,
    OLD.content,
    OLD.category,
    OLD.tags,
    auth.uid(),
    CASE 
      WHEN OLD.title != NEW.title AND OLD.content != NEW.content THEN 'Title and content updated'
      WHEN OLD.title != NEW.title THEN 'Title updated'
      ELSE 'Content updated'
    END,
    v_next_version
  );

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_record_knowledge_version
  BEFORE UPDATE ON ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.record_knowledge_version();

-- 14. Create function to track analytics
CREATE OR REPLACE FUNCTION public.track_knowledge_event(
  p_document_id UUID,
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'internal',
  p_search_query TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ai_knowledge_base_analytics (
    document_id,
    event_type,
    user_id,
    session_id,
    source,
    search_query
  ) VALUES (
    p_document_id,
    p_event_type,
    COALESCE(p_user_id, auth.uid()),
    p_session_id,
    p_source,
    p_search_query
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_knowledge_event TO authenticated;

-- 15. Comments
COMMENT ON COLUMN ai_knowledge_base.workflow_status IS 'Workflow: draft->pending_review->published->archived';
COMMENT ON TABLE ai_knowledge_base_versions IS 'Version history for knowledge documents';
COMMENT ON TABLE ai_knowledge_base_analytics IS 'Analytics events for knowledge documents';
COMMENT ON TABLE knowledge_approvals IS 'Approval workflow for document publishing';
COMMENT ON TABLE knowledge_comments IS 'Comments and collaboration on documents';

-- Rollback:
-- DROP TRIGGER IF EXISTS trg_record_knowledge_version ON ai_knowledge_base;
-- DROP FUNCTION IF EXISTS public.record_knowledge_version;
-- DROP FUNCTION IF EXISTS public.track_knowledge_event;
-- DROP TABLE IF EXISTS ai_knowledge_base_versions CASCADE;
-- DROP TABLE IF EXISTS ai_knowledge_base_analytics CASCADE;
-- DROP TABLE IF EXISTS knowledge_approvals CASCADE;
-- DROP TABLE IF EXISTS knowledge_saved_searches CASCADE;
-- DROP TABLE IF EXISTS knowledge_comments CASCADE;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS workflow_status;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS published_at;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS published_by;
