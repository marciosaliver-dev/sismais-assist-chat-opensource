-- Índice único parcial: garante no máximo 1 conversa ativa por chat/canal/instância.
-- Evita duplicatas causadas por race condition quando o webhook Meta dispara
-- múltiplos eventos em milissegundos para o mesmo cliente.
-- Re-contatos após fechamento continuam funcionando (index só cobre status não-terminais).
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_conv_channel_chat
  ON ai_conversations (channel_chat_id, communication_channel, channel_instance_id)
  WHERE status NOT IN ('finalizado', 'resolvido', 'cancelado')
    AND channel_chat_id IS NOT NULL
    AND channel_instance_id IS NOT NULL
    AND (is_merged IS NULL OR is_merged = FALSE);
