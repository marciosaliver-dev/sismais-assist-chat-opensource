-- Enable RLS on system_updates and system_update_reads (if not already)
ALTER TABLE IF EXISTS system_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_update_reads ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read published updates
CREATE POLICY IF NOT EXISTS "authenticated_read_published_updates"
  ON system_updates FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Allow authenticated users to manage their own read marks
CREATE POLICY IF NOT EXISTS "authenticated_manage_own_reads"
  ON system_update_reads FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow service_role full access (for deploy script inserts)
-- service_role bypasses RLS by default, so no policy needed
