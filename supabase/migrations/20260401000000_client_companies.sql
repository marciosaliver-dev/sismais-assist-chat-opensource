-- Migration: helpdesk_client_companies
-- Suporta múltiplos CNPJs/Empresas por contato

CREATE TABLE IF NOT EXISTS helpdesk_client_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES helpdesk_clients(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  company_name text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_client_companies_client ON helpdesk_client_companies(client_id);
CREATE INDEX idx_client_companies_cnpj ON helpdesk_client_companies(cnpj);

-- Migrar dados existentes
INSERT INTO helpdesk_client_companies (client_id, cnpj, company_name, is_primary)
SELECT id, cnpj, company_name, true
FROM helpdesk_clients
WHERE cnpj IS NOT NULL AND cnpj != '';

-- RLS
ALTER TABLE helpdesk_client_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on helpdesk_client_companies"
  ON helpdesk_client_companies
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger: manter helpdesk_clients.cnpj sincronizado com o primário
CREATE OR REPLACE FUNCTION sync_primary_cnpj()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Remover is_primary de outros registros do mesmo client
    UPDATE helpdesk_client_companies
    SET is_primary = false
    WHERE client_id = NEW.client_id AND id != NEW.id AND is_primary = true;

    -- Atualizar o campo cnpj no helpdesk_clients
    UPDATE helpdesk_clients
    SET cnpj = NEW.cnpj, company_name = COALESCE(NEW.company_name, company_name)
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_primary_cnpj
  AFTER INSERT OR UPDATE ON helpdesk_client_companies
  FOR EACH ROW
  EXECUTE FUNCTION sync_primary_cnpj();
