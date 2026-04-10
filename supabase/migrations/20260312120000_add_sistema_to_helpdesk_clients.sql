-- Add 'sistema' column to helpdesk_clients table
-- This field stores the main system used by the client (GMS Desktop, GMS Web, Maxpro, Outro)
ALTER TABLE helpdesk_clients
  ADD COLUMN IF NOT EXISTS sistema TEXT DEFAULT NULL;

COMMENT ON COLUMN helpdesk_clients.sistema IS 'Sistema principal utilizado pelo cliente (GMS Desktop, GMS Web, Maxpro, Outro)';
