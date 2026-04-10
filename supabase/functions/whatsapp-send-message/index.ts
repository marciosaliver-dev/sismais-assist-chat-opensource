import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, message, type = "text", buttons, media } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "to and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active account credentials
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_business_accounts")
      .select("*")
      .eq("is_active", true)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Business account not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number
    const formattedTo = to.replace(/\D/g, "");

    // Build Meta API payload
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedTo,
    };

    if (buttons && buttons.length > 0) {
      payload.type = "interactive";
      payload.interactive = {
        type: "button",
        body: { text: message },
        action: {
          buttons: buttons.map((b: { id: string; title: string }) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      };
    } else if (media) {
      payload.type = media.type;
      payload[media.type] = {
        link: media.url,
        caption: message,
      };
    } else {
      payload.type = "text";
      payload.text = { body: message };
    }

    // Send via Meta API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${account.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Meta API send error:", result);
      return new Response(
        JSON.stringify({ error: result.error?.message || "Failed to send message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save outbound message to DB
    await supabase.from("whatsapp_messages").insert({
      message_id: result.messages?.[0]?.id || null,
      from_phone: account.phone_number,
      to_phone: formattedTo,
      direction: "outbound",
      type: (payload.type as string) || "text",
      text_body: message,
      status: "sent",
      waba_id: account.id,
    });

    console.log(`Message sent to ${formattedTo.slice(0, -4) + '****'}`);

    return new Response(
      JSON.stringify({ success: true, message_id: result.messages?.[0]?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("whatsapp-send-message error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
