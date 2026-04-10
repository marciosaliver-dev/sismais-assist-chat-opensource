import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    const { client_phone, scheduled_time, agent_id, reason, conversation_id } = body;

    if (!client_phone || !scheduled_time) {
      return new Response(JSON.stringify({ error: "client_phone e scheduled_time sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate scheduled_time is in the future
    const scheduledDate = new Date(scheduled_time);
    if (scheduledDate <= new Date()) {
      return new Response(JSON.stringify({ error: "scheduled_time deve ser no futuro" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create callback as a conversation with special metadata
    const { data: callback, error: insertError } = await supabase
      .from("ai_conversations")
      .insert({
        ticket_subject: "[Callback] " + (reason || "Retorno telefonico"),
        ticket_description: { phone: client_phone, reason: reason },
        customer_phone: client_phone,
        status: "novo",
        handler_type: "ai",
        priority: "alta",
        tags: ["callback", "scheduled"],
        context: {
          type: "callback",
          scheduled_time,
          conversation_id,
          assigned_to: agent_id,
          created_by: "ai_agent",
        } as any,
        started_at: scheduled_time,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[schedule-callback] Error:", insertError);
      return new Response(JSON.stringify({ error: "Falha ao agendar callback", details: insertError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[schedule-callback] Callback scheduled: " + callback.id);

    return new Response(
      JSON.stringify({
        success: true,
        callback_id: callback.id,
        client_phone,
        scheduled_time,
        agent_id: agent_id || null,
        reason: reason || null,
        message: "Callback agendado para " + new Date(scheduled_time).toLocaleString("pt-BR"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[schedule-callback] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
