CREATE TABLE IF NOT EXISTS customer_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'incremental',
  total_processed integer DEFAULT 0,
  total_created integer DEFAULT 0,
  total_updated integer DEFAULT 0,
  total_errors integer DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  duration_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  source text DEFAULT 'sismais-admin'
);

ALTER TABLE customer_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs" ON customer_sync_log
  FOR SELECT USING (true);

CREATE INDEX idx_sync_log_created ON customer_sync_log(created_at DESC);
