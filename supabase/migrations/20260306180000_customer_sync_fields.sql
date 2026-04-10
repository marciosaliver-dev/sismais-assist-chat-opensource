-- ═══════════════════════════════════════════════════════════════════════════
-- Customer Data Sync — Novos campos para status de licença e dívida
-- ═══════════════════════════════════════════════════════════════════════════

-- Campos para tracking de status de licença/financeiro sincronizado do Sismais Admin
ALTER TABLE helpdesk_clients
  ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'unknown',
  -- 'active' | 'suspended' | 'expired' | 'cancelled' | 'unknown'
  ADD COLUMN IF NOT EXISTS pending_invoices_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debt_total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS mrr_total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_contracts_count INTEGER DEFAULT 0;

-- Índice para queries frequentes de status
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_license_status
  ON helpdesk_clients(license_status);

-- Permitir lookup rápido por sismais_admin_id (já existe índice mas garante)
CREATE INDEX IF NOT EXISTS idx_helpdesk_clients_phone_notnull
  ON helpdesk_clients(phone) WHERE phone IS NOT NULL AND phone != '';
