import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_HOURS = 24;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { instance_id, phone, batch, temp_url } = body;

    // Single mode
    if (phone && instance_id) {
      const result = await fetchAndCacheAvatar(supabase, instance_id, phone, temp_url);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch mode
    if (batch && Array.isArray(batch) && instance_id) {
      const results = [];
      for (const item of batch.slice(0, 50)) {
        if (!item.phone) continue;
        try {
          const result = await fetchAndCacheAvatar(supabase, instance_id, item.phone);
          results.push({ phone: item.phone, ...result });
        } catch (e) {
          results.push({ phone: item.phone, error: String(e) });
        }
      }
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "phone and instance_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-sync-avatars error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchAndCacheAvatar(
  supabase: any,
  instanceId: string,
  phone: string,
  tempUrl?: string | null
): Promise<{ avatar_url: string | null; cached: boolean }> {
  const cleanPhone = phone.replace(/\D/g, "");

  // Check cache in uazapi_chats
  const { data: chatRecord } = await supabase
    .from("uazapi_chats")
    .select("id, contact_picture_url, avatar_fetched_at")
    .eq("instance_id", instanceId)
    .eq("contact_phone", cleanPhone)
    .maybeSingle();

  if (chatRecord?.avatar_fetched_at) {
    const fetchedAt = new Date(chatRecord.avatar_fetched_at);
    const hoursSince = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < CACHE_HOURS && chatRecord.contact_picture_url) {
      return { avatar_url: chatRecord.contact_picture_url, cached: true };
    }
    // If fetched recently but no URL, don't retry
    if (hoursSince < CACHE_HOURS) {
      return { avatar_url: null, cached: true };
    }
  }

  // Also check customer_profiles cache
  const { data: profileRecord } = await supabase
    .from("customer_profiles")
    .select("id, avatar_url, avatar_fetched_at")
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (profileRecord?.avatar_fetched_at) {
    const fetchedAt = new Date(profileRecord.avatar_fetched_at);
    const hoursSince = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < CACHE_HOURS && profileRecord.avatar_url) {
      // Sync to chat record if needed
      if (chatRecord && !chatRecord.contact_picture_url) {
        await supabase
          .from("uazapi_chats")
          .update({ contact_picture_url: profileRecord.avatar_url, avatar_fetched_at: new Date().toISOString() })
          .eq("id", chatRecord.id);
      }
      return { avatar_url: profileRecord.avatar_url, cached: true };
    }
    if (hoursSince < CACHE_HOURS) {
      return { avatar_url: null, cached: true };
    }
  }

  // Fetch instance credentials
  const { data: instance } = await supabase
    .from("uazapi_instances")
    .select("api_url, api_token")
    .eq("id", instanceId)
    .eq("is_active", true)
    .single();

  if (!instance) {
    return { avatar_url: null, cached: false };
  }

  const apiUrl = instance.api_url.replace(/\/$/, "");
  let whatsappTempUrl: string | null = null;

  // If a temp_url was provided from the webhook payload, try it first
  if (tempUrl && typeof tempUrl === "string" && tempUrl.startsWith("http")) {
    whatsappTempUrl = tempUrl;
    console.log(`Using provided temp_url for ${cleanPhone}`);
  }

  // Try multiple endpoint variants with both GET and POST (uazapiGO v2 uses GET for contact endpoints)
  const jid = `${cleanPhone}@s.whatsapp.net`;
  const headers = { "Content-Type": "application/json", token: instance.api_token };

  const extractUrl = (data: Record<string, any>): string | null => {
    const url = data?.profilePictureUrl || data?.profilePicUrl || data?.PictureURL ||
      data?.pictureUrl || data?.picture || data?.imgUrl || data?.url || data?.eurl ||
      data?.photo || data?.avatar || data?.image ||
      data?.result?.profilePictureUrl || data?.result?.profilePicUrl || data?.result?.eurl || null;
    return (url && typeof url === "string" && url.startsWith("http")) ? url : null;
  };

  // Try GET endpoints first (uazapiGO v2 style)
  const getEndpoints = [
    `/v1/contacts/info?number=${cleanPhone}`,
    `/contact/details?number=${cleanPhone}`,
    `/contact/info?number=${jid}`,
    `/contact/profilePicture?number=${jid}`,
    `/chat/fetchProfilePictureUrl?number=${jid}`,
  ];

  for (const epUrl of getEndpoints) {
    if (whatsappTempUrl) break;
    try {
      const resp = await fetch(`${apiUrl}${epUrl}`, { method: "GET", headers });
      if (resp.ok) {
        const data = await resp.json();
        console.log(`Avatar GET ${epUrl.split("?")[0]} response for ${cleanPhone}:`, JSON.stringify(data).substring(0, 500));
        whatsappTempUrl = extractUrl(data);
        if (whatsappTempUrl) { console.log(`Avatar found for ${cleanPhone} via GET ${epUrl.split("?")[0]}`); break; }
      } else {
        const errBody = await resp.text();
        console.log(`Avatar GET ${epUrl.split("?")[0]} error ${resp.status} for ${cleanPhone}: ${errBody.substring(0, 200)}`);
      }
    } catch (e) { console.log(`Avatar GET error for ${cleanPhone}: ${e}`); }
  }

  // Fallback: try POST endpoints (Evolution API v1 style)
  if (!whatsappTempUrl) {
    const postEndpoints = [
      { path: "/chat/fetchProfilePictureUrl", body: { number: jid } },
      { path: "/contact/profilePicture", body: { number: jid } },
    ];
    for (const ep of postEndpoints) {
      try {
        const resp = await fetch(`${apiUrl}${ep.path}`, { method: "POST", headers, body: JSON.stringify(ep.body) });
        if (resp.ok) {
          const data = await resp.json();
          console.log(`Avatar POST ${ep.path} response for ${cleanPhone}:`, JSON.stringify(data).substring(0, 500));
          whatsappTempUrl = extractUrl(data);
          if (whatsappTempUrl) { console.log(`Avatar found for ${cleanPhone} via POST ${ep.path}`); break; }
        } else { await resp.text(); }
      } catch { /* silent */ }
    }
  }

  const now = new Date().toISOString();
  let permanentUrl: string | null = null;

  if (whatsappTempUrl) {
    // Download image server-side (no CORS issue)
    try {
      const imgResp = await fetch(whatsappTempUrl);
      if (imgResp.ok) {
        const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
        const contentType = imgResp.headers.get("content-type") || "image/jpeg";
        const filePath = `${cleanPhone}.jpg`;

        // Upload to Supabase Storage (upsert)
        const { error: uploadError } = await supabase.storage
          .from("contact-avatars")
          .upload(filePath, imgBytes, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Storage upload error for ${cleanPhone}:`, uploadError.message);
        } else {
          // Build permanent public URL
          permanentUrl = `${SUPABASE_URL}/storage/v1/object/public/contact-avatars/${filePath}`;
          console.log(`Avatar stored for ${cleanPhone}: ${permanentUrl}`);
        }
      } else {
        console.log(`Image download failed for ${cleanPhone}: ${imgResp.status}`);
        await imgResp.text(); // consume
      }
    } catch (e) {
      console.error(`Image download/upload error for ${cleanPhone}:`, e);
    }
  } else {
    console.log(`No avatar found for ${cleanPhone}`);
  }

  // Update uazapi_chats
  if (chatRecord) {
    await supabase
      .from("uazapi_chats")
      .update({
        contact_picture_url: permanentUrl || chatRecord.contact_picture_url,
        avatar_fetched_at: now,
      })
      .eq("id", chatRecord.id);
  }

  // Update customer_profiles
  if (profileRecord) {
    await supabase
      .from("customer_profiles")
      .update({
        avatar_url: permanentUrl || profileRecord.avatar_url,
        avatar_fetched_at: now,
      })
      .eq("id", profileRecord.id);
  }

  return { avatar_url: permanentUrl, cached: false };
}
