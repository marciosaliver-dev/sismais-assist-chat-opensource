
-- Create customer_profiles table for caching external SISMAIS_GL data
CREATE TABLE public.customer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  external_id TEXT,
  nome TEXT,
  documento TEXT,
  email TEXT,
  fantasia TEXT,
  dados_cadastrais JSONB DEFAULT '{}'::jsonb,
  dados_financeiros JSONB DEFAULT '{}'::jsonb,
  dados_servico JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on phone (normalized)
CREATE UNIQUE INDEX idx_customer_profiles_phone ON public.customer_profiles (phone);
CREATE INDEX idx_customer_profiles_documento ON public.customer_profiles (documento);
CREATE INDEX idx_customer_profiles_external_id ON public.customer_profiles (external_id);

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access customer_profiles"
ON public.customer_profiles
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access customer_profiles"
ON public.customer_profiles
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_customer_profiles_updated_at
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
