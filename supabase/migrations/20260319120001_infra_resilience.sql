-- ============================================================================
-- Migration: Infraestrutura de Resiliencia
-- Data: 2026-03-19
-- Autor: E02 Infra Engineer
-- Descricao: Contadores atomicos, triggers de eventos criticos, indexes de
--            performance, RLS em tabelas faltantes
-- Rollback: Ver secao ROLLBACK no final do arquivo
-- ============================================================================

-- ── 1. FUNCAO DE INCREMENTO ATOMICO (resolve D3 — race condition em contadores) ──

CREATE OR REPLACE FUNCTION increment_counter(
  p_table text,
  p_id_column text,
  p_id_value text,
  p_counter_column text,
  p_increment_by integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE %I = $2',
    p_table, p_counter_column, p_counter_column, p_id_column
  ) USING p_increment_by, p_id_value;
END;
$$;

-- Funcoes especificas para contadores mais usados (evita SQL injection via format)

CREATE OR REPLACE FUNCTION increment_unread_count(
  p_chat_id uuid,
  p_increment integer DEFAULT 1
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE uazapi_chats
  SET unread_count = COALESCE(unread_count, 0) + p_increment
  WHERE id = p_chat_id;
$$;

CREATE OR REPLACE FUNCTION increment_message_counts(
  p_conversation_id uuid,
  p_is_ai boolean DEFAULT true
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE ai_conversations
  SET
    ai_messages_count = CASE WHEN p_is_ai THEN COALESCE(ai_messages_count, 0) + 1 ELSE ai_messages_count END,
    human_messages_count = CASE WHEN NOT p_is_ai THEN COALESCE(human_messages_count, 0) + 1 ELSE human_messages_count END
  WHERE id = p_conversation_id;
$$;


-- ── 2. TRIGGERS PARA EVENTOS CRITICOS ──

-- 2a. Trigger: nova mensagem recebida -> notifica via pg_notify
-- Permite workers assincronos escutarem novas mensagens sem polling

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'new_message',
    json_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'role', NEW.role,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON ai_messages;
CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();


-- 2b. Trigger: escalacao para humano (handler_type muda para 'human')

CREATE OR REPLACE FUNCTION notify_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.handler_type = 'human' AND (OLD.handler_type IS NULL OR OLD.handler_type != 'human') THEN
    PERFORM pg_notify(
      'escalation',
      json_build_object(
        'conversation_id', NEW.id,
        'previous_handler', OLD.handler_type,
        'escalated_at', now()
      )::text
    );

    -- Registrar timestamp de escalacao para calculo de SLA
    UPDATE ai_conversations
    SET context = jsonb_set(
      COALESCE(context, '{}'::jsonb),
      '{escalated_at}',
      to_jsonb(now()::text)
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_escalation ON ai_conversations;
CREATE TRIGGER trg_notify_escalation
  AFTER UPDATE OF handler_type ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION notify_escalation();


-- 2c. Trigger: timeout de SLA — marca conversas que passaram do prazo
-- Verifica na atualizacao se o SLA foi estourado

CREATE OR REPLACE FUNCTION check_sla_breach()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sla_minutes integer;
  v_started_at timestamptz;
BEGIN
  -- Buscar SLA config (primeiro response time)
  SELECT first_response_minutes INTO v_sla_minutes
  FROM sla_configurations
  WHERE is_active = true
  LIMIT 1;

  IF v_sla_minutes IS NULL THEN
    RETURN NEW;
  END IF;

  v_started_at := COALESCE(NEW.started_at, NEW.created_at);

  -- Se conversa ainda aberta e excedeu SLA
  IF NEW.status IN ('active', 'waiting') AND
     v_started_at + (v_sla_minutes || ' minutes')::interval < now() AND
     NOT COALESCE((NEW.context->>'sla_breached')::boolean, false)
  THEN
    NEW.context = jsonb_set(
      COALESCE(NEW.context, '{}'::jsonb),
      '{sla_breached}',
      'true'::jsonb
    );
    NEW.context = jsonb_set(
      NEW.context,
      '{sla_breached_at}',
      to_jsonb(now()::text)
    );

    PERFORM pg_notify(
      'sla_breach',
      json_build_object(
        'conversation_id', NEW.id,
        'sla_minutes', v_sla_minutes,
        'started_at', v_started_at
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_sla_breach ON ai_conversations;
CREATE TRIGGER trg_check_sla_breach
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION check_sla_breach();


-- ── 3. INDEXES DE PERFORMANCE ──

-- Conversas ativas (mais consultadas)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status_active
  ON ai_conversations (status)
  WHERE status IN ('active', 'waiting');

-- Mensagens por conversa (ordenadas por data — paginacao de historico)
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON ai_messages (conversation_id, created_at DESC);

-- Busca de chat por phone (lookup frequente no webhook)
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_phone_instance
  ON uazapi_chats (phone, whatsapp_instance_id)
  WHERE phone IS NOT NULL;

-- Conversas por whatsapp_phone (lookup no process-incoming-message)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_whatsapp_phone
  ON ai_conversations (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL AND status != 'closed';

-- Knowledge base: busca por tipo ativo
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_active_type
  ON ai_knowledge_base (content_type)
  WHERE is_active = true;

-- Automacoes ativas por trigger type (usado no automation-executor)
CREATE INDEX IF NOT EXISTS idx_ai_automations_active_trigger
  ON ai_automations (trigger_type)
  WHERE is_active = true;

-- Flow automations ativas por trigger type
CREATE INDEX IF NOT EXISTS idx_flow_automations_active_trigger
  ON flow_automations (trigger_type)
  WHERE is_active = true;

-- Processing lock: lookup rapido
CREATE INDEX IF NOT EXISTS idx_processing_lock_conversation
  ON conversation_processing_lock (conversation_id)
  WHERE locked_until > now();


-- ── 4. FUNCAO PARA DEBOUNCE ASSINCRONO (resolve D2) ──
-- Salva mensagem pendente e retorna imediatamente. Um cron/worker processa depois.

CREATE TABLE IF NOT EXISTS pending_ai_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_content text NOT NULL,
  whatsapp_instance_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  attempts integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pending_processing_unprocessed
  ON pending_ai_processing (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE pending_ai_processing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access pending_ai_processing"
  ON pending_ai_processing FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read pending_ai_processing"
  ON pending_ai_processing FOR SELECT TO authenticated USING (true);


-- ── 5. TABELA DE AUDIT LOG PARA FEATURE FLAGS ──

CREATE TABLE IF NOT EXISTS feature_flag_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feature_flag_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read feature_flag_audit"
  ON feature_flag_audit FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access feature_flag_audit"
  ON feature_flag_audit FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- ROLLBACK SCRIPT (executar manualmente se necessario reverter)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_notify_new_message ON ai_messages;
-- DROP TRIGGER IF EXISTS trg_notify_escalation ON ai_conversations;
-- DROP TRIGGER IF EXISTS trg_check_sla_breach ON ai_conversations;
-- DROP FUNCTION IF EXISTS notify_new_message();
-- DROP FUNCTION IF EXISTS notify_escalation();
-- DROP FUNCTION IF EXISTS check_sla_breach();
-- DROP FUNCTION IF EXISTS increment_counter(text, text, text, text, integer);
-- DROP FUNCTION IF EXISTS increment_unread_count(uuid, integer);
-- DROP FUNCTION IF EXISTS increment_message_counts(uuid, boolean);
-- DROP TABLE IF EXISTS pending_ai_processing;
-- DROP TABLE IF EXISTS feature_flag_audit;
-- DROP INDEX IF EXISTS idx_ai_conversations_status_active;
-- DROP INDEX IF EXISTS idx_ai_messages_conversation_created;
-- DROP INDEX IF EXISTS idx_uazapi_chats_phone_instance;
-- DROP INDEX IF EXISTS idx_ai_conversations_whatsapp_phone;
-- DROP INDEX IF EXISTS idx_ai_knowledge_base_active_type;
-- DROP INDEX IF EXISTS idx_ai_automations_active_trigger;
-- DROP INDEX IF EXISTS idx_flow_automations_active_trigger;
-- DROP INDEX IF EXISTS idx_processing_lock_conversation;
-- ============================================================================
