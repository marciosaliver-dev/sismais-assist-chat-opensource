-- ═══════════════════════════════════════════════════════════════════════════
-- CS ARCHITECT SYSTEM — Migration 1: Schema Extensions & New Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTENSÕES em ai_conversations ────────────────────────────────────────
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS ticket_description JSONB,
  -- JSONB: {sistema, modulo, resumo, detalhe, passos_reproducao, impacto, tentativas}
  ADD COLUMN IF NOT EXISTS sistema TEXT,
  -- 'GMS Desktop' | 'GMS Web' | 'Maxpro' | 'Outro'
  ADD COLUMN IF NOT EXISTS priority_source TEXT DEFAULT 'manual';
  -- 'ai' | 'manual' | 'params' | 'rule'

CREATE INDEX IF NOT EXISTS idx_ai_conversations_priority_source
  ON ai_conversations(priority_source);

-- ─── EXTENSÕES em helpdesk_clients ────────────────────────────────────────
ALTER TABLE helpdesk_clients
  ADD COLUMN IF NOT EXISTS sismais_admin_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_level TEXT,
  -- 'Basico' | 'Profissional' | 'Enterprise'
  ADD COLUMN IF NOT EXISTS activation_date DATE,
  ADD COLUMN IF NOT EXISTS churn_risk BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responsavel_cs TEXT,
  ADD COLUMN IF NOT EXISTS sistema TEXT,
  -- sistema principal do cliente
  ADD COLUMN IF NOT EXISTS customer_tier TEXT DEFAULT 'starter';
  -- 'enterprise' | 'business' | 'starter'

CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_sismais_admin_id
  ON helpdesk_clients(sismais_admin_id);

CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_cnpj_notnull
  ON helpdesk_clients(cnpj) WHERE cnpj IS NOT NULL AND cnpj != '';

-- ─── TABELA: ticket_ai_logs ────────────────────────────────────────────────
-- Registra cada chamada de IA por ticket: routing, respostas, classificações
CREATE TABLE IF NOT EXISTS ticket_ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  evento_tipo TEXT NOT NULL,
  -- 'classificacao' | 'routing' | 'resposta' | 'escalonamento' | 'resumo' | 'sentiment' | 'descricao'
  prompt_enviado TEXT,       -- truncado a 5000 chars nas edge functions
  resposta_recebida TEXT,    -- truncado a 5000 chars nas edge functions
  modelo_usado TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  confianca FLOAT,
  agente_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  metadata JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ticket_ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_ticket_ai_logs" ON ticket_ai_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- service_role (edge functions) não precisa de policy — bypassa RLS
CREATE POLICY "service_role_insert_ticket_ai_logs" ON ticket_ai_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ticket_ai_logs_ticket_id
  ON ticket_ai_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ai_logs_evento
  ON ticket_ai_logs(evento_tipo);
CREATE INDEX IF NOT EXISTS idx_ticket_ai_logs_criado_em
  ON ticket_ai_logs(criado_em DESC);

-- ─── TABELA: priority_rules ────────────────────────────────────────────────
-- Regras configuráveis para classificação de prioridade
CREATE TABLE IF NOT EXISTS priority_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  conditions JSONB NOT NULL DEFAULT '[]',
  -- Array de: [{field: string, operator: string, value: string|number}]
  -- fields: 'keyword' | 'customer_tier' | 'module' | 'time_without_response' | 'ticket_count'
  -- operators: 'contains' | 'equals' | 'greater_than' | 'less_than'
  logic TEXT NOT NULL DEFAULT 'OR' CHECK (logic IN ('AND', 'OR')),
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE priority_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_crud_priority_rules" ON priority_rules
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── TABELA: ticket_priority_log ──────────────────────────────────────────
-- Histórico de mudanças de prioridade por ticket
CREATE TABLE IF NOT EXISTS ticket_priority_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  priority_before TEXT,
  priority_after TEXT NOT NULL,
  classification_source TEXT NOT NULL,
  -- 'ai' | 'rule' | 'manual' | 'auto_escalation' | 'params'
  ai_confidence DECIMAL(5,2),
  ai_reasoning TEXT,
  rule_id UUID REFERENCES priority_rules(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ticket_priority_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_priority_log" ON ticket_priority_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_insert_priority_log" ON ticket_priority_log
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_priority_log_ticket_id
  ON ticket_priority_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_priority_log_created_at
  ON ticket_priority_log(created_at DESC);

-- ─── TABELA: sla_configurations ───────────────────────────────────────────
-- Configuração de SLA por nível de prioridade (substitui valores hardcoded nos prompts)
CREATE TABLE IF NOT EXISTS sla_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL UNIQUE,
  -- 'critical' | 'high' | 'medium' | 'low'
  first_response_minutes INT NOT NULL,
  resolution_hours INT NOT NULL,
  escalation_after_minutes INT,
  notify_agents BOOLEAN DEFAULT true,
  notify_managers_on_breach BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sla_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_crud_sla" ON sla_configurations
  FOR ALL USING (auth.role() = 'authenticated');

-- Seeds: valores padrão alinhados com o que estava hardcoded nos prompts dos agentes
INSERT INTO sla_configurations (priority, first_response_minutes, resolution_hours, escalation_after_minutes)
VALUES
  ('critical', 15,  4,  30),
  ('high',     30,  8,  60),
  ('medium',   120, 24, 180),
  ('low',      240, 72, NULL)
ON CONFLICT (priority) DO NOTHING;

-- ─── TABELA: customer_sync_log ────────────────────────────────────────────
-- Histórico de sincronizações com Sismais Admin
CREATE TABLE IF NOT EXISTS customer_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  total_processed INT DEFAULT 0,
  total_created INT DEFAULT 0,
  total_updated INT DEFAULT 0,
  total_errors INT DEFAULT 0,
  error_details JSONB,
  duration_ms INT,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_sync_log" ON customer_sync_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_role_insert_sync_log" ON customer_sync_log
  FOR INSERT WITH CHECK (true);

-- ─── TABELA: contact_name_changes ─────────────────────────────────────────
-- Auditoria de alterações de nome de contato durante atendimento
CREATE TABLE IF NOT EXISTS contact_name_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  old_name TEXT,
  new_name TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  -- 'Correção manual' | 'Apelido' | 'Nome completo'
  saved_to_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_name_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_name_changes" ON contact_name_changes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_name_changes" ON contact_name_changes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── SEEDS: regras de prioridade padrão ───────────────────────────────────
INSERT INTO priority_rules (name, priority, conditions, logic, sort_order) VALUES
  (
    'Sistema fora do ar',
    'critical',
    '[{"field":"keyword","operator":"contains","value":"sistema parado"},{"field":"keyword","operator":"contains","value":"fora do ar"},{"field":"keyword","operator":"contains","value":"sistema caiu"}]'::jsonb,
    'OR',
    1
  ),
  (
    'NF-e / NFC-e bloqueada',
    'critical',
    '[{"field":"keyword","operator":"contains","value":"nota fiscal"},{"field":"keyword","operator":"contains","value":"bloqueada"}]'::jsonb,
    'AND',
    2
  ),
  (
    'Perda de dados',
    'critical',
    '[{"field":"keyword","operator":"contains","value":"perda de dados"},{"field":"keyword","operator":"contains","value":"dados perdidos"},{"field":"keyword","operator":"contains","value":"sumiu os dados"}]'::jsonb,
    'OR',
    3
  ),
  (
    'Urgência declarada',
    'critical',
    '[{"field":"keyword","operator":"contains","value":"urgente"},{"field":"keyword","operator":"contains","value":"emergência"},{"field":"keyword","operator":"contains","value":"parado"}]'::jsonb,
    'OR',
    4
  ),
  (
    'Cliente enterprise — mínimo alta',
    'high',
    '[{"field":"customer_tier","operator":"equals","value":"enterprise"}]'::jsonb,
    'AND',
    10
  ),
  (
    'Sem resposta há mais de 4h',
    'high',
    '[{"field":"time_without_response","operator":"greater_than","value":"240"}]'::jsonb,
    'AND',
    11
  ),
  (
    'Recorrência alta (3+ tickets em 7 dias)',
    'high',
    '[{"field":"ticket_count","operator":"greater_than","value":"2"}]'::jsonb,
    'AND',
    12
  )
ON CONFLICT DO NOTHING;
