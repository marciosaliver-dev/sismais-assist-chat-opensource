-- Company Knowledge Sources — central repository for company data
CREATE TABLE IF NOT EXISTS company_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'image', 'docx', 'website', 'social', 'confluence', 'zoho')),
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'error')),
  chunks_count INT DEFAULT 0,
  pages_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_frequency TEXT CHECK (sync_frequency IS NULL OR sync_frequency IN ('daily', 'weekly', 'monthly')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add source_id to knowledge base for linking
ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES company_knowledge_sources(id) ON DELETE SET NULL;

-- Add knowledge_sources to agents for selection
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS knowledge_sources JSONB DEFAULT '[]';

-- RLS
ALTER TABLE company_knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sources" ON company_knowledge_sources FOR SELECT USING (true);
CREATE POLICY "Users can insert sources" ON company_knowledge_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sources" ON company_knowledge_sources FOR UPDATE USING (true);
CREATE POLICY "Users can delete sources" ON company_knowledge_sources FOR DELETE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_knowledge_sources_type ON company_knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_source_id ON ai_knowledge_base(source_id);
