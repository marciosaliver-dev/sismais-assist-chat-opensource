-- Agendar check-inactive-conversations a cada 3 minutos via pg_cron + pg_net
-- Detecta conversas inativas e envia follow-ups contextuais via IA

SELECT cron.schedule(
  'check-inactive-conversations-every-3min',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/check-inactive-conversations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbXVld2VldWxlbnNseHZzeGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3OTksImV4cCI6MjA4NjQwODc5OX0.y_RJ9RJDB9d8oGiReG61s4Q_ji6xAcFK-RQepZNw0X8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
