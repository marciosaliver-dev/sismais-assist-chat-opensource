import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Load config
    const { data: configRows } = await supabase
      .from("platform_ai_config")
      .select("feature, config")
      .eq("feature", "queue_notifications")
      .maybeSingle();

    const config = (configRows?.config as Record<string, number>) || {};
    const intervalMinutes = config.interval_minutes || 10;
    const maxNotifications = config.max_notifications || 5;
    const avgServiceMinutes = config.avg_service_minutes || 15;

    // 2. Count online agents
    const { count: onlineAgents } = await supabase
      .from("human_agents")
      .select("id", { count: "exact", head: true })
      .eq("is_online", true)
      .eq("is_active", true);

    const agentsOnline = Math.max(onlineAgents || 1, 1);

    // 3. Get conversations waiting in queue for human
    const { data: queueConvs } = await supabase
      .from("ai_conversations")
      .select(
        "id, customer_phone, customer_name, uazapi_chat_id, whatsapp_instance_id, context, queue_entered_at"
      )
      .eq("status", "aguardando")
      .eq("handler_type", "human")
      .order("queue_entered_at", { ascending: true });

    if (!queueConvs || queueConvs.length === 0) {
      console.log("[queue-notifier] No conversations in queue");
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notifiedCount = 0;

    for (let i = 0; i < queueConvs.length; i++) {
      const conv = queueConvs[i];
      const ctx = (conv.context as Record<string, unknown>) || {};
      const notifyCount = (ctx.queue_notify_count as number) || 0;
      const lastNotifiedAt = ctx.queue_last_notified_at as string | undefined;

      // Check max notifications
      if (notifyCount >= maxNotifications) continue;

      // Check interval
      if (lastNotifiedAt) {
        const elapsed =
          (Date.now() - new Date(lastNotifiedAt).getTime()) / 60000;
        if (elapsed < intervalMinutes) continue;
      } else if (conv.queue_entered_at) {
        // First notification: wait at least intervalMinutes after entering queue
        const elapsed =
          (Date.now() - new Date(conv.queue_entered_at).getTime()) / 60000;
        if (elapsed < intervalMinutes) continue;
      }

      // Calculate position and estimated time
      const position = i + 1;
      const estimatedMinutes = Math.ceil(
        (position / agentsOnline) * avgServiceMinutes
      );

      // Build message
      let message: string;
      if (notifyCount === 0) {
        message = `Olá${conv.customer_name ? `, ${conv.customer_name.split(" ")[0]}` : ""}! Você está na posição *${position}* da fila de atendimento. Tempo estimado: *~${estimatedMinutes} minutos*. Agradecemos sua paciência! 🙏`;
      } else {
        message = `Ainda estamos trabalhando para te atender. Sua posição atual: *${position}*. Estimativa: *~${estimatedMinutes} min*. Obrigado por aguardar! 😊`;
      }

      // Send via UAZAPI
      const sent = await sendQueueMessage(
        supabase as any,
        conv,
        message
      );

      if (sent) {
        // Update context
        await supabase
          .from("ai_conversations")
          .update({
            context: {
              ...ctx,
              queue_notify_count: notifyCount + 1,
              queue_last_notified_at: new Date().toISOString(),
            },
          })
          .eq("id", conv.id);
        notifiedCount++;
      }
    }

    console.log(
      `[queue-notifier] Notified ${notifiedCount}/${queueConvs.length} conversations`
    );

    return new Response(
      JSON.stringify({
        success: true,
        notified: notifiedCount,
        total_in_queue: queueConvs.length,
        agents_online: agentsOnline,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[queue-notifier] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function sendQueueMessage(
  supabase: any,
  conv: Record<string, unknown>,
  text: string
): Promise<boolean> {
  try {
    const instanceId = conv.whatsapp_instance_id as string;
    if (!instanceId) return false;

    const { data: inst } = await supabase
      .from("uazapi_instances")
      .select("api_url, api_token, profile_name")
      .eq("id", instanceId)
      .single();

    if (!inst) return false;

    const apiUrl = (inst as any).api_url.replace(/\/$/, "");
    const customerPhone = conv.customer_phone as string;
    const chatJid = conv.uazapi_chat_id as string;

    const recipient =
      customerPhone && /^\d{8,}/.test(customerPhone)
        ? customerPhone
        : chatJid;

    if (!recipient) return false;

    // Ensure proper format
    if (/^\d{8,}/.test(recipient) && !recipient.includes("@")) {
      // already a phone number, UAZAPI accepts raw numbers
    }

    const sendResp = await fetch(`${apiUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: (inst as any).api_token,
      },
      body: JSON.stringify({ number: recipient, text }),
    });

    if (!sendResp.ok) {
      const errBody = await sendResp.text();
      console.error(
        `[queue-notifier] Send error for ${conv.id}: [${sendResp.status}] ${errBody}`
      );
      return false;
    }

    const result = await sendResp.json();
    console.log(
      `[queue-notifier] Sent to ${conv.id}: ${result?.key?.id || "ok"}`
    );

    // Log sent message
    if (result?.key?.id) {
      await (supabase as any).from("uazapi_messages").insert({
        message_id: result.key.id,
        instance_id: instanceId,
        type: "text",
        text_body: text,
        from_me: true,
        sender_name: (inst as any).profile_name || "Sistema",
        timestamp: new Date().toISOString(),
        status: "sent",
      });
    }

    return true;
  } catch (e) {
    console.error(`[queue-notifier] Send error:`, e);
    return false;
  }
}
