-- ============================================================
-- Migration: kb_hierarchy_expansion
-- Adds multi-level hierarchy support: Products > Submenus > Documents
-- Supports nested menus (unlimited depth via parent_id)
-- ============================================================

-- 1. Add parent_id to knowledge_products for nested products
ALTER TABLE knowledge_products
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES knowledge_products(id) ON DELETE SET NULL;

ALTER TABLE knowledge_products
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Folder',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Add parent_id to knowledge_groups for nested submenus
ALTER TABLE knowledge_groups
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES knowledge_groups(id) ON DELETE SET NULL;

ALTER TABLE knowledge_groups
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'FolderOpen',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Add hierarchy fields to ai_knowledge_base
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES ai_knowledge_base(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4. Create indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_knowledge_products_parent ON knowledge_products(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_groups_parent ON knowledge_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_parent ON ai_knowledge_base(parent_id);

-- 5. Create function to get full hierarchy path
CREATE OR REPLACE FUNCTION public.get_knowledge_path(
  p_id UUID,
  p_table TEXT
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path TEXT[] := ARRAY[]::TEXT[];
  v_current_id UUID := p_id;
  v_parent_id UUID;
  v_name TEXT;
  v_table_name TEXT;
  v_depth INTEGER := 0;
BEGIN
  v_table_name := COALESCE(p_table, 'knowledge_groups');
  WHILE v_current_id IS NOT NULL LOOP
    v_depth := v_depth + 1;
    EXIT WHEN v_depth > 20;
    IF v_table_name = 'knowledge_groups' THEN
      SELECT name, parent_id INTO v_name, v_parent_id 
      FROM knowledge_groups WHERE id = v_current_id;
    ELSIF v_table_name = 'knowledge_products' THEN
      SELECT name, parent_id INTO v_name, v_parent_id 
      FROM knowledge_products WHERE id = v_current_id;
    ELSE
      SELECT title, parent_id INTO v_name, v_parent_id 
      FROM ai_knowledge_base WHERE id = v_current_id;
    END IF;
    
    IF v_name IS NULL THEN
      EXIT;
    END IF;
    
    v_path := ARRAY[v_name] || v_path;
    v_current_id := v_parent_id;
  END LOOP;

  RETURN v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_knowledge_path TO authenticated;

-- 6. Add metadata columns to ai_knowledge_base
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS estimated_read_time INTEGER,
  ADD COLUMN IF NOT EXISTS article_template TEXT,
  ADD COLUMN IF NOT EXISTS audience_tier TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS rag_chunks INTEGER DEFAULT 0;

-- 7. Update comments
COMMENT ON COLUMN knowledge_products.parent_id IS 'Parent product for nested hierarchy';
COMMENT ON COLUMN knowledge_groups.parent_id IS 'Parent group for nested submenus';
COMMENT ON COLUMN ai_knowledge_base.parent_id IS 'Parent document for nested articles';
COMMENT ON COLUMN ai_knowledge_base.visibility IS 'public=visivel clientes, internal=apenas agentes, draft=rascunho';
COMMENT ON COLUMN ai_knowledge_base.estimated_read_time IS 'Tempo estimado de leitura em minutos';
COMMENT ON COLUMN ai_knowledge_base.article_template IS 'Template: how-to, faq, troubleshooting, tutorial, internal, release-notes';
COMMENT ON COLUMN ai_knowledge_base.audience_tier IS 'Público alvo: beginner, intermediate, advanced, admin';

-- 8. Create partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_kb_visibility_public ON ai_knowledge_base(visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_kb_visibility_internal ON ai_knowledge_base(visibility) WHERE visibility = 'internal';
CREATE INDEX IF NOT EXISTS idx_kb_article_template ON ai_knowledge_base(article_template) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_audience_tier ON ai_knowledge_base(audience_tier) WHERE is_active = true;

-- Rollback: 
-- DROP INDEX IF EXISTS idx_knowledge_products_parent ON knowledge_products;
-- DROP INDEX IF EXISTS idx_knowledge_groups_parent ON knowledge_groups;
-- DROP INDEX IF EXISTS idx_ai_knowledge_base_parent ON ai_knowledge_base;
-- ALTER TABLE knowledge_products DROP COLUMN IF EXISTS parent_id;
-- ALTER TABLE knowledge_groups DROP COLUMN IF EXISTS parent_id;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS parent_id;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS estimated_read_time;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS last_reviewed_at;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS next_review_at;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS article_template;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS audience_tier;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS visibility;
-- ALTER TABLE ai_knowledge_base DROP COLUMN IF EXISTS rag_chunks;
-- DROP FUNCTION IF EXISTS public.get_knowledge_path;
