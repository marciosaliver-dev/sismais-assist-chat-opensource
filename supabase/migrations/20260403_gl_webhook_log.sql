-- Migration: gl_webhook_log
-- Tabela de auditoria para webhooks recebidos do GL

CREATE TABLE IF NOT EXISTS gl_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  gl_id integer NOT NULL,
  source_system text NOT NULL,
  status_pessoa text,
  previous_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_method text,
  success boolean DEFAULT true,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gl_webhook_log_gl_id ON gl_webhook_log (gl_id, source_system);
CREATE INDEX idx_gl_webhook_log_received ON gl_webhook_log (received_at DESC);

ALTER TABLE gl_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON gl_webhook_log
  FOR ALL USING (auth.role() = 'service_role');

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260403_gl_webhook_log', 'GL webhook audit log table', NOW())
ON CONFLICT DO NOTHING;
