import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackMetric, trackError } from "../_shared/pipeline-metrics.ts";
import { corsHeaders } from "../_shared/supabase-helpers.ts";
import { cachedQuery } from "../_shared/cache.ts";
import { isBusinessHours, getAfterHoursMessage } from "../_shared/brazil-timezone.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const _replyStartMs = Date.now();
    const body = await req.json();
    const { messageId, chatId, instanceId, conversationId, text } = body;
    console.log("[ai-whatsapp-reply] Called with params:", JSON.stringify({ messageId, chatId, instanceId, conversationId, textLength: text?.length }));
    if (!chatId || !instanceId) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve effective text: if placeholder or empty, read latest user message from DB
    let effectiveText = text;
    const placeholders = ["[Áudio]", "[audio]", "[ptt]", "[Imagem]", "[image]", "[Áudio - transcrição falhou]", "[Imagem - processamento falhou]"];
    if ((!effectiveText || placeholders.includes(effectiveText)) && conversationId) {
      const { data: latestMsg } = await supabase
        .from("ai_messages")
        .select("content")
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestMsg?.content && !placeholders.includes(latestMsg.content)) {
        effectiveText = latestMsg.content.replace(/^\[Áudio transcrito\]\s*/i, "").replace(/^\[Imagem\]\s*/i, "");
        console.log(`[ai-whatsapp-reply] Resolved text from DB: ${effectiveText?.substring(0, 50)}...[truncated]`);
      }
    }

    if (!effectiveText) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_text_content" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 0. Check if auto-reply is enabled (cached 5 min — changes rarely)
    const autoReplyConfig = await cachedQuery<{ enabled: boolean | string | null } | null>(
      "platform_ai_config:auto_reply_enabled",
      300_000,
      async () => {
        const { data } = await supabase
          .from("platform_ai_config")
          .select("enabled")
          .eq("feature", "auto_reply_enabled")
          .maybeSingle();
        return data;
      }
    );

    if (autoReplyConfig && autoReplyConfig.enabled === false) {
      console.log("Auto-reply disabled via config");
      return new Response(JSON.stringify({ skipped: true, reason: "auto_reply_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Find AI agent via orchestrator or fallback
    let selectedAgent: Record<string, unknown> | null = null;

    // Try orchestrator first if conversationId exists
    if (conversationId) {
      try {
        const orchResp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/orchestrator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              conversation_id: conversationId,
              message_content: effectiveText,
              analysis: {},
            }),
          }
        );
        if (orchResp.ok) {
          const orchData = await orchResp.json();
          if (orchData.action === "agent" && orchData.agent_id) {
            const { data: agent } = await supabase
              .from("ai_agents")
              .select("*")
              .eq("id", orchData.agent_id)
              .single();
            if (agent) selectedAgent = agent;
            console.log(`Orchestrator selected: ${orchData.agent_name} (${orchData.reason})`);
          } else if (orchData.action === "human") {
            console.log(`Orchestrator decided human: ${orchData.reason}`);

            // ── CHECK: fora do expediente? NÃO abandonar o cliente na fila ──
            const businessStatus = await isBusinessHours(supabase);

            if (!businessStatus.isOpen) {
              // Fora do expediente: NÃO escalar para humano, manter IA
              console.log(`[ai-whatsapp-reply] OUTSIDE business hours (${businessStatus.reason}) — NOT escalating, keeping AI`);
              // Não atualiza handler_type, continua o fluxo para o agent-executor responder
              // O orchestrator já marcou wants_human_outside_hours no context
            } else {
              // Dentro do expediente: escalar normalmente, MAS enviar mensagem ao cliente
              const { data: filaStage } = await supabase
                .from("kanban_stages")
                .select("id, board_id")
                .eq("slug", "fila")
                .limit(1)
                .maybeSingle();
              const updateData: Record<string, unknown> = {
                handler_type: "human",
                status: "aguardando",
                queue_entered_at: new Date().toISOString(),
              };
              if (filaStage) {
                updateData.kanban_stage_id = filaStage.id;
                updateData.kanban_board_id = filaStage.board_id;
              }
              await supabase.from("ai_conversations").update(updateData).eq("id", conversationId);

              // Enviar mensagem de transferência ao cliente (não deixar sem resposta!)
              const transferMsg = "Vou transferir você para um atendente humano que poderá ajudar melhor com sua solicitação. Um especialista assumirá nossa conversa em instantes. Obrigado pela paciência! 🤝";
              try {
                const { data: chatForTransfer } = await supabase
                  .from("uazapi_chats").select("chat_id").eq("id", chatId).single();
                const { data: instForTransfer } = await supabase
                  .from("uazapi_instances").select("api_url, api_token, profile_name").eq("id", instanceId).single();
                if (chatForTransfer?.chat_id && instForTransfer) {
                  const transferApiUrl = instForTransfer.api_url.replace(/\/$/, "");
                  await fetch(`${transferApiUrl}/send/text`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", token: instForTransfer.api_token },
                    body: JSON.stringify({ number: chatForTransfer.chat_id, text: transferMsg }),
                  });
                  // Salvar na ai_messages para histórico
                  await supabase.from("ai_messages").insert({
                    conversation_id: conversationId,
                    role: "assistant",
                    content: transferMsg,
                    delivery_status: "sent",
                  });
                }
              } catch (transferErr) {
                console.error("[ai-whatsapp-reply] Failed to send transfer message:", transferErr);
              }

              return new Response(JSON.stringify({ skipped: true, reason: "escalated_to_human", message_sent: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }
      } catch (e) {
        console.error("Orchestrator error, using fallback:", e);
      }
    }

    // Fallback: check for configured default agent (cached 5 min — changes rarely)
    if (!selectedAgent) {
      const defaultAgentConfig = await cachedQuery<{ enabled: boolean | string | null } | null>(
        "platform_ai_config:default_ai_agent_id",
        300_000,
        async () => {
          const { data } = await supabase
            .from("platform_ai_config")
            .select("enabled")
            .eq("feature", "default_ai_agent_id")
            .maybeSingle();
          return data;
        }
      );

      if (defaultAgentConfig?.enabled && typeof defaultAgentConfig.enabled === "string") {
        const { data: agent } = await supabase
          .from("ai_agents")
          .select("*")
          .eq("id", defaultAgentConfig.enabled)
          .eq("is_active", true)
          .maybeSingle();
        if (agent) selectedAgent = agent;
      }
    }

    // Final fallback: highest priority active agent
    if (!selectedAgent) {
      const { data: fallback } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();
      selectedAgent = fallback;
    }

    if (!selectedAgent) {
      console.log("No active AI agent found, skipping auto-reply");
      return new Response(JSON.stringify({ skipped: true, reason: "no_agent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update conversation with selected agent + 3. Get customer name — run in parallel
    let customerName = "desconhecido";
    await Promise.all([
      // 2. Update conversation with selected agent
      conversationId
        ? supabase.from("ai_conversations").update({
            current_agent_id: selectedAgent.id as string,
          }).eq("id", conversationId)
        : Promise.resolve(),
      // 3. Get customer name for logging/tracking
      (async () => {
        if (conversationId) {
          const { data: conv } = await supabase
            .from("ai_conversations")
            .select("customer_name, customer_phone")
            .eq("id", conversationId)
            .single();
          customerName = conv?.customer_name || conv?.customer_phone || "desconhecido";
        } else {
          const { data: chatRecord } = await supabase
            .from("uazapi_chats")
            .select("id, contact_name, contact_phone")
            .eq("id", chatId)
            .single();
          customerName = chatRecord?.contact_name || chatRecord?.contact_phone || "desconhecido";
        }
      })(),
    ]);

    const model = (selectedAgent.model as string) || 'agent-executor';

    // 4. Delegate AI response to agent-executor (single source of truth)
    // agent-executor handles: RAG, guardrails, skills, loop detection, GL check, humanized prompts
    let reply = '';
    let confidence = 0.75;
    let shouldEscalate = false;
    let aiTokens = 0;

    try {
      const executorResp = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-executor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            agent_id: selectedAgent.id,
            message_content: effectiveText,
            analysis: {},
          }),
        }
      );

      if (!executorResp.ok) {
        const errText = await executorResp.text();
        console.error(`[ai-whatsapp-reply] agent-executor failed [${executorResp.status}]: ${errText}`);
        if (executorResp.status === 402) {
          return new Response(JSON.stringify({ skipped: true, reason: "no_credits" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ skipped: true, reason: "executor_error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const executorResult = await executorResp.json();
      reply = executorResult.response || executorResult.message || '';
      confidence = executorResult.confidence ?? 0.75;
      shouldEscalate = executorResult.escalated || executorResult.action === 'escalate' || false;
      aiTokens = executorResult.total_tokens || 0;

      if (shouldEscalate) {
        console.log(`[ai-whatsapp-reply] Escalated: ${executorResult.escalation_reason || 'unknown'}`);
        const { data: filaStage } = await supabase
          .from("kanban_stages").select("id, board_id").eq("slug", "fila").limit(1).maybeSingle();
        const updateData: Record<string, unknown> = {
          handler_type: "human", status: "aguardando",
          queue_entered_at: new Date().toISOString(),
          escalation_reason: executorResult.escalation_reason || 'Escalação do agente',
        };
        if (filaStage) {
          updateData.kanban_stage_id = filaStage.id;
          updateData.kanban_board_id = filaStage.board_id;
        }
        await supabase.from("ai_conversations").update(updateData).eq("id", conversationId);
        if (!reply) {
          reply = "Vou transferir você para um atendente humano. Um momento! 🙏";
        }
      }
    } catch (e) {
      console.error("[ai-whatsapp-reply] Agent-executor call failed:", e);
      return new Response(JSON.stringify({ skipped: true, reason: "executor_exception" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reply) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ai-whatsapp-reply] Confidence: ${confidence.toFixed(2)}, escalated: ${shouldEscalate}`);

    // 7. Resolve correct instance + fetch chat data in parallel (both independent at this point)
    let resolvedInstanceId = instanceId;
    const [convInstResult, chatDataResult] = await Promise.all([
      // Resolve whatsapp_instance_id from conversation
      conversationId
        ? supabase
            .from("ai_conversations")
            .select("whatsapp_instance_id")
            .eq("id", conversationId)
            .single()
        : Promise.resolve({ data: null }),
      // Fetch chat JID and contact phone
      supabase.from("uazapi_chats").select("chat_id, contact_phone").eq("id", chatId).single(),
    ]);

    const convInst = (convInstResult as { data: Record<string, string> | null }).data;
    if (convInst?.whatsapp_instance_id) {
      if (convInst.whatsapp_instance_id !== instanceId) {
        console.log(`[ai-whatsapp-reply] Instance override: webhook=${instanceId} → conversation=${convInst.whatsapp_instance_id}`);
      }
      resolvedInstanceId = convInst.whatsapp_instance_id;
    }

    const { data: inst } = await supabase
      .from("uazapi_instances")
      .select("*")
      .eq("id", resolvedInstanceId)
      .single();

    if (!inst) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TEST MODE: If instance is in test mode, only reply to the test phone number
    if (inst.test_mode === true && inst.test_phone_number) {
      const testPhone = inst.test_phone_number.replace(/\D/g, "");
      // Get conversation's customer phone to check
      let customerPhone = "";
      if (conversationId) {
        const { data: convCheck } = await supabase
          .from("ai_conversations")
          .select("customer_phone")
          .eq("id", conversationId)
          .single();
        customerPhone = (convCheck?.customer_phone || "").replace(/\D/g, "");
      }
      if (customerPhone && !customerPhone.includes(testPhone) && !testPhone.includes(customerPhone)) {
        console.log(`[ai-whatsapp-reply] TEST MODE: Skipping reply for ${customerPhone ? customerPhone.slice(0, -4) + '****' : 'unknown'} (test phone: ${testPhone ? testPhone.slice(0, -4) + '****' : 'unknown'})`);
        return new Response(JSON.stringify({ skipped: true, reason: "test_mode_filtered" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const apiUrl = inst.api_url.replace(/\/$/, "");
    const chatData = (chatDataResult as { data: { chat_id: string; contact_phone: string } | null }).data;
    const chatJid = chatData?.chat_id;

    if (!chatJid) {
      return new Response(JSON.stringify({ error: "Chat JID not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the correct recipient — LIDs don't work for sending via UAZAPI
    let recipient = chatJid;
    if (!/^\d/.test(chatJid) && !chatJid.includes("@")) {
      // chatJid is a LID, need to resolve to real phone
      let realPhone = chatData?.contact_phone;

      // If contact_phone is also not a real number, check ai_conversations
      if (!realPhone || !/^\d{8,}/.test(realPhone)) {
        const { data: convRecord } = await supabase
          .from("ai_conversations")
          .select("customer_phone")
          .eq("uazapi_chat_id", chatJid)
          .in("status", ["aguardando", "em_atendimento"])
          .maybeSingle();

        if (convRecord?.customer_phone && /^\d{8,}/.test(convRecord.customer_phone)) {
          realPhone = convRecord.customer_phone;
          // Update chat record for future lookups
          await supabase
            .from("uazapi_chats")
            .update({ contact_phone: realPhone })
            .eq("id", chatId);
        }
      }

      if (realPhone && /^\d{8,}/.test(realPhone)) {
        recipient = `${realPhone}@s.whatsapp.net`;
        console.log(`[ai-whatsapp-reply] LID ${chatJid} resolved to phone (masked)`);
      } else {
        recipient = `${chatJid}@lid`;
        console.log(`[ai-whatsapp-reply] LID ${chatJid} has no real phone, using fallback LID`);
      }
    }

    // 8a. Humanized delay — simulate typing like a real person
    const humanDelay = Math.min(
      1500 + (reply.length * 12), // ~12ms per character
      6000 // max 6 seconds
    );

    // Send "composing" (typing indicator) via UAZAPI before sending the actual message
    try {
      await fetch(`${apiUrl}/chat/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: inst.api_token },
        body: JSON.stringify({ number: recipient, presence: "composing" }),
      });
    } catch (e) {
      // Non-critical — typing indicator is cosmetic
      console.warn("[ai-whatsapp-reply] Typing indicator failed:", e);
    }

    await new Promise(resolve => setTimeout(resolve, humanDelay));

    // Send reply via UAZAPI with retry
    let sendResp: Response | null = null;
    let sendResult: Record<string, unknown> | null = null;
    let sendSuccess = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        sendResp = await fetch(`${apiUrl}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: inst.api_token,
          },
          body: JSON.stringify({
            number: recipient,
            text: reply,
          }),
        });

        if (sendResp.ok) {
          sendResult = await sendResp.json();
          sendSuccess = true;
          break;
        }

        const errBody = await sendResp.text();
        console.error(`[ai-whatsapp-reply] UAZAPI send error attempt ${attempt + 1} [${sendResp.status}]: ${errBody}`);

        // Don't retry on 4xx errors (client errors)
        if (sendResp.status >= 400 && sendResp.status < 500) break;
      } catch (fetchErr) {
        console.error(`[ai-whatsapp-reply] UAZAPI send fetch error attempt ${attempt + 1}:`, fetchErr);
      }
    }

    if (!sendSuccess) {
      console.error(`[ai-whatsapp-reply] Failed to send message via UAZAPI after retries. instance=${inst.instance_name}`);
      // Save to ai_messages anyway so the user sees the AI generated a response (but mark delivery failed)
      if (conversationId) {
      await supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
          agent_id: selectedAgent.id as string,
          model_used: model,
          confidence,
          delivery_status: "failed",
          whatsapp_instance_id: resolvedInstanceId,
          total_tokens: aiTokens || null,
        });
      }
      return new Response(JSON.stringify({ error: "Failed to send via UAZAPI", reply: reply.substring(0, 100) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const replyMsgId = (sendResult as Record<string, Record<string, string>>)?.key?.id || crypto.randomUUID();
    console.log(`[ai-whatsapp-reply] Message sent successfully: msgId=${replyMsgId}`);

    // 8. Save AI reply to uazapi_messages
    await supabase.from("uazapi_messages").insert({
      instance_id: resolvedInstanceId,
      chat_id: chatId,
      message_id: replyMsgId,
      from_me: true,
      type: "text",
      text_body: reply,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    // 9. Save AI reply to ai_messages
    if (conversationId) {
      const { error: saveError } = await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: reply,
        agent_id: selectedAgent.id as string,
        model_used: model,
        confidence,
        uazapi_message_id: replyMsgId,
        delivery_status: "sent",
        whatsapp_instance_id: resolvedInstanceId,
        total_tokens: aiTokens || null,
      });
      if (saveError) {
        console.error(`[ai-whatsapp-reply] CRITICAL: Failed to save AI reply to ai_messages:`, saveError.message, saveError.details);
      }

      // Update conversation message count
      const { data: convCounts } = await supabase
        .from("ai_conversations")
        .select("ai_messages_count")
        .eq("id", conversationId)
        .single();
      await supabase.from("ai_conversations").update({
        ai_messages_count: ((convCounts?.ai_messages_count || 0) + 1),
      }).eq("id", conversationId);
    }

    // Update chat preview
    await supabase
      .from("uazapi_chats")
      .update({
        last_message_preview: reply.substring(0, 100),
        last_message_time: new Date().toISOString(),
        last_message_from_me: true,
      })
      .eq("id", chatId);

    console.log(`AI reply sent: agent=${selectedAgent.name}, confidence=${confidence.toFixed(2)}, tokens=${aiTokens}, model=${model}`);

    // Metricas: resposta enviada com sucesso
    trackMetric(supabase, {
      edge_function: 'ai-whatsapp-reply',
      event_type: 'ai_reply_sent',
      conversation_id: conversationId,
      latency_ms: Date.now() - _replyStartMs,
      metadata: {
        agent: selectedAgent.name,
        model,
        confidence,
        tokens: aiTokens,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        agent: selectedAgent.name,
        confidence: Math.round(confidence * 100) / 100,
        escalated: shouldEscalate,
        reply: reply.substring(0, 100),
        tokens: aiTokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI reply error:", error);
    trackError(supabase, 'ai-whatsapp-reply', 'ai_reply_error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
