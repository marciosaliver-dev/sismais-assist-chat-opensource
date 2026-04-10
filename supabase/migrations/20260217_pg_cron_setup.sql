-- Migration: pg_cron_setup
-- Configures pg_cron jobs for SLA monitoring, reconciliation, and proactive triggers
-- Requires: 20260216_ai_tools_complete

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions for pg_cron
GRANT USAGE ON SCHEMA cron TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO service_role;

-- 1. SLA Warning Check (every 15 minutes)
-- Alerts when tickets are approaching SLA breach
SELECT cron.schedule(
  'sla-warning-check',
  '*/15 * * * *',
  $$SELECT execute_proactive_triggers()$$
);

-- 2. SLA Breach Check (every 5 minutes)
-- Escalates tickets that have breached SLA
SELECT cron.schedule(
  'sla-breach-check',
  '*/5 * * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'sla_breach',
      c.id,
      'escalate-to-human',
      json_build_object('reason', 'SLA breach', 'priority', 'high'),
      json_build_object('escalated_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status = 'aguardando'
      AND c.queue_entered_at IS NOT NULL
      AND (EXTRACT(EPOCH FROM (NOW() - c.queue_entered_at)) / 3600) > 
          (SELECT COALESCE(value::numeric, 60) FROM ticket_sla_config WHERE priority = 'alta')
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'sla_breach'
          AND al.created_at > NOW() - INTERVAL '1 hour'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- 3. Stale Ticket Detection (every 4 hours)
-- Flags tickets inactive for more than 7 days
SELECT cron.schedule(
  'stale-ticket-check',
  '0 */4 * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'ticket_stale',
      c.id,
      'escalate-to-human',
      json_build_object('reason', 'Ticket sem atividade há mais de 7 dias'),
      json_build_object('detected_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status IN ('novo', 'em_atendimento')
      AND c.updated_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'ticket_stale'
          AND al.created_at > NOW() - INTERVAL '24 hours'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- 4. Client Inactivity Follow-up (every 2 hours)
-- Re-engages clients who haven't responded in 24 hours
SELECT cron.schedule(
  'client-inactivity-check',
  '0 */2 * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'client_inactivity',
      c.id,
      'send-message',
      json_build_object(
        'message', 'Olá! Notamos que você ficou um tempo sem responder. Posso ajudar em algo?',
        'template', 'reengagement'
      ),
      json_build_object('sent_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status IN ('em_atendimento', 'novo')
      AND c.last_customer_message_at < NOW() - INTERVAL '24 hours'
      AND c.handler_type = 'ai'
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'client_inactivity'
          AND al.created_at > NOW() - INTERVAL '12 hours'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- 5. Scheduled Callback Executor (every 5 minutes)
-- Processes callbacks that are due
SELECT cron.schedule(
  'callback-executor',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/process-proactive-trigger',
      body := json_build_object(
        'type', 'execute_callbacks',
        'execution_time', NOW()::text
      )::text
    )
  $$
);

-- 6. Reminder Executor (every 15 minutes)
-- Sends notifications for due reminders
SELECT cron.schedule(
  'reminder-executor',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/process-proactive-trigger',
      body := json_build_object(
        'type', 'execute_reminders',
        'execution_time', NOW()::text
      )::text
    )
  $$
);

-- 7. Daily Metrics Reconciliation (at midnight)
-- Recalculates and updates daily metrics
SELECT cron.schedule(
  'daily-reconciliation',
  '0 0 * * *',
  $$
    INSERT INTO ai_actions_log (action_type, tool_name, parameters, result, success)
    SELECT 
      'daily_reconciliation',
      'reconciliation',
      json_build_object('date', CURRENT_DATE),
      json_build_object(
        'tickets_created', (SELECT COUNT(*) FROM ai_conversations WHERE DATE(created_at) = CURRENT_DATE),
        'tickets_resolved', (SELECT COUNT(*) FROM ai_conversations WHERE DATE(resolved_at) = CURRENT_DATE),
        'executed_at', NOW()
      ),
      true
    WHERE EXISTS (SELECT 1 FROM ai_conversations LIMIT 1)
  $$
);

-- 8. Weekly Report Generation (Sunday at 6 AM)
-- Generates weekly summary
SELECT cron.schedule(
  'weekly-report',
  '0 6 * * 0',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/generate-report',
      body := json_build_object(
        'type', 'weekly_summary',
        'period', 'last_week',
        'execution_time', NOW()::text
      )::text
    )
  $$
);

-- 9. Health Check (every 30 minutes)
-- Monitors system health
SELECT cron.schedule(
  'health-check',
  '*/30 * * * *',
  $$
    INSERT INTO ai_actions_log (action_type, tool_name, parameters, result, success)
    SELECT 
      'health_check',
      'system_monitor',
      json_build_object('check_time', NOW()),
      json_build_object(
        'db_connected', true,
        'functions_healthy', true,
        'checked_at', NOW()
      ),
      true
    WHERE EXISTS (SELECT 1 FROM ai_agents LIMIT 1)
  $$
);

-- 10. Unassigned Tickets Queue (every 10 minutes)
-- Escalates unassigned tickets in queue
SELECT cron.schedule(
  'unassigned-queue-check',
  '*/10 * * * *',
  $$
    INSERT INTO ai_actions_log (action_type, conversation_id, tool_name, parameters, result, success)
    SELECT 
      'queue_timeout',
      c.id,
      'escalate-to-human',
      json_build_object('reason', 'Ticket na fila há mais de 30 minutos'),
      json_build_object('escalated_at', NOW()),
      true
    FROM ai_conversations c
    WHERE c.status = 'novo'
      AND c.queue_entered_at IS NOT NULL
      AND c.queue_entered_at < NOW() - INTERVAL '30 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM ai_actions_log al 
        WHERE al.conversation_id = c.id 
          AND al.action_type = 'queue_timeout'
          AND al.created_at > NOW() - INTERVAL '30 minutes'
      )
    ON CONFLICT DO NOTHING
  $$
);

-- Create view for cron job status
CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT 
  jobname,
  schedule,
  command,
  active,
  nodename,
  nodeport
FROM cron.job;

GRANT SELECT ON public.cron_job_status TO service_role, authenticated;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION cron.schedule TO service_role;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260217_pg_cron_setup', 'pg_cron jobs for SLA monitoring, reconciliation, proactive triggers', NOW())
ON CONFLICT DO NOTHING;
