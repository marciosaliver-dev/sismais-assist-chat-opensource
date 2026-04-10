-- Allow authenticated users to read their own human_agents record
CREATE POLICY "Users can read own human_agent record"
ON public.human_agents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to update their own record (e.g. is_online status)
CREATE POLICY "Users can update own human_agent record"
ON public.human_agents
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());