-- ============================================================
-- Migration: Knowledge Products & Groups
-- Adds hierarchical organization: Product > Group > Document
-- ============================================================

-- 1. Create knowledge_products table
CREATE TABLE IF NOT EXISTS knowledge_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Package',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create knowledge_groups table
CREATE TABLE IF NOT EXISTS knowledge_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES knowledge_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'FolderOpen',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add product_id and group_id to ai_knowledge_base
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES knowledge_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES knowledge_groups(id) ON DELETE SET NULL;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_groups_product ON knowledge_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_product ON ai_knowledge_base(product_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_group ON ai_knowledge_base(group_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_products_slug ON knowledge_products(slug);

-- 5. Seed initial products
INSERT INTO knowledge_products (name, slug, description, icon, color, sort_order) VALUES
  ('Mais Simples', 'mais-simples', 'Sistema Mais Simples - Gestão simplificada', 'Zap', '#10b981', 1),
  ('MaxPro', 'maxpro', 'Sistema MaxPro - Gestão avançada', 'Rocket', '#6366f1', 2)
ON CONFLICT (slug) DO NOTHING;

-- 6. Enable RLS
ALTER TABLE knowledge_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_groups ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "knowledge_products_select" ON knowledge_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_products_all" ON knowledge_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "knowledge_groups_select" ON knowledge_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_groups_all" ON knowledge_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "knowledge_products_service" ON knowledge_products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "knowledge_groups_service" ON knowledge_groups FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Update search_knowledge RPC to support product filtering
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
    AND (filter_category IS NULL OR kb.category = filter_category)
    AND (filter_tags IS NULL OR kb.tags && filter_tags)
    AND (filter_product_id IS NULL OR kb.product_id = filter_product_id)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Updated_at trigger for knowledge_products
CREATE OR REPLACE FUNCTION update_knowledge_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_products_updated_at
  BEFORE UPDATE ON knowledge_products
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_products_updated_at();

CREATE TRIGGER trigger_knowledge_groups_updated_at
  BEFORE UPDATE ON knowledge_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_products_updated_at();
