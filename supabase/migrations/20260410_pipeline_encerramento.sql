-- supabase/migrations/20260410_pipeline_encerramento.sql
-- Pipeline de Encerramento e Classificação de Tickets

-- 1. Campos de classificação enriquecida na conversa
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS problem_summary TEXT,
  ADD COLUMN IF NOT EXISTS solution_summary TEXT,
  ADD COLUMN IF NOT EXISTS classification_version INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_ticket_id UUID REFERENCES ai_conversations(id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_parent_ticket
  ON ai_conversations(parent_ticket_id) WHERE parent_ticket_id IS NOT NULL;

-- 2. Tabela de auditoria CSAT
CREATE TABLE IF NOT EXISTS csat_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  config_id UUID,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csat_send_log_conversation ON csat_send_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_csat_send_log_created ON csat_send_log(created_at DESC);

-- 3. Cron de reconciliação CSAT (a cada 5 minutos)
SELECT cron.unschedule('csat-reconcile-missed') FROM cron.job WHERE jobname = 'csat-reconcile-missed';

SELECT cron.schedule(
  'csat-reconcile-missed',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/csat-processor',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := '{"action": "reconcile-missed"}'::jsonb
    )
  $$
);
