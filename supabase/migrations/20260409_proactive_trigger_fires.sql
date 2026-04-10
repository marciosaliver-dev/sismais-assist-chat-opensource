-- Migration: ai_proactive_trigger_fires (Onda 6F - dry-run mode)
--
-- Tabela de histórico para registrar quando cada trigger proativo
-- DISPARARIA em modo dry-run. Nenhuma ação é executada — apenas registro.
--
-- Propósito: dar visibilidade de "se o sistema fosse 100% autônomo, essas
-- N ações aconteceriam hoje". Depois de coletar 1-2 semanas de dados,
-- admin pode decidir quais triggers ativar de verdade (modo 'executed').
--
-- Rollback:
--   DROP TABLE IF EXISTS ai_proactive_trigger_fires CASCADE;

CREATE TABLE IF NOT EXISTS ai_proactive_trigger_fires (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id     UUID NOT NULL REFERENCES ai_proactive_triggers(id) ON DELETE CASCADE,
  trigger_name   TEXT NOT NULL,
  trigger_type   TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  fired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contexto do disparo: entity_id, metadata, razão
  context        JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- O que aconteceria se fosse executado (action_config aplicado)
  would_execute  JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Estado: 'dry_run' (padrão), 'executed', 'failed', 'skipped'
  status         TEXT NOT NULL DEFAULT 'dry_run'
                 CHECK (status IN ('dry_run', 'executed', 'failed', 'skipped')),

  -- Mensagem livre (erro, motivo de skip, etc.)
  message        TEXT
);

-- Indexes para queries comuns (últimos N disparos por trigger, por tipo, por dia)
CREATE INDEX IF NOT EXISTS idx_trigger_fires_trigger_id
  ON ai_proactive_trigger_fires (trigger_id, fired_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_fires_fired_at
  ON ai_proactive_trigger_fires (fired_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_fires_status
  ON ai_proactive_trigger_fires (status, fired_at DESC);

-- RLS: apenas service_role escreve. authenticated lê para dashboards.
ALTER TABLE ai_proactive_trigger_fires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON ai_proactive_trigger_fires;
CREATE POLICY "service_role_all"
  ON ai_proactive_trigger_fires
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select" ON ai_proactive_trigger_fires;
CREATE POLICY "authenticated_select"
  ON ai_proactive_trigger_fires
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE ai_proactive_trigger_fires IS
'Histórico de disparos de triggers proativos. Onda 6F — modo dry-run por padrão (detecta e loga, não executa). Permite análise de "o que aconteceria se fosse autônomo" antes de ativar execução real.';
