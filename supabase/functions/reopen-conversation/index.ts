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
    // Autenticação do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client do usuário para validar autenticação
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client admin para operações com service role
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Validar role do usuário
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData || roleData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar input
    const body = await req.json();
    const { conversation_id, reason, destination_type, destination_id } = body;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "reason is required and must be at least 10 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validDestinationTypes = ["orchestrator", "human", "ai"];
    if (!destination_type || !validDestinationTypes.includes(destination_type)) {
      return new Response(
        JSON.stringify({ error: "destination_type must be one of: orchestrator, human, ai" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar que a conversa existe e está em status finalizado ou resolvido
    const { data: conversation, error: convError } = await adminClient
      .from("ai_conversations")
      .select("id, status, reopen_count")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedStatuses = ["finalizado", "resolvido"];
    if (!allowedStatuses.includes(conversation.status)) {
      return new Response(
        JSON.stringify({ error: `Conversation must be in 'finalizado' or 'resolvido' status. Current status: ${conversation.status}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nome do admin (human_agents) com fallback para email
    const { data: humanAgent } = await adminClient
      .from("human_agents")
      .select("name")
      .eq("user_id", user.id)
      .single();

    const adminName = humanAgent?.name || user.email || "Admin";

    // Inserir registro em ai_conversation_reopens
    const { error: reopenInsertError } = await adminClient
      .from("ai_conversation_reopens")
      .insert({
        conversation_id,
        reopened_by: user.id,
        reason: reason.trim(),
        destination_type,
        destination_id: destination_id || null,
      });

    if (reopenInsertError) {
      console.error("Error inserting reopen record:", reopenInsertError);
      return new Response(
        JSON.stringify({ error: "Failed to register reopen record", details: reopenInsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar update da conversa conforme destination_type
    let conversationUpdate: Record<string, unknown> = {
      reopen_count: (conversation.reopen_count || 0) + 1,
      last_reopened_at: new Date().toISOString(),
      last_reopened_by: user.id,
    };

    if (destination_type === "orchestrator") {
      conversationUpdate = {
        ...conversationUpdate,
        status: "aguardando",
        handler_type: null,
        assigned_agent_id: null,
        human_agent_id: null,
      };
    } else if (destination_type === "human") {
      conversationUpdate = {
        ...conversationUpdate,
        status: "em_atendimento",
        handler_type: "human",
        human_agent_id: destination_id || null,
      };
    } else if (destination_type === "ai") {
      conversationUpdate = {
        ...conversationUpdate,
        status: "em_atendimento",
        handler_type: "ai",
        assigned_agent_id: destination_id || null,
      };
    }

    // Atualizar ai_conversations
    const { error: updateError } = await adminClient
      .from("ai_conversations")
      .update(conversationUpdate)
      .eq("id", conversation_id);

    if (updateError) {
      console.error("Error updating conversation:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update conversation", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inserir mensagem de sistema
    const systemMessageContent = `Ticket reaberto por ${adminName} — Motivo: ${reason.trim()}`;
    const { error: msgError } = await adminClient
      .from("ai_messages")
      .insert({
        conversation_id,
        role: "system",
        content: systemMessageContent,
      });

    if (msgError) {
      console.error("Error inserting system message:", msgError);
      // Não falhar a operação por causa da mensagem de sistema
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id,
        destination_type,
        message: systemMessageContent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
