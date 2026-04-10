-- =============================================================================
-- CRM 360 — Modelo de Dados Unificado
-- Consolida visao do cliente a partir de 4 fontes:
--   1. Sismais GL (ERP) via sismais-client-lookup
--   2. Sismais Admin via sismais-admin-proxy
--   3. Helpdesk local (helpdesk_clients)
--   4. WhatsApp/UAZAPI (uazapi_chats, customer_profiles)
-- =============================================================================

-- 1. Expandir helpdesk_clients com campos CRM unificados
-- (campos que ja podem existir via migrations anteriores sao adicionados com IF NOT EXISTS)
DO $$
BEGIN
  -- Campos de ciclo de vida
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'lifecycle_stage') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN lifecycle_stage text DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'customer_since') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN customer_since timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'segment') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN segment text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'nps_score') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN nps_score integer;
  END IF;

  -- Campos financeiros
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'mrr') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN mrr numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'mrr_total') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN mrr_total numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'debt_total') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN debt_total numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'pending_invoices_count') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN pending_invoices_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'active_contracts_count') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN active_contracts_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'license_status') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN license_status text DEFAULT 'unknown';
  END IF;

  -- Campos de classificacao
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'customer_tier') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN customer_tier text DEFAULT 'starter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'plan_level') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN plan_level text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'churn_risk') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN churn_risk boolean DEFAULT false;
  END IF;

  -- Campos de integracao
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'sismais_admin_id') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN sismais_admin_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'sismais_gl_id') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN sismais_gl_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'last_synced_at') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN last_synced_at timestamptz;
  END IF;

  -- Scoring
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'health_score') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN health_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'engagement_score') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN engagement_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'scores_updated_at') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN scores_updated_at timestamptz;
  END IF;

  -- Avatar
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'avatar_url') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN avatar_url text;
  END IF;

  -- Merge / duplicatas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'merged_into_id') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN merged_into_id uuid REFERENCES helpdesk_clients(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'helpdesk_clients' AND column_name = 'is_merged') THEN
    ALTER TABLE helpdesk_clients ADD COLUMN is_merged boolean DEFAULT false;
  END IF;
END $$;


-- 2. Tabela de timeline unificada de interacoes
CREATE TABLE IF NOT EXISTS crm_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'message', 'ticket_created', 'ticket_resolved', 'contract_change', 'annotation', 'call', 'email', 'payment', 'system'
  channel text, -- 'whatsapp', 'web', 'phone', 'email', 'instagram', 'internal'
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  -- Referencia cruzada com entidades de origem
  conversation_id uuid,
  message_id uuid,
  contract_id uuid,
  annotation_id uuid,
  -- Quem executou a acao
  actor_type text, -- 'client', 'ai_agent', 'human_agent', 'system'
  actor_id text,
  actor_name text,
  -- Timestamps
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_timeline_client_id ON crm_timeline(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_occurred_at ON crm_timeline(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_event_type ON crm_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_channel ON crm_timeline(channel);


-- 3. Tabela de deteccao e merge de duplicatas
CREATE TABLE IF NOT EXISTS crm_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a_id uuid NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  client_b_id uuid NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  match_score numeric(5,2) NOT NULL, -- 0-100
  match_reasons jsonb NOT NULL DEFAULT '[]', -- ex: [{"field":"phone","match":"exact"},{"field":"cnpj","match":"exact"}]
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected', 'merged'
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_duplicate_pair UNIQUE (client_a_id, client_b_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_duplicate_status ON crm_duplicate_candidates(status);


-- 4. Tabela de scoring historico
CREATE TABLE IF NOT EXISTS crm_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  score_type text NOT NULL, -- 'health', 'engagement', 'churn_risk'
  score_value numeric(5,2) NOT NULL,
  factors jsonb DEFAULT '{}',
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_score_history_client ON crm_score_history(client_id, score_type);
CREATE INDEX IF NOT EXISTS idx_crm_score_history_date ON crm_score_history(calculated_at DESC);


-- 5. Tabela de mapeamento de fontes de dados (source-of-truth registry)
CREATE TABLE IF NOT EXISTS crm_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  source_system text NOT NULL, -- 'sismais_gl', 'sismais_admin', 'helpdesk', 'whatsapp', 'manual'
  source_id text, -- ID no sistema de origem
  source_data jsonb DEFAULT '{}',
  last_synced_at timestamptz,
  sync_status text DEFAULT 'synced', -- 'synced', 'stale', 'error'
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_source UNIQUE (client_id, source_system)
);

CREATE INDEX IF NOT EXISTS idx_crm_data_sources_client ON crm_data_sources(client_id);


-- 6. Indices adicionais para helpdesk_clients (deduplicacao e busca)
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_cnpj ON helpdesk_clients(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_cpf ON helpdesk_clients(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_phone ON helpdesk_clients(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_email ON helpdesk_clients(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_external_id ON helpdesk_clients(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_sismais_admin_id ON helpdesk_clients(sismais_admin_id) WHERE sismais_admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_sismais_gl_id ON helpdesk_clients(sismais_gl_id) WHERE sismais_gl_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_merged ON helpdesk_clients(merged_into_id) WHERE is_merged = true;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_health ON helpdesk_clients(health_score) WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_churn ON helpdesk_clients(churn_risk) WHERE churn_risk = true;


-- 7. Funcao RPC para busca unificada de clientes (usada pelos agentes IA)
CREATE OR REPLACE FUNCTION crm_search_client(
  p_phone text DEFAULT NULL,
  p_documento text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  company_name text,
  phone text,
  email text,
  cnpj text,
  cpf text,
  lifecycle_stage text,
  health_score integer,
  churn_risk boolean,
  mrr_total numeric,
  debt_total numeric,
  active_contracts_count integer,
  customer_tier text,
  match_type text
) AS $$
BEGIN
  -- Busca por telefone (mais comum via WhatsApp)
  IF p_phone IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.name, c.company_name, c.phone, c.email, c.cnpj, c.cpf,
           c.lifecycle_stage, c.health_score, c.churn_risk, c.mrr_total, c.debt_total,
           c.active_contracts_count, c.customer_tier, 'phone'::text AS match_type
    FROM helpdesk_clients c
    WHERE c.is_merged IS NOT TRUE
      AND (c.phone ILIKE '%' || RIGHT(p_phone, 8) || '%')
    LIMIT 5;

    IF FOUND THEN RETURN; END IF;

    -- Tentar via contatos
    RETURN QUERY
    SELECT c.id, c.name, c.company_name, c.phone, c.email, c.cnpj, c.cpf,
           c.lifecycle_stage, c.health_score, c.churn_risk, c.mrr_total, c.debt_total,
           c.active_contracts_count, c.customer_tier, 'contact_phone'::text AS match_type
    FROM helpdesk_clients c
    JOIN helpdesk_client_contacts cc ON cc.client_id = c.id
    WHERE c.is_merged IS NOT TRUE
      AND cc.phone ILIKE '%' || RIGHT(p_phone, 8) || '%'
    LIMIT 5;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Busca por documento (CNPJ/CPF)
  IF p_documento IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.name, c.company_name, c.phone, c.email, c.cnpj, c.cpf,
           c.lifecycle_stage, c.health_score, c.churn_risk, c.mrr_total, c.debt_total,
           c.active_contracts_count, c.customer_tier, 'documento'::text AS match_type
    FROM helpdesk_clients c
    WHERE c.is_merged IS NOT TRUE
      AND (c.cnpj = p_documento OR c.cpf = p_documento)
    LIMIT 5;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Busca por email
  IF p_email IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.name, c.company_name, c.phone, c.email, c.cnpj, c.cpf,
           c.lifecycle_stage, c.health_score, c.churn_risk, c.mrr_total, c.debt_total,
           c.active_contracts_count, c.customer_tier, 'email'::text AS match_type
    FROM helpdesk_clients c
    WHERE c.is_merged IS NOT TRUE
      AND c.email ILIKE p_email
    LIMIT 5;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Busca por nome (fuzzy)
  IF p_name IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.name, c.company_name, c.phone, c.email, c.cnpj, c.cpf,
           c.lifecycle_stage, c.health_score, c.churn_risk, c.mrr_total, c.debt_total,
           c.active_contracts_count, c.customer_tier, 'name'::text AS match_type
    FROM helpdesk_clients c
    WHERE c.is_merged IS NOT TRUE
      AND (c.name ILIKE '%' || p_name || '%' OR c.company_name ILIKE '%' || p_name || '%')
    LIMIT 10;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Funcao para detectar duplicatas
CREATE OR REPLACE FUNCTION crm_detect_duplicates(p_limit integer DEFAULT 50)
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Duplicatas por CNPJ
  INSERT INTO crm_duplicate_candidates (client_a_id, client_b_id, match_score, match_reasons)
  SELECT a.id, b.id, 95, '[{"field":"cnpj","match":"exact"}]'::jsonb
  FROM helpdesk_clients a
  JOIN helpdesk_clients b ON a.cnpj = b.cnpj AND a.id < b.id
  WHERE a.cnpj IS NOT NULL
    AND a.is_merged IS NOT TRUE AND b.is_merged IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM crm_duplicate_candidates d
      WHERE (d.client_a_id = a.id AND d.client_b_id = b.id)
         OR (d.client_a_id = b.id AND d.client_b_id = a.id)
    )
  LIMIT p_limit
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Duplicatas por telefone (ultimos 8 digitos)
  INSERT INTO crm_duplicate_candidates (client_a_id, client_b_id, match_score, match_reasons)
  SELECT a.id, b.id, 80, '[{"field":"phone","match":"suffix_8"}]'::jsonb
  FROM helpdesk_clients a
  JOIN helpdesk_clients b ON RIGHT(regexp_replace(a.phone, '\D', '', 'g'), 8) = RIGHT(regexp_replace(b.phone, '\D', '', 'g'), 8)
    AND a.id < b.id
  WHERE a.phone IS NOT NULL AND b.phone IS NOT NULL
    AND length(regexp_replace(a.phone, '\D', '', 'g')) >= 8
    AND a.is_merged IS NOT TRUE AND b.is_merged IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM crm_duplicate_candidates d
      WHERE (d.client_a_id = a.id AND d.client_b_id = b.id)
         OR (d.client_a_id = b.id AND d.client_b_id = a.id)
    )
  LIMIT p_limit
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  -- Duplicatas por email
  INSERT INTO crm_duplicate_candidates (client_a_id, client_b_id, match_score, match_reasons)
  SELECT a.id, b.id, 85, '[{"field":"email","match":"exact"}]'::jsonb
  FROM helpdesk_clients a
  JOIN helpdesk_clients b ON LOWER(a.email) = LOWER(b.email) AND a.id < b.id
  WHERE a.email IS NOT NULL
    AND a.is_merged IS NOT TRUE AND b.is_merged IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM crm_duplicate_candidates d
      WHERE (d.client_a_id = a.id AND d.client_b_id = b.id)
         OR (d.client_a_id = b.id AND d.client_b_id = a.id)
    )
  LIMIT p_limit
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Funcao para merge de duplicatas
CREATE OR REPLACE FUNCTION crm_merge_clients(
  p_keep_id uuid,
  p_merge_id uuid,
  p_resolved_by text DEFAULT 'system'
)
RETURNS boolean AS $$
BEGIN
  -- Mover contatos
  UPDATE helpdesk_client_contacts SET client_id = p_keep_id WHERE client_id = p_merge_id;
  -- Mover contratos
  UPDATE helpdesk_client_contracts SET client_id = p_keep_id WHERE client_id = p_merge_id;
  -- Mover anotacoes
  UPDATE helpdesk_client_annotations SET client_id = p_keep_id WHERE client_id = p_merge_id;
  -- Mover conversas
  UPDATE ai_conversations SET helpdesk_client_id = p_keep_id WHERE helpdesk_client_id = p_merge_id;
  -- Mover timeline
  UPDATE crm_timeline SET client_id = p_keep_id WHERE client_id = p_merge_id;
  -- Mover data sources
  UPDATE crm_data_sources SET client_id = p_keep_id WHERE client_id = p_merge_id
    ON CONFLICT (client_id, source_system) DO NOTHING;
  -- Mover score history
  UPDATE crm_score_history SET client_id = p_keep_id WHERE client_id = p_merge_id;

  -- Marcar como merged
  UPDATE helpdesk_clients SET
    is_merged = true,
    merged_into_id = p_keep_id,
    updated_at = now()
  WHERE id = p_merge_id;

  -- Atualizar candidato de duplicata
  UPDATE crm_duplicate_candidates SET
    status = 'merged',
    resolved_by = p_resolved_by,
    resolved_at = now()
  WHERE (client_a_id = p_keep_id AND client_b_id = p_merge_id)
     OR (client_a_id = p_merge_id AND client_b_id = p_keep_id);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. RLS
ALTER TABLE crm_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_data_sources ENABLE ROW LEVEL SECURITY;

-- Politicas permissivas para usuarios autenticados (service role bypassa RLS)
CREATE POLICY "Authenticated users can view timeline" ON crm_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view duplicates" ON crm_duplicate_candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view scores" ON crm_score_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view data sources" ON crm_data_sources FOR SELECT TO authenticated USING (true);

-- Insercao/atualizacao somente via service role (edge functions)
CREATE POLICY "Service can manage timeline" ON crm_timeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage duplicates" ON crm_duplicate_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage scores" ON crm_score_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage data sources" ON crm_data_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
