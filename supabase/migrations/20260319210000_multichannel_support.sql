-- ============================================================================
-- Migration: Multi-Channel Support
-- Descricao: Adiciona tabelas e campos para suporte multi-canal
--            (UAZAPI + Meta WhatsApp API + Instagram)
-- Autor: Engenheiro Multi-Canal
-- Data: 2026-03-19
-- Feature flags: FF_CHANNEL_META_WHATSAPP, FF_CHANNEL_INSTAGRAM, FF_MULTICHANNEL_ROUTING
-- ============================================================================

-- ── 1. Tabela unificada de instancias de canal ──────────────────────────────

CREATE TABLE IF NOT EXISTS channel_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('uazapi', 'meta_whatsapp', 'instagram')),
  display_name TEXT NOT NULL,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending_setup')),

  -- Configuracao especifica do canal (access_token, phone_number_id, etc.)
  -- Estrutura varia por channel_type — documentado no CLAUDE.md
  config JSONB NOT NULL DEFAULT '{}',

  -- Kanban board associado (mesma logica de uazapi_instances.kanban_board_id)
  kanban_board_id UUID REFERENCES kanban_boards(id),

  -- Modo teste (mesma logica de uazapi_instances.test_mode)
  test_mode BOOLEAN DEFAULT false,
  test_identifier TEXT, -- phone para WhatsApp, IG user ID para Instagram

  -- Metricas basicas
  messages_received_count BIGINT DEFAULT 0,
  messages_sent_count BIGINT DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_instances_type ON channel_instances(channel_type);
CREATE INDEX IF NOT EXISTS idx_channel_instances_active ON channel_instances(is_active) WHERE is_active = true;
-- Index GIN para busca no JSONB config (ex: phone_number_id, ig_user_id)
CREATE INDEX IF NOT EXISTS idx_channel_instances_config ON channel_instances USING gin(config);

-- RLS
ALTER TABLE channel_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view channel instances"
  ON channel_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage channel instances"
  ON channel_instances FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Tabela unificada de mensagens de canal ───────────────────────────────

CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('uazapi', 'meta_whatsapp', 'instagram')),
  channel_instance_id UUID REFERENCES channel_instances(id),

  -- Identificadores
  external_message_id TEXT NOT NULL,
  sender_phone TEXT,
  sender_name TEXT,

  -- Conteudo
  message_type TEXT NOT NULL DEFAULT 'text',
  text_content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,

  -- Status
  from_me BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  error_code TEXT,
  error_message TEXT,

  -- Soft delete
  deleted_by_sender BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,

  -- Dados brutos (debug)
  raw_payload JSONB,

  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dedup: uma mensagem por external_id + canal + instancia
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_dedup
  ON channel_messages(external_message_id, channel_type, channel_instance_id);

CREATE INDEX IF NOT EXISTS idx_channel_messages_conversation ON channel_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_timestamp ON channel_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_type, channel_instance_id);

-- RLS
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view channel messages"
  ON channel_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage channel messages"
  ON channel_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 3. Campos novos em ai_conversations ─────────────────────────────────────

-- channel_chat_id: ID do chat no canal (substitui uazapi_chat_id para novos canais)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_conversations' AND column_name = 'channel_chat_id'
  ) THEN
    ALTER TABLE ai_conversations ADD COLUMN channel_chat_id TEXT;
  END IF;
END $$;

-- channel_instance_id: referencia para channel_instances (substitui whatsapp_instance_id para novos canais)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_conversations' AND column_name = 'channel_instance_id'
  ) THEN
    ALTER TABLE ai_conversations ADD COLUMN channel_instance_id UUID REFERENCES channel_instances(id);
  END IF;
END $$;

-- Index para busca de conversa por canal
CREATE INDEX IF NOT EXISTS idx_ai_conversations_channel
  ON ai_conversations(communication_channel, channel_chat_id)
  WHERE status IN ('aguardando', 'em_atendimento', 'nova');

-- ── 4. Campo channel_type em ai_messages (para rastreabilidade) ─────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_messages' AND column_name = 'channel_type'
  ) THEN
    ALTER TABLE ai_messages ADD COLUMN channel_type TEXT;
  END IF;
END $$;

-- ── 5. Funcao para incrementar contadores de canal atomicamente ─────────────

CREATE OR REPLACE FUNCTION increment_channel_counter(
  p_instance_id UUID,
  p_counter TEXT, -- 'received' ou 'sent'
  p_amount INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_counter = 'received' THEN
    UPDATE channel_instances
    SET messages_received_count = messages_received_count + p_amount,
        last_message_at = now(),
        updated_at = now()
    WHERE id = p_instance_id;
  ELSIF p_counter = 'sent' THEN
    UPDATE channel_instances
    SET messages_sent_count = messages_sent_count + p_amount,
        updated_at = now()
    WHERE id = p_instance_id;
  END IF;
END;
$$;

-- ── 6. Trigger para updated_at automatico ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_channel_instances') THEN
    CREATE TRIGGER set_updated_at_channel_instances
      BEFORE UPDATE ON channel_instances
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_channel_messages') THEN
    CREATE TRIGGER set_updated_at_channel_messages
      BEFORE UPDATE ON channel_messages
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ── 7. Comentarios de documentacao ──────────────────────────────────────────

COMMENT ON TABLE channel_instances IS 'Instancias de canais de comunicacao (UAZAPI, Meta WhatsApp, Instagram). Config JSONB varia por canal.';
COMMENT ON TABLE channel_messages IS 'Mensagens normalizadas de todos os canais. Dedup por external_message_id + channel_type + instance.';
COMMENT ON COLUMN channel_instances.config IS 'UAZAPI: {api_url, api_token}. Meta WA: {phone_number_id, waba_id, access_token, webhook_verify_token}. Instagram: {ig_user_id, page_id, access_token}.';
COMMENT ON COLUMN ai_conversations.channel_chat_id IS 'ID do chat no canal (JID para UAZAPI, phone para Meta WA, IG user ID para Instagram). Complementa uazapi_chat_id para novos canais.';
COMMENT ON COLUMN ai_conversations.channel_instance_id IS 'Referencia para channel_instances. Complementa whatsapp_instance_id para novos canais.';
