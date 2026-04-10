-- Dead letter queue para mensagens que falharam ao salvar em ai_messages
-- Permite reconciliação posterior e auditoria de mensagens perdidas
CREATE TABLE IF NOT EXISTS dead_letter_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- 'agent-executor' | 'uazapi-webhook' | 'reconciliation'
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  uazapi_message_id text,
  payload jsonb NOT NULL,
  error_message text,
  retry_count int DEFAULT 0,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX idx_dead_letter_unresolved ON dead_letter_messages (resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_dead_letter_conversation ON dead_letter_messages (conversation_id) WHERE conversation_id IS NOT NULL;

-- RLS: apenas service_role pode acessar
ALTER TABLE dead_letter_messages ENABLE ROW LEVEL SECURITY;

-- Permitir acesso via service_role (edge functions)
CREATE POLICY "Service role full access on dead_letter_messages"
  ON dead_letter_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE dead_letter_messages IS 'Fila de mensagens que falharam ao ser salvas em ai_messages. Processada pela edge function reconcile-messages.';
