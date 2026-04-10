-- Adiciona coluna last_source_updated_at para rastrear o max dt_atualizacao da fonte MySQL
ALTER TABLE customer_sync_log
ADD COLUMN IF NOT EXISTS last_source_updated_at timestamptz;

-- Indice para busca rapida do ultimo sync por fonte
CREATE INDEX IF NOT EXISTS idx_customer_sync_log_source_created
ON customer_sync_log (source, created_at DESC);
