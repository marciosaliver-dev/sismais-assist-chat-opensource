-- 1. Fix has_role to check is_approved
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_approved = true
  )
$$;

-- 2. Fix customer_profiles: drop public role policy
DROP POLICY IF EXISTS "Service role full access customer_profiles" ON public.customer_profiles;

-- 3. Fix customer_health_scores: drop public role policies  
DROP POLICY IF EXISTS "Authenticated read customer_health_scores" ON public.customer_health_scores;
DROP POLICY IF EXISTS "Service role write customer_health_scores" ON public.customer_health_scores;

-- Recreate with proper roles
CREATE POLICY "Authenticated read customer_health_scores"
ON public.customer_health_scores
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role write customer_health_scores"
ON public.customer_health_scores
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);