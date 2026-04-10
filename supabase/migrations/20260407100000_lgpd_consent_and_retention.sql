-- =====================================================================
-- LGPD compliance: retention cron + indexes on existing consent table
-- =====================================================================
-- NOTA: A tabela public.lgpd_consent_records JÁ existia em migration anterior
-- com schema: (id, phone, consent_type, granted, granted_at, revoked_at,
-- ip_address, channel, created_at). Esta migration apenas:
--
--   1. Adiciona índices para lookup por phone/channel
--   2. Adiciona ai_conversations.lgpd_notice_sent_at (flag rápido)
--   3. Cria função anonymize_old_messages() para retenção LGPD
--   4. Agenda cron diário 03:00 BRT (06:00 UTC) para anonimização
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Índices na tabela lgpd_consent_records existente
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lgpd_consent_phone
  ON public.lgpd_consent_records (phone);

CREATE INDEX IF NOT EXISTS idx_lgpd_consent_phone_channel
  ON public.lgpd_consent_records (phone, channel);

-- ---------------------------------------------------------------------
-- 2. Coluna lgpd_notice_sent_at em ai_conversations
-- ---------------------------------------------------------------------
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS lgpd_notice_sent_at timestamptz;

-- ---------------------------------------------------------------------
-- 3. Função de anonimização de mensagens antigas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anonymize_old_messages(retention_months int DEFAULT 12)
RETURNS TABLE(messages_anonymized int, conversations_anonymized int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  msg_count int := 0;
  conv_count int := 0;
  cutoff timestamptz := now() - (retention_months || ' months')::interval;
BEGIN
  -- Anonimiza conteúdo de mensagens antigas (mantém estrutura para analytics)
  WITH updated AS (
    UPDATE public.ai_messages
       SET content = '[ANONYMIZED]',
           media_url = NULL
     WHERE created_at < cutoff
       AND content IS NOT NULL
       AND content <> '[ANONYMIZED]'
    RETURNING 1
  )
  SELECT COUNT(*) INTO msg_count FROM updated;

  -- Anonimiza dados pessoais em conversações antigas finalizadas
  WITH updated_conv AS (
    UPDATE public.ai_conversations
       SET customer_name  = '[ANONYMIZED]',
           customer_phone = 'anon_' || substring(md5(customer_phone) for 12),
           customer_email = NULL
     WHERE started_at < cutoff
       AND status IN ('finalizado', 'resolvido', 'cancelado')
       AND customer_name <> '[ANONYMIZED]'
    RETURNING 1
  )
  SELECT COUNT(*) INTO conv_count FROM updated_conv;

  -- Log na tabela de auditoria (fail-safe)
  BEGIN
    INSERT INTO public.ai_actions_log (action_type, tool_name, parameters, result, success)
    VALUES (
      'lgpd_retention',
      'anonymize_old_messages',
      jsonb_build_object('retention_months', retention_months, 'cutoff', cutoff),
      jsonb_build_object('messages', msg_count, 'conversations', conv_count),
      true
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT msg_count, conv_count;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. Cron job — diário às 03:00 BRT (06:00 UTC)
-- ---------------------------------------------------------------------
DO $block$
BEGIN
  PERFORM cron.unschedule('lgpd-retention-anonymize')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lgpd-retention-anonymize');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$block$;

SELECT cron.schedule(
  'lgpd-retention-anonymize',
  '0 6 * * *',
  'SELECT public.anonymize_old_messages(12)'
);
