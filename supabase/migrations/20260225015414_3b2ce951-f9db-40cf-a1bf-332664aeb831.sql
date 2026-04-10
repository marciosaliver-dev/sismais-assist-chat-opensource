ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS id_contrato text;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS id_fatura text;
CREATE INDEX IF NOT EXISTS idx_conv_id_fatura ON ai_conversations(id_fatura);
CREATE INDEX IF NOT EXISTS idx_conv_id_contrato ON ai_conversations(id_contrato);