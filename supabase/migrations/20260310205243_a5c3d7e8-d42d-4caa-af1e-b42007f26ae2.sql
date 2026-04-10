-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can read all active agents" ON public.human_agents;
DROP POLICY IF EXISTS "Users can read own human_agent record" ON public.human_agents;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Authenticated users can read all active agents"
  ON public.human_agents FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Users can read own human_agent record"
  ON public.human_agents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());