import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InstanceRequest {
  action: "connect" | "disconnect" | "status" | "qrcode";
  instanceId?: string;
  instanceName?: string;
  subdomain?: string;
  token?: string;
}

async function callUazapi(
  subdomain: string,
  token: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `https://${subdomain}.uazapi.com${endpoint}`;
  console.log("Calling Uazapi:", url);

  return fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
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
        status: 401,
        headers: corsHeaders,
      });
    }

    const body: InstanceRequest = await req.json();
    const { action, instanceId, instanceName, subdomain, token } = body;

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Use provided credentials or fallback to environment variables
    const useSubdomain = subdomain || Deno.env.get("UAZAPI_SUBDOMAIN")!;
    const useToken = token || Deno.env.get("UAZAPI_TOKEN")!;
    const useInstanceId = instanceId || Deno.env.get("UAZAPI_INSTANCE_ID")!;

    if (!useSubdomain || !useToken) {
      return new Response(
        JSON.stringify({ error: "Missing Uazapi credentials" }),
        { status: 400, headers: corsHeaders }
      );
    }

    switch (action) {
      case "qrcode": {
        const response = await callUazapi(useSubdomain, useToken, "/instance/qrcode", {
          id: useInstanceId,
        });
        const result = await response.json();
        console.log("QRCode response:", result);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const response = await callUazapi(useSubdomain, useToken, "/instance/status", {
          id: useInstanceId,
        });
        const result = await response.json();
        console.log("Status response:", result);

        // Update instance status in database if we have a record
        if (instanceId) {
          await serviceSupabase
            .from("crm_whatsapp_instances")
            .update({
              status: result.state || "unknown",
              phone: result.phone || null,
              last_connected_at: result.state === "connected" ? new Date().toISOString() : null,
            })
            .eq("id", instanceId);
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect": {
        // Save instance to database
        const { data: existing } = await serviceSupabase
          .from("crm_whatsapp_instances")
          .select("id")
          .eq("instance_id", useInstanceId)
          .single();

        if (existing) {
          await serviceSupabase
            .from("crm_whatsapp_instances")
            .update({
              subdomain: useSubdomain,
              token: useToken,
              instance_name: instanceName || "WhatsApp Instance",
              status: "connecting",
            })
            .eq("id", existing.id);
        } else {
          await serviceSupabase.from("crm_whatsapp_instances").insert({
            instance_id: useInstanceId,
            instance_name: instanceName || "WhatsApp Instance",
            subdomain: useSubdomain,
            token: useToken,
            status: "connecting",
            is_default: true,
          });
        }

        // Get QR code
        const response = await callUazapi(useSubdomain, useToken, "/instance/qrcode", {
          id: useInstanceId,
        });
        const result = await response.json();

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const response = await callUazapi(useSubdomain, useToken, "/instance/logout", {
          id: useInstanceId,
        });
        const result = await response.json();

        // Update status in database
        await serviceSupabase
          .from("crm_whatsapp_instances")
          .update({ status: "disconnected" })
          .eq("instance_id", useInstanceId);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: corsHeaders,
        });
    }
  } catch (error) {
    console.error("Instance error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
