CREATE POLICY "Authenticated users can read all active agents"
ON public.human_agents
FOR SELECT
TO authenticated
USING (is_active = true);