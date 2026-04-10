
-- 1. helpdesk_clients
CREATE TABLE public.helpdesk_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  cnpj text,
  cpf text,
  subscribed_product text DEFAULT 'outro',
  subscribed_product_custom text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access helpdesk_clients"
  ON public.helpdesk_clients FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at_helpdesk_clients
  BEFORE UPDATE ON public.helpdesk_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. helpdesk_client_contacts
CREATE TABLE public.helpdesk_client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.helpdesk_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  role text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access helpdesk_client_contacts"
  ON public.helpdesk_client_contacts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 3. helpdesk_client_contracts
CREATE TABLE public.helpdesk_client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.helpdesk_clients(id) ON DELETE CASCADE,
  contract_number text,
  plan_name text,
  status text DEFAULT 'active',
  start_date date,
  end_date date,
  value numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access helpdesk_client_contracts"
  ON public.helpdesk_client_contracts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 4. ticket_categories
CREATE TABLE public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  is_default boolean DEFAULT false,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access ticket_categories"
  ON public.ticket_categories FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.ticket_categories (name, color, is_default, sort_order) VALUES
  ('Suporte Técnico', '#3b82f6', true, 1),
  ('Financeiro', '#22c55e', false, 2),
  ('Comercial', '#a855f7', false, 3),
  ('Dúvida', '#eab308', false, 4),
  ('Reclamação', '#ef4444', false, 5),
  ('Solicitação', '#06b6d4', false, 6);

-- 5. ticket_modules
CREATE TABLE public.ticket_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access ticket_modules"
  ON public.ticket_modules FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 6. ticket_statuses
CREATE TABLE public.ticket_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#06b6d4',
  icon text,
  is_final boolean DEFAULT false,
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access ticket_statuses"
  ON public.ticket_statuses FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.ticket_statuses (name, slug, color, is_default, is_final, sort_order) VALUES
  ('Novo', 'novo', '#06b6d4', true, false, 1),
  ('Em Andamento', 'em_andamento', '#eab308', false, false, 2),
  ('Aguardando Cliente', 'aguardando_cliente', '#a855f7', false, false, 3),
  ('Resolvido', 'resolvido', '#22c55e', false, false, 4),
  ('Fechado', 'fechado', '#6b7280', false, true, 5);

-- 7. ticket_close_requirements
CREATE TABLE public.ticket_close_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL,
  field_label text NOT NULL,
  is_required boolean DEFAULT false
);

ALTER TABLE public.ticket_close_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access ticket_close_requirements"
  ON public.ticket_close_requirements FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.ticket_close_requirements (field_name, field_label, is_required) VALUES
  ('helpdesk_client_id', 'Cliente associado', true),
  ('ticket_category_id', 'Categoria', true),
  ('ticket_module_id', 'Módulo', false),
  ('resolution_note', 'Anotação de resolução', false);

-- 8. helpdesk_client_annotations
CREATE TABLE public.helpdesk_client_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.helpdesk_clients(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  content text NOT NULL,
  author text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_client_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access helpdesk_client_annotations"
  ON public.helpdesk_client_annotations FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 9. Add columns to ai_conversations
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS helpdesk_client_id uuid REFERENCES public.helpdesk_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_category_id uuid REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_module_id uuid REFERENCES public.ticket_modules(id) ON DELETE SET NULL;
