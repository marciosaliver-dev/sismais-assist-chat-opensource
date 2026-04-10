-- =============================================================================
-- API Publica — Tabelas de API Keys e Webhooks de Saida
-- =============================================================================

-- Tabela de API keys para terceiros
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- Hash SHA-256 da key (nunca armazenar a key em texto plano)
  key_hash text NOT NULL UNIQUE,
  -- Prefixo visivel para identificacao (ex: "sk_live_abc...")
  key_prefix text NOT NULL,
  -- Scopes de permissao (array de strings)
  scopes text[] NOT NULL DEFAULT '{}',
  -- Rate limit: requests por minuto
  rate_limit_rpm integer NOT NULL DEFAULT 60,
  -- Rate limit: requests por dia
  rate_limit_rpd integer NOT NULL DEFAULT 10000,
  -- Plano associado
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  -- Metadados do integrador
  organization_name text,
  contact_email text,
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  -- Expiracao opcional
  expires_at timestamptz,
  last_used_at timestamptz,
  request_count bigint NOT NULL DEFAULT 0,
  -- Audit
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Indice para lookup rapido por hash
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_active ON api_keys (is_active) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode acessar (edge functions usam service_role)
-- Admins podem ler via frontend com policy especifica
CREATE POLICY "admins_manage_api_keys" ON api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.is_approved = true
    )
  );

-- Tabela de rate limiting (janela deslizante)
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  window_type text NOT NULL CHECK (window_type IN ('minute', 'day')),
  UNIQUE (api_key_id, window_type, window_start)
);

CREATE INDEX idx_api_rate_limits_lookup ON api_rate_limits (api_key_id, window_type, window_start);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
-- Apenas service_role acessa

-- Tabela de webhooks de saida
CREATE TABLE IF NOT EXISTS api_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  -- URL destino do webhook
  url text NOT NULL,
  -- Eventos que disparam este webhook
  events text[] NOT NULL DEFAULT '{}',
  -- Secret para assinatura HMAC-SHA256
  secret text NOT NULL,
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  -- Metadados de entrega
  last_triggered_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  -- Desativar automaticamente apos N falhas consecutivas
  max_failures integer NOT NULL DEFAULT 10,
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_webhooks_events ON api_webhooks USING gin (events);
CREATE INDEX idx_api_webhooks_active ON api_webhooks (is_active) WHERE is_active = true;

ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;

-- Log de entregas de webhook
CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES api_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  duration_ms integer,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_webhook_deliveries_webhook ON api_webhook_deliveries (webhook_id, created_at DESC);

ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Funcao atomica para incrementar request_count na api_keys
CREATE OR REPLACE FUNCTION increment_api_key_usage(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE api_keys
  SET request_count = request_count + 1,
      last_used_at = now()
  WHERE id = p_key_id;
END;
$$;

-- Funcao para check e increment rate limit (retorna true se permitido)
CREATE OR REPLACE FUNCTION check_api_rate_limit(
  p_key_id uuid,
  p_window_type text,
  p_max_requests integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  -- Calcular inicio da janela
  IF p_window_type = 'minute' THEN
    v_window_start := date_trunc('minute', now());
  ELSE
    v_window_start := date_trunc('day', now());
  END IF;

  -- Upsert com incremento atomico
  INSERT INTO api_rate_limits (api_key_id, window_type, window_start, request_count)
  VALUES (p_key_id, p_window_type, v_window_start, 1)
  ON CONFLICT (api_key_id, window_type, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

-- Cleanup de rate limits antigos (rodar via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_api_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM api_rate_limits WHERE window_start < now() - interval '2 days';
  DELETE FROM api_webhook_deliveries WHERE created_at < now() - interval '30 days';
$$;
