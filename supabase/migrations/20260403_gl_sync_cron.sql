-- IMPORTANTE: Substituir SERVICE_ROLE_KEY_PLACEHOLDER pela service role key real antes de aplicar via SQL Editor

-- Migration: GL Sync Cron Jobs and Realtime
-- Configures pg_cron jobs for periodic GL sync (incremental and full) and enables Realtime
-- Requires: 20260217_pg_cron_setup

-- 1. Schedule incremental GL sync (every 5 minutes)
SELECT cron.schedule(
  'gl-sync-incremental',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-sync',
      body := '{"source": "both", "full_sync": false}'::jsonb,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
      )::jsonb
    )
  $$
);

-- 2. Schedule full GL sync (daily at 3 AM)
SELECT cron.schedule(
  'gl-sync-full-daily',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/gl-sync',
      body := '{"source": "both", "full_sync": true}'::jsonb,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
      )::jsonb
    )
  $$
);

-- 3. Enable Realtime on gl_client_licenses table
ALTER PUBLICATION supabase_realtime ADD TABLE gl_client_licenses;

-- 4. Create performance indexes on gl_client_licenses
CREATE INDEX IF NOT EXISTS idx_gl_client_licenses_synced_at
  ON gl_client_licenses (synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_gl_client_licenses_status
  ON gl_client_licenses (status_pessoa, support_eligible);

-- 5. Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260403_gl_sync_cron', 'pg_cron jobs for GL sync and Realtime on gl_client_licenses', NOW())
ON CONFLICT DO NOTHING;
