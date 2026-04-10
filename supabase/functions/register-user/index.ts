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
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nome, email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Create user in Supabase Auth (email confirmed immediately)
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (createError) {
      const rawMessage = (createError.message || "").toLowerCase();
      const isEmailExists =
        rawMessage.includes("already been registered") ||
        rawMessage.includes("email_exists") ||
        rawMessage.includes("already registered");

      return new Response(
        JSON.stringify({
          error: isEmailExists
            ? "Este email já está cadastrado. Tente fazer login ou use outro email."
            : createError.message,
          code: isEmailExists ? "email_exists" : "registration_error",
        }),
        {
          status: isEmailExists ? 409 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = newUser.user.id;

    // Insert into user_roles with is_approved = false (pending admin approval)
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "suporte", is_approved: false },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      console.error("Error inserting user_role:", roleError);
      // Rollback: delete the created auth user
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove default 'user' role if created by trigger
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "user");

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("register-user error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
