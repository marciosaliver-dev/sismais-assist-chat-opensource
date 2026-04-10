import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — caller must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } =
      await callerClient.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ error: "Forbidden — admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, role, create_agent, max_simultaneous_chats } = await req.json();

    if (!user_id || !role) {
      return new Response(
        JSON.stringify({ error: "user_id e role são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["admin", "lider", "suporte", "comercial"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Role inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user info from Auth for name/email
    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(user_id);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = userData.user.email || "";
    const userName = userData.user.user_metadata?.name || userEmail;

    // Remove any existing role entries and upsert with is_approved = true
    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("user_roles").insert({
      user_id,
      role,
      is_approved: true,
    });

    // Optionally create human_agents record
    let agentId: string | null = null;
    if (create_agent) {
      // Check if agent already linked to this user
      const { data: existingAgent } = await adminClient
        .from("human_agents")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existingAgent) {
        agentId = existingAgent.id;
      } else {
        const { data: agent, error: agentError } = await adminClient
          .from("human_agents")
          .insert({
            name: userName,
            email: userEmail,
            user_id,
            is_active: true,
            is_online: false,
            status: "offline",
            max_concurrent_conversations: max_simultaneous_chats || 5,
          })
          .select("id")
          .single();

        if (agentError) {
          console.error("Error creating human agent:", agentError);
          return new Response(
            JSON.stringify({ error: `Usuário aprovado, mas falha ao criar agente: ${agentError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          agentId = agent.id;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, agent_id: agentId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("approve-user error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
