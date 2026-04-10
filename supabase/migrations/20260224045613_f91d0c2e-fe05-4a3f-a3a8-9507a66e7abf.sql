
-- Tabela de log de auditoria para webhook-billing
CREATE TABLE public.webhook_billing_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  plataforma text,
  evento text,
  cliente_nome text,
  cliente_documento text,
  cliente_telefone text,
  action_taken text NOT NULL, -- created, updated, error, rejected
  conversation_id uuid,
  ticket_number integer,
  helpdesk_client_id uuid,
  existing_board_id uuid,
  moved_to_billing boolean DEFAULT false,
  payload jsonb,
  error_message text,
  execution_time_ms integer
);

-- RLS
ALTER TABLE public.webhook_billing_logs ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total via bypass; authenticated pode ler
CREATE POLICY "Authenticated users can view billing logs"
  ON public.webhook_billing_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Index para consultas por data e plataforma
CREATE INDEX idx_webhook_billing_logs_created_at ON public.webhook_billing_logs (created_at DESC);
CREATE INDEX idx_webhook_billing_logs_plataforma ON public.webhook_billing_logs (plataforma);
CREATE INDEX idx_webhook_billing_logs_action ON public.webhook_billing_logs (action_taken);
