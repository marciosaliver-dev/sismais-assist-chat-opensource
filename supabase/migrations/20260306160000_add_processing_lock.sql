-- ============================================================
-- conversation_processing_lock
-- Semáforo de processamento por conversa.
-- Garante que apenas UM executor processa cada mensagem,
-- eliminando o risco de respostas duplicadas ao cliente.
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_processing_lock (
  conversation_id UUID PRIMARY KEY REFERENCES ai_conversations(id) ON DELETE CASCADE,
  locked_by       TEXT        NOT NULL,    -- 'flow:{flow_id}', 'agent:{agent_id}', 'orchestrator'
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,    -- NOW() + 30s — timeout automático
  message_id      TEXT                     -- message_id que gerou o lock (para debug)
);

-- Índice para limpeza automática de locks expirados
CREATE INDEX IF NOT EXISTS idx_processing_lock_expires
  ON conversation_processing_lock(expires_at);

-- ============================================================
-- acquire_processing_lock(conversation_id, locked_by, message_id)
-- Tenta adquirir o lock de processamento para uma conversa.
-- Retorna TRUE se conseguiu, FALSE se já existe lock válido.
-- Limpa automaticamente locks expirados antes de tentar.
-- ============================================================
CREATE OR REPLACE FUNCTION acquire_processing_lock(
  p_conversation_id UUID,
  p_locked_by       TEXT,
  p_message_id      TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Limpar locks expirados para esta conversa
  DELETE FROM conversation_processing_lock
  WHERE conversation_id = p_conversation_id
    AND expires_at < NOW();

  -- 2. Tentar inserir o lock (falha silenciosamente se já existe)
  INSERT INTO conversation_processing_lock
    (conversation_id, locked_by, locked_at, expires_at, message_id)
  VALUES
    (p_conversation_id, p_locked_by, NOW(), NOW() + INTERVAL '30 seconds', p_message_id)
  ON CONFLICT (conversation_id) DO NOTHING;

  -- 3. Verificar se o lock é nosso
  RETURN EXISTS (
    SELECT 1 FROM conversation_processing_lock
    WHERE conversation_id = p_conversation_id
      AND locked_by = p_locked_by
      AND (p_message_id IS NULL OR message_id = p_message_id)
  );
END;
$$;

-- ============================================================
-- release_processing_lock(conversation_id)
-- Libera o lock de uma conversa. Sempre chamar no finally.
-- ============================================================
CREATE OR REPLACE FUNCTION release_processing_lock(
  p_conversation_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM conversation_processing_lock
  WHERE conversation_id = p_conversation_id;
END;
$$;

-- ============================================================
-- cleanup_expired_locks()
-- Limpa todos os locks expirados.
-- Chamar periodicamente (ex: cron via pg_cron ou edge function).
-- Retorna número de locks removidos.
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  removed_count INT;
BEGIN
  DELETE FROM conversation_processing_lock
  WHERE expires_at < NOW();
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$$;

-- RLS: service role pode tudo; usuários autenticados só leem
ALTER TABLE conversation_processing_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON conversation_processing_lock
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read" ON conversation_processing_lock
  FOR SELECT USING (auth.role() = 'authenticated');
