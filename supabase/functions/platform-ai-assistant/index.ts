import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenRouter, callOpenRouterWithFallback, OpenRouterError } from "../_shared/openrouter-client.ts";
import { DEFAULT_FALLBACK_CHAIN } from "../_shared/default-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchPlatformData(supabase: ReturnType<typeof createClient>) {
  const [boardsRes, stagesRes, agentsRes, categoriesRes, modulesRes, humanAgentsRes] = await Promise.all([
    supabase.from("kanban_boards").select("id, name, description").eq("active", true),
    supabase.from("kanban_stages").select("id, name, board_id, position, status_type").eq("active", true),
    supabase.from("ai_agents").select("id, name, specialty, description, system_prompt, tone, language, color, support_config, tools, confidence_threshold, rag_enabled, priority").eq("is_active", true),
    supabase.from("ticket_categories").select("id, name"),
    supabase.from("ticket_modules").select("id, name"),
    supabase.from("human_agents").select("id, name, role, is_active").eq("is_active", true),
  ]);

  return {
    boards: boardsRes.data || [],
    stages: stagesRes.data || [],
    ai_agents: agentsRes.data || [],
    categories: categoriesRes.data || [],
    modules: modulesRes.data || [],
    human_agents: humanAgentsRes.data || [],
  };
}

function buildSystemPrompt(context: string, platformData: any, currentConfig?: any) {
  const baseKnowledge = `
## Dados da Plataforma (consulta dinâmica)

**Boards Kanban:** ${JSON.stringify(platformData.boards)}
**Etapas:** ${JSON.stringify(platformData.stages)}
**Agentes IA:** ${JSON.stringify(platformData.ai_agents)}
**Agentes Humanos:** ${JSON.stringify(platformData.human_agents)}
**Categorias:** ${JSON.stringify(platformData.categories)}
**Módulos:** ${JSON.stringify(platformData.modules)}

## Plataformas de Cobrança Suportadas
- **Asaas**: Eventos PAYMENT_OVERDUE, PAYMENT_RECEIVED, SUBSCRIPTION_INACTIVATED
- **Eduzz**: Eventos de inadimplência e pagamento
- **Guru**: Eventos de assinatura e fatura

## Campos de Webhook de Cobrança
cliente_nome, cliente_documento, cliente_email, cliente_telefone, plataforma, evento, id_externo, plano_nome, valor_assinatura, data_vencimento, forma_pagamento, fatura_id, fatura_valor, fatura_vencimento, fatura_link
`;

  if (context === "agent") {
    return `Você é um assistente especializado em configurar agentes de IA para atendimento ao cliente via WhatsApp.

## Tipos de Agente disponíveis:
- **triage**: Orquestra e direciona para outros agentes (entrada do fluxo)
- **support**: Atendimento e suporte técnico ao cliente
- **financial**: Cobrança, pagamentos, inadimplência
- **sales / sdr**: Qualificação de leads e vendas
- **copilot**: Auxilia agentes humanos com sugestões em tempo real (não responde ao cliente)
- **analytics**: Gera relatórios, métricas e indicadores automáticos

Seu objetivo é fazer perguntas de forma amigável e natural. Faça UMA PERGUNTA por vez.

Fluxo de perguntas:
1. Qual o papel/função deste agente? (triage, support, financial, sales, copilot, analytics)
2. Nome do agente e empresa
3. Descrição breve do que ele faz
4. Tom (profissional, casual, amigável, formal)
5. Idioma (pt-BR, en, es)
6. Produto/serviço da empresa (se atendimento)
7. Saudação inicial (se atendimento ao cliente)
8. Políticas importantes (horário, garantia, troca)
9. Quando escalar para humano

Quando tiver informações suficientes, use a ferramenta generate_agent_config.

Config atual: ${JSON.stringify(currentConfig || {})}

${baseKnowledge}

IMPORTANTE: Seja conciso, amigável e use emojis moderadamente. Máximo 3-4 linhas por mensagem.`;
  }

  if (context === "webhook") {
    return `Você é um assistente especializado em configurar webhooks de entrada para a plataforma de atendimento.

Seu objetivo é entender o que o usuário quer integrar e gerar a configuração do webhook automaticamente. Faça perguntas de forma natural e conversacional.

Fluxo de perguntas:
1. Qual sistema/plataforma vai enviar os webhooks? (Asaas, Eduzz, Guru, CRM, ERP, etc)
2. Qual o objetivo? (cobrança, onboarding, atualização de cliente, etc)
3. Quais dados serão enviados? (nome, telefone, email, valor, etc)
4. O que deve acontecer quando o webhook for recebido? (criar atendimento, mapear cliente, notificar agente, etc)
5. Em qual board/etapa o ticket deve ser criado?
6. Qual agente deve ser atribuído?

Quando tiver informações suficientes, use a ferramenta generate_webhook_config.

Para webhooks de cobrança, use template_type: "billing" que redireciona automaticamente para a lógica especializada de deduplicação por fatura.

${baseKnowledge}

IMPORTANTE: Seja conciso e prático. Máximo 3-4 linhas por mensagem.`;
  }

  if (context === "automation") {
    return `Você é um assistente especializado em criar automações para a plataforma de atendimento.

Ajude o usuário a criar automações baseadas em eventos do sistema.

Triggers disponíveis: message_received, conversation_started, status_changed, stage_changed, csat_received, schedule
Ações disponíveis: assign_agent, change_stage, send_message, add_tag, remove_tag, notify, close_conversation

Faça perguntas para entender o que o usuário quer automatizar. Quando tiver informações suficientes, use generate_automation_config.

${baseKnowledge}

IMPORTANTE: Seja conciso e prático. Máximo 3-4 linhas por mensagem.`;
  }

  return `Você é um assistente inteligente da plataforma de atendimento. Ajude o usuário com configurações de agentes, webhooks ou automações.
${baseKnowledge}`;
}

function getTools(context: string) {
  const tools: any[] = [];

  if (context === "agent" || context === "general") {
    tools.push({
      type: "function",
      function: {
        name: "generate_agent_config",
        description: "Generate complete agent configuration.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            specialty: { type: "string", enum: ["support", "sales", "sdr", "triage", "financial", "analyst", "analytics", "copilot"] },
            system_prompt: { type: "string" },
            tone: { type: "string", enum: ["professional", "casual", "friendly", "formal"] },
            language: { type: "string", enum: ["pt-BR", "en", "es"] },
            color: { type: "string" },
            support_config: {
              type: "object",
              properties: {
                companyName: { type: "string" },
                companyDescription: { type: "string" },
                productsServices: { type: "string" },
                greeting: { type: "string" },
                supportHours: { type: "string" },
                escalationMessage: { type: "string" },
                escalationRules: { type: "string" },
              },
            },
          },
          required: ["name", "specialty", "system_prompt", "tone", "language"],
          additionalProperties: false,
        },
      },
    });
  }

  if (context === "webhook" || context === "general") {
    tools.push({
      type: "function",
      function: {
        name: "generate_webhook_config",
        description: "Generate webhook configuration with name, actions, field mapping and template type.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            template_type: { type: "string", enum: ["onboarding", "inadimplente", "billing", "custom"], description: "Use 'billing' for billing/payment webhooks" },
            action_mode: { type: "string", enum: ["direct", "flow"] },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action_type: { type: "string", enum: ["map_client_fields", "create_conversation", "assign_board_stage", "assign_agent", "send_welcome_message"] },
                  config: { type: "object" },
                },
                required: ["action_type"],
              },
            },
            field_mapping: {
              type: "object",
              description: "Map payload fields to system fields (e.g. 'cliente_nome' -> 'helpdesk_clients.name')",
            },
          },
          required: ["name", "template_type", "action_mode"],
          additionalProperties: false,
        },
      },
    });
  }

  if (context === "automation" || context === "general") {
    tools.push({
      type: "function",
      function: {
        name: "generate_automation_config",
        description: "Generate automation configuration with trigger, conditions and actions.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            trigger_type: { type: "string", enum: ["message_received", "conversation_started", "status_changed", "stage_changed", "csat_received", "schedule"] },
            trigger_conditions: { type: "object" },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action_type: { type: "string" },
                  config: { type: "object" },
                },
                required: ["action_type"],
              },
            },
          },
          required: ["name", "trigger_type", "actions"],
          additionalProperties: false,
        },
      },
    });
  }

  return tools;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context = "general", currentConfig } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const platformData = await fetchPlatformData(supabase as any);
    const systemPrompt = buildSystemPrompt(context, platformData, currentConfig);
    const tools = getTools(context);

    const result = await callOpenRouterWithFallback({
      models: DEFAULT_FALLBACK_CHAIN.slice(0, 2),
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      tools,
      tool_choice: "auto",
    });

    const choice = result.raw_choice;

    if (choice?.message?.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      const fnName = toolCall.function.name;
      const config = JSON.parse(toolCall.function.arguments);

      return new Response(JSON.stringify({
        type: "config",
        tool: fnName,
        config,
        message: choice.message.content || `✅ Configuração gerada! Revise e aplique.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      type: "message",
      message: choice?.message?.content || "Desculpe, não entendi. Pode repetir?",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof OpenRouterError && error.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Verifique o saldo da conta OpenRouter." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
