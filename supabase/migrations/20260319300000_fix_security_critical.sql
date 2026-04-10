-- =============================================================================
-- Migration: Fix critical security vulnerabilities
-- 1. Enable RLS on user_roles table
-- 2. Add policies for authenticated read (own role) and service_role write
-- =============================================================================

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read only their own role
CREATE POLICY "Users can read own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: only service_role can insert
CREATE POLICY "Service role can insert roles"
  ON user_roles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: only service_role can update
CREATE POLICY "Service role can update roles"
  ON user_roles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: only service_role can delete
CREATE POLICY "Service role can delete roles"
  ON user_roles
  FOR DELETE
  TO service_role
  USING (true);

-- =============================================================================
-- ROLLBACK SCRIPT (run manually if needed):
-- =============================================================================
-- DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
-- DROP POLICY IF EXISTS "Service role can insert roles" ON user_roles;
-- DROP POLICY IF EXISTS "Service role can update roles" ON user_roles;
-- DROP POLICY IF EXISTS "Service role can delete roles" ON user_roles;
-- ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
