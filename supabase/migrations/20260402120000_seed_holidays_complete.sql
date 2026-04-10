-- ═══════════════════════════════════════════════════════════
-- SEED: Feriados faltantes — Consciência Negra + 2029-2030 + Bahia
-- ═══════════════════════════════════════════════════════════

-- Consciência Negra (20 Nov) — recurring, nacional
INSERT INTO business_holidays (name, date, scope, recurring)
VALUES ('Dia da Consciência Negra', '2025-11-20', 'national', true)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;

-- Feriados móveis 2029 (Páscoa: 01 Abr)
INSERT INTO business_holidays (name, date, scope, recurring) VALUES
  ('Carnaval', '2029-02-12', 'national', false),
  ('Carnaval', '2029-02-13', 'national', false),
  ('Sexta-feira Santa', '2029-03-30', 'national', false),
  ('Corpus Christi', '2029-05-31', 'national', false)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;

-- Feriados móveis 2030 (Páscoa: 21 Abr)
INSERT INTO business_holidays (name, date, scope, recurring) VALUES
  ('Carnaval', '2030-03-04', 'national', false),
  ('Carnaval', '2030-03-05', 'national', false),
  ('Sexta-feira Santa', '2030-04-19', 'national', false),
  ('Corpus Christi', '2030-06-20', 'national', false)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;

-- Independência da Bahia (02 Jul) — recurring, estadual BA
INSERT INTO business_holidays (name, date, scope, state_code, recurring)
VALUES ('Independência da Bahia', '2025-07-02', 'state', 'BA', true)
ON CONFLICT (date, name, scope, COALESCE(state_code, ''), COALESCE(city_name, '')) DO NOTHING;
