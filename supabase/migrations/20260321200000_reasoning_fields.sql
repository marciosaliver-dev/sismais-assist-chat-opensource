-- Fase 2B: Thinking Visível — campos de raciocínio
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS reasoning_text TEXT CHECK (char_length(reasoning_text) <= 2000),
  ADD COLUMN IF NOT EXISTS reasoning_signals JSONB DEFAULT '{}';

-- Índice parcial para queries da tab Raciocínio (assistant messages por conversa, desc)
CREATE INDEX IF NOT EXISTS idx_ai_messages_reasoning
  ON ai_messages (conversation_id, role, created_at DESC)
  WHERE role = 'assistant';

COMMENT ON COLUMN ai_messages.reasoning_text IS 'Explicação em linguagem natural gerada pelo LLM sobre seu raciocínio';
COMMENT ON COLUMN ai_messages.reasoning_signals IS 'Sinais estruturados de confiança: {kb_match, specialty_alignment, guardrails, hedging, tools, client_data}';
