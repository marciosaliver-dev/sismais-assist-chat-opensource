import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { conversation_id, resolution_summary } = body;

    if (!conversation_id) {
      return jsonResponse({ error: "conversation_id required" }, 400);
    }

    // Guardrail: não roda se resolution_summary vazio
    if (!resolution_summary?.trim()) {
      return jsonResponse({ skipped: true, reason: "empty_resolution_summary" });
    }

    // Busca dados da conversa: problem_summary
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("problem_summary, ticket_category_id, ticket_module_id")
      .eq("id", conversation_id)
      .single();

    // Busca últimas 30 mensagens
    const { data: messages } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(30);

    const conversationText = (messages || [])
      .reverse()
      .map((m) => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return jsonResponse({ error: "OPENROUTER_API_KEY not set" }, 500);

    const prompt = `Você é um analisador de tickets de suporte técnico.

Problema reportado: "${conv?.problem_summary || "Não informado"}"
O atendente registrou como resolução: "${resolution_summary}"

Histórico da conversa:
${conversationText.substring(0, 4000)}

Com base nisso, gere:
1. Um resumo objetivo da SOLUÇÃO aplicada (máximo 300 caracteres)
2. Se a categoria ou módulo original não fizer mais sentido, sugira novos IDs

Responda APENAS em JSON:
{
  "solution_summary": "resumo da solução aplicada",
  "category_changed": false,
  "suggested_category_id": null,
  "suggested_module_id": null
}`;

    let solutionSummary: string = resolution_summary.substring(0, 300);
    let categoryChanged = false;
    let suggestedCategoryId: string | null = null;
    let suggestedModuleId: string | null = null;

    try {
      const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        const content = llmData.choices?.[0]?.message?.content || "";
        try {
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          if (parsed.solution_summary) {
            solutionSummary = (parsed.solution_summary as string).substring(0, 300);
          }
          categoryChanged = parsed.category_changed === true;
          suggestedCategoryId = parsed.suggested_category_id || null;
          suggestedModuleId = parsed.suggested_module_id || null;
        } catch {
          console.warn("[solution-classifier] parse error, using fallback");
        }
      }
    } catch (err) {
      console.warn("[solution-classifier] LLM error, using fallback:", err);
    }

    // Salva solution_summary na conversa
    const updateData: Record<string, unknown> = { solution_summary: solutionSummary };
    if (categoryChanged && suggestedCategoryId) {
      updateData.ticket_category_id = suggestedCategoryId;
      if (suggestedModuleId) updateData.ticket_module_id = suggestedModuleId;
    }

    const { error: updateError } = await supabase
      .from("ai_conversations")
      .update(updateData)
      .eq("id", conversation_id);

    if (updateError) {
      console.error("[solution-classifier] DB update error:", updateError);
      return jsonResponse({ error: "failed to save solution_summary" }, 500);
    }

    return jsonResponse({
      success: true,
      solution_summary: solutionSummary,
      category_changed: categoryChanged,
      suggested_category_id: suggestedCategoryId,
    });
  } catch (err) {
    console.error("[ticket-solution-classifier] Error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
