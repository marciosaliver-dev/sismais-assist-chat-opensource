
-- Create knowledge_products table
CREATE TABLE public.knowledge_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  color text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create knowledge_groups table
CREATE TABLE public.knowledge_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.knowledge_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to ai_knowledge_base
ALTER TABLE public.ai_knowledge_base
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.knowledge_products(id),
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.knowledge_groups(id);

-- Enable RLS
ALTER TABLE public.knowledge_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for knowledge_products
CREATE POLICY "Authenticated access knowledge_products" ON public.knowledge_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for knowledge_groups
CREATE POLICY "Authenticated access knowledge_groups" ON public.knowledge_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_products_updated_at
  BEFORE UPDATE ON public.knowledge_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_groups_updated_at
  BEFORE UPDATE ON public.knowledge_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
