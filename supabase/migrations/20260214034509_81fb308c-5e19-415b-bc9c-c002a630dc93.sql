
-- Create automation logs table
CREATE TABLE IF NOT EXISTS public.ai_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.ai_automations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  trigger_data JSONB DEFAULT '{}',
  actions_executed JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON public.ai_automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed ON public.ai_automation_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.ai_automation_logs(status);

-- Enable RLS
ALTER TABLE public.ai_automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated access automation_logs"
  ON public.ai_automation_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access automation_logs"
  ON public.ai_automation_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add indexes to existing ai_automations table
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON public.ai_automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_active ON public.ai_automations(is_active);
