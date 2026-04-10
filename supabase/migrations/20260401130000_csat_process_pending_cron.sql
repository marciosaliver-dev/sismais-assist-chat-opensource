-- Cron job: processa surveys CSAT pendentes a cada 5 minutos
-- Envia surveys delayed, faz resend, e expira surveys sem resposta
SELECT cron.schedule(
  'csat-process-pending-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/csat-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbXVld2VldWxlbnNseHZzeGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3OTksImV4cCI6MjA4NjQwODc5OX0.y_RJ9RJDB9d8oGiReG61s4Q_ji6xAcFK-RQepZNw0X8"}'::jsonb,
    body := '{"action": "process-pending"}'::jsonb
  ) AS request_id;
  $$
);

-- Cron job: re-avalia tickets finalizados que ficaram sem avaliação IA
-- Roda a cada 15 minutos, busca tickets recentes sem entrada em ai_service_evaluations
SELECT cron.schedule(
  'evaluate-orphan-tickets-every-15min',
  '*/15 * * * *',
  $$
  WITH orphans AS (
    SELECT c.id
    FROM ai_conversations c
    LEFT JOIN ai_service_evaluations e ON e.conversation_id = c.id
    WHERE c.status = 'finalizado'
      AND c.resolved_at > now() - interval '24 hours'
      AND e.id IS NULL
    LIMIT 10
  )
  SELECT net.http_post(
    url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/evaluate-service',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbXVld2VldWxlbnNseHZzeGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3OTksImV4cCI6MjA4NjQwODc5OX0.y_RJ9RJDB9d8oGiReG61s4Q_ji6xAcFK-RQepZNw0X8"}'::jsonb,
    body := format('{"conversation_id": "%s"}', o.id)::jsonb
  ) AS request_id
  FROM orphans o;
  $$
);
