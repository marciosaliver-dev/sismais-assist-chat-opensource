-- Create schema_migrations table if not exists
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add essential AI agent tools for autonomous CRM
-- Run this migration to enable real actions by AI agents

-- Insert core tools that agents can use to perform actions

-- 1. Create Kanban Ticket
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'create_ticket',
  'Criar Ticket',
  'Cria um novo ticket no quadro Kanban. Use quando o cliente reportar um problema que precisa ser rastreado.',
  'edge_function',
  'kanban-create-ticket',
  '{
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Título do ticket" },
      "description": { "type": "string", "description": "Descrição detalhada" },
      "priority": { "type": "string", "enum": ["baixa", "media", "alta", "critica"], "description": "Prioridade" },
      "board_slug": { "type": "string", "description": "Slug do board (default: suporte)" },
      "stage": { "type": "string", "description": "Estágio inicial (default: novo)" },
      "tags": { "type": "array", "items": { "type": "string" }, "description": "Tags do ticket" }
    },
    "required": ["title", "priority"]
  }'::jsonb,
  true,
  'supabase_service',
  10000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 2. Update Ticket Status
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'update_ticket_status',
  'Atualizar Status do Ticket',
  'Atualiza o status/estágio de um ticket existente. Use para mover tickets no Kanban.',
  'edge_function',
  'kanban-update-ticket',
  '{
    "type": "object",
    "properties": {
      "ticket_id": { "type": "string", "description": "ID do ticket" },
      "stage": { "type": "string", "description": "Novo estágio (novo, em_atendimento, aguardando, resolvido, fechado)" },
      "notes": { "type": "string", "description": "Notas sobre a atualização" }
    },
    "required": ["ticket_id", "stage"]
  }'::jsonb,
  true,
  'supabase_service',
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 3. Send Email
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'send_email',
  'Enviar Email',
  'Envia um email para o cliente. Use para comunicações formais ou documentos.',
  'edge_function',
  'send-email',
  '{
    "type": "object",
    "properties": {
      "to": { "type": "string", "description": "Email do destinatário" },
      "subject": { "type": "string", "description": "Assunto do email" },
      "body": { "type": "string", "description": "Corpo do email (HTML suportado)" },
      "cc": { "type": "string", "description": "Emails em cópia" },
      "attachments": { "type": "array", "items": { "type": "object" }, "description": "Anexos" }
    },
    "required": ["to", "subject", "body"]
  }'::jsonb,
  true,
  'smtp',
  15000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 4. Search Client Records (Sismais GL)
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'search_client_records',
  'Buscar Dados do Cliente',
  'Busca informações completas do cliente no Sismais GL (contratos, débitos, produtos).',
  'edge_function',
  'sismais-client-lookup',
  '{
    "type": "object",
    "properties": {
      "client_id": { "type": "string", "description": "ID do cliente" },
      "cnpj": { "type": "string", "description": "CNPJ do cliente" },
      "include_contracts": { "type": "boolean", "description": "Incluir contratos" },
      "include_debts": { "type": "boolean", "description": "Incluir débitos" },
      "include_products": { "type": "boolean", "description": "Incluir produtos" }
    }
  }'::jsonb,
  true,
  'sismais_gl',
  12000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 5. Create Reminder
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'create_reminder',
  'Criar Lembrete',
  'Cria um lembrete/agendamento para acompanhamento posterior.',
  'edge_function',
  'create-reminder',
  '{
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Título do lembrete" },
      "description": { "type": "string", "description": "Descrição" },
      "due_date": { "type": "string", "description": "Data/hora no formato ISO" },
      "assign_to": { "type": "string", "description": "ID do agente" },
      "client_id": { "type": "string", "description": "ID do cliente relacionado" }
    },
    "required": ["title", "due_date"]
  }'::jsonb,
  true,
  'supabase_service',
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 6. Add Note to Client
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'add_client_note',
  'Adicionar Anotação ao Cliente',
  'Adiciona uma anotação ao histórico do cliente para referência futura.',
  'edge_function',
  'add-client-note',
  '{
    "type": "object",
    "properties": {
      "client_id": { "type": "string", "description": "ID do cliente" },
      "note": { "type": "string", "description": "Texto da anotação" },
      "category": { "type": "string", "description": "Categoria (atendimento, financeiro, técnico)" }
    },
    "required": ["client_id", "note"]
  }'::jsonb,
  true,
  'supabase_service',
  5000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 7. Send WhatsApp Message
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'send_whatsapp_message',
  'Enviar Mensagem WhatsApp',
  'Envia uma mensagem WhatsApp para o cliente via UAZAPI.',
  'edge_function',
  'uazapi-proxy',
  '{
    "type": "object",
    "properties": {
      "chatJid": { "type": "string", "description": "ID do chat" },
      "text": { "type": "string", "description": "Texto da mensagem" },
      "type": { "type": "string", "enum": ["text", "image", "document"], "description": "Tipo de mensagem" },
      "mediaUrl": { "type": "string", "description": "URL do mídia (se type não for text)" }
    },
    "required": ["chatJid", "text"]
  }'::jsonb,
  true,
  'supabase_service',
  10000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 8. Search Knowledge Base
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'search_knowledge_base',
  'Buscar Base de Conhecimento',
  'Busca documentos relevantes na base de conhecimento para responder perguntas.',
  'edge_function',
  'knowledge-search',
  '{
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Query de busca" },
      "top_k": { "type": "integer", "description": "Número de resultados (default: 5)" },
      "category": { "type": "string", "description": "Categoria do documento" }
    },
    "required": ["query"]
  }'::jsonb,
  false,
  null,
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 9. Escalate to Human
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'escalate_to_human',
  'Escalar para Humano',
  'Transfere a conversa para um agente humano. Use quando precisar de intervenção humana.',
  'edge_function',
  'escalate-to-human',
  '{
    "type": "object",
    "properties": {
      "conversation_id": { "type": "string", "description": "ID da conversa" },
      "reason": { "type": "string", "description": "Motivo da escalação" },
      "priority": { "type": "string", "enum": ["normal", "high", "urgent"], "description": "Prioridade" }
    },
    "required": ["conversation_id"]
  }'::jsonb,
  true,
  'supabase_service',
  5000,
  true
) ON CONFLICT (name) DO NOTHING;

-- 10. Schedule Callback
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'schedule_callback',
  'Agendar Retorno',
  'Agenda um retorno telefônico para o cliente.',
  'edge_function',
  'schedule-callback',
  '{
    "type": "object",
    "properties": {
      "client_phone": { "type": "string", "description": "Telefone do cliente" },
      "scheduled_time": { "type": "string", "description": "Data/hora no formato ISO" },
      "agent_id": { "type": "string", "description": "ID do agente que retornará" },
      "reason": { "type": "string", "description": "Motivo do retorno" }
    },
    "required": ["client_phone", "scheduled_time"]
  }'::jsonb,
  true,
  'supabase_service',
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260214_add_ai_tools', 'Add essential AI agent tools for autonomous CRM', NOW())
ON CONFLICT DO NOTHING;
