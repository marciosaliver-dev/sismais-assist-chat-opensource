-- error_issues: tracks auto-created GitHub issues
CREATE TABLE IF NOT EXISTS error_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_hash text NOT NULL,
  github_issue_number int NOT NULL,
  github_url text NOT NULL,
  edge_function text NOT NULL,
  error_message text,
  squad_name text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  occurrence_count int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX idx_error_issues_hash_open
  ON error_issues (error_hash) WHERE status != 'resolved';

CREATE INDEX idx_error_issues_status ON error_issues (status);

-- error_routing_rules: configurable squad routing
CREATE TABLE IF NOT EXISTS error_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  squad_name text NOT NULL,
  github_label text NOT NULL DEFAULT 'bug',
  discord_webhook_url text,
  is_critical boolean NOT NULL DEFAULT false,
  github_assignee text,
  priority int NOT NULL DEFAULT 100
);

CREATE INDEX idx_error_routing_priority ON error_routing_rules (priority);

-- Seed default routing rules
INSERT INTO error_routing_rules (pattern, squad_name, github_label, is_critical, priority) VALUES
  ('uazapi-|process-incoming-|whatsapp-', 'helpdesk-dev-squad', 'squad:helpdesk-dev', true, 10),
  ('agent-executor|orchestrat|ai-', 'ia-orchestration', 'squad:ia-orchestration', true, 20),
  ('auth-|user-', 'helpdesk-dev-squad', 'squad:helpdesk-dev', false, 30),
  ('deploy-|migration-', 'devops-squad', 'squad:devops', false, 40),
  ('.*', 'dx-squad', 'squad:dx', false, 999);

-- RLS: only service_role can read/write these tables
ALTER TABLE error_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON error_issues
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access" ON error_routing_rules
  FOR ALL USING (auth.role() = 'service_role');
