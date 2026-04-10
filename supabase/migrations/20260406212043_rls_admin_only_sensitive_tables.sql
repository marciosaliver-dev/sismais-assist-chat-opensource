-- =====================================================================
-- Security hardening: restringe escrita em tabelas sensíveis a admins
-- =====================================================================
-- Tabelas afetadas:
--   * ai_agents          (configuração de agentes IA)
--   * uazapi_instances   (credenciais/instâncias WhatsApp)
--   * ai_knowledge_base  (base de conhecimento RAG)
--
-- Antes: policies USING (true) — qualquer authenticated user podia
-- INSERT/UPDATE/DELETE.
-- Depois: SELECT continua liberado para authenticated (necessário para
-- o frontend funcionar), mas INSERT/UPDATE/DELETE restritos a admins
-- via has_role(auth.uid(), 'admin').
-- =====================================================================

-- ---------------------------------------------------------------------
-- ai_agents
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read agents"   ON public.ai_agents;
DROP POLICY IF EXISTS "Authenticated insert agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Authenticated update agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Authenticated delete agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Authenticated access ai_agents" ON public.ai_agents;

CREATE POLICY "ai_agents_select_authenticated"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_agents_insert_admin"
  ON public.ai_agents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ai_agents_update_admin"
  ON public.ai_agents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ai_agents_delete_admin"
  ON public.ai_agents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------
-- uazapi_instances
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated access uazapi_instances" ON public.uazapi_instances;
DROP POLICY IF EXISTS "Authenticated read uazapi_instances"   ON public.uazapi_instances;
DROP POLICY IF EXISTS "Authenticated insert uazapi_instances" ON public.uazapi_instances;
DROP POLICY IF EXISTS "Authenticated update uazapi_instances" ON public.uazapi_instances;
DROP POLICY IF EXISTS "Authenticated delete uazapi_instances" ON public.uazapi_instances;

CREATE POLICY "uazapi_instances_select_authenticated"
  ON public.uazapi_instances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "uazapi_instances_insert_admin"
  ON public.uazapi_instances FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "uazapi_instances_update_admin"
  ON public.uazapi_instances FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "uazapi_instances_delete_admin"
  ON public.uazapi_instances FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------
-- ai_knowledge_base
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated access" ON public.ai_knowledge_base;
DROP POLICY IF EXISTS "Authenticated access ai_knowledge_base" ON public.ai_knowledge_base;
DROP POLICY IF EXISTS "Authenticated read ai_knowledge_base"   ON public.ai_knowledge_base;
DROP POLICY IF EXISTS "Authenticated insert ai_knowledge_base" ON public.ai_knowledge_base;
DROP POLICY IF EXISTS "Authenticated update ai_knowledge_base" ON public.ai_knowledge_base;
DROP POLICY IF EXISTS "Authenticated delete ai_knowledge_base" ON public.ai_knowledge_base;

CREATE POLICY "ai_knowledge_base_select_authenticated"
  ON public.ai_knowledge_base FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_knowledge_base_insert_admin"
  ON public.ai_knowledge_base FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ai_knowledge_base_update_admin"
  ON public.ai_knowledge_base FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ai_knowledge_base_delete_admin"
  ON public.ai_knowledge_base FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
