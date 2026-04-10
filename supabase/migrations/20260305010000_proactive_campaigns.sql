-- =====================================================
-- Proactive Campaigns System - Tables & Functions
-- =====================================================

-- 1. Campaign definitions
CREATE TABLE IF NOT EXISTS proactive_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Campaign type: follow_up, billing, onboarding, reactivation, health_check
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('follow_up', 'billing', 'onboarding', 'reactivation', 'health_check')),

  -- Autonomy level: auto (no approval), approval_required (needs human OK)
  approval_mode TEXT NOT NULL DEFAULT 'auto' CHECK (approval_mode IN ('auto', 'approval_required')),

  -- Schedule
  schedule_cron TEXT, -- e.g. "0 9 * * 1-5" = weekdays at 9am
  schedule_timezone TEXT DEFAULT 'America/Sao_Paulo',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,

  -- Target audience (JSON filter rules)
  target_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [{"field":"subscribed_product","op":"eq","value":"sismais_erp"}, {"field":"days_inactive","op":"gte","value":30}]

  -- Message generation
  message_mode TEXT NOT NULL DEFAULT 'ai_generated' CHECK (message_mode IN ('ai_generated', 'template')),
  message_template TEXT, -- template text with {variables}
  message_prompt TEXT, -- AI prompt/instructions for personalization

  -- Agent assignment
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  whatsapp_instance_id UUID REFERENCES uazapi_instances(id) ON DELETE SET NULL,

  -- Multi-step sequence (array of steps)
  steps JSONB NOT NULL DEFAULT '[{"delay_hours":0,"message_prompt":"Initial outreach"}]'::jsonb,
  -- Example: [{"delay_hours":0,"message_prompt":"..."},{"delay_hours":24,"message_prompt":"follow-up if no reply"}]

  -- Limits & controls
  max_contacts_per_run INT DEFAULT 50,
  max_contacts_per_day INT DEFAULT 200,
  min_hours_between_contacts INT DEFAULT 24, -- avoid spamming same client

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  is_active BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Campaign executions (each run of a campaign)
CREATE TABLE IF NOT EXISTS campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES proactive_campaigns(id) ON DELETE CASCADE,

  -- Execution metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'running', 'completed', 'cancelled', 'failed')),

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Targets identified for this run
  total_targets INT DEFAULT 0,
  contacted INT DEFAULT 0,
  replied INT DEFAULT 0,
  converted INT DEFAULT 0, -- e.g. replied positively, paid, etc.
  failed INT DEFAULT 0,
  skipped INT DEFAULT 0,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Individual contact attempts
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES campaign_executions(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES proactive_campaigns(id) ON DELETE CASCADE,

  -- Target client
  helpdesk_client_id UUID REFERENCES helpdesk_clients(id) ON DELETE SET NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,

  -- Message tracking
  current_step INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'replied', 'converted', 'failed', 'skipped', 'opted_out')),

  -- Conversation created for this outreach
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,

  -- Message sent
  message_sent TEXT,
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- AI-specific
  ai_context JSONB, -- context used for message generation

  -- Error tracking
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Campaign activity log (for supervision)
CREATE TABLE IF NOT EXISTS campaign_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES proactive_campaigns(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES campaign_executions(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES campaign_contacts(id) ON DELETE CASCADE,

  action TEXT NOT NULL, -- 'campaign_started', 'message_sent', 'reply_received', 'escalated', 'approved', 'paused', etc.
  details JSONB,
  actor_type TEXT DEFAULT 'system' CHECK (actor_type IN ('system', 'ai', 'human')),
  actor_id TEXT, -- user ID or agent ID

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proactive_campaigns_status ON proactive_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_proactive_campaigns_type ON proactive_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_proactive_campaigns_next_run ON proactive_campaigns(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaign_executions_campaign ON campaign_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_status ON campaign_executions(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_execution ON campaign_contacts(execution_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_client ON campaign_contacts(helpdesk_client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_campaign ON campaign_activity_log(campaign_id);

-- Enable RLS
ALTER TABLE proactive_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users full access (team-wide visibility)
CREATE POLICY "Authenticated users can manage campaigns" ON proactive_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage executions" ON campaign_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage contacts" ON campaign_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view activity log" ON campaign_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role (edge functions) full access
CREATE POLICY "Service role full access campaigns" ON proactive_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access executions" ON campaign_executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access contacts" ON campaign_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access activity" ON campaign_activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function: Calculate next run time from cron expression
-- (simplified - uses interval-based approach since pg_cron isn't available in all Supabase plans)
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaign_updated_at
  BEFORE UPDATE ON proactive_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_campaign_updated_at();

CREATE TRIGGER trg_campaign_contacts_updated_at
  BEFORE UPDATE ON campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION update_campaign_updated_at();
