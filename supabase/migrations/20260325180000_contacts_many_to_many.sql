-- Migration: contacts_many_to_many
-- Descrição: Cria modelo many-to-many para contatos. Um contato pode pertencer a múltiplos clientes.
-- Rollback: DROP VIEW IF EXISTS v_client_contacts; DROP TABLE IF EXISTS client_contact_links; DROP TABLE IF EXISTS contacts;

-- 1. Tabela independente de contatos
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.contacts IS 'Contatos independentes que podem ser vinculados a múltiplos clientes';

-- 2. Tabela de junção client <-> contact
CREATE TABLE IF NOT EXISTS public.client_contact_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.helpdesk_clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  role text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, contact_id)
);

COMMENT ON TABLE public.client_contact_links IS 'Junção many-to-many entre clientes e contatos';

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_ccl_client ON public.client_contact_links(client_id);
CREATE INDEX IF NOT EXISTS idx_ccl_contact ON public.client_contact_links(contact_id);

-- 4. Migrar dados existentes de helpdesk_client_contacts
INSERT INTO public.contacts (id, name, email, phone, created_at)
  SELECT id, name, email, phone, created_at
  FROM public.helpdesk_client_contacts
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.client_contact_links (client_id, contact_id, is_primary, role, created_at)
  SELECT client_id, id, is_primary, role, created_at
  FROM public.helpdesk_client_contacts
  ON CONFLICT (client_id, contact_id) DO NOTHING;

-- 5. RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contact_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_authenticated"
  ON public.contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "contacts_insert_authenticated"
  ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "contacts_update_authenticated"
  ON public.contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "contacts_delete_authenticated"
  ON public.contacts FOR DELETE TO authenticated USING (true);

CREATE POLICY "ccl_select_authenticated"
  ON public.client_contact_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "ccl_insert_authenticated"
  ON public.client_contact_links FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ccl_update_authenticated"
  ON public.client_contact_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ccl_delete_authenticated"
  ON public.client_contact_links FOR DELETE TO authenticated USING (true);

-- 6. Trigger updated_at para contacts
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 7. View de compatibilidade (mesma shape de helpdesk_client_contacts)
CREATE OR REPLACE VIEW public.v_client_contacts AS
  SELECT ccl.id, ccl.client_id, c.name, c.email, c.phone,
         ccl.role, ccl.is_primary, c.created_at, c.updated_at
  FROM public.client_contact_links ccl
  JOIN public.contacts c ON c.id = ccl.contact_id;
