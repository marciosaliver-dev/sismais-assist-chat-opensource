import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenRouterWithFallback } from "../_shared/openrouter-client.ts";
import { logAICost } from "../_shared/log-ai-cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: detect if message content is just an untranscribed placeholder
function isPlaceholder(content: string | null): boolean {
  if (!content) return true;
  const c = content.trim();
  if (c === "[Áudio]" || c === "[Imagem]" || c === "[Vídeo]" || c === "[Documento]") return true;
  // Matches "[Áudio de 00:04]" or "[Áudio de 1:23]"
  if (/^\[Áudio de \d+:\d+\]$/.test(c)) return true;
  // "[Áudio recebido]" with nothing else
  if (c === "[Áudio recebido]") return true;
  // Explicit transcription failure markers
  if (c === "[Áudio - transcrição falhou]" || c === "[Imagem - processamento falhou]") return true;
  return false;
}

// Helper: clean content for AI context (strip transcription prefix)
function cleanContent(content: string): string {
  let c = content;
  if (c.startsWith("[Áudio transcrito] ")) c = c.replace("[Áudio transcrito] ", "");
  if (c.startsWith("[Imagem] ")) c = c.replace("[Imagem] ", "[Imagem: ");
  return c.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check - require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: authError } = await authSupabase.auth.getUser(token);
  if (authError || !claimsData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const conversation_id = typeof body?.conversation_id === "string" ? body.conversation_id.trim() : "";
    const pending_message = typeof body?.pending_message === "string" ? body.pending_message.trim().substring(0, 5000) : "";
    const mode = typeof body?.mode === "string" ? body.mode : "generate";
    const agent_context = typeof body?.agent_context === "string" ? body.agent_context.trim().substring(0, 2000) : "";

    // Validate conversation_id is a valid UUID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!conversation_id || !UUID_RE.test(conversation_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing conversation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch conversation + agent
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("*, ai_agents(*)")
      .eq("id", conversation_id)
      .single();

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch last 15 messages — include id + media_type for placeholder detection
    const { data: recentMessages } = await supabase
      .from("ai_messages")
      .select("id, role, content, sentiment, urgency, intent, created_at, media_type")
      .eq("conversation_id", conversation_id)
      .not("intent", "eq", "summarization") // exclude internal summarization records
      .order("created_at", { ascending: false })
      .limit(15);

    let messages = (recentMessages || []).reverse();

    // 2b. Check if any audio/image messages are still showing placeholders
    // (transcription might have completed since we fetched — do a quick re-fetch)
    const untranscribedIds = messages
      .filter(
        (m) =>
          (m.media_type === "audio" || m.media_type === "ptt" || m.media_type === "image") &&
          isPlaceholder(m.content)
      )
      .map((m) => m.id)
      .filter(Boolean);

    if (untranscribedIds.length > 0) {
      const { data: refreshed } = await supabase
        .from("ai_messages")
        .select("id, content, media_url, media_type")
        .in("id", untranscribedIds);

      if (refreshed && refreshed.length > 0) {
        const refreshMap = new Map(refreshed.map((r) => [r.id, r]));
        messages = messages.map((m) => {
          const fresh = refreshMap.get(m.id);
          return fresh ? { ...m, content: fresh.content ?? m.content } : m;
        });

        // Re-trigger transcription for messages that still show placeholders or explicit failures
        // (fire-and-forget to avoid blocking copilot response)
        for (const msg of refreshed) {
          if (msg.media_url && isPlaceholder(msg.content)) {
            console.log(`[copilot-suggest] Re-triggering transcription for message ${msg.id}`);
            supabase.functions.invoke("transcribe-media", {
              body: {
                conversation_id: conversation_id,
                message_id: msg.id,
                media_url: msg.media_url,
                media_type: msg.media_type || "audio",
              },
            }).catch(() => {});
          }
        }
      }
    }

    // 3. Detect sentiment/urgency/intent from user messages that have real text
    const userMessages = messages.filter((m) => m.role === "user");
    const latestSentiment = userMessages.at(-1)?.sentiment || "neutral";
    const latestUrgency = userMessages.at(-1)?.urgency || "medium";
    const latestIntent = userMessages.at(-1)?.intent || "general";

    // 4. Build queryText: use pending_message or most recent non-placeholder message (any role)
    const allTextMessages = messages
      .filter((m) => !isPlaceholder(m.content))
      .map((m) => cleanContent(m.content || ""))
      .filter(Boolean);

    console.log(`copilot-suggest: total msgs: ${messages.length}, user msgs: ${userMessages.length}, text msgs: ${allTextMessages.length}`);

    const queryText = pending_message || allTextMessages.pop() || "";

    if (!queryText) {
      return new Response(
        JSON.stringify({
          text: "Sem contexto de texto disponível. Aguarde a transcrição dos áudios ou envie uma mensagem de texto.",
          confidence: 0.3,
          sources: [],
          summary: "Conversa sem mensagens de texto do cliente ainda.",
          sentiment: "neutral",
          urgency: "low",
          intent: "general",
          agent_name: null,
          tokens: 0,
          suggested_priority: "low",
          priority_reason: "Sem contexto de mensagem disponível",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Build conversation context — filter out pure placeholders, clean transcriptions
    const conversationContext = messages
      .filter((m) => {
        // If it has real text, always include
        if (!isPlaceholder(m.content)) return true;
        // If it's a media message still showing a raw placeholder, skip it
        if (m.media_type === "audio" || m.media_type === "ptt" || m.media_type === "image") return false;
        return true;
      })
      .map((m) => {
        const rawContent = m.content || "";
        let content = cleanContent(rawContent);

        // Label remaining non-text media types
        if (m.media_type === "video") content = `[Vídeo recebido]${content ? ": " + content : ""}`;
        else if (m.media_type === "document") content = `[Documento recebido]${content ? ": " + content : ""}`;

        return {
          role: m.role === "user" ? "user" : "assistant",
          content,
        };
      });

    // Guard: if ALL context messages are empty/trivial, return friendly message
    const hasRealContext = conversationContext.some((m) => m.content.length > 5);
    if (!hasRealContext) {
      return new Response(
        JSON.stringify({
          text: "Aguardando transcrição dos áudios para gerar sugestão. Tente novamente em alguns segundos ou envie uma mensagem de texto.",
          confidence: 0.3,
          sources: [],
          summary: "Conversa contém apenas áudios ainda não transcritos.",
          sentiment: latestSentiment,
          urgency: latestUrgency,
          intent: latestIntent,
          agent_name: conversation.ai_agents?.name || null,
          tokens: 0,
          suggested_priority: "medium",
          priority_reason: "Sem contexto de texto disponível",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5b. Fetch Customer 360 data for richer copilot context
    let customer360Context = '';
    if (conversation.helpdesk_client_id) {
      try {
        const { data: c360 } = await supabase.functions.invoke('customer-360', {
          body: { client_id: conversation.helpdesk_client_id }
        });
        if (c360 && !c360.error) {
          const parts: string[] = [];
          if (c360.client?.name) parts.push(`Nome: ${c360.client.name}`);
          if (c360.client?.document) parts.push(`Documento: ${c360.client.document}`);
          if (c360.contracts?.active_count !== undefined) parts.push(`Contratos ativos: ${c360.contracts.active_count}`);
          if (c360.financial?.mrr) parts.push(`MRR: R$ ${c360.financial.mrr}`);
          if (c360.financial?.overdue_amount > 0) parts.push(`⚠️ Dívida: R$ ${c360.financial.overdue_amount}`);
          if (c360.health?.score !== undefined) parts.push(`Health Score: ${c360.health.score}/100`);
          if (c360.health?.risk_level) parts.push(`Risco: ${c360.health.risk_level}`);
          if (c360.tickets?.open_count !== undefined) parts.push(`Tickets abertos: ${c360.tickets.open_count}`);
          if (c360.tickets?.avg_resolution_hours) parts.push(`Tempo médio resolução: ${c360.tickets.avg_resolution_hours}h`);
          if (parts.length > 0) {
            customer360Context = `\n\n## Dados do Cliente (Customer 360):\n${parts.join('\n')}`;
          }
        }
      } catch (e) {
        console.warn('[copilot-suggest] Customer 360 fetch failed:', e);
      }
    }

    // 5c. Fetch relevant macros for suggestion
    let macrosContext = '';
    try {
      const { data: macros } = await supabase
        .from('macros')
        .select('name, message')
        .eq('is_active', true)
        .limit(10);
      if (macros && macros.length > 0) {
        macrosContext = '\n\n## Macros Disponíveis (respostas rápidas):\n' +
          macros.map(m => `- **${m.name}**: ${m.message?.substring(0, 100)}`).join('\n');
      }
    } catch (e) {
      console.warn('[copilot-suggest] Macros fetch failed:', e);
    }

    // 6. RAG search with clean queryText
    let ragContext = "";
    let sources: { title: string; url: string }[] = [];

    try {
      const embResp = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-embedding`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ text: queryText }),
        }
      );

      if (embResp.ok) {
        const embData = await embResp.json();
        if (embData.embedding) {
          const { data: docs } = await supabase.rpc("search_knowledge", {
            query_embedding: JSON.stringify(embData.embedding),
            match_threshold: 0.7,
            match_count: 5,
          });

          if (docs && docs.length > 0) {
            // Enrich with dates for recency context
            const docIds = docs.map((d: { id: string }) => d.id)
            const { data: docDates } = await supabase
              .from('ai_knowledge_base')
              .select('id, updated_at')
              .in('id', docIds)
            const dateMap = new Map<string, string>()
            if (docDates) {
              for (const dd of docDates) { dateMap.set(dd.id, dd.updated_at || '') }
            }
            const fmtDate = (iso: string) => {
              if (!iso) return 'N/A'
              const dt = new Date(iso)
              return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
            }
            ragContext =
              "\n\n## Base de Conhecimento:\nIMPORTANTE: Se houver informações conflitantes, priorize a fonte com data mais recente.\n\n" +
              docs
                .map((d: { id: string; title: string; content: string }) => `### ${d.title} (Atualizado: ${fmtDate(dateMap.get(d.id) || '')})\n${d.content}`)
                .join("\n\n");

            sources = docs.map((d: { title: string; original_url: string }) => ({
              title: d.title,
              url: d.original_url || "#",
            }));
          }
        }
      }
    } catch (e) {
      console.error("RAG error:", e);
    }

    // 7. Select agent or fallback
    const agent = conversation.ai_agents;
    let systemPrompt =
      "Você é um assistente de helpdesk inteligente. Analise a conversa e retorne um JSON com os campos solicitados.";

    if (agent) {
      systemPrompt =
        agent.system_prompt +
        "\n\nVocê está analisando uma conversa de WhatsApp como copiloto do atendente.";
    }

    systemPrompt += '\n\n[POLÍTICA DE DADOS]: Quando encontrar informações duplicadas ou conflitantes, SEMPRE priorize as informações mais recentes (data mais recente).';
    systemPrompt += ragContext;
    systemPrompt += customer360Context;
    systemPrompt += macrosContext;
    systemPrompt += `\n\nCliente: ${conversation.customer_name || conversation.customer_phone}`;
    systemPrompt += `\nCanal: WhatsApp`;
    systemPrompt += `\n\nNOTA: Mensagens marcadas como "[Áudio transcrito]" são transcrições de áudio do cliente — trate-as como texto normal.`;

    // Sentiment coaching for negative conversations
    if (latestSentiment === 'negative') {
      systemPrompt += `\n\n[COACHING]: O cliente demonstra insatisfação. Sugira respostas empáticas que:
1. Reconheçam o problema/frustração do cliente
2. Demonstrem compreensão e empatia
3. Ofereçam uma solução concreta ou próximo passo claro
4. Evitem linguagem defensiva ou justificativas excessivas`;
    }

    // Mode-specific instructions
    if (mode === "improve" && pending_message) {
      systemPrompt += `\n\n[MODO MELHORAR]: O atendente enviará sua mensagem no próximo turno. Melhore/reescreva de forma mais profissional, clara e empática, mantendo o mesmo sentido.`;
      systemPrompt += `\n\nResponda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem \`\`\`) com os seguintes campos:
{
  "suggestion": "a mensagem reescrita/melhorada profissionalmente",
  "summary": "breve explicação das melhorias feitas"
}`;
    } else if (mode === "context" && agent_context) {
      systemPrompt += `\n\n[MODO CONTEXTO]: O atendente fornecerá instruções específicas no próximo turno. Gere uma resposta ao cliente seguindo essas instruções e usando o histórico + base de conhecimento.`;
      systemPrompt += `\n\nResponda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem \`\`\`) com os seguintes campos:
{
  "suggestion": "sugestão de resposta concisa e profissional seguindo as instruções do atendente",
  "summary": "resumo breve da conversa até agora em 2-3 frases"
}`;
    } else {
      systemPrompt += `\n\nResponda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem \`\`\`) com os seguintes campos:
{
  "suggestion": "sugestão principal de resposta concisa e profissional",
  "suggestion_empathetic": "versão mais empática e acolhedora da mesma resposta",
  "suggestion_direct": "versão mais direta e objetiva, focada na solução",
  "summary": "resumo breve da conversa até agora em 2-3 frases",
  "recommended_macro": "nome da macro mais relevante se houver, ou null"
}`;
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...conversationContext,
    ];

    // User-controlled content goes in user role (not system prompt) to prevent injection
    if (mode === "improve" && pending_message) {
      aiMessages.push({
        role: "user",
        content: `Melhore esta mensagem do atendente: "${pending_message}"`,
      });
    } else if (mode === "context" && agent_context) {
      aiMessages.push({
        role: "user",
        content: `Instruções do atendente para gerar resposta: "${agent_context}"`,
      });
    } else if (pending_message) {
      aiMessages.push({
        role: "user",
        content: `[Contexto: O atendente está digitando: "${pending_message}". Sugira uma resposta completa baseada nesse rascunho.]`,
      });
    }

    // 8. Call OpenRouter with fallback models (only confirmed valid models)
    const { DEFAULT_FALLBACK_CHAIN } = await import('../_shared/default-models.ts')
    const modelsToTry = DEFAULT_FALLBACK_CHAIN;

    const aiResult = await callOpenRouterWithFallback({
      models: modelsToTry,
      messages: aiMessages,
      max_completion_tokens: Number(agent?.max_tokens) || 800,
      temperature: Number(agent?.temperature) || 0.3,
    });

    const usedModel = aiResult.model_used;
    const rawContent = aiResult.content || "";

    await logAICost(supabase, {
      model: usedModel,
      feature: 'copilot',
      input_tokens: aiResult.usage?.prompt_tokens || 0,
      output_tokens: aiResult.usage?.completion_tokens || 0,
      cost_usd: aiResult.cost_usd || 0,
      conversation_id: conversation_id,
    });

    if (!rawContent) {
      return new Response(
        JSON.stringify({
          text: "Não foi possível gerar uma sugestão no momento. Tente novamente.",
          confidence: 0.3,
          sources: [],
          summary: "",
          sentiment: latestSentiment,
          urgency: latestUrgency,
          intent: latestIntent,
          agent_name: agent?.name || null,
          tokens: 0,
          suggested_priority: "medium",
          priority_reason: "Sugestão vazia retornada pela IA",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON response
    let suggestionText = rawContent;
    let summaryText = "";
    let suggestionEmpathetic = "";
    let suggestionDirect = "";
    let recommendedMacro: string | null = null;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      suggestionText = parsed.suggestion || rawContent;
      summaryText = parsed.summary || "";
      suggestionEmpathetic = parsed.suggestion_empathetic || "";
      suggestionDirect = parsed.suggestion_direct || "";
      recommendedMacro = parsed.recommended_macro || null;
    } catch {
      console.warn("Failed to parse JSON from AI, using raw content");
    }

    // 9. Calculate confidence based on RAG results
    const confidence = sources.length > 0 ? 0.9 : 0.7;

    // 10. AI Priority Suggestion
    let suggestedPriority = "medium";
    let priorityReason = "";

    if (latestSentiment === "negative" && latestUrgency === "critical") {
      suggestedPriority = "critical";
      priorityReason = "Cliente demonstra insatisfação elevada com urgência crítica";
    } else if (latestSentiment === "negative" || latestUrgency === "high") {
      suggestedPriority = "high";
      priorityReason = latestSentiment === "negative"
        ? "Sentimento negativo detectado na conversa"
        : "Urgência alta identificada pela IA";
    } else if (latestSentiment === "positive" && latestUrgency === "low") {
      suggestedPriority = "low";
      priorityReason = "Cliente satisfeito, sem urgência identificada";
    } else {
      suggestedPriority = "medium";
      priorityReason = "Conversa com tom neutro e urgência moderada";
    }

    // 11. Save AI suggested priority + analysis snapshot to the conversation
    const analysisSnapshot = {
      ts: new Date().toISOString(),
      summary: summaryText,
      sentiment: latestSentiment,
      urgency: latestUrgency,
      priority: suggestedPriority,
      model: aiResult.model_used,
    };

    const existingHistory = conversation.summary_history;
    const historyArray = Array.isArray(existingHistory) ? existingHistory : [];
    const updatedHistory = [...historyArray, analysisSnapshot].slice(-20);

    await supabase
      .from("ai_conversations")
      .update({
        ai_suggested_priority: suggestedPriority,
        priority_reason: priorityReason,
        conversation_summary: summaryText,
        summary_history: updatedHistory,
      } as any)
      .eq("id", conversation_id);

    console.log(`copilot-suggest: used ${aiResult.model_used}, context msgs: ${conversationContext.length}, tokens: ${aiResult.usage?.total_tokens || 0}`);

    return new Response(
      JSON.stringify({
        text: suggestionText,
        alternatives: [
          suggestionEmpathetic ? { label: 'Empática', text: suggestionEmpathetic } : null,
          suggestionDirect ? { label: 'Direta', text: suggestionDirect } : null,
        ].filter(Boolean),
        recommended_macro: recommendedMacro,
        confidence,
        sources,
        summary: summaryText,
        sentiment: latestSentiment,
        urgency: latestUrgency,
        intent: latestIntent,
        agent_name: agent?.name || null,
        tokens: aiResult.usage?.total_tokens || 0,
        suggested_priority: suggestedPriority,
        priority_reason: priorityReason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Copilot suggest error:", error instanceof Error ? error.constructor.name : "unknown", error);
    
    // Propagate 402/429 from OpenRouter so frontend can show proper message
    const errObj = error as any;
    if (errObj?.status === 402 || errObj?.name === 'OpenRouterError' && errObj?.message?.includes('credits')) {
      return new Response(
        JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (errObj?.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições IA excedido. Tente novamente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Falha ao gerar sugestão. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
