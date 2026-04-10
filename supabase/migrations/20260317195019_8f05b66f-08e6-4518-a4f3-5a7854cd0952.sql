-- View pública sem campos sensíveis (api_token, api_url excluídos)
CREATE OR REPLACE VIEW public.uazapi_instances_public
WITH (security_invoker = on) AS
SELECT id, instance_name, phone_number, status, is_active, kanban_board_id
FROM public.uazapi_instances;

-- Permitir SELECT para qualquer usuário autenticado
GRANT SELECT ON public.uazapi_instances_public TO authenticated;

-- Adicionar policy de SELECT na tabela base para que a view funcione com security_invoker
CREATE POLICY "Authenticated users can read instances via view"
  ON public.uazapi_instances
  FOR SELECT
  TO authenticated
  USING (true);