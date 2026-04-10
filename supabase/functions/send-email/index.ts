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
    const { to, subject, body: emailBody, cc, from_name, conversation_id } = body;

    if (!to || !subject || !emailBody) {
      return new Response(JSON.stringify({ error: "to, subject e body sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(JSON.stringify({ error: "Formato de email invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SMTP configuration from platform_ai_config
    const { data: smtpConfig } = await supabase
      .from("platform_ai_config")
      .select("config")
      .eq("key", "smtp")
      .single();

    if (!smtpConfig?.config) {
      // Fallback: use a simple email log if no SMTP configured
      console.log("[send-email] No SMTP configured, logging email instead");
      
      await supabase.from("ai_audit_log").insert({
        conversation_id,
        action: "email_sent",
        details: { to, subject, body_preview: emailBody.substring(0, 200) },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email logged (SMTP nao configurado)",
          to,
          subject,
          logged_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtp = smtpConfig.config;
    
    // Send email via SMTP (using fetch to external SMTP service or directly)
    // For now, use a simple HTTP email service like Resend, SendGrid, etc.
    const emailService = Deno.env.get("EMAIL_SERVICE_URL");
    const emailApiKey = Deno.env.get("EMAIL_API_KEY");

    if (emailService && emailApiKey) {
      const response = await fetch(emailService, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + emailApiKey,
        },
        body: JSON.stringify({
          from: smtp.from_email || "noreply@sismais.com.br",
          from_name: from_name || "Sismais Assist",
          to: [to],
          cc: cc ? [cc] : undefined,
          subject,
          html: emailBody,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[send-email] Email service error:", errorText);
        return new Response(JSON.stringify({ error: "Falha ao enviar email", details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      console.log("[send-email] Email sent to " + to);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email enviado com sucesso",
          to,
          subject,
          message_id: result.id || result.messageId,
          sent_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No email service configured - log and return
    await supabase.from("ai_audit_log").insert({
      conversation_id,
      action: "email_sent",
      details: { to, subject, body_preview: emailBody.substring(0, 200) },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email logged (servico nao configurado)",
        to,
        subject,
        logged_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-email] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
