-- ═══════════════════════════════════════════════════════════
-- Tabela business_holidays: Feriados nacionais, estaduais e municipais
-- Usada pelo sistema de IA para saber se está em dia útil
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  scope TEXT NOT NULL DEFAULT 'national' CHECK (scope IN ('national', 'state', 'municipal')),
  state_code TEXT,
  city_name TEXT,
  recurring BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_business_holidays_date ON business_holidays(date);
CREATE INDEX idx_business_holidays_scope ON business_holidays(scope);
CREATE INDEX idx_business_holidays_active_date ON business_holidays(is_active, date);
CREATE UNIQUE INDEX idx_business_holidays_unique
  ON business_holidays(date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, ''));

-- RLS
ALTER TABLE business_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON business_holidays
  FOR ALL USING (auth.role() = 'authenticated');

-- Trigger updated_at (usa função existente no projeto)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER set_business_holidays_updated_at
      BEFORE UPDATE ON business_holidays
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  ELSE
    CREATE OR REPLACE FUNCTION update_business_holidays_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER set_business_holidays_updated_at
      BEFORE UPDATE ON business_holidays
      FOR EACH ROW EXECUTE FUNCTION update_business_holidays_updated_at();
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- SEED: Feriados nacionais fixos (recurring=true)
-- ═══════════════════════════════════════════════════════════
INSERT INTO business_holidays (name, date, scope, recurring) VALUES
  ('Confraternização Universal', '2025-01-01', 'national', true),
  ('Tiradentes', '2025-04-21', 'national', true),
  ('Dia do Trabalho', '2025-05-01', 'national', true),
  ('Independência do Brasil', '2025-09-07', 'national', true),
  ('Nossa Sra. Aparecida', '2025-10-12', 'national', true),
  ('Finados', '2025-11-02', 'national', true),
  ('Proclamação da República', '2025-11-15', 'national', true),
  ('Natal', '2025-12-25', 'national', true);

-- ═══════════════════════════════════════════════════════════
-- SEED: Feriados nacionais móveis 2025-2028 (recurring=false)
-- Carnaval = Páscoa - 47d (seg) e -46d (ter)
-- Sexta-feira Santa = Páscoa - 2d
-- Corpus Christi = Páscoa + 60d
-- ═══════════════════════════════════════════════════════════
INSERT INTO business_holidays (name, date, scope, recurring) VALUES
  -- 2025 (Páscoa: 20 Abr)
  ('Carnaval', '2025-03-03', 'national', false),
  ('Carnaval', '2025-03-04', 'national', false),
  ('Sexta-feira Santa', '2025-04-18', 'national', false),
  ('Corpus Christi', '2025-06-19', 'national', false),

  -- 2026 (Páscoa: 05 Abr)
  ('Carnaval', '2026-02-16', 'national', false),
  ('Carnaval', '2026-02-17', 'national', false),
  ('Sexta-feira Santa', '2026-04-03', 'national', false),
  ('Corpus Christi', '2026-06-04', 'national', false),

  -- 2027 (Páscoa: 28 Mar)
  ('Carnaval', '2027-02-08', 'national', false),
  ('Carnaval', '2027-02-09', 'national', false),
  ('Sexta-feira Santa', '2027-03-26', 'national', false),
  ('Corpus Christi', '2027-05-27', 'national', false),

  -- 2028 (Páscoa: 16 Abr)
  ('Carnaval', '2028-02-28', 'national', false),
  ('Carnaval', '2028-02-29', 'national', false),
  ('Sexta-feira Santa', '2028-04-14', 'national', false),
  ('Corpus Christi', '2028-06-15', 'national', false);
