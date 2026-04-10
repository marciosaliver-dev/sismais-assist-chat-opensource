-- Índice parcial para conversas ativas (fila + em atendimento)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_active_tv
ON ai_conversations (status, started_at)
WHERE status IN ('aguardando', 'em_atendimento')
AND (is_discarded IS NULL OR is_discarded = false);

-- Índice para resolvidos do dia (KPIs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_resolved_today
ON ai_conversations (resolved_at, status)
WHERE status = 'finalizado';

-- Índice para último stage change (stale tickets)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_status_history_latest
ON ticket_status_history (conversation_id, created_at DESC);
