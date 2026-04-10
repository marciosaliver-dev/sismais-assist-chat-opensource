import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenRouter } from "../_shared/openrouter-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Voce e um assistente especializado em criar fluxos de automacao para atendimento via WhatsApp.

O usuario descreve o que deseja em linguagem natural e voce gera a estrutura do fluxo usando a tool "generate_flow".

## Tipos de Nodes Disponiveis (15 tipos)

1. **trigger** - Gatilho inicial. Config: { trigger_type: "message_received" | "ticket_created" | "scheduled" | "webhook", keywords?: string[] }
2. **send_message** - Enviar mensagem. Config: { message: string }
3. **ai_response** - Resposta da IA. Config: { agent_name?: string, context?: string }
4. **assign_human** - Atribuir a humano. Config: { strategy: "specific" | "round_robin" | "least_busy", agent_name?: string }
5. **assign_ai** - Atribuir a agente IA. Config: { agent_name?: string }
6. **condition** - Condicao IF/ELSE (2 saidas: true/false). Config: { field: string, operator: "equals"|"not_equals"|"contains"|"not_contains"|"greater_than"|"less_than", value: string }
7. **switch** - Switch com multiplas saidas. Config: { field: string, cases: [{ value: string, label: string }] }
8. **delay** - Aguardar tempo. Config: { duration: number, unit: "seconds"|"minutes"|"hours" }
9. **http_request** - Requisicao HTTP. Config: { url: string, method: "GET"|"POST"|"PUT"|"DELETE" }
10. **add_tag** - Adicionar tag. Config: { tag: string }
11. **set_variable** - Definir variavel. Config: { variable_name: string, value: string }
12. **update_field** - Atualizar campo. Config: { entity: "conversation"|"contact", field: string, value: string }
13. **jump_to_flow** - Ir para outro fluxo. Config: { flow_name: string }
14. **search_knowledge** - Busca RAG na base de conhecimento. Config: { query: string, top_k?: number }
15. **end** - Fim do fluxo. Config: { reason?: string }

## Regras de Conexao
- Todo fluxo DEVE comecar com um node "trigger"
- "end" so pode ser o ultimo node de um branch
- "condition" tem 2 saidas: sourceHandle "true" e "false"
- "switch" tem N saidas: sourceHandle igual ao value de cada case, mais "default"
- Cada node so pode ter uma entrada (exceto trigger que nao tem entrada)

## Regras de Posicionamento
- Layout em arvore vertical
- Trigger no topo: position { x: 400, y: 0 }
- Cada nivel seguinte: y += 150
- Branches lado a lado: espacamento horizontal de 300px
- Centralizar branches em relacao ao pai

## Labels dos Nodes
Use labels descritivos em portugues:
- trigger: "Gatilho"
- send_message: "Enviar Mensagem"
- ai_response: "Resposta IA"
- assign_human: "Atribuir Humano"
- assign_ai: "Atribuir IA"
- condition: "Condição"
- switch: "Switch"
- delay: "Aguardar"
- http_request: "HTTP Request"
- add_tag: "Adicionar Tag"
- set_variable: "Definir Variável"
- update_field: "Atualizar Campo"
- jump_to_flow: "Ir para Fluxo"
- search_knowledge: "Busca RAG"
- end: "Fim"

Quando o usuario fornecer nodes/edges existentes, voce pode modificar, adicionar ou remover nodes incrementalmente.
Sempre retorne o fluxo COMPLETO (todos os nodes e edges), nao apenas as mudancas.
Inclua uma descricao clara do que foi criado/modificado.`;

const GENERATE_FLOW_TOOL = {
  type: "function",
  function: {
    name: "generate_flow",
    description:
      "Gera a estrutura completa de um fluxo de automacao com nodes e edges para o canvas visual.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description:
            "Descricao resumida do fluxo gerado, explicando o que cada parte faz.",
        },
        nodes: {
          type: "array",
          description: "Lista de nodes do fluxo",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description:
                  "ID unico do node, formato: tipo-timestamp (ex: trigger-1)",
              },
              type: {
                type: "string",
                enum: [
                  "trigger",
                  "send_message",
                  "ai_response",
                  "assign_human",
                  "assign_ai",
                  "condition",
                  "switch",
                  "delay",
                  "http_request",
                  "add_tag",
                  "set_variable",
                  "update_field",
                  "jump_to_flow",
                  "search_knowledge",
                  "end",
                ],
              },
              position: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                },
                required: ["x", "y"],
              },
              data: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  config: { type: "object" },
                },
                required: ["label", "config"],
              },
            },
            required: ["id", "type", "position", "data"],
          },
        },
        edges: {
          type: "array",
          description: "Lista de conexoes entre nodes",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              source: { type: "string" },
              target: { type: "string" },
              sourceHandle: {
                type: "string",
                description:
                  "Handle de saida (obrigatorio para condition: 'true'/'false', para switch: valor do case ou 'default')",
              },
              label: { type: "string" },
            },
            required: ["id", "source", "target"],
          },
        },
      },
      required: ["description", "nodes", "edges"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, messages: chatHistory, currentNodes, currentEdges } = await req.json();

    // Build messages array
    const llmMessages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

    // Add context about current canvas state
    if (currentNodes?.length > 0) {
      llmMessages.push({
        role: "system",
        content: `Estado atual do canvas:\nNodes: ${JSON.stringify(currentNodes)}\nEdges: ${JSON.stringify(currentEdges || [])}`,
      });
    }

    // Add chat history
    if (chatHistory?.length) {
      for (const msg of chatHistory) {
        llmMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    llmMessages.push({ role: "user", content: message });

    const result = await callOpenRouter({
      model: "google/gemini-3-flash-preview",
      messages: llmMessages,
      tools: [GENERATE_FLOW_TOOL],
      tool_choice: { type: "function", function: { name: "generate_flow" } },
      temperature: 0.3,
    });

    const toolCall = result.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "generate_flow") {
      // Fallback: return text response
      const textContent = result.content || "Não consegui gerar o fluxo. Tente descrever novamente.";
      return new Response(
        JSON.stringify({ type: "text", content: textContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const flowData = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        type: "flow",
        description: flowData.description,
        nodes: flowData.nodes,
        edges: flowData.edges,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("flow-ai-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
