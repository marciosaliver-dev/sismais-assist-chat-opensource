-- =============================================================================
-- Performance Optimization: Database Indexes
-- =============================================================================
-- Índices compostos para otimizar o pipeline de mensagens WhatsApp.
-- Projetado para suportar 500+ atendimentos/dia com latência mínima.
-- =============================================================================

-- ─── Pipeline de Mensagens (ai_messages) ────────────────────────────────────
-- Usado por: agent-executor (histórico), useInboxConversations (preview),
-- message list rendering, process-incoming-message
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON ai_messages(conversation_id, created_at DESC);

-- ─── Conversas por status (ai_conversations) ───────────────────────────────
-- Usado por: useInboxConversations, Queue, Dashboard, orchestrator
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status_handler
  ON ai_conversations(status, handler_type);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_status_started
  ON ai_conversations(status, started_at DESC);

-- Usado por: orchestrator, agent-executor (busca por conversa ativa)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer_phone
  ON ai_conversations(customer_phone)
  WHERE status IN ('ativo', 'em_atendimento', 'aguardando');

-- ─── Webhook Lookups (uazapi_chats) ────────────────────────────────────────
-- Usado por: uazapi-webhook (chat lookup por instance + chat_id)
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_instance_chatjid
  ON uazapi_chats(instance_id, chat_jid);

-- Usado por: uazapi-webhook (fallback lookup por remoteJid)
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_remote_jid
  ON uazapi_chats(remote_jid)
  WHERE remote_jid IS NOT NULL;

-- ─── Mensagens WhatsApp (uazapi_messages) ──────────────────────────────────
-- Usado por: uazapi-webhook (dedup check), delete/edit handlers
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_msgid
  ON uazapi_messages(message_id);

-- Usado por: ChatArea message list, message history loading
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_chatid_created
  ON uazapi_messages(chat_id, created_at DESC);

-- ─── Instâncias UAZAPI ────────────────────────────────────────────────────
-- Usado por: sendTextViaWhatsApp, webhook instance resolution
CREATE INDEX IF NOT EXISTS idx_uazapi_instances_active
  ON uazapi_instances(is_active)
  WHERE is_active = true;

-- ─── Agentes IA (ai_agents) ───────────────────────────────────────────────
-- Usado por: orchestrator (busca agentes ativos por prioridade)
CREATE INDEX IF NOT EXISTS idx_ai_agents_active_priority
  ON ai_agents(is_active, priority DESC)
  WHERE is_active = true;

-- ─── Knowledge Base (RAG) ─────────────────────────────────────────────────
-- HNSW index para busca vetorial — significativamente mais rápido que seq scan
-- Nota: Só funciona se a extensão pgvector já estiver instalada e o tipo
-- da coluna embedding for vector. Se a coluna usar outro tipo, este index
-- será ignorado sem erro.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
      ON ai_knowledge_base USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)';
  END IF;
END $$;

-- ─── Automações (para trigger lookup no pipeline) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_automations_active_trigger
  ON ai_automations(trigger_type, is_active)
  WHERE is_active = true;

-- ─── Helpdesk Clients (para agent-executor client lookup) ─────────────────
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_phone
  ON helpdesk_clients(phone)
  WHERE phone IS NOT NULL;
