
-- Tabela de log de exclusões
CREATE TABLE public.conversation_deletion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  ticket_number integer NOT NULL,
  customer_phone text,
  customer_name text,
  deleted_by uuid NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  conversation_snapshot jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.conversation_deletion_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver os logs
CREATE POLICY "Admins can read deletion logs"
ON public.conversation_deletion_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert deletion logs"
ON public.conversation_deletion_logs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy para admins deletarem conversas
CREATE POLICY "Admins can delete conversations"
ON public.ai_conversations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Policy para admins deletarem mensagens de conversas deletadas
CREATE POLICY "Admins can delete messages"
ON public.ai_messages
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
