CREATE OR REPLACE FUNCTION public.capture_csat_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score integer;
  v_conv RECORD;
  v_trimmed text;
BEGIN
  IF NEW.role = 'user' AND NEW.conversation_id IS NOT NULL THEN
    v_trimmed := TRIM(NEW.content);
    
    -- CSAT scores are 1-5, so content must be exactly 1 character
    IF LENGTH(v_trimmed) = 1 AND v_trimmed ~ '^[1-5]$' THEN
      v_score := v_trimmed::integer;

      SELECT csat_sent_at, csat_score INTO v_conv
      FROM ai_conversations
      WHERE id = NEW.conversation_id;

      IF v_conv.csat_sent_at IS NOT NULL AND v_conv.csat_score IS NULL THEN
        UPDATE ai_conversations
        SET
          csat_score = v_score,
          csat_responded_at = now()
        WHERE id = NEW.conversation_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NEW;
  WHEN numeric_value_out_of_range THEN
    RETURN NEW;
END;
$$;