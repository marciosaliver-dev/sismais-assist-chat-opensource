import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendWhatsAppMessage(
  apiUrl: string,
  apiToken: string,
  phone: string,
  message: string
): Promise<string | null> {
  const res = await fetch(`${apiUrl}/message/sendText/${apiToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    console.error("UAZAPI sendText error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  // Tenta capturar o message id retornado pela UAZAPI
  return data?.key?.id ?? data?.messageId ?? data?.id ?? null;
}

// ─── Action: send ─────────────────────────────────────────────────────────────

async function handleSend(
  conversationId: string,
  configId: string,
  triggerSource: "close" | "cron_reconcile" | "manual" = "close"
) {
  // 1. Busca config com join ao board
  const { data: config, error: configErr } = await supabase
    .from("csat_board_configs")
    .select("*, kanban_boards(name)")
    .eq("id", configId)
    .single();

  if (configErr || !config) {
    await supabase.from("csat_send_log").insert({
      conversation_id: conversationId,
      config_id: configId,
      trigger_source: triggerSource,
      status: "failed",
      error_message: "Config not found",
    }).then(() => {}, () => {});
    return jsonResponse({ error: "Config not found" }, 404);
  }

  // 2. Busca conversa
  const { data: conv, error: convErr } = await supabase
    .from("ai_conversations")
    .select("id, customer_phone, customer_name, ticket_number, whatsapp_instance_id")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) {
    return jsonResponse({ error: "Conversation not found" }, 404);
  }

  // 3. Monta mensagem substituindo variáveis
  const boardName = (config.kanban_boards as any)?.name ?? "";
  const message = (config.message_template as string)
    .replace(/\{\{nome\}\}/g, conv.customer_name ?? "")
    .replace(/\{\{customer_name\}\}/g, conv.customer_name ?? "")
    .replace(/\{\{protocolo\}\}/g, conv.ticket_number ?? "")
    .replace(/\{\{ticket_number\}\}/g, conv.ticket_number ?? "")
    .replace(/\{\{board\}\}/g, boardName);

  const delayMinutes = config.delay_minutes ?? 0;

  if (delayMinutes > 0) {
    // 4. Insere survey pendente para envio futuro
    const nextActionAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    const { error: insertErr } = await supabase
      .from("csat_surveys")
      .insert({
        conversation_id: conversationId,
        config_id: configId,
        customer_phone: conv.customer_phone,
        instance_id: conv.whatsapp_instance_id,
        response_window_hours: config.response_window_hours ?? 48,
        status: "pending",
        next_action_at: nextActionAt,
      });

    if (insertErr) {
      console.error("Insert pending survey error:", insertErr);
      return jsonResponse({ error: insertErr.message }, 500);
    }
  } else {
    // 5. Envia imediatamente
    const { data: instance, error: instanceErr } = await supabase
      .from("uazapi_instances")
      .select("api_url, api_token")
      .eq("id", conv.whatsapp_instance_id)
      .single();

    if (instanceErr || !instance) {
      await supabase.from("csat_send_log").insert({
        conversation_id: conversationId,
        config_id: configId,
        trigger_source: triggerSource,
        status: "skipped_no_instance",
      }).then(() => {}, () => {});
      return jsonResponse({ error: "UAZAPI instance not found" }, 404);
    }

    const sentMessageId = await sendWhatsAppMessage(
      instance.api_url,
      instance.api_token,
      conv.customer_phone,
      message
    );

    const { error: insertErr } = await supabase
      .from("csat_surveys")
      .insert({
        conversation_id: conversationId,
        config_id: configId,
        customer_phone: conv.customer_phone,
        instance_id: conv.whatsapp_instance_id,
        response_window_hours: config.response_window_hours ?? 48,
        status: "sent",
        sent_message_id: sentMessageId,
        sent_at: new Date().toISOString(),
        next_action_at: config.resend_enabled
          ? new Date(Date.now() + (config.resend_after_hours ?? 4) * 3600 * 1000).toISOString()
          : null,
      });

    if (insertErr) {
      console.error("Insert sent survey error:", insertErr);
      return jsonResponse({ error: insertErr.message }, 500);
    }

    // Atualiza csat_sent_at na conversa
    await supabase
      .from("ai_conversations")
      .update({ csat_sent_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  await supabase.from("csat_send_log").insert({
    conversation_id: conversationId,
    config_id: configId,
    trigger_source: triggerSource,
    status: "sent",
  }).then(() => {}, (err) => console.warn("[csat-processor] audit log error:", err));

  return jsonResponse({ success: true });
}

// ─── Action: classify ─────────────────────────────────────────────────────────

async function handleClassify(
  surveyId: string,
  message: string,
  quotedMsgId?: string
) {
  // 1. Busca survey com config
  const { data: survey, error: surveyErr } = await supabase
    .from("csat_surveys")
    .select("*, csat_board_configs(*)")
    .eq("id", surveyId)
    .single();

  if (surveyErr || !survey) {
    return jsonResponse({ error: "Survey not found" }, 404);
  }

  const config = survey.csat_board_configs as any;
  const isDirectReply =
    quotedMsgId != null && quotedMsgId === survey.sent_message_id;

  // 2. Classificação via OpenRouter
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "OPENROUTER_API_KEY not set" }, 500);
  }

  const scaleDescriptions: Record<string, string> = {
    stars_1_5: "Escala de 1 a 5 estrelas (1=muito insatisfeito, 5=muito satisfeito)",
    thumbs: "Escala binária: 👍 (positivo=2) ou 👎 (negativo=1)",
    nps_0_10: "Net Promoter Score de 0 a 10",
    emoji: "Escala de emojis: 😡=1, 😕=2, 😐=3, 🙂=4, 😍=5",
  };
  const scaleInfo = scaleDescriptions[config?.scale_type] || scaleDescriptions.stars_1_5;

  const dimensions = config?.ai_dimensions as string[] | null;
  const dimensionsInfo = dimensions?.length
    ? `Dimensões a avaliar: ${dimensions.join(", ")}.`
    : "";

  const prompt = `Você é um analisador de respostas de pesquisa CSAT.

${scaleInfo}
${dimensionsInfo}

Mensagem recebida do cliente: "${message}"

Responda APENAS com JSON válido no seguinte formato:
{
  "is_csat_response": true,
  "score": 4,
  "sentiment": "positive",
  "dimensions": {},
  "tags": [],
  "summary": "Resumo breve da resposta",
  "answers": {}
}

Regras:
- "is_csat_response": true se a mensagem for claramente uma resposta de avaliação, false caso contrário
- "score": número na escala configurada ou null se não identificado
- "sentiment": "positive", "neutral" ou "negative"
- "dimensions": objeto com notas por dimensão se houver
- "tags": array de palavras-chave relevantes
- "summary": resumo da resposta em português
- "answers": respostas específicas a perguntas abertas, se houver`;

  let analysis: Record<string, unknown> = {
    is_csat_response: false,
    score: null,
    sentiment: "neutral",
    dimensions: {},
    tags: [],
    summary: "",
    answers: {},
  };

  try {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // 4. Fallback para respostas diretas: tenta extrair número
      if (isDirectReply) {
        const numMatch = message.match(/\d+/);
        if (numMatch) {
          analysis = {
            is_csat_response: true,
            score: parseInt(numMatch[0], 10),
            sentiment: "neutral",
            dimensions: {},
            tags: [],
            summary: message.trim(),
            answers: {},
          };
        }
      } else {
        console.error("Failed to parse AI classify response:", content);
      }
    }
  } catch (err) {
    console.error("OpenRouter classify error:", err);
    if (isDirectReply) {
      const numMatch = message.match(/\d+/);
      if (numMatch) {
        analysis = {
          is_csat_response: true,
          score: parseInt(numMatch[0], 10),
          sentiment: "neutral",
          dimensions: {},
          tags: [],
          summary: message.trim(),
          answers: {},
        };
      }
    }
  }

  // 5. Se é uma resposta CSAT, persiste
  if (analysis.is_csat_response) {
    const now = new Date().toISOString();
    await supabase
      .from("csat_surveys")
      .update({
        status: "answered",
        score: analysis.score ?? null,
        raw_response: message,
        ai_analysis: {
          sentiment: analysis.sentiment,
          dimensions: analysis.dimensions,
          tags: analysis.tags,
          summary: analysis.summary,
        },
        answers: analysis.answers ?? null,
        responded_at: now,
      })
      .eq("id", surveyId);

    // Sincroniza na conversa
    if (survey.conversation_id) {
      await supabase
        .from("ai_conversations")
        .update({
          csat_score: analysis.score ?? null,
          csat_responded_at: now,
          csat_comment: (analysis.summary as string) ?? null,
        })
        .eq("id", survey.conversation_id);
    }

    // Follow-up para notas baixas
    const score = typeof analysis.score === "number" ? analysis.score : null;
    const threshold = config?.followup_threshold ?? 2;
    const followupEnabled = config?.followup_enabled !== false;

    if (followupEnabled && score !== null && score <= threshold && !survey.followup_sent) {
      const followupMessage = config?.followup_message ||
        "Sentimos muito pela experiência. Poderia nos contar o que podemos melhorar?";

      const { data: instance } = await supabase
        .from("uazapi_instances")
        .select("api_url, api_token")
        .eq("id", survey.instance_id)
        .single();

      if (instance) {
        await sendWhatsAppMessage(
          instance.api_url,
          instance.api_token,
          survey.customer_phone,
          followupMessage
        );
        await supabase
          .from("csat_surveys")
          .update({ followup_sent: true, status: "awaiting_followup" })
          .eq("id", surveyId);
      }
    }
  }

  return jsonResponse({
    is_csat_response: analysis.is_csat_response,
    score: analysis.score ?? null,
    surveyId,
  });
}

// ─── Action: classify-followup ────────────────────────────────────────────────

async function handleClassifyFollowup(surveyId: string, message: string) {
  const { data: survey, error } = await supabase
    .from("csat_surveys")
    .select("id, status, conversation_id")
    .eq("id", surveyId)
    .single();

  if (error || !survey) {
    return jsonResponse({ error: "Survey not found" }, 404);
  }

  if (survey.status !== "awaiting_followup") {
    return jsonResponse({ error: "Survey not awaiting followup" }, 400);
  }

  await supabase
    .from("csat_surveys")
    .update({
      followup_response: message,
      status: "answered",
    })
    .eq("id", surveyId);

  // Salvar comentário na conversa também
  if (survey.conversation_id) {
    await supabase
      .from("ai_conversations")
      .update({ csat_comment: message })
      .eq("id", survey.conversation_id);
  }

  return jsonResponse({ success: true, surveyId });
}

// ─── Action: process-pending ──────────────────────────────────────────────────

async function handleProcessPending() {
  const now = new Date();
  const stats = { expired: 0, resent: 0, sent: 0 };

  // 1. EXPIRE: surveys enviadas cujo response_window_hours já passou
  const { data: toExpire } = await supabase
    .from("csat_surveys")
    .select("id, created_at, response_window_hours")
    .in("status", ["sent", "resent"])
    .limit(50);

  if (toExpire?.length) {
    const expireIds: string[] = [];
    for (const s of toExpire) {
      const expiresAt = new Date(
        new Date(s.created_at).getTime() + (s.response_window_hours ?? 48) * 3600 * 1000
      );
      if (expiresAt <= now) {
        expireIds.push(s.id);
      }
    }
    if (expireIds.length) {
      await supabase
        .from("csat_surveys")
        .update({ status: "expired", expired_at: now.toISOString() })
        .in("id", expireIds);
      stats.expired = expireIds.length;
    }
  }

  // 2. RESEND: surveys sent/resent com next_action_at <= now
  const { data: toResend } = await supabase
    .from("csat_surveys")
    .select(
      "id, customer_phone, instance_id, resend_count, sent_message_id, config_id, conversation_id, config:csat_board_configs(max_resends, resend_after_hours, resend_enabled, message_template, board:kanban_boards(name))"
    )
    .in("status", ["sent", "resent"])
    .lte("next_action_at", now.toISOString())
    .limit(50);

  if (toResend?.length) {
    for (const s of toResend) {
      const cfg = s.config as any;
      if (!cfg?.resend_enabled) continue;
      const maxResends = cfg?.max_resends ?? 1;
      const resendCount = s.resend_count ?? 0;

      if (resendCount >= maxResends) {
        await supabase
          .from("csat_surveys")
          .update({ status: "expired", expired_at: now.toISOString() })
          .eq("id", s.id);
        stats.expired += 1;
        continue;
      }

      const { data: instance } = await supabase
        .from("uazapi_instances")
        .select("api_url, api_token")
        .eq("id", s.instance_id)
        .single();

      if (!instance) continue;

      // Rebuild message from template
      const { data: conv } = await supabase
        .from("ai_conversations")
        .select("customer_name, ticket_number")
        .eq("id", s.conversation_id)
        .single();

      const msg = (cfg.message_template as string)
        .replace(/\{\{nome\}\}/g, conv?.customer_name ?? "Cliente")
        .replace(/\{\{protocolo\}\}/g, conv?.ticket_number ?? "")
        .replace(/\{\{board\}\}/g, cfg.board?.name ?? "Atendimento");

      const reminderMessage = `🔔 *Lembrete*\n\n${msg}`;
      const sentMessageId = await sendWhatsAppMessage(
        instance.api_url,
        instance.api_token,
        s.customer_phone,
        reminderMessage
      );

      const nextActionAt = new Date(
        Date.now() + (cfg.resend_after_hours ?? 4) * 3600 * 1000
      ).toISOString();

      await supabase
        .from("csat_surveys")
        .update({
          status: "resent",
          resend_count: resendCount + 1,
          sent_message_id: sentMessageId ?? s.sent_message_id,
          next_action_at: nextActionAt,
        })
        .eq("id", s.id);

      stats.resent += 1;
    }
  }

  // 3. SEND DELAYED: surveys pending com next_action_at <= now
  const { data: pendingToSend } = await supabase
    .from("csat_surveys")
    .select(
      "id, customer_phone, instance_id, config_id, conversation_id, config:csat_board_configs(message_template, resend_enabled, resend_after_hours, response_window_hours, board:kanban_boards(name))"
    )
    .eq("status", "pending")
    .lte("next_action_at", now.toISOString())
    .limit(50);

  if (pendingToSend?.length) {
    for (const s of pendingToSend) {
      const { data: instance } = await supabase
        .from("uazapi_instances")
        .select("api_url, api_token")
        .eq("id", s.instance_id)
        .single();

      if (!instance) continue;

      const { data: conv } = await supabase
        .from("ai_conversations")
        .select("customer_name, ticket_number")
        .eq("id", s.conversation_id)
        .single();

      const cfg = s.config as any;
      const msg = (cfg?.message_template as string || "")
        .replace(/\{\{nome\}\}/g, conv?.customer_name ?? "Cliente")
        .replace(/\{\{protocolo\}\}/g, conv?.ticket_number ?? "")
        .replace(/\{\{board\}\}/g, cfg?.board?.name ?? "Atendimento");

      const sentMessageId = await sendWhatsAppMessage(
        instance.api_url,
        instance.api_token,
        s.customer_phone,
        msg
      );

      const sentAt = new Date().toISOString();
      const nextAction = cfg?.resend_enabled
        ? new Date(Date.now() + (cfg.resend_after_hours ?? 4) * 3600 * 1000).toISOString()
        : null;

      await supabase
        .from("csat_surveys")
        .update({
          status: "sent",
          sent_message_id: sentMessageId,
          sent_at: sentAt,
          next_action_at: nextAction,
        })
        .eq("id", s.id);

      if (s.conversation_id) {
        await supabase
          .from("ai_conversations")
          .update({ csat_sent_at: sentAt })
          .eq("id", s.conversation_id);
      }

      stats.sent += 1;
    }
  }

  return jsonResponse({ success: true, processed: stats });
}

// ─── Action: reconcile-missed ─────────────────────────────────────────────────

async function handleReconcileMissed() {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

  const { data: missed } = await supabase
    .from("ai_conversations")
    .select("id, whatsapp_instance_id, kanban_board_id")
    .eq("status", "finalizado")
    .is("csat_sent_at", null)
    .gte("resolved_at", twoHoursAgo)
    .limit(50);

  if (!missed?.length) return jsonResponse({ success: true, processed: 0 });

  let processed = 0;

  for (const conv of missed) {
    if (!conv.kanban_board_id) continue;

    const { data: csatConfig } = await supabase
      .from("csat_board_configs")
      .select("id, enabled, send_on_close")
      .eq("board_id", conv.kanban_board_id)
      .eq("enabled", true)
      .eq("send_on_close", true)
      .maybeSingle();

    if (!csatConfig) {
      await supabase.from("csat_send_log").insert({
        conversation_id: conv.id,
        config_id: null,
        trigger_source: "cron_reconcile",
        status: "skipped_no_config",
      }).then(() => {}, () => {});
      continue;
    }

    try {
      const sendResult = await handleSend(conv.id, csatConfig.id, "cron_reconcile");
      if (sendResult.status >= 200 && sendResult.status < 300) {
        processed++;
      } else {
        const errBody = await sendResult.json().catch(() => ({}));
        await supabase.from("csat_send_log").insert({
          conversation_id: conv.id,
          config_id: csatConfig.id,
          trigger_source: "cron_reconcile",
          status: "failed",
          error_message: (errBody as any)?.error || `HTTP ${sendResult.status}`,
        }).then(() => {}, () => {});
      }
    } catch (err) {
      await supabase.from("csat_send_log").insert({
        conversation_id: conv.id,
        config_id: csatConfig.id,
        trigger_source: "cron_reconcile",
        status: "failed",
        error_message: String(err),
      }).then(() => {}, () => {});
    }
  }

  return jsonResponse({ success: true, processed });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "send":
        return await handleSend(
          params.conversationId,
          params.configId,
          (params.trigger_source as "close" | "cron_reconcile" | "manual") || "close"
        );

      case "classify":
        return await handleClassify(
          params.surveyId,
          params.message,
          params.quotedMsgId
        );

      case "classify-followup":
        return await handleClassifyFollowup(params.surveyId, params.message);

      case "process-pending":
        return await handleProcessPending();

      case "reconcile-missed":
        return await handleReconcileMissed();

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("csat-processor error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
