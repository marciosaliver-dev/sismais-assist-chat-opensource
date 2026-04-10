import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenRouter } from "../_shared/openrouter-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um **Redator Especialista em Manuais** para pequenos comerciantes e varejistas brasileiros.

## Regras obrigatórias

1. **Linguagem simples** — escreva como se estivesse explicando para o dono de uma padaria, mercadinho ou loja de roupas. NUNCA use termos técnicos como "interface", "renderizar", "endpoint", "parametrizar". Use palavras do dia a dia.

2. **Formato passo a passo numerado** — sempre organize o conteúdo em passos claros e numerados. Cada passo deve ter um título curto e uma explicação.

3. **Exemplos práticos** — em CADA passo, dê um exemplo real do cotidiano do pequeno varejista. Ex: "Imagine que você vendeu 3 pães franceses e 1 refrigerante para o seu Antônio..."

4. **Emojis e destaques** — use emojis relevantes (📋, ✅, 💡, ⚠️, 🖱️, 📱) para tornar a leitura agradável. Use <mark> para destacar textos importantes e <strong> para botões e menus.

5. **Referência à tela** — quando citar botões, menus ou campos da tela, coloque entre aspas e em negrito. Ex: Clique no botão <strong>"Finalizar Venda"</strong>.

6. **Dicas e alertas** — inclua blocos de dica e alerta quando relevante:
   - Dica: <div class="tip">💡 <strong>Dica:</strong> texto da dica</div>
   - Alerta: <div class="warning">⚠️ <strong>Atenção:</strong> texto do alerta</div>

7. **HTML válido** — retorne APENAS HTML válido (sem markdown). Use: <h2>, <h3>, <p>, <ol>, <li>, <strong>, <mark>, <div class="tip">, <div class="warning">, <img>.

8. **Estrutura do manual**:
   - Título em <h2> com emoji
   - Breve introdução (1-2 frases simples)
   - Passos numerados em <ol> com <li>
   - Cada passo: título em <h3>, explicação em <p>, exemplo prático
   - Conclusão breve

9. Se receber uma imagem de tela, descreva EXATAMENTE o que aparece nela e crie o manual baseado nos elementos visuais.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, module, suggested_title, refinement_prompt, conversation_history } = await req.json();

    // Build messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history if present
    if (conversation_history && Array.isArray(conversation_history)) {
      messages.push(...conversation_history);
    }

    // Build user message
    const userContent: any[] = [];

    if (image_base64) {
      userContent.push({
        type: "image_url",
        image_url: { url: image_base64.startsWith("data:") ? image_base64 : `data:image/png;base64,${image_base64}` },
      });
    }

    let textPrompt = "";
    if (refinement_prompt) {
      textPrompt = refinement_prompt;
    } else if (image_base64) {
      textPrompt = `Analise esta tela do sistema${module ? ` (módulo: ${module})` : ""} e crie um manual completo em HTML, passo a passo, com linguagem simples para o pequeno varejista.${suggested_title ? ` O título sugerido é: "${suggested_title}".` : ""}`;
    } else {
      textPrompt = `Crie um manual em HTML sobre "${suggested_title || "como usar o sistema"}"${module ? ` no módulo ${module}` : ""}, com linguagem simples para o pequeno varejista.`;
    }

    userContent.push({ type: "text", text: textPrompt });
    messages.push({ role: "user", content: userContent });

    const { DEFAULT_CONTENT_MODEL } = await import('../_shared/default-models.ts')
    const result = await callOpenRouter({
      model: DEFAULT_CONTENT_MODEL,
      messages,
      max_tokens: 4096,
    });

    let htmlContent = result.content || "";

    // Clean markdown code fences if the model wraps in ```html
    htmlContent = htmlContent.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    // Try to extract a title from the generated content
    const titleMatch = htmlContent.match(/<h2[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/h2>/i);
    const extractedTitle = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim()
      : suggested_title || "";

    return new Response(
      JSON.stringify({
        html_content: htmlContent,
        suggested_title: extractedTitle,
        suggested_tags: [module || "geral"],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-manual-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
