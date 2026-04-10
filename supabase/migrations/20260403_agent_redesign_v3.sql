-- ===========================================
-- Migration: Agent Redesign v3
-- Desativar Lana, dead letter queue, ajustes
-- ===========================================

-- 1. Desativar agente Lana (triagem)
UPDATE ai_agents
SET is_active = false
WHERE specialty = 'triage';

-- 2. Criar tabela dead_letter_queue para mensagens que falharam
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id),
  message_content text NOT NULL,
  error_type text NOT NULL, -- 'orchestrator_fail', 'executor_timeout', 'model_error', 'webhook_error'
  error_details jsonb DEFAULT '{}',
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'failed')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text -- 'auto_retry', 'manual', 'human_escalation'
);

-- Índices para consulta rápida
CREATE INDEX idx_dead_letter_status ON dead_letter_queue(status) WHERE status = 'pending';
CREATE INDEX idx_dead_letter_created ON dead_letter_queue(created_at DESC);

-- RLS
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view dead letters"
  ON dead_letter_queue FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Service role can manage dead letters"
  ON dead_letter_queue FOR ALL
  TO service_role
  USING (true);

-- 3. Adicionar coluna fallback_models em ai_agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS fallback_models text[] DEFAULT '{}';

-- 4. Adicionar coluna transfer_context em ai_conversations para contexto herdado
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS transfer_context jsonb DEFAULT null;
