-- ============================================================
-- Migration: Cancellation Board (Retenção e Cancelamentos)
-- Cria board, stages, categoria, agente IA, automações e CSAT
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Ampliar CHECK constraint de status_type em kanban_stages
-- ============================================================
ALTER TABLE public.kanban_stages DROP CONSTRAINT IF EXISTS kanban_stages_status_type_check;
ALTER TABLE public.kanban_stages
  ADD CONSTRAINT kanban_stages_status_type_check
  CHECK (status_type IN (
    'aguardando', 'em_atendimento', 'finalizado',
    'open', 'in_progress', 'waiting', 'resolved', 'closed'
  ));

-- ============================================================
-- 1. Board: Cancelamentos
-- ============================================================
INSERT INTO public.kanban_boards (name, slug, board_type, color, icon, description, sort_order, active, is_default)
VALUES (
  'Cancelamentos',
  'cancelamentos',
  'cancellation',
  '#DC2626',
  'shield-alert',
  'Board de retenção e cancelamentos — proteger MRR',
  10,
  true,
  false
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Stages (7 etapas)
-- ============================================================
WITH board AS (
  SELECT id FROM public.kanban_boards WHERE slug = 'cancelamentos' LIMIT 1
)
INSERT INTO public.kanban_stages
  (board_id, name, slug, sort_order, color, icon, is_entry, is_exit, is_final, status_type, queue_alert_threshold_minutes, description)
VALUES
  ((SELECT id FROM board), 'Pedido de Cancelamento', 'pedido-cancelamento', 1, '#DC2626', 'alert-triangle', true,  false, false, 'open',        120,  'SLA 2h para assumir'),
  ((SELECT id FROM board), 'Contato Realizado',      'contato-realizado',   2, '#2563EB', 'phone',          false, false, false, 'in_progress', NULL, '1o contato feito'),
  ((SELECT id FROM board), 'Motivo Identificado',    'motivo-identificado', 3, '#7C3AED', 'search',         false, false, false, 'in_progress', NULL, 'Motivo registrado'),
  ((SELECT id FROM board), 'Oferta de Retenção',     'oferta-retencao',     4, '#FFB800', 'gift',           false, false, false, 'in_progress', NULL, 'Oferta apresentada'),
  ((SELECT id FROM board), 'Sem Resposta',           'sem-resposta',        5, '#666666', 'clock',          false, false, false, 'waiting',     NULL, '3+ tentativas sem retorno'),
  ((SELECT id FROM board), 'Revertido',              'revertido',           6, '#16A34A', 'check-circle',   false, true,  true,  'resolved',    NULL, 'Cancelamento revertido'),
  ((SELECT id FROM board), 'Cancelado',              'cancelado',           7, '#DC2626', 'x-circle',       false, true,  true,  'closed',      NULL, 'Cancelamento efetivado');

-- ============================================================
-- 3. Ticket category: Cancelamento
-- ============================================================
INSERT INTO public.ticket_categories (name, color, active, sort_order)
VALUES ('Cancelamento', '#DC2626', true, 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Agente IA de Retenção
-- ============================================================
INSERT INTO public.ai_agents (
  name, specialty, model, temperature, max_tokens, priority, is_active,
  channel_type, rag_enabled, rag_similarity_threshold, rag_top_k,
  confidence_threshold, system_prompt, support_config
)
VALUES (
  'Agente de Retenção',
  'retention',
  'google/gemini-2.0-flash-001',
  0.4,
  1500,
  90,
  true,
  'public',
  true,
  0.70,
  8,
  0.55,
  E'Você é Kira, especialista em retenção de clientes da Sismais Tecnologia.\n'
  E'Seu objetivo é reverter pedidos de cancelamento preservando o relacionamento com o cliente e protegendo o MRR da empresa.\n\n'
  E'## Diretrizes de Atuação\n\n'
  E'### 1. Escuta Ativa\n'
  E'- Ouça atentamente o cliente para entender o REAL motivo do cancelamento.\n'
  E'- Faça perguntas abertas: "Pode me contar mais sobre o que levou a essa decisão?"\n'
  E'- Nunca interrompa ou minimize a insatisfação do cliente.\n\n'
  E'### 2. Empatia e Validação\n'
  E'- Valide os sentimentos do cliente: "Entendo sua frustração e agradeço por compartilhar."\n'
  E'- Mostre que a opinião dele importa para a empresa.\n'
  E'- Use linguagem acolhedora e profissional.\n\n'
  E'### 3. Diagnóstico\n'
  E'- Consulte os dados do cliente (MRR, health score, contratos, histórico de atendimentos).\n'
  E'- Identifique padrões: tempo de uso, frequência de suporte, módulos utilizados.\n'
  E'- Classifique o motivo do cancelamento na lista fechada abaixo.\n\n'
  E'### 4. Ofertas de Retenção Personalizadas\n'
  E'Com base no motivo identificado, ofereça soluções:\n'
  E'- **Preço:** Desconto temporário de até 30% por 3 meses.\n'
  E'- **Falta de uso / não adaptou:** Treinamento dedicado + acompanhamento de 30 dias.\n'
  E'- **Bug ou problema técnico:** Resolução prioritária com SLA reduzido.\n'
  E'- **Insatisfação com suporte:** Canal de suporte dedicado com agente fixo.\n'
  E'- **Fechamento do negócio:** Pausa de assinatura por até 90 dias.\n'
  E'- **Migrou para concorrente:** Análise comparativa + proposta de valor.\n'
  E'- Combine ofertas quando fizer sentido (ex: desconto + treinamento).\n\n'
  E'### 5. Escalação Elegante\n'
  E'- Se o cliente INSISTIR no cancelamento após a oferta, respeite a decisão.\n'
  E'- Marque a mensagem com [ESCALATE] para encaminhar a um supervisor.\n'
  E'- Nunca feche o ticket diretamente — você NÃO tem permissão para isso.\n'
  E'- Despedida: "Respeito sua decisão. Vou encaminhar para nosso time finalizar o processo."\n\n'
  E'### 6. Registro Estruturado\n'
  E'Sempre registre o motivo do cancelamento usando este formato:\n'
  E'```\n'
  E'MOTIVO: [motivo da lista fechada]\n'
  E'DETALHES: [descrição livre do contexto]\n'
  E'OFERTA: [o que foi oferecido]\n'
  E'RESULTADO: [aceito/recusado/pendente]\n'
  E'```\n\n'
  E'## Motivos de Cancelamento (lista fechada)\n'
  E'- Preço\n'
  E'- Fechamento do negócio\n'
  E'- Migrou para concorrente\n'
  E'- Falta de uso/não adaptou\n'
  E'- Insatisfação com suporte\n'
  E'- Bug ou problema técnico não resolvido\n'
  E'- Outro\n\n'
  E'## Ofertas de Retenção Disponíveis\n'
  E'- Desconto temporário (até 30% por 3 meses)\n'
  E'- Pausa de assinatura (até 90 dias)\n'
  E'- Suporte dedicado\n'
  E'- Treinamento personalizado\n'
  E'- Resolução prioritária de bug\n'
  E'- Outro (descrever)\n\n'
  E'## Regras Absolutas\n'
  E'- NUNCA feche um ticket de cancelamento.\n'
  E'- NUNCA prometa algo que não está na lista de ofertas sem escalar.\n'
  E'- SEMPRE registre o motivo mesmo que o cliente desista do cancelamento.\n'
  E'- Responda SEMPRE em português brasileiro.\n',
  '{
    "agentName": "Kira",
    "canCloseTicket": false,
    "escalationTriggers": [
      "cancelamento definitivo",
      "decisão final",
      "não quero mais",
      "cancela por favor",
      "já decidi cancelar"
    ],
    "standardResponses": {
      "resolved": "Que bom que encontramos uma solução! Sua conta continua ativa.",
      "waitingCustomer": "Estou aqui para encontrar a melhor solução para você. Quando puder, me conte mais.",
      "needMoreInfo": "Para ajudar da melhor forma, preciso entender melhor sua situação.",
      "outOfHours": "Recebi sua mensagem! Nossa equipe de retenção retornará em breve com uma proposta especial para você."
    }
  }'::jsonb
);

-- ============================================================
-- 5. Stage Automations
-- ============================================================
WITH board AS (
  SELECT id FROM public.kanban_boards WHERE slug = 'cancelamentos' LIMIT 1
),
stages AS (
  SELECT ks.id, ks.slug
  FROM public.kanban_stages ks
  JOIN board b ON ks.board_id = b.id
),
retention_agent AS (
  SELECT id, name FROM public.ai_agents WHERE name = 'Agente de Retenção' LIMIT 1
)
INSERT INTO public.kanban_stage_automations (kanban_stage_id, trigger_type, action_type, action_config, active, sort_order)
VALUES
  -- Pedido de cancelamento → atribuir agente de retenção
  (
    (SELECT id FROM stages WHERE slug = 'pedido-cancelamento'),
    'on_enter',
    'assign_ai',
    jsonb_build_object('agent_name', (SELECT name FROM retention_agent), 'agent_id', (SELECT id FROM retention_agent)::text),
    true,
    1
  ),
  -- Revertido → marcar ticket como resolvido
  (
    (SELECT id FROM stages WHERE slug = 'revertido'),
    'on_enter',
    'change_ticket_status',
    '{"status": "resolvido"}'::jsonb,
    true,
    1
  ),
  -- Cancelado → marcar ticket como cancelado
  (
    (SELECT id FROM stages WHERE slug = 'cancelado' AND board_id = (SELECT id FROM board)),
    'on_enter',
    'change_ticket_status',
    '{"status": "cancelado"}'::jsonb,
    true,
    1
  );

-- ============================================================
-- 6. Global Automations (ai_automations)
-- ============================================================

-- 6.1 Tag Cancelamento → Board Cancelamentos
INSERT INTO public.ai_automations (name, description, trigger_type, trigger_conditions, actions, is_active)
VALUES (
  'Tag Cancelamento → Board Cancelamentos',
  'Quando a tag "cancelamento" é adicionada a uma conversa, cria ticket no board de cancelamentos',
  'tag_added',
  '{"tag": "cancelamento"}'::jsonb,
  '[{
    "type": "create_conversation",
    "config": {
      "board_slug": "cancelamentos",
      "stage_slug": "pedido-cancelamento",
      "copy_context": true
    }
  }]'::jsonb,
  true
);

-- 6.2 Alerta SLA 2h Cancelamento
INSERT INTO public.ai_automations (name, description, trigger_type, trigger_conditions, actions, is_active, schedule_cron)
VALUES (
  'Alerta SLA 2h Cancelamento',
  'Verifica a cada 15min se há tickets no stage pedido-cancelamento sem atribuição há mais de 2h',
  'scheduled',
  '{
    "board_slug": "cancelamentos",
    "stage_slug": "pedido-cancelamento",
    "condition": "unassigned_older_than_minutes",
    "threshold_minutes": 120
  }'::jsonb,
  '[{
    "type": "send_alert",
    "config": {
      "channel": "internal",
      "severity": "high",
      "message": "⚠️ Ticket de cancelamento aguardando atribuição há mais de 2h — SLA estourado!"
    }
  }]'::jsonb,
  true,
  '*/15 * * * *'
);

-- 6.3 Sem Resposta 5 dias → Cancelado
INSERT INTO public.ai_automations (name, description, trigger_type, trigger_conditions, actions, is_active, schedule_cron)
VALUES (
  'Sem Resposta 5 dias → Cancelado',
  'Move tickets na etapa "sem-resposta" há mais de 5 dias úteis para "cancelado"',
  'scheduled',
  '{
    "board_slug": "cancelamentos",
    "stage_slug": "sem-resposta",
    "condition": "in_stage_older_than_business_days",
    "threshold_business_days": 5
  }'::jsonb,
  '[{
    "type": "move_stage",
    "config": {
      "target_stage_slug": "cancelado",
      "add_note": "Movido automaticamente após 5 dias úteis sem resposta do cliente."
    }
  }]'::jsonb,
  true,
  '0 9 * * 1-5'
);

-- 6.4 Alerta Ticket Parado 24h
INSERT INTO public.ai_automations (name, description, trigger_type, trigger_conditions, actions, is_active, schedule_cron)
VALUES (
  'Alerta Ticket Parado 24h',
  'Alerta para tickets parados há 24h nas etapas intermediárias (contato, motivo, oferta)',
  'scheduled',
  '{
    "board_slug": "cancelamentos",
    "stage_slugs": ["contato-realizado", "motivo-identificado", "oferta-retencao"],
    "condition": "stalled_older_than_hours",
    "threshold_hours": 24
  }'::jsonb,
  '[{
    "type": "send_alert",
    "config": {
      "channel": "internal",
      "severity": "medium",
      "message": "⏰ Ticket de cancelamento parado há 24h — verificar andamento."
    }
  }]'::jsonb,
  true,
  '0 */2 * * 1-5'
);

-- 6.5 3 Tentativas → Sem Resposta
INSERT INTO public.ai_automations (name, description, trigger_type, trigger_conditions, actions, is_active)
VALUES (
  '3 Tentativas → Sem Resposta',
  'Quando o campo context.contact_attempts >= 3, move para sem-resposta',
  'ticket_updated',
  '{
    "board_slug": "cancelamentos",
    "field": "context.contact_attempts",
    "operator": "gte",
    "value": 3
  }'::jsonb,
  '[{
    "type": "move_stage",
    "config": {
      "target_stage_slug": "sem-resposta",
      "add_note": "Movido automaticamente após 3 tentativas de contato sem retorno."
    }
  }]'::jsonb,
  true
);

-- ============================================================
-- 7. CSAT Board Config
-- ============================================================
INSERT INTO public.csat_board_configs (
  board_id, enabled, scale_type, send_on_close, delay_minutes,
  message_template, questions, response_window_hours,
  resend_enabled, resend_after_hours, max_resends, ai_dimensions
)
VALUES (
  (SELECT id FROM public.kanban_boards WHERE slug = 'cancelamentos'),
  true,
  'nps',
  true,
  30,
  E'Olá {{customer_name}}! Seu atendimento sobre cancelamento foi finalizado.\n\nDe 0 a 10, qual a probabilidade de você recomendar a Sismais para um amigo ou colega?\n\nSua opinião é muito importante para melhorarmos nossos serviços.',
  '[
    {"id": "nps_score", "type": "scale", "label": "NPS", "min": 0, "max": 10},
    {"id": "retention_feedback", "type": "text", "label": "O que poderíamos ter feito diferente?"},
    {"id": "offer_satisfaction", "type": "scale", "label": "Satisfação com a oferta apresentada", "min": 1, "max": 5}
  ]'::jsonb,
  48,
  true,
  24,
  2,
  '[
    {"name": "empatia", "weight": 0.3, "description": "O agente demonstrou empatia e compreensão?"},
    {"name": "solucao", "weight": 0.4, "description": "A solução oferecida foi adequada ao problema?"},
    {"name": "clareza", "weight": 0.3, "description": "A comunicação foi clara e profissional?"}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;

COMMIT;
