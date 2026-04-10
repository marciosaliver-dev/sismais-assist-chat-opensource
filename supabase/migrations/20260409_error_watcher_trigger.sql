-- Migration: Trigger pg_net para error-watcher (Onda 6D)
--
-- Dispara a edge function error-watcher automaticamente via pg_net
-- quando um erro (success=false) é inserido em pipeline_metrics.
-- Substitui a necessidade de configurar Database Webhook manualmente.
--
-- Pré-requisitos:
--   1. Extensão pg_net habilitada (já está)
--   2. Edge function error-watcher deployada
--   3. Secret GITHUB_PAT_ERROR_WATCHER configurado no Supabase
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_error_watcher ON pipeline_metrics;
--   DROP FUNCTION IF EXISTS notify_error_watcher();

CREATE OR REPLACE FUNCTION notify_error_watcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só dispara para erros (success = false)
  IF NEW.success = false THEN
    PERFORM net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/error-watcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbXVld2VldWxlbnNseHZzeGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzI3OTksImV4cCI6MjA4NjQwODc5OX0.y_RJ9RJDB9d8oGiReG61s4Q_ji6xAcFK-RQepZNw0X8'
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'edge_function', NEW.edge_function,
          'event_type', NEW.event_type,
          'error_message', NEW.error_message,
          'request_id', NEW.request_id,
          'latency_ms', NEW.latency_ms,
          'success', NEW.success
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_error_watcher ON pipeline_metrics;
CREATE TRIGGER trg_error_watcher
  AFTER INSERT ON pipeline_metrics
  FOR EACH ROW
  EXECUTE FUNCTION notify_error_watcher();
