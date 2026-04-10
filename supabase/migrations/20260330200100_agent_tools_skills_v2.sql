-- =====================================================
-- MIGRATION: Tools & Skills V2
-- Descrição: Ferramentas built-in e habilidades avançadas para agentes IA
-- Data: 2026-03-30
-- =====================================================

-- ── TOOLS V2: Ferramentas built-in para agentes ──

INSERT INTO ai_agent_tools (name, description, function_type, parameters_schema, is_active)
VALUES
  ('transfer_to_human',
   'Transfere o atendimento para um agente humano. Use quando: cliente pede explicitamente, confiança baixa, bug confirmado, assunto jurídico.',
   'builtin',
   '{"type":"object","properties":{"reason":{"type":"string","description":"Motivo da transferência"},"urgency":{"type":"string","enum":["low","medium","high","critical"]}},"required":["reason"]}',
   true),

  ('check_business_hours',
   'Verifica se está dentro do horário comercial e quantos agentes humanos estão online.',
   'builtin',
   '{"type":"object","properties":{}}',
   true),

  ('search_knowledge_base',
   'Pesquisa a base de conhecimento interna por um termo ou pergunta.',
   'builtin',
   '{"type":"object","properties":{"query":{"type":"string","description":"Pergunta ou termo de busca"},"product":{"type":"string","description":"Filtrar por produto: mais_simples, maxpro, ou vazio para todos"}},"required":["query"]}',
   true),

  ('get_client_financial_status',
   'Consulta status financeiro do cliente: faturas pendentes, inadimplência, plano atual.',
   'builtin',
   '{"type":"object","properties":{"client_id":{"type":"string","description":"ID do cliente helpdesk"}},"required":["client_id"]}',
   true),

  ('schedule_callback',
   'Agenda um retorno para o cliente quando o problema requer investigação.',
   'builtin',
   '{"type":"object","properties":{"reason":{"type":"string","description":"Motivo do agendamento"},"when":{"type":"string","description":"Quando retornar: proxima_hora, amanha, proximo_dia_util"}},"required":["reason","when"]}',
   true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parameters_schema = EXCLUDED.parameters_schema,
  is_active = EXCLUDED.is_active;

-- ── SKILLS V2: Habilidades avançadas para agentes ──

INSERT INTO ai_agent_skills (name, slug, description, category, prompt_instructions, auto_activate, trigger_keywords, trigger_intents, is_active, is_system)
VALUES
  ('whatsapp_style',
   'whatsapp-style',
   'Estilo de comunicação WhatsApp — mensagens curtas e humanizadas',
   'atendimento',
   'REGRAS DE ESTILO WHATSAPP:
1. Máximo 2-3 linhas por mensagem individual
2. Se precisar de mais, quebre em múltiplas mensagens curtas
3. Use emojis com moderação (1-2 por mensagem)
4. NUNCA use linguagem corporativa ("prezado", "informamos que", "segue em anexo")
5. Use "você" e nunca "senhor/senhora"
6. Quebre listas longas em mensagens separadas
7. Referências a imagens/áudio: "Vi na imagem que...", "Sobre o que você falou no áudio..."
8. NUNCA envie blocos de texto — é WhatsApp, não email',
   true, '{}', '{}', true, true),

  ('emotional_intelligence',
   'emotional-intelligence',
   'Inteligência emocional — adaptar tom ao humor do cliente',
   'atendimento',
   'PROTOCOLO DE INTELIGÊNCIA EMOCIONAL:
Analise o sentimento do cliente e adapte seu tom:

FRUSTRADO/IRRITADO:
- Valide primeiro: "Sinto muito por isso, {nome}"
- Nunca minimize: "entendo perfeitamente sua frustração"
- Ação imediata: "Vamos resolver agora"
- Se já pediu desculpa, NÃO repita — varie frases

ANSIOSO/URGENTE:
- Calma + agilidade: "Entendo a urgência, já estou vendo"
- Dê previsão: "Em X minutos te retorno"

CONFUSO:
- Simplifique: "Sem problema, vou te guiar passo a passo"
- Use analogias do dia-a-dia

NEUTRO:
- Cordial e eficiente, sem exageros

FELIZ/SATISFEITO:
- Espelhe: "Que ótimo! Fico feliz em ajudar 😊"

ANTI-REPETIÇÃO:
- Varie suas frases — NUNCA entre em loop de "sinto muito"
- Se já demonstrou empatia, avance para a solução',
   true, '{}', '{}', true, true),

  ('anti_hallucination',
   'anti-hallucination',
   'Protocolo anti-alucinação reforçado',
   'general',
   'PROTOCOLO ANTI-ALUCINAÇÃO:
1. NUNCA invente informações, dados, links, telefones, valores ou procedimentos
2. Se não tiver certeza: "Vou verificar essa informação e retorno em breve"
3. SEMPRE baseie respostas na base de conhecimento. Se não encontrar, diga
4. Prefira transferir para humano a dar informação possivelmente incorreta
5. Quando citar dados do cliente, use APENAS o que está nos dados injetados
6. PROIBIDO criar URLs ou links que não existam na base de conhecimento
7. Se o cliente perguntar algo fora do seu escopo, diga: "Essa questão precisa de um especialista. Vou te encaminhar!"',
   true, '{}', '{}', true, true),

  ('step_by_step_guide',
   'step-by-step-guide',
   'Guia passo a passo para resolução de problemas técnicos',
   'tecnico',
   'QUANDO ORIENTAR O CLIENTE EM PASSOS:
1. Numere cada passo claramente: "1.", "2.", "3."
2. Um passo por mensagem (não envie todos de uma vez)
3. Use **negrito** para menus/botões do sistema
4. Aguarde confirmação do cliente entre passos
5. Se o cliente travar em um passo, ofereça alternativa
6. Peça screenshot quando o erro não estiver claro
7. Após último passo, confirme: "Funcionou? Precisa de mais alguma coisa?"',
   false, ARRAY['passo', 'como', 'tutorial', 'ajuda', 'configurar', 'instalar', 'fazer'], ARRAY['support', 'how_to'], true, true),

  ('chopped_message_handler',
   'chopped-message-handler',
   'Tratamento de mensagens picotadas do WhatsApp',
   'atendimento',
   'MENSAGENS PICOTADAS:
Clientes no WhatsApp frequentemente enviam mensagens fragmentadas:
- "oi" → "to com problema" → "no fiscal"

COMPORTAMENTO:
- Se receber fragmento muito curto (1-3 palavras) sem contexto suficiente, aguarde
- Quando tiver contexto completo, responda de forma consolidada
- NUNCA responda cada fragmento individualmente
- Se já tem contexto suficiente para entender, responda normalmente
- Use o histórico da conversa para consolidar fragmentos',
   true, '{}', '{}', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  prompt_instructions = EXCLUDED.prompt_instructions,
  auto_activate = EXCLUDED.auto_activate,
  trigger_keywords = EXCLUDED.trigger_keywords,
  trigger_intents = EXCLUDED.trigger_intents,
  is_active = EXCLUDED.is_active,
  is_system = EXCLUDED.is_system,
  updated_at = now();

-- ── Atribuir skills universais aos agentes que atendem clientes ──

INSERT INTO ai_agent_skill_assignments (agent_id, skill_id, priority, is_enabled)
SELECT a.id, s.id,
  CASE s.name
    WHEN 'whatsapp_style' THEN 1
    WHEN 'emotional_intelligence' THEN 2
    WHEN 'anti_hallucination' THEN 3
    WHEN 'chopped_message_handler' THEN 4
  END,
  true
FROM ai_agents a
CROSS JOIN ai_agent_skills s
WHERE a.specialty IN ('triage', 'support_ms', 'support_maxpro', 'financial', 'sales')
  AND a.is_active = true
  AND s.name IN ('whatsapp_style', 'emotional_intelligence', 'anti_hallucination', 'chopped_message_handler')
ON CONFLICT (agent_id, skill_id) DO NOTHING;

-- step_by_step_guide apenas para suporte técnico
INSERT INTO ai_agent_skill_assignments (agent_id, skill_id, priority, is_enabled)
SELECT a.id, s.id, 5, true
FROM ai_agents a
CROSS JOIN ai_agent_skills s
WHERE a.specialty IN ('support_ms', 'support_maxpro')
  AND a.is_active = true
  AND s.name = 'step_by_step_guide'
ON CONFLICT (agent_id, skill_id) DO NOTHING;
