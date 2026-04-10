import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenRouter } from "../_shared/openrouter-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FileAttachment {
  name: string;
  type: string;
  base64: string; // data URI
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

function extractBase64Content(dataUri: string): string {
  // "data:image/png;base64,iVBOR..." -> "iVBOR..."
  const commaIdx = dataUri.indexOf(",");
  return commaIdx >= 0 ? dataUri.substring(commaIdx + 1) : dataUri;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentConfig, siteContent, files } = await req.json() as {
      messages: any[];
      currentConfig?: any;
      siteContent?: string;
      files?: FileAttachment[];
    };

    const hasImages = files?.some((f) => isImageType(f.type)) ?? false;
    const docFiles = files?.filter((f) => !isImageType(f.type)) ?? [];
    const imageFiles = files?.filter((f) => isImageType(f.type)) ?? [];

    const systemPrompt = `Você é um assistente especializado em configurar agentes de IA para atendimento ao cliente via WhatsApp.

Seu objetivo é fazer perguntas de forma amigável e natural para coletar as informações necessárias para configurar o agente. Faça UMA PERGUNTA por vez, de forma conversacional.

Fluxo de perguntas (siga esta ordem, pule o que já foi respondido):
1. Nome do agente e para que empresa ele atende
2. Qual a especialidade (support, sales, sdr, triage, financial, analyst)
3. Descreva brevemente o que esse agente faz (descrição)
4. Qual o tom de comunicação (profissional, casual, amigável, formal)
5. Qual idioma principal (pt-BR, en, es)
6. Descreva o produto/serviço da empresa
7. Qual a saudação inicial que o agente deve usar
8. Quais são as políticas importantes (horário, garantia, troca)
9. Quando o agente deve escalar para humano

Quando receber conteúdo extraído de um site da empresa, analise automaticamente e extraia:
- Nome da empresa
- Descrição dos produtos/serviços
- Tom de comunicação adequado
- Horários de atendimento (se disponíveis)
- Políticas relevantes (se disponíveis)
- Cores da marca (para a cor do agente)

Quando receber IMAGENS (screenshots, logos, documentos fotografados):
- Analise o conteúdo visual para extrair informações relevantes
- Se for um logo, identifique cores da marca para sugerir a cor do agente
- Se for um screenshot de configuração, extraia as configurações visíveis
- Se for um documento fotografado, leia o texto e extraia informações

Quando receber DOCUMENTOS (PDFs, planilhas, CSVs):
- O conteúdo de texto dos documentos será fornecido como contexto
- Analise para extrair informações sobre a empresa, produtos, políticas, etc.

Se receber conteúdo de site ou arquivos suficientes, gere a configuração completa do agente usando a ferramenta generate_agent_config SEM fazer perguntas adicionais.

Quando tiver informações suficientes, use a ferramenta generate_agent_config para gerar a configuração.

Estado atual da configuração:
${JSON.stringify(currentConfig || {}, null, 2)}

IMPORTANTE: Seja conciso, amigável e use emojis moderadamente. Cada mensagem deve ter no máximo 3-4 linhas.`;

    // Build messages array
    const allMessages = [...(messages || [])];

    // Inject site content if provided
    if (siteContent) {
      allMessages.unshift({
        role: "system",
        content: `CONTEÚDO DO SITE DA EMPRESA (extraído via scraping):\n\n${siteContent}\n\nCom base nessas informações, gere a configuração completa do agente usando a ferramenta generate_agent_config. Não faça perguntas, use as informações do site para preencher todos os campos automaticamente.`,
      });
    }

    // Inject document content as system messages
    for (const doc of docFiles) {
      let textContent = "";
      try {
        // Decode base64 data URI to text
        const raw = extractBase64Content(doc.base64);
        const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
        const decoder = new TextDecoder("utf-8", { fatal: false });
        textContent = decoder.decode(bytes);
      } catch {
        textContent = "[Não foi possível extrair o texto deste documento]";
      }

      // Truncate to 8000 chars
      const truncated = textContent.length > 8000
        ? textContent.substring(0, 8000) + "\n\n[... conteúdo truncado ...]"
        : textContent;

      allMessages.unshift({
        role: "system",
        content: `CONTEÚDO DO DOCUMENTO "${doc.name}" (tipo: ${doc.type}):\n\n${truncated}\n\nUse as informações acima para configurar o agente.`,
      });
    }

    // If last user message has images, convert to multimodal format
    if (imageFiles.length > 0 && allMessages.length > 0) {
      const lastIdx = allMessages.length - 1;
      const lastMsg = allMessages[lastIdx];

      if (lastMsg.role === "user") {
        const contentParts: any[] = [
          { type: "text", text: lastMsg.content || "Analise estas imagens e use as informações para configurar o agente." },
        ];

        for (const img of imageFiles) {
          contentParts.push({
            type: "image_url",
            image_url: { url: img.base64 },
          });
        }

        allMessages[lastIdx] = {
          role: "user",
          content: contentParts,
        };
      }
    }

    // Modelo centralizado — altere em _shared/default-models.ts
    const { DEFAULT_MULTIMODAL_MODEL, DEFAULT_CONTENT_MODEL } = await import('../_shared/default-models.ts')
    const model = hasImages ? DEFAULT_MULTIMODAL_MODEL : DEFAULT_CONTENT_MODEL;
    const forceToolCall = !!(siteContent || (files && files.length > 0 && docFiles.length > 0));

    const tools = [
      {
        type: "function",
        function: {
          name: "generate_agent_config",
          description: "Generate the complete agent configuration based on collected information. Call this when you have enough info to configure the agent.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Agent name" },
              description: { type: "string", description: "Brief description of what the agent does" },
              specialty: { type: "string", enum: ["support", "sales", "sdr", "triage", "financial", "analyst"] },
              system_prompt: { type: "string", description: "Complete system prompt for the agent behavior" },
              tone: { type: "string", enum: ["professional", "casual", "friendly", "formal"] },
              language: { type: "string", enum: ["pt-BR", "en", "es"] },
              color: { type: "string", description: "Hex color for the agent avatar" },
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
          },
        },
      },
    ];

    const result = await callOpenRouter({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...allMessages,
      ],
      tools,
      tool_choice: forceToolCall ? { type: "function", function: { name: "generate_agent_config" } } : "auto",
    });

    const choice = result.raw_choice;

    // Check if the model wants to call a tool
    if (choice?.message?.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === "generate_agent_config") {
        let config;
        try {
          config = JSON.parse(toolCall.function.arguments);
        } catch (parseErr) {
          console.error('[agent-configurator] Failed to parse tool args:', toolCall.function.arguments);
          return new Response(JSON.stringify({
            type: "message",
            message: "Desculpe, tive um problema ao processar a configuração. Pode repetir as informações?",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          type: "config",
          config,
          message: "✅ Configuração gerada! Revise os campos e ajuste o que precisar.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Regular message response
    return new Response(JSON.stringify({
      type: "message",
      message: choice?.message?.content || "Desculpe, não entendi. Pode repetir?",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
