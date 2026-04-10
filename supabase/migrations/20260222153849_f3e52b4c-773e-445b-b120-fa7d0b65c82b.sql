
-- Create incoming_webhooks table
CREATE TABLE public.incoming_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active boolean NOT NULL DEFAULT true,
  action_mode text NOT NULL DEFAULT 'direct',
  flow_automation_id uuid REFERENCES public.flow_automations(id) ON DELETE SET NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_type text,
  last_triggered_at timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE,
  payload jsonb,
  execution_status text NOT NULL DEFAULT 'received',
  error_message text,
  execution_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incoming_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for incoming_webhooks
CREATE POLICY "Authenticated access incoming_webhooks" ON public.incoming_webhooks
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for webhook_logs
CREATE POLICY "Authenticated access webhook_logs" ON public.webhook_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Index for token lookup
CREATE INDEX idx_incoming_webhooks_token ON public.incoming_webhooks(token);

-- Index for logs by webhook
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);

-- Trigger for updated_at
CREATE TRIGGER update_incoming_webhooks_updated_at
  BEFORE UPDATE ON public.incoming_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
