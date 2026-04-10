
-- ============================================================
-- SECURITY FIX: Restrict access to sensitive credential tables
-- ============================================================

-- 1. whatsapp_business_accounts: Restrict to admin-only (contains access_token)
DROP POLICY IF EXISTS "Authenticated access" ON whatsapp_business_accounts;

CREATE POLICY "Admin access whatsapp_business_accounts"
  ON whatsapp_business_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. uazapi_instances: Restrict to admin-only (contains api_token)
DROP POLICY IF EXISTS "Authenticated access uazapi_instances" ON uazapi_instances;

CREATE POLICY "Admin access uazapi_instances"
  ON uazapi_instances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. incoming_webhooks: Restrict to admin-only (contains webhook tokens)
DROP POLICY IF EXISTS "Authenticated access incoming_webhooks" ON incoming_webhooks;

CREATE POLICY "Admin access incoming_webhooks"
  ON incoming_webhooks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Tighten RLS on core data tables: require actual auth.uid() instead of USING(true)
-- ai_conversations
DROP POLICY IF EXISTS "Authenticated access" ON ai_conversations;

CREATE POLICY "Authenticated users access conversations"
  ON ai_conversations
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ai_messages
DROP POLICY IF EXISTS "Authenticated access" ON ai_messages;

CREATE POLICY "Authenticated users access messages"
  ON ai_messages
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- customer_profiles
DROP POLICY IF EXISTS "Authenticated access customer_profiles" ON customer_profiles;

CREATE POLICY "Authenticated users access customer_profiles"
  ON customer_profiles
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- helpdesk_clients
DROP POLICY IF EXISTS "Authenticated access helpdesk_clients" ON helpdesk_clients;

CREATE POLICY "Authenticated users access helpdesk_clients"
  ON helpdesk_clients
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Revoke direct EXECUTE on sensitive functions from authenticated role
REVOKE EXECUTE ON FUNCTION public.increment_agent_conversation(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_agent_success(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_agent_confidence(uuid, numeric) FROM authenticated;

-- Grant only to service_role (edge functions)
GRANT EXECUTE ON FUNCTION public.increment_agent_conversation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_agent_success(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_agent_confidence(uuid, numeric) TO service_role;
