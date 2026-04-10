import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch active SLA configs
    const { data: slaConfigs, error: slaErr } = await supabase
      .from("ticket_sla_config")
      .select("priority, first_response_target_minutes")
      .eq("active", true);

    if (slaErr) throw slaErr;
    if (!slaConfigs?.length) {
      return new Response(JSON.stringify({ message: "No SLA configs found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slaMap = new Map<string, number>();
    for (const cfg of slaConfigs) {
      slaMap.set(cfg.priority, cfg.first_response_target_minutes);
    }

    // 2. Fetch conversations still in queue (no first human response yet)
    const { data: conversations, error: convErr } = await supabase
      .from("ai_conversations")
      .select("id, queue_entered_at, priority, human_agent_id, customer_name, ticket_number")
      .not("queue_entered_at", "is", null)
      .is("first_human_response_at", null)
      .neq("status", "finalizado");

    if (convErr) throw convErr;
    if (!conversations?.length) {
      return new Response(JSON.stringify({ message: "No conversations in queue", alerts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let alertsSent = 0;

    for (const conv of conversations) {
      const priority = conv.priority || "medium";
      const targetMinutes = slaMap.get(priority);
      if (!targetMinutes) continue;

      const queuedAt = new Date(conv.queue_entered_at).getTime();
      const elapsedMinutes = (now - queuedAt) / 60000;
      const thresholdMinutes = targetMinutes * 0.8;

      // Only alert if elapsed >= 80% of target AND not yet exceeded
      if (elapsedMinutes < thresholdMinutes || elapsedMinutes > targetMinutes) continue;

      // Check if we already sent an SLA alert for this conversation (avoid duplicates)
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("type", "system")
        .ilike("title", "%SLA%prestes%")
        .limit(1);

      if (existing?.length) continue;

      // Find who to notify: the assigned human agent, or skip if none
      if (!conv.human_agent_id) continue;

      const { data: agent } = await supabase
        .from("human_agents")
        .select("user_id, name")
        .eq("id", conv.human_agent_id)
        .single();

      if (!agent?.user_id) continue;

      const remainingMin = Math.max(0, Math.round(targetMinutes - elapsedMinutes));
      const customerLabel = conv.customer_name || `#${conv.ticket_number}`;

      await supabase.from("notifications").insert({
        user_id: agent.user_id,
        human_agent_id: conv.human_agent_id,
        type: "system",
        title: `⚠️ SLA prestes a estourar`,
        message: `A conversa de ${customerLabel} atingiu 80% do prazo de primeira resposta. Restam ~${remainingMin} min.`,
        conversation_id: conv.id,
        priority: "critical",
        action_url: `/inbox?conversation=${conv.id}`,
        action_label: "Responder agora",
        expires_at: new Date(queuedAt + targetMinutes * 60000).toISOString(),
      });

      alertsSent++;
    }

    return new Response(
      JSON.stringify({ message: `SLA check complete`, alerts: alertsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("SLA alert check error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
