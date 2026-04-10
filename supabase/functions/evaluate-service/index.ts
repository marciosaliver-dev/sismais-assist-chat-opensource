import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get conversation
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id, ticket_number, customer_name, human_agent_id, status, handler_type, started_at, resolved_at")
      .eq("id", conversation_id)
      .single();

    if (!conv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get messages
    const { data: messages } = await supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!messages || messages.length < 2) {
      return new Response(JSON.stringify({ skipped: true, reason: "Too few messages" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agent name
    let agentName = "Agente";
    if (conv.human_agent_id) {
      const { data: agent } = await supabase
        .from("human_agents")
        .select("name")
        .eq("id", conv.human_agent_id)
        .single();
      if (agent) agentName = agent.name;
    }

    // Build conversation transcript
    const transcript = messages
      .map((m: any) => {
        const role = m.role === "user" ? "Cliente" : m.role === "human_agent" ? agentName : "IA";
        return `[${role}]: ${m.content}`;
      })
      .join("\n");

    // Call AI for evaluation
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um avaliador de qualidade de atendimento ao cliente. Analise a conversa abaixo e forneça:

1. Um resumo da conversa (máximo 3 frases)
2. Uma avaliação de 1 a 10 para cada critério:
   - cordialidade: educação e empatia do atendente
   - clareza: comunicação clara e objetiva
   - resolucao: efetividade na resolução do problema
   - tempo_resposta: agilidade nas respostas
   - profissionalismo: postura profissional
3. Um score geral (média ponderada)
4. Até 3 pontos fortes
5. Até 3 pontos de melhoria

Responda APENAS em JSON válido no formato:
{
  "conversation_summary": "...",
  "summary": "Avaliação geral em uma frase",
  "overall_score": 8,
  "criteria": { "cordialidade": 8, "clareza": 7, "resolucao": 9, "tempo_resposta": 6, "profissionalismo": 8 },
  "strengths": ["ponto 1", "ponto 2"],
  "improvements": ["melhoria 1", "melhoria 2"]
}

CONVERSA:
${transcript}`;

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || 0;
    const modelUsed = aiData.model || "google/gemini-3.1-flash-lite-preview";

    // Parse JSON from response
    let evaluation: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      evaluation = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI evaluation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save evaluation
    const { error: insertError } = await supabase
      .from("ai_service_evaluations")
      .insert({
        conversation_id,
        human_agent_id: conv.human_agent_id,
        evaluation_type: "ai",
        overall_score: Math.min(10, Math.max(1, Math.round(evaluation.overall_score || 5))),
        criteria: evaluation.criteria || {},
        summary: evaluation.summary || "",
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || [],
        conversation_summary: evaluation.conversation_summary || "",
        model_used: modelUsed,
        tokens_used: tokensUsed,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
