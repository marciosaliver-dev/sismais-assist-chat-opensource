-- Fix: unique constraint on (client_id, cnpj)
ALTER TABLE helpdesk_client_companies
ADD CONSTRAINT uq_client_company_cnpj UNIQUE (client_id, cnpj);

-- Fix: RLS policy - restrict to service_role and authenticated with proper checks
DROP POLICY IF EXISTS "Service role full access on helpdesk_client_companies" ON helpdesk_client_companies;

CREATE POLICY "Service role full access on helpdesk_client_companies"
  ON helpdesk_client_companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage client companies"
  ON helpdesk_client_companies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fix: ON DELETE trigger to promote next company or nullify
CREATE OR REPLACE FUNCTION handle_company_deletion()
RETURNS TRIGGER AS $$
DECLARE
  next_id uuid;
BEGIN
  IF OLD.is_primary = true THEN
    SELECT id INTO next_id
    FROM helpdesk_client_companies
    WHERE client_id = OLD.client_id AND id != OLD.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF next_id IS NOT NULL THEN
      UPDATE helpdesk_client_companies
      SET is_primary = true
      WHERE id = next_id;
    ELSE
      UPDATE helpdesk_clients
      SET cnpj = NULL
      WHERE id = OLD.client_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_company_deletion
  AFTER DELETE ON helpdesk_client_companies
  FOR EACH ROW
  EXECUTE FUNCTION handle_company_deletion();
