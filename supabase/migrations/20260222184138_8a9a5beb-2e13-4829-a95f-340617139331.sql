-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule SLA alert check every minute
SELECT cron.schedule(
  'sla-alert-check-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/sla-alert-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbXVld2VldWxlbnNseHZzeGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3OTksImV4cCI6MjA4NjQwODc5OX0.y_RJ9RJDB9d8oGiReG61s4Q_ji6xAcFK-RQepZNw0X8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);