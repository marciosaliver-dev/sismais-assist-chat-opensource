-- ============================================================
-- ai_autonomy_config
-- Configuração de autonomia da IA por tipo de situação.
-- Permite ao administrador definir quando a IA age sozinha
-- e quando precisa de supervisão ou escalação humana.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_autonomy_config (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_type             TEXT        UNIQUE NOT NULL,  -- identificador único da situação
  label                      TEXT        NOT NULL,         -- nome legível para o admin
  autonomy_level             INT         NOT NULL DEFAULT 100 CHECK (autonomy_level BETWEEN 0 AND 100),
  -- 100 = totalmente autônoma, 0 = sempre humano
  auto_escalate_keywords     TEXT[]      DEFAULT ARRAY[]::TEXT[],  -- palavras que forçam escalação
  escalate_after_repeat_count INT        DEFAULT 3,   -- mesmo problema N vezes → escalar
  escalate_after_hours       INT         DEFAULT 4,   -- sem resolução em N horas → escalar
  csat_escalate_threshold    NUMERIC(3,1) DEFAULT 2.0, -- CSAT abaixo deste valor → supervisão
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO ai_autonomy_config
  (situation_type, label, autonomy_level, auto_escalate_keywords, escalate_after_repeat_count, escalate_after_hours)
VALUES
  ('general_questions',   'Dúvidas Gerais',             100, ARRAY[]::TEXT[],                            5, 8),
  ('technical_simple',    'Erros Técnicos Simples',      70, ARRAY['sistema parado', 'não funciona'],     3, 4),
  ('technical_critical',  'Erros Técnicos Críticos',     30, ARRAY['sistema parado', 'perda de dados'],   2, 2),
  ('complaints',          'Reclamações',                  70, ARRAY['cancelar', 'insatisfeito'],           2, 4),
  ('special_requests',    'Solicitações Especiais',       15, ARRAY['processo', 'advogado', 'processo judicial'], 1, 1),
  ('financial',           'Questões Financeiras',         60, ARRAY['débito', 'cobrança indevida'],        2, 4)
ON CONFLICT (situation_type) DO NOTHING;

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_autonomy_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_autonomy_config_updated_at
  BEFORE UPDATE ON ai_autonomy_config
  FOR EACH ROW EXECUTE FUNCTION update_autonomy_config_updated_at();

-- RLS
ALTER TABLE ai_autonomy_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON ai_autonomy_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read" ON ai_autonomy_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update" ON ai_autonomy_config
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================
-- ticket_status_history: adicionar transition_source
-- Rastreia a origem de cada mudança de estágio no Kanban.
-- Previne loops: flow_engine → Kanban → flow_engine.
-- ============================================================
ALTER TABLE ticket_status_history
  ADD COLUMN IF NOT EXISTS transition_source TEXT
    CHECK (transition_source IN ('ai_decision', 'flow_engine', 'human_manual', 'sla_breach', 'system'));

-- Índice para auditorias de fluxo
CREATE INDEX IF NOT EXISTS idx_status_history_source
  ON ticket_status_history(transition_source)
  WHERE transition_source IS NOT NULL;

COMMENT ON COLUMN ticket_status_history.transition_source IS
  'Origem da mudança: ai_decision | flow_engine | human_manual | sla_breach | system. '
  'Movimentos com source=flow_engine NÃO redisparam trigger-flows para evitar loops.';
