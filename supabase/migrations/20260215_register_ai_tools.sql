-- Migration: Register AI Tools in ai_agent_tools table
-- Run this AFTER deploying the edge functions

-- Register kanban-create-ticket
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'kanban_create_ticket',
  'Criar Ticket no Kanban',
  'Cria um novo ticket no quadro Kanban. Use quando o cliente reportar um problema.',
  'edge_function',
  'kanban-create-ticket',
  '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"priority":{"type":"string","enum":["baixa","media","alta","critica"]},"board_slug":{"type":"string"},"stage":{"type":"string"}},"required":["title","priority"]}'::jsonb,
  true,
  'supabase_service',
  10000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register kanban-update-ticket
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'kanban_update_ticket',
  'Atualizar Ticket',
  'Atualiza o status/estagio de um ticket existente.',
  'edge_function',
  'kanban-update-ticket',
  '{"type":"object","properties":{"ticket_id":{"type":"string"},"stage":{"type":"string"},"notes":{"type":"string"}},"required":["ticket_id","stage"]}'::jsonb,
  true,
  'supabase_service',
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register add-client-note
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'add_client_note',
  'Adicionar Anotacao',
  'Adiciona uma anotacao ao historico do cliente.',
  'edge_function',
  'add-client-note',
  '{"type":"object","properties":{"client_id":{"type":"string"},"note":{"type":"string"},"category":{"type":"string"}},"required":["client_id","note"]}'::jsonb,
  true,
  'supabase_service',
  5000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register escalate-to-human
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'escalate_to_human',
  'Escalar para Humano',
  'Transfere a conversa para um agente humano.',
  'edge_function',
  'escalate-to-human',
  '{"type":"object","properties":{"conversation_id":{"type":"string"},"reason":{"type":"string"},"priority":{"type":"string"}},"required":["conversation_id"]}'::jsonb,
  true,
  'supabase_service',
  5000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register create-reminder
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'create_reminder',
  'Criar Lembrete',
  'Cria um lembrete para acompanhamento posterior.',
  'edge_function',
  'create-reminder',
  '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"due_date":{"type":"string"},"assign_to":{"type":"string"}},"required":["title","due_date"]}'::jsonb,
  true,
  'supabase_service',
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register schedule-callback
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'schedule_callback',
  'Agendar Retorno',
  'Agenda um retorno telefonico para o cliente.',
  'edge_function',
  'schedule-callback',
  '{"type":"object","properties":{"client_phone":{"type":"string"},"scheduled_time":{"type":"string"},"agent_id":{"type":"string"},"reason":{"type":"string"}},"required":["client_phone","scheduled_time"]}'::jsonb,
  true,
  'supabase_service',
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register send-email
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'send_email',
  'Enviar Email',
  'Envia um email formal para o cliente.',
  'edge_function',
  'send-email',
  '{"type":"object","properties":{"to":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"},"cc":{"type":"string"}},"required":["to","subject","body"]}'::jsonb,
  true,
  'supabase_service',
  15000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Register knowledge-search
INSERT INTO ai_agent_tools (name, display_name, description, function_type, endpoint, parameters_schema, requires_auth, auth_type, timeout_ms, is_active)
VALUES (
  'knowledge_search',
  'Buscar Base de Conhecimento',
  'Busca documentos relevantes na base de conhecimento.',
  'edge_function',
  'knowledge-search',
  '{"type":"object","properties":{"query":{"type":"string"},"top_k":{"type":"integer"},"category":{"type":"string"}},"required":["query"]}'::jsonb,
  false,
  null,
  8000,
  true
) ON CONFLICT (name) DO NOTHING;

-- Assign tools to support agent
DO $$
DECLARE
  support_agent_id UUID;
BEGIN
  SELECT id INTO support_agent_id FROM ai_agents WHERE specialty = 'support' LIMIT 1;
  
  IF support_agent_id IS NOT NULL THEN
    UPDATE ai_agent_tools 
    SET allowed_agents = ARRAY[support_agent_id]
    WHERE name IN ('kanban_create_ticket', 'kanban_update_ticket', 'add_client_note', 'escalate_to_human', 'create_reminder', 'schedule_callback', 'knowledge_search');
  END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_knowledge_with_quality TO service_role;
GRANT EXECUTE ON FUNCTION penalise_knowledge_document TO service_role;

-- Log migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260215_register_ai_tools', 'Register deployed AI tools in ai_agent_tools', NOW())
ON CONFLICT DO NOTHING;
