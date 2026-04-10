-- Migration: Complete AI Tools Setup
-- Creates all necessary tables and configurations for autonomous AI agents

-- 1. Create reminders table
CREATE TABLE IF NOT EXISTS public.ai_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES human_agents(id) ON DELETE SET NULL,
  created_by TEXT,
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON ai_reminders(due_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reminders_client ON ai_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_reminders_conversation ON ai_reminders(conversation_id);

ALTER TABLE public.ai_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_reminders" ON public.ai_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_reminders" ON public.ai_reminders FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_reminders IS 'Lembretes criados por agentes IA para acompanhamento posterior.';

-- 2. Create scheduled callbacks table
CREATE TABLE IF NOT EXISTS public.ai_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  agent_id UUID REFERENCES human_agents(id) ON DELETE SET NULL,
  reason TEXT,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'missed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callbacks_scheduled_time ON ai_callbacks(scheduled_time) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_callbacks_client_phone ON ai_callbacks(client_phone);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON ai_callbacks(status);

ALTER TABLE public.ai_callbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_callbacks" ON public.ai_callbacks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_callbacks" ON public.ai_callbacks FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_callbacks IS 'Callbacks agendados por agentes IA para retorno ao cliente.';

-- 3. Create client notes table
CREATE TABLE IF NOT EXISTS public.ai_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'atendimento' CHECK (category IN ('atendimento', 'financeiro', 'tecnico', 'vendas', 'geral')),
  agent_id UUID REFERENCES human_agents(id) ON DELETE SET NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client ON ai_client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_category ON ai_client_notes(category);

ALTER TABLE public.ai_client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_client_notes" ON public.ai_client_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_client_notes" ON public.ai_client_notes FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_client_notes IS 'Anotacoes sobre clientes criadas por agentes IA ou humanos.';

-- 4. Create AI actions log for audit trail
CREATE TABLE IF NOT EXISTS public.ai_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES helpdesk_clients(id) ON DELETE SET NULL,
  tool_name TEXT,
  parameters JSONB,
  result JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_log_conversation ON ai_actions_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_log_agent ON ai_actions_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_log_type ON ai_actions_log(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_log_created ON ai_actions_log(created_at DESC);

ALTER TABLE public.ai_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_actions_log" ON public.ai_actions_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_actions_log" ON public.ai_actions_log FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_actions_log IS 'Log de acoes executadas por agentes IA para auditoria.';

-- 5. Create proactive campaign triggers table
CREATE TABLE IF NOT EXISTS public.ai_proactive_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'sla_breach',
    'sla_warning', 
    'client_inactivity',
    'ticket_stale',
    'churn_risk',
    'payment_due',
    'nps_low',
    'custom'
  )),
  conditions JSONB NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_message',
    'send_email',
    'create_reminder',
    'schedule_callback',
    'escalate',
    'add_tag',
    'update_priority'
  )),
  action_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_triggers_type ON ai_proactive_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_proactive_triggers_active ON ai_proactive_triggers(is_active) WHERE is_active = true;

ALTER TABLE public.ai_proactive_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access ai_proactive_triggers" ON public.ai_proactive_triggers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read ai_proactive_triggers" ON public.ai_proactive_triggers FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.ai_proactive_triggers IS 'Triggers para acoes proativas de agentes IA.';

-- 6. Insert default proactive triggers
INSERT INTO public.ai_proactive_triggers (name, trigger_type, conditions, action_type, action_config, is_active, priority)
VALUES
  (
    'Alerta SLA 80%',
    'sla_warning',
    '{"threshold_percent": 80}',
    'send_message',
    '{"template": "Olá! Notamos que sua solicitação está em espera há algum tempo. Posso ajudar?", "delay_minutes": 0}',
    true,
    90
  ),
  (
    'Cliente Inativo 24h',
    'client_inactivity',
    '{"inactivity_hours": 24}',
    'send_message',
    '{"template": "Olá! Como posso ajudá-lo? Notamos que você teve uma dúvida pendente.", "delay_minutes": 0}',
    true,
    70
  ),
  (
    'Ticket Stale 7 dias',
    'ticket_stale',
    '{"stale_days": 7}',
    'escalate',
    '{"reason": "Ticket estah sem atividade ha mais de 7 dias", "priority": "normal"}',
    true,
    60
  ),
  (
    'Risco de Churn',
    'churn_risk',
    '{"churn_probability": 0.7}',
    'schedule_callback',
    '{"reason": "Cliente com alto risco de churn - retorno telefonico", "priority": "high"}',
    true,
    85
  )
ON CONFLICT DO NOTHING;

-- 7. Create function to check and execute proactive triggers
CREATE OR REPLACE FUNCTION public.execute_proactive_triggers()
RETURNS SETOF ai_proactive_triggers AS $$
DECLARE
  trigger_record ai_proactive_triggers;
  conv_record RECORD;
BEGIN
  FOR trigger_record IN 
    SELECT * FROM ai_proactive_triggers 
    WHERE is_active = true 
    ORDER BY priority DESC
  LOOP
    -- Execute based on trigger type
    CASE trigger_record.trigger_type
      WHEN 'sla_warning' THEN
        FOR conv_record IN 
          SELECT id FROM ai_conversations 
          WHERE status = 'aguardando' 
            AND handler_type = 'human'
            AND queue_entered_at IS NOT NULL
            AND (EXTRACT(EPOCH FROM (NOW() - queue_entered_at)) / 3600) >= 
                ((SELECT COALESCE(value::numeric, 60) FROM ticket_sla_config WHERE priority = 'alta') * 0.8)
        LOOP
          PERFORM net.http_post(
            url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/process-proactive-trigger',
            body := json_build_object(
              'trigger_id', trigger_record.id,
              'conversation_id', conv_record.id,
              'action_type', trigger_record.action_type,
              'action_config', trigger_record.action_config
            )::text
          );
        END LOOP;
      
      WHEN 'client_inactivity' THEN
        FOR conv_record IN 
          SELECT id, customer_phone FROM ai_conversations 
          WHERE status IN ('em_atendimento', 'novo')
            AND last_customer_message_at < NOW() - INTERVAL '24 hours'
            AND handler_type = 'ai'
        LOOP
          PERFORM net.http_post(
            url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/process-proactive-trigger',
            body := json_build_object(
              'trigger_id', trigger_record.id,
              'conversation_id', conv_record.id,
              'action_type', trigger_record.action_type,
              'action_config', trigger_record.action_config
            )::text
          );
        END LOOP;
      
      ELSE
        -- Custom trigger logic
        NULL;
    END CASE;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.execute_proactive_triggers TO service_role;

-- 8. Create CRM metrics view
CREATE OR REPLACE VIEW public.ai_crm_metrics AS
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT conversation_id) FILTER (WHERE action_type = 'ticket_created') as tickets_created,
  COUNT(DISTINCT conversation_id) FILTER (WHERE action_type = 'ticket_resolved') as tickets_resolved,
  COUNT(DISTINCT conversation_id) FILTER (WHERE action_type = 'escalated') as escalations,
  COUNT(DISTINCT conversation_id) FILTER (WHERE action_type = 'callback_scheduled') as callbacks_scheduled,
  COUNT(DISTINCT client_id) FILTER (WHERE action_type = 'note_added') as notes_added,
  AVG(execution_time_ms) FILTER (WHERE success = true) as avg_execution_ms,
  COUNT(*) FILTER (WHERE success = false) as errors,
  COUNT(*) as total_actions
FROM ai_actions_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

GRANT SELECT ON public.ai_crm_metrics TO service_role;

-- 9. Create agent performance view
CREATE OR REPLACE VIEW public.ai_agent_performance AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  a.specialty,
  COUNT(DISTINCT al.conversation_id) as total_conversations,
  COUNT(DISTINCT al.conversation_id) FILTER (WHERE al.success = true) as successful,
  COUNT(DISTINCT al.conversation_id) FILTER (WHERE al.success = false) as failed,
  COUNT(DISTINCT al.conversation_id) FILTER (WHERE al.tool_name IS NOT NULL) as tool_usage,
  AVG(al.execution_time_ms) as avg_response_ms,
  MIN(al.created_at) as first_interaction,
  MAX(al.created_at) as last_interaction
FROM ai_agents a
LEFT JOIN ai_actions_log al ON al.agent_id = a.id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.id, a.name, a.specialty;

GRANT SELECT ON public.ai_agent_performance TO service_role;

-- 10. Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260216_ai_tools_complete', 'Complete AI tools setup - reminders, callbacks, notes, proactive triggers, metrics', NOW())
ON CONFLICT DO NOTHING;
