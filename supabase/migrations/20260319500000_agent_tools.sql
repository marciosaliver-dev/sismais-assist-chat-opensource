-- Migration: Registra tools para agentes IA (function calling)
-- Inclui ferramentas Asaas, Guru, Eduzz e acoes internas

-- ============================================================
-- 1. TOOLS — INSERT
-- ============================================================

INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, method, parameters_schema, is_active, timeout_ms, retry_on_failure, max_retries) VALUES

-- ── Asaas ────────────────────────────────────────────────────
('asaas_find_customer',
 'Buscar cliente Asaas',
 'Busca um cliente na plataforma Asaas pelo CPF ou CNPJ. Retorna dados cadastrais e o customerId necessario para consultar faturas.',
 'edge_function', 'asaas-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "find_customer" },
     "cpfCnpj": { "type": "string", "description": "CPF ou CNPJ do cliente (somente numeros)" }
   },
   "required": ["action", "cpfCnpj"]
 }'::jsonb,
 true, 10000, true, 2),

('asaas_list_payments',
 'Listar faturas Asaas',
 'Lista faturas e cobrancas de um cliente Asaas. Pode filtrar por status: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED.',
 'edge_function', 'asaas-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "list_payments" },
     "customerId": { "type": "string", "description": "ID do cliente no Asaas (retornado por asaas_find_customer)" },
     "status": { "type": "string", "enum": ["PENDING", "RECEIVED", "CONFIRMED", "OVERDUE", "REFUNDED"], "description": "Filtrar por status da cobranca (opcional)" }
   },
   "required": ["action", "customerId"]
 }'::jsonb,
 true, 10000, true, 2),

('asaas_get_payment_link',
 'Link de pagamento Asaas',
 'Obtem o link de pagamento (URL) de uma fatura especifica do Asaas para enviar ao cliente.',
 'edge_function', 'asaas-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "get_payment" },
     "paymentId": { "type": "string", "description": "ID da cobranca no Asaas" }
   },
   "required": ["action", "paymentId"]
 }'::jsonb,
 true, 10000, true, 2),

('asaas_get_boleto',
 'Linha digitavel do boleto',
 'Obtem a linha digitavel (codigo de barras) de um boleto Asaas para o cliente copiar e pagar.',
 'edge_function', 'asaas-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "get_boleto_line" },
     "paymentId": { "type": "string", "description": "ID da cobranca no Asaas" }
   },
   "required": ["action", "paymentId"]
 }'::jsonb,
 true, 10000, true, 2),

('asaas_get_pix',
 'QR Code PIX Asaas',
 'Obtem o QR code e o codigo copia-e-cola PIX de uma cobranca Asaas para o cliente pagar.',
 'edge_function', 'asaas-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "get_pix_qr" },
     "paymentId": { "type": "string", "description": "ID da cobranca no Asaas" }
   },
   "required": ["action", "paymentId"]
 }'::jsonb,
 true, 10000, true, 2),

-- ── Guru ─────────────────────────────────────────────────────
('guru_list_transactions',
 'Listar transacoes Guru',
 'Lista transacoes (compras) de um cliente na plataforma Guru pelo email. Retorna status, valor e data de cada transacao.',
 'edge_function', 'guru-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "list_transactions" },
     "email": { "type": "string", "format": "email", "description": "Email do cliente" }
   },
   "required": ["action", "email"]
 }'::jsonb,
 true, 10000, true, 2),

('guru_list_subscriptions',
 'Listar assinaturas Guru',
 'Lista assinaturas ativas e inativas de um cliente na plataforma Guru pelo email.',
 'edge_function', 'guru-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "list_subscriptions" },
     "email": { "type": "string", "format": "email", "description": "Email do cliente" }
   },
   "required": ["action", "email"]
 }'::jsonb,
 true, 10000, true, 2),

-- ── Eduzz ────────────────────────────────────────────────────
('eduzz_list_sales',
 'Listar vendas Eduzz',
 'Lista vendas de um cliente na plataforma Eduzz pelo email. Retorna status, produto, valor e data.',
 'edge_function', 'eduzz-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "list_sales" },
     "email": { "type": "string", "format": "email", "description": "Email do cliente" }
   },
   "required": ["action", "email"]
 }'::jsonb,
 true, 10000, true, 2),

('eduzz_list_subscriptions',
 'Listar assinaturas Eduzz',
 'Lista assinaturas de um cliente na plataforma Eduzz pelo email. Retorna status, plano e datas.',
 'edge_function', 'eduzz-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "list_subscriptions" },
     "email": { "type": "string", "format": "email", "description": "Email do cliente" }
   },
   "required": ["action", "email"]
 }'::jsonb,
 true, 10000, true, 2),

('eduzz_list_customers',
 'Listar clientes Eduzz',
 'Busca clientes na plataforma Eduzz por email ou CPF. Retorna dados cadastrais do comprador.',
 'edge_function', 'eduzz-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "list_customers" },
     "email": { "type": "string", "format": "email", "description": "Email do cliente" },
     "cpf": { "type": "string", "description": "CPF do cliente (somente numeros)" }
   },
   "required": ["action"]
 }'::jsonb,
 true, 10000, true, 2),

('eduzz_get_sale',
 'Detalhe de venda Eduzz',
 'Consulta detalhes de uma venda especifica na Eduzz pelo ID da venda.',
 'edge_function', 'eduzz-proxy', 'POST',
 '{
   "type": "object",
   "properties": {
     "action": { "type": "string", "const": "get_sale" },
     "saleId": { "type": "string", "description": "ID da venda na Eduzz" }
   },
   "required": ["action", "saleId"]
 }'::jsonb,
 true, 10000, true, 2),

-- ── Acoes Internas ───────────────────────────────────────────
('update_client_data',
 'Alterar dados do cliente',
 'Atualiza um campo cadastral do cliente no helpdesk. Campos permitidos: name, email, phone, address, notes. Use quando o cliente pedir para alterar seus dados.',
 'supabase_rpc', NULL, 'POST',
 '{
   "type": "object",
   "properties": {
     "client_id": { "type": "string", "format": "uuid", "description": "ID do cliente no helpdesk" },
     "field": { "type": "string", "enum": ["name", "email", "phone", "address", "notes"], "description": "Campo a ser alterado" },
     "value": { "type": "string", "description": "Novo valor do campo" }
   },
   "required": ["client_id", "field", "value"]
 }'::jsonb,
 true, 5000, false, 0),

('create_support_ticket',
 'Criar ticket de suporte',
 'Cria um novo ticket (card) no quadro Kanban de suporte. Use quando o cliente reportar um problema que precisa ser acompanhado ou quando o atendimento precisar ser escalado.',
 'supabase_rpc', NULL, 'POST',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string", "description": "Titulo resumido do ticket" },
     "description": { "type": "string", "description": "Descricao detalhada do problema" },
     "priority": { "type": "string", "enum": ["low", "medium", "high", "critical"], "description": "Prioridade do ticket" },
     "client_id": { "type": "string", "format": "uuid", "description": "ID do cliente (opcional)" }
   },
   "required": ["title", "description", "priority"]
 }'::jsonb,
 true, 5000, false, 0),

('get_client_history',
 'Historico de atendimentos',
 'Busca o historico de conversas e atendimentos anteriores do cliente. Util para entender o contexto antes de atender.',
 'supabase_query', NULL, 'POST',
 '{
   "type": "object",
   "properties": {
     "client_id": { "type": "string", "format": "uuid", "description": "ID do cliente no helpdesk" },
     "limit": { "type": "integer", "default": 10, "description": "Quantidade maxima de registros (padrao: 10)" }
   },
   "required": ["client_id"]
 }'::jsonb,
 true, 5000, true, 2),

('get_client_contracts',
 'Contratos do cliente',
 'Busca os contratos ativos e inativos do cliente. Retorna plano, status, datas de inicio e fim.',
 'supabase_query', NULL, 'POST',
 '{
   "type": "object",
   "properties": {
     "client_id": { "type": "string", "format": "uuid", "description": "ID do cliente no helpdesk" }
   },
   "required": ["client_id"]
 }'::jsonb,
 true, 5000, true, 2);


-- ============================================================
-- 2. RPCs — Funcoes SQL para tools internas
-- ============================================================

-- Atualiza campo permitido em helpdesk_clients
CREATE OR REPLACE FUNCTION public.update_client_field(
  p_client_id uuid,
  p_field text,
  p_value text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar campo permitido
  IF p_field NOT IN ('name', 'email', 'phone', 'address', 'notes') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campo nao permitido: ' || p_field);
  END IF;

  -- Atualizar dinamicamente
  EXECUTE format(
    'UPDATE helpdesk_clients SET %I = $1, updated_at = now() WHERE id = $2',
    p_field
  ) USING p_value, p_client_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente nao encontrado');
  END IF;

  RETURN jsonb_build_object('success', true, 'field', p_field, 'value', p_value);
END;
$$;

-- Cria ticket no kanban board de suporte
CREATE OR REPLACE FUNCTION public.create_kanban_ticket(
  p_title text,
  p_description text,
  p_priority text DEFAULT 'medium',
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_board_id uuid;
  v_stage_id uuid;
  v_conversation_id uuid;
BEGIN
  -- Buscar board de suporte (slug = 'suporte' ou primeiro board)
  SELECT id INTO v_board_id
  FROM kanban_boards
  WHERE slug = 'suporte'
  LIMIT 1;

  IF v_board_id IS NULL THEN
    SELECT id INTO v_board_id
    FROM kanban_boards
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_board_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum board kanban encontrado');
  END IF;

  -- Buscar primeiro estagio (coluna) do board
  SELECT id INTO v_stage_id
  FROM kanban_stages
  WHERE board_id = v_board_id
  ORDER BY position ASC
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum estagio encontrado no board');
  END IF;

  -- Criar conversa/ticket
  INSERT INTO ai_conversations (
    title,
    status,
    priority,
    kanban_board_id,
    kanban_stage_id,
    helpdesk_client_id,
    handler_type,
    metadata
  ) VALUES (
    p_title,
    'open',
    p_priority,
    v_board_id,
    v_stage_id,
    p_client_id,
    'ai',
    jsonb_build_object('description', p_description, 'created_by', 'ai_tool')
  )
  RETURNING id INTO v_conversation_id;

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', v_conversation_id,
    'board_id', v_board_id,
    'stage_id', v_stage_id
  );
END;
$$;


-- ============================================================
-- 3. ROLLBACK
-- ============================================================
-- Para reverter esta migration, execute:
--
-- DELETE FROM ai_agent_tools WHERE name IN (
--   'asaas_find_customer', 'asaas_list_payments', 'asaas_get_payment_link',
--   'asaas_get_boleto', 'asaas_get_pix',
--   'guru_list_transactions', 'guru_list_subscriptions',
--   'eduzz_list_sales', 'eduzz_list_subscriptions',
--   'update_client_data', 'create_support_ticket',
--   'get_client_history', 'get_client_contracts'
-- );
--
-- DROP FUNCTION IF EXISTS public.update_client_field(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.create_kanban_ticket(text, text, text, uuid);
