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
    const { conversation_id, reason, priority = "normal", agent_id } = body;

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id e obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select("id, customer_phone, status, handler_type")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: "Conversa nao encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update conversation to human handler using available fields
    const { error: updateError } = await supabase
      .from("ai_conversations")
      .update({
        handler_type: "human",
        status: "aguardando",
        human_agent_id: agent_id || null,
        queue_entered_at: new Date().toISOString(),
        priority: priority === "urgent" ? "alta" : undefined,
      })
      .eq("id", conversation_id);

    if (updateError) {
      console.error("[escalate-to-human] Error:", updateError);
      return new Response(JSON.stringify({ error: "Falha ao escalar", details: updateError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the escalation
    await supabase.from("ai_audit_log").insert({
      conversation_id,
      action: "escalate_to_human",
      agent_id,
      details: { reason, priority },
      created_at: new Date().toISOString(),
    });

    console.log("[escalate-to-human] Conversation " + conversation_id + " escalated. Reason: " + reason);

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id,
        status: "aguardando",
        message: "Conversa transferida para atendimento humano",
        queue_position: "Sera avisado sobre posicao na fila",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[escalate-to-human] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
