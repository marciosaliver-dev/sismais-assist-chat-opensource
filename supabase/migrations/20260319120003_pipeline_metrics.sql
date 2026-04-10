-- Pipeline Metrics — Instrumentacao basica para validar estabilidade do pipeline
-- Fase 1: latencia ponta-a-ponta, contagem de mensagens, taxa de erro

CREATE TABLE IF NOT EXISTS pipeline_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Identificacao
  request_id text,                     -- correlation ID entre edge functions
  edge_function text NOT NULL,         -- nome da edge function (uazapi-webhook, agent-executor, etc.)
  conversation_id uuid,                -- FK logica para ai_conversations

  -- Tipo de evento
  event_type text NOT NULL,            -- 'webhook_received', 'ai_reply_sent', 'ai_reply_error', 'pipeline_complete', etc.

  -- Metricas de latencia (ms)
  latency_ms integer,                  -- tempo total da edge function
  webhook_to_reply_ms integer,         -- latencia ponta-a-ponta (webhook recebido ate resposta enviada)

  -- Resultado
  success boolean NOT NULL DEFAULT true,
  error_message text,
  error_code text,

  -- Metadados
  metadata jsonb DEFAULT '{}'::jsonb   -- dados adicionais (model, tokens, confidence, etc.)
);

-- Indices para queries de validacao
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_created_at ON pipeline_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_edge_function ON pipeline_metrics (edge_function, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_event_type ON pipeline_metrics (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_success ON pipeline_metrics (success, created_at DESC) WHERE success = false;

-- RLS: apenas service role pode inserir/ler (edge functions usam service role)
ALTER TABLE pipeline_metrics ENABLE ROW LEVEL SECURITY;

-- Politica para leitura via dashboard (usuarios autenticados)
CREATE POLICY "authenticated_read_pipeline_metrics" ON pipeline_metrics
  FOR SELECT TO authenticated USING (true);

-- Funcao para limpeza automatica (manter apenas 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_pipeline_metrics()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM pipeline_metrics WHERE created_at < now() - interval '30 days';
$$;

COMMENT ON TABLE pipeline_metrics IS 'Metricas de instrumentacao do pipeline de mensagens. Fase 1 analytics.';
