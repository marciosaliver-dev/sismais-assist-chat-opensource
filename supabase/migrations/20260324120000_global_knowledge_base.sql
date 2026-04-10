-- Adiciona flag de conhecimento global para centralizar KB entre agentes
ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT true;

-- Documentos que já alimentam IA ficam marcados como globais
UPDATE ai_knowledge_base SET is_global = true WHERE feeds_ai = true AND is_global IS NULL;

-- Índice para filtros de busca
CREATE INDEX IF NOT EXISTS idx_knowledge_base_global ON ai_knowledge_base (is_global) WHERE is_active = true;

-- Comentário
COMMENT ON COLUMN ai_knowledge_base.is_global IS 'Se true, documento é acessível por todos os agentes automaticamente via RAG';
