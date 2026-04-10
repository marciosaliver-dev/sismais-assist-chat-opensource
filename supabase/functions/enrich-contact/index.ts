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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();

    // === BATCH MODE ===
    if (body.action === "batch") {
      const limit = Math.min(body.limit || 20, 50);
      console.log(`[enrich-contact] Batch mode: enriching up to ${limit} contacts without photo`);

      // Find contacts without photo that haven't been enriched in the last 48h
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: chats } = await supabase
        .from("uazapi_chats")
        .select("id, contact_phone, instance_id")
        .is("contact_picture_url", null)
        .eq("is_group", false)
        .not("contact_phone", "is", null)
        .or(`enriched_at.is.null,enriched_at.lt.${cutoff}`)
        .order("last_message_time", { ascending: false })
        .limit(limit);

      if (!chats || chats.length === 0) {
        return new Response(JSON.stringify({ ok: true, enriched: 0, message: "No contacts to enrich" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[enrich-contact] Found ${chats.length} contacts to enrich`);
      let enriched = 0;
      let errors = 0;

      for (const chat of chats) {
        try {
          const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-sync-avatars`;
          const syncResp = await fetch(syncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({ instance_id: chat.instance_id, phone: chat.contact_phone }),
          });
          if (syncResp.ok) {
            const syncData = await syncResp.json();
            if (syncData?.avatar_url) enriched++;
            else {
              // Mark as enriched to avoid retrying too soon
              await supabase.from("uazapi_chats").update({ enriched_at: new Date().toISOString() }).eq("id", chat.id);
            }
          }
        } catch (e) {
          console.error(`[enrich-contact] Batch error for ${chat.contact_phone}:`, e);
          errors++;
        }
      }

      console.log(`[enrich-contact] Batch done: ${enriched} enriched, ${errors} errors out of ${chats.length}`);
      return new Response(JSON.stringify({ ok: true, total: chats.length, enriched, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SINGLE MODE ===
    const { phone, instance_id, conversation_id } = body;
    if (!phone || !instance_id) {
      return new Response(JSON.stringify({ error: "phone and instance_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    console.log(`[enrich-contact] Starting enrichment for ${cleanPhone}, instance=${instance_id}`);

    // Check if already enriched recently (within 24h)
    const { data: existingChat } = await supabase
      .from("uazapi_chats")
      .select("id, enriched_at, contact_name, contact_picture_url")
      .eq("instance_id", instance_id)
      .eq("contact_phone", cleanPhone)
      .maybeSingle();

    if (existingChat?.enriched_at) {
      const hoursSince = (Date.now() - new Date(existingChat.enriched_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        console.log(`[enrich-contact] Already enriched ${hoursSince.toFixed(1)}h ago, skipping`);
        return new Response(JSON.stringify({ 
          ok: true, 
          skipped: true, 
          enriched_at: existingChat.enriched_at,
          contact_name: existingChat.contact_name,
          contact_picture_url: existingChat.contact_picture_url,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get instance credentials
    const { data: instance } = await supabase
      .from("uazapi_instances")
      .select("api_url, api_token")
      .eq("id", instance_id)
      .eq("is_active", true)
      .single();

    if (!instance) {
      return new Response(JSON.stringify({ error: "Instance not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = instance.api_url.replace(/\/$/, "");
    const headers = { "Content-Type": "application/json", token: instance.api_token };

    // === STEP 1: Fetch contact info via UAZAPI ===
    let contactName: string | null = null;
    let pushName: string | null = null;
    let whatsappStatus: string | null = null;
    let hasWhatsApp = false;

    const infoEndpoints = [
      `/v1/contacts/info?number=${cleanPhone}`,
      `/contact/details?number=${cleanPhone}`,
      `/contact/info?number=${cleanPhone}@s.whatsapp.net`,
    ];

    for (const ep of infoEndpoints) {
      try {
        const resp = await fetch(`${apiUrl}${ep}`, { method: "GET", headers });
        if (resp.ok) {
          const data = await resp.json();
          console.log(`[enrich-contact] Info ${ep.split("?")[0]} response:`, JSON.stringify(data).substring(0, 500));
          
          contactName = data.name || data.pushName || data.notify || data.verifiedName || 
                        data.result?.name || data.result?.pushName || contactName;
          pushName = data.pushName || data.notify || data.result?.pushName || pushName;
          whatsappStatus = data.status || data.about || data.result?.status || whatsappStatus;
          hasWhatsApp = data.numberExists !== false && data.onWhatsApp !== false;
          
          if (contactName || pushName) break;
        }
      } catch (e) {
        console.log(`[enrich-contact] Info endpoint error: ${e}`);
      }
    }

    // === STEP 2: Fetch and save photo via whatsapp-sync-avatars ===
    let photoUrl: string | null = null;
    try {
      const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-sync-avatars`;
      const syncResp = await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ instance_id, phone: cleanPhone }),
      });
      if (syncResp.ok) {
        const syncData = await syncResp.json();
        photoUrl = syncData?.avatar_url || null;
        console.log(`[enrich-contact] Avatar sync result: ${photoUrl ? "found" : "not found"}`);
      }
    } catch (e) {
      console.error(`[enrich-contact] Avatar sync error:`, e);
    }

    // === STEP 3: Save enrichment data ===
    const now = new Date().toISOString();
    const enrichmentStatus = {
      photo: !!photoUrl,
      name: !!(contactName || pushName),
      whatsapp_active: hasWhatsApp,
      status: !!whatsappStatus,
    };

    // Update uazapi_chats
    if (existingChat) {
      const updates: Record<string, unknown> = {
        enriched_at: now,
        enrichment_status: enrichmentStatus,
      };
      if (contactName && !existingChat.contact_name) updates.contact_name = contactName;
      if (pushName) updates.push_name = pushName;
      if (whatsappStatus) updates.whatsapp_status = whatsappStatus;
      if (photoUrl) updates.contact_picture_url = photoUrl;

      await supabase.from("uazapi_chats").update(updates).eq("id", existingChat.id);
    }

    // Update customer_profiles
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id, nome, avatar_url")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (profile) {
      const profileUpdates: Record<string, unknown> = {};
      if (contactName && !profile.nome) profileUpdates.nome = contactName;
      if (photoUrl && !profile.avatar_url) {
        profileUpdates.avatar_url = photoUrl;
        profileUpdates.avatar_fetched_at = now;
      }
      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from("customer_profiles").update(profileUpdates).eq("id", profile.id);
      }
    }

    // Update conversation customer_name if we found a better name
    if (conversation_id && (contactName || pushName)) {
      const bestName = contactName || pushName;
      await supabase.from("ai_conversations")
        .update({ customer_name: bestName })
        .eq("id", conversation_id)
        .is("customer_name", null); // Only update if null
    }

    console.log(`[enrich-contact] Done for ${cleanPhone}: name=${contactName}, photo=${!!photoUrl}`);

    return new Response(JSON.stringify({
      ok: true,
      contact_name: contactName || pushName,
      push_name: pushName,
      whatsapp_status: whatsappStatus,
      photo_url: photoUrl,
      enrichment_status: enrichmentStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[enrich-contact] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
