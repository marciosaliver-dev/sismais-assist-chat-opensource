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

    // Get conversation with category and module
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id, ticket_number, ticket_subject, customer_name, customer_phone, human_agent_id, handler_type, status, started_at, ticket_category_id, ticket_module_id, helpdesk_client_id, priority")
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
      return new Response(JSON.stringify({ note: "Conversa com poucas mensagens para gerar nota.", tokens_used: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get category and module names
    let categoryName = "";
    let moduleName = "";
    if (conv.ticket_category_id) {
      const { data: cat } = await supabase
        .from("ticket_categories")
        .select("name")
        .eq("id", conv.ticket_category_id)
        .single();
      if (cat) categoryName = cat.name;
    }
    if (conv.ticket_module_id) {
      const { data: mod } = await supabase
        .from("ticket_modules")
        .select("name")
        .eq("id", conv.ticket_module_id)
        .single();
      if (mod) moduleName = mod.name;
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

    // Build transcript
    const transcript = messages
      .map((m: any) => {
        const role = m.role === "user" ? "Cliente" : m.role === "human_agent" ? agentName : "IA";
        return `[${role}]: ${m.content}`;
      })
      .join("\n");

    // Call AI
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextInfo = [
      conv.ticket_subject ? `Assunto: ${conv.ticket_subject}` : "",
      categoryName ? `Categoria: ${categoryName}` : "",
      moduleName ? `Módulo: ${moduleName}` : "",
      conv.customer_name ? `Cliente: ${conv.customer_name}` : "",
      conv.priority ? `Prioridade: ${conv.priority}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Você é um assistente de encerramento de tickets de suporte técnico. Analise a conversa abaixo e gere uma nota de encerramento estruturada.

${contextInfo ? `CONTEXTO DO TICKET:\n${contextInfo}\n` : ""}
CONVERSA:
${transcript}

Gere uma nota de encerramento com os seguintes tópicos (use texto limpo em português, sem markdown pesado):

1. PROBLEMA RELATADO: Descrição concisa do problema ou solicitação (1-2 frases)
2. AÇÕES TOMADAS: Lista das principais ações realizadas durante o atendimento
3. RESOLUÇÃO: Como o problema foi resolvido ou qual foi o desfecho
4. PENDÊNCIAS: Se há algo pendente ou que precisa de acompanhamento (se não houver, escreva "Nenhuma")
5. OBSERVAÇÕES: Informações adicionais relevantes para atendimentos futuros (se não houver, omita esta seção)

Seja objetivo e profissional. Máximo 300 palavras.`;

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
        max_tokens: 1500,
      }),
    });

    const aiData = await aiResponse.json();
    const note = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || 0;
    const modelUsed = aiData.model || "google/gemini-3.1-flash-lite-preview";

    if (!note) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log to ticket_ai_logs
    supabase.from("ticket_ai_logs").insert({
      ticket_id: conversation_id,
      evento_tipo: "close_review",
      prompt_enviado: prompt.substring(0, 5000),
      resposta_recebida: note.substring(0, 5000),
      modelo_usado: modelUsed,
      tokens_input: aiData.usage?.prompt_tokens || 0,
      tokens_output: aiData.usage?.completion_tokens || 0,
      confianca: 1.0,
      metadata: { tokens_used: tokensUsed },
    }).then(
      () => console.log("Close review logged"),
      (err: any) => console.error("Failed to log close review:", err)
    );

    return new Response(JSON.stringify({ note, tokens_used: tokensUsed }), {
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
