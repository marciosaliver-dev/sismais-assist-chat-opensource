
ALTER TABLE helpdesk_clients ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_helpdesk_clients_external_id 
  ON helpdesk_clients(external_id) WHERE external_id IS NOT NULL;
