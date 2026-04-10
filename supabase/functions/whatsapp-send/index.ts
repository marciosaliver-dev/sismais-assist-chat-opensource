import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendMessageRequest {
  phone: string;
  message?: string;
  type?: "text" | "image" | "audio" | "video" | "document";
  mediaUrl?: string;
  mediaCaption?: string;
  instanceId?: string;
}

async function sendToUazapi(
  apiUrl: string,
  token: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${apiUrl.replace(/\/$/, "")}${endpoint}`;
  console.log("Sending to Uazapi:", url, JSON.stringify(body));

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: token,
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getUser(jwtToken);
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const body: SendMessageRequest = await req.json();
    const { phone, message, type = "text", mediaUrl, mediaCaption, instanceId } = body;

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone is required" }), {
        status: 400, headers: corsHeaders,
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try DB instance first, then env vars
    let apiUrl: string;
    let apiToken: string;
    let dbInstanceId: string | null = null;

    if (instanceId) {
      const { data: instance } = await serviceSupabase
        .from("crm_whatsapp_instances").select("*").eq("id", instanceId).single();
      if (instance) {
        apiUrl = `https://${instance.subdomain}.uazapi.com`;
        apiToken = instance.token;
        dbInstanceId = instance.id;
      }
    }

    if (!apiUrl!) {
      // Try uazapi_instances table — but log a warning since this is a fallback
      console.warn("[whatsapp-send] No instanceId provided, falling back to first active uazapi_instance");
      const { data: uazInstance } = await serviceSupabase
        .from("uazapi_instances").select("*").eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (uazInstance) {
        apiUrl = uazInstance.api_url.replace(/\/$/, "");
        apiToken = uazInstance.api_token;
        dbInstanceId = uazInstance.id;
        console.warn(`[whatsapp-send] Fallback resolved to instance: ${uazInstance.instance_name || uazInstance.id}`);
      }
    }

    if (!apiUrl!) {
      // Fallback to env
      const envSubdomain = Deno.env.get("UAZAPI_SUBDOMAIN");
      const envToken = Deno.env.get("UAZAPI_TOKEN");
      if (!envSubdomain || !envToken) {
        return new Response(
          JSON.stringify({ error: "No WhatsApp instance configured" }),
          { status: 400, headers: corsHeaders }
        );
      }
      apiUrl = `https://${envSubdomain}.uazapi.com`;
      apiToken = envToken;
    }

    const formattedPhone = phone.replace(/\D/g, "");

    // Use UAZAPI v2 endpoints
    let endpoint: string;
    let requestBody: Record<string, unknown>;

    if (type === "text") {
      endpoint = "/send/text";
      requestBody = { number: formattedPhone, text: message || "" };
    } else {
      endpoint = "/send/media";
      requestBody = {
        number: formattedPhone,
        type: type,
        file: mediaUrl,
        text: mediaCaption || message || "",
      };
    }

    const uazapiResponse = await sendToUazapi(apiUrl!, apiToken!, endpoint, requestBody);
    const uazapiResult = await uazapiResponse.json();

    if (!uazapiResponse.ok) {
      console.error("Uazapi error:", uazapiResult);
      return new Response(
        JSON.stringify({ error: "Failed to send message", details: uazapiResult }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Save message to database
    await serviceSupabase.from("crm_messages").insert({
      lead_phone: formattedPhone,
      direction: "outbound",
      content: message || mediaCaption || `[${type}]`,
      type,
      status: "sent",
      mode: "manual",
      uza_message_id: uazapiResult.key?.id || null,
      media_url: mediaUrl || null,
      ...(dbInstanceId ? { instance_id: dbInstanceId } : {}),
    });

    return new Response(JSON.stringify({ success: true, data: uazapiResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
