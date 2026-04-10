import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCircuitBreaker, withTimeout, CircuitBreakerOpenError, TimeoutError } from '../_shared/resilience.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProxyRequest {
  action: "connect" | "disconnect" | "status" | "qrcode" | "sendMessage" | "sendInteractive" | "sendReaction" | "fetchContacts" | "startConversation" | "downloadMedia" | "sendContact" | "fetchProfilePicture" | "configureWebhook";
  instanceId: string;
  chatJid?: string;
  type?: string;
  text?: string;
  mediaUrl?: string;
  filename?: string;
  interactive?: {
    type: "buttons" | "list";
    body: string;
    footer?: string;
    buttons?: Array<{ id: string; text: string }>;
    listTitle?: string;
    listButtonText?: string;
    listSections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getUser(token);
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as string;
    const { instanceId, chatJid, type, text, mediaUrl, filename, interactive } = body;
    console.log(`[uazapi-proxy] action=${action}, instanceId=${instanceId}`);
    const reactionEmoji = body.emoji as string | undefined;
    const reactionMessageId = body.messageId as string | undefined;
    const quotedMsgId = body.quotedMsgId as string | undefined;

    // Get instance from DB
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instance, error: instError } = await serviceSupabase
      .from("uazapi_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instError || !instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = instance.api_url.replace(/\/$/, "");
    const apiToken = instance.api_token;

    const uazapiFetch = async (endpoint: string, fetchBody?: Record<string, unknown>, signal?: AbortSignal) => {
      const url = `${apiUrl}${endpoint}`;
      console.log("UAZAPI call:", url);
      return fetch(url, {
        method: fetchBody ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          token: apiToken,
        },
        body: fetchBody ? JSON.stringify(fetchBody) : undefined,
        signal,
      });
    };

    const uazapiFetchResilient = async (endpoint: string, fetchBody?: Record<string, unknown>) => {
      return withCircuitBreaker(
        async () => withTimeout(
          async (signal) => uazapiFetch(endpoint, fetchBody, signal),
          { timeoutMs: 15_000, errorMessage: `UAZAPI timeout: ${endpoint}` }
        ),
        { failureThreshold: 5, resetTimeoutMs: 30_000, name: `uazapi-${instanceId}` }
      );
    };

    let result: unknown;

    switch (action) {
      case "connect":
      case "qrcode": {
        const resp = await uazapiFetch("/instance/qrcode", { id: instance.instance_name });
        result = await resp.json();

        // Update instance status
        await serviceSupabase
          .from("uazapi_instances")
          .update({ status: "qrcode", qr_code: (result as Record<string, string>).qrcode || null })
          .eq("id", instanceId);
        break;
      }

      case "status": {
        // Try multiple endpoint/method variants for resilience across UAZAPI versions
        const statusVariants = [
          { endpoint: "/instance/status", body: undefined as Record<string, unknown> | undefined },
          { endpoint: "/instance/status", body: { id: instance.instance_name } },
          { endpoint: "/status", body: undefined as Record<string, unknown> | undefined },
          { endpoint: "/instance/info", body: { id: instance.instance_name } },
        ];

        let statusSuccess = false;
        let lastError: unknown = null;

        for (const variant of statusVariants) {
          try {
            const statusResp = await uazapiFetch(variant.endpoint, variant.body);
            if (statusResp.ok) {
              result = await statusResp.json();
              statusSuccess = true;
              console.log(`Status endpoint ${variant.body ? "POST" : "GET"} ${variant.endpoint} succeeded:`, result);
              break;
            }
            lastError = await statusResp.json();
            if (statusResp.status === 405 || statusResp.status === 404) {
              console.log(`Status endpoint ${variant.body ? "POST" : "GET"} ${variant.endpoint} not available (${statusResp.status}), trying next...`);
              continue;
            }
            // Other error — stop trying
            console.error(`Status endpoint ${variant.endpoint} error:`, lastError);
            result = lastError;
            break;
          } catch (e) {
            console.error(`Status endpoint ${variant.endpoint} failed:`, e);
            lastError = e;
            continue;
          }
        }

        if (statusSuccess) {
          // Handle multiple UAZAPI response formats
          const r = result as Record<string, any>;
          // v2 format: { instance: { status, owner }, status: { connected } }
          // v1 format: { state, phone }
          const isConnectedV2 = r.status?.connected === true || r.instance?.status === "connected";
          const isConnectedV1 = r.state === "open" || r.state === "connected";
          const isConnected = isConnectedV2 || isConnectedV1;
          
          const phone = r.instance?.owner || r.phone || r.instance?.phone;
          const profileName = r.instance?.profileName || r.instance?.name;
          const profilePic = r.instance?.profilePicUrl;
          
          const newStatus = isConnected ? "connected" : (r.instance?.status || r.state || "disconnected");
          
          console.log(`Parsed status: connected=${isConnected}, phone=${phone}, status=${newStatus}`);
          
          await serviceSupabase
            .from("uazapi_instances")
            .update({
              status: newStatus,
              phone_number: phone || instance.phone_number,
              profile_name: profileName || instance.profile_name,
              profile_picture_url: profilePic || instance.profile_picture_url,
              last_seen_at: isConnected ? new Date().toISOString() : instance.last_seen_at,
            })
            .eq("id", instanceId);
        } else {
          result = { error: "All status endpoints failed", details: lastError };
        }
        break;
      }

      case "disconnect": {
        const resp = await uazapiFetch("/instance/logout", { id: instance.instance_name });
        result = await resp.json();

        await serviceSupabase
          .from("uazapi_instances")
          .update({ status: "disconnected", qr_code: null })
          .eq("id", instanceId);
        break;
      }

      case "sendMessage": {
        if (!chatJid || (!text && !mediaUrl)) {
          return new Response(JSON.stringify({ error: "chatJid and text/mediaUrl required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

      // Resolve the correct recipient for sending
      // If chatJid is a LID reference (starts with non-digit), try to find the real phone number
      // from the chat record. LIDs don't work reliably for sending via UAZAPI.
      let recipient = chatJid;
      if (!/^\d/.test(chatJid) && !chatJid.includes("@")) {
        // Look up real phone number from the chat record
        const { data: chatRecord } = await serviceSupabase
          .from("uazapi_chats")
          .select("contact_phone")
          .eq("instance_id", instanceId)
          .eq("chat_id", chatJid)
          .maybeSingle();
        
        let realPhone = chatRecord?.contact_phone;
        
        // If contact_phone is also a LID (not a real number), check ai_conversations
        if (!realPhone || !/^\d{8,}/.test(realPhone)) {
          const { data: convRecord } = await serviceSupabase
            .from("ai_conversations")
            .select("customer_phone")
            .eq("uazapi_chat_id", chatJid)
            .in("status", ["aguardando", "em_atendimento"])
            .maybeSingle();
          
          if (convRecord?.customer_phone && /^\d{8,}/.test(convRecord.customer_phone)) {
            realPhone = convRecord.customer_phone;
            // Also update the chat record with the real phone for future use
            if (chatRecord?.contact_phone) {
              await serviceSupabase
                .from("uazapi_chats")
                .update({ contact_phone: realPhone })
                .eq("instance_id", instanceId)
                .eq("chat_id", chatJid);
            }
          }
        }
        
        if (realPhone && /^\d{8,}/.test(realPhone)) {
          recipient = `${realPhone}@s.whatsapp.net`;
          console.log(`LID ${chatJid} resolved to real phone: ${recipient}`);
        } else {
          recipient = `${chatJid}@lid`;
          console.log(`LID ${chatJid} has no real phone stored, using fallback: ${recipient}`);
        }
      }
        let endpoint: string;
        let sendBody: Record<string, unknown>;

        if (type === "text" || !mediaUrl) {
          endpoint = `/send/text`;
          sendBody = { number: recipient, text: text || "" };
          if (quotedMsgId) {
            sendBody.quotedMsgId = quotedMsgId;
          }
        } else {
          endpoint = `/send/media`;

          // Download media from signed URL and convert to base64 for UAZAPI
          // This prevents issues with expired URLs and ensures the file arrives intact
          let filePayload: string = mediaUrl;
          try {
            const mediaResp = await fetch(mediaUrl);
            if (mediaResp.ok) {
              const mediaBuffer = await mediaResp.arrayBuffer();
              const mediaBytes = new Uint8Array(mediaBuffer);
              let binaryStr = "";
              const chunkSize = 8192;
              for (let i = 0; i < mediaBytes.length; i += chunkSize) {
                const chunk = mediaBytes.slice(i, i + chunkSize);
                binaryStr += String.fromCharCode(...chunk);
              }
              const base64Data = btoa(binaryStr);
              const mimeType = mediaResp.headers.get("content-type") || "application/octet-stream";
              filePayload = `data:${mimeType};base64,${base64Data}`;
              console.log(`[sendMessage] Converted media to base64: ${mediaBytes.length} bytes, mime=${mimeType}`);
            } else {
              console.warn(`[sendMessage] Failed to download media (${mediaResp.status}), falling back to URL`);
            }
          } catch (dlErr: unknown) {
            console.warn("[sendMessage] Media download error, falling back to URL:", dlErr);
          }

          sendBody = {
            number: recipient,
            type: type || "image",
            file: filePayload,
            text: text || "",
            docName: filename || undefined,
          };
          if (quotedMsgId) {
            sendBody.quotedMsgId = quotedMsgId;
          }
        }

        let resp: Response;
        try {
          resp = await uazapiFetchResilient(endpoint, sendBody);
        } catch (err) {
          if (err instanceof CircuitBreakerOpenError) {
            console.error(`[uazapi-proxy] Circuit breaker OPEN for ${instanceId}: ${err.retryAfterMs}ms until retry`);
            return new Response(JSON.stringify({ 
              error: "Serviço temporariamente indisponível. Tente novamente em alguns segundos.",
              code: "CIRCUIT_OPEN",
              retryAfterMs: err.retryAfterMs 
            }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (err instanceof TimeoutError) {
            console.error(`[uazapi-proxy] Timeout sending message: ${err.message}`);
            return new Response(JSON.stringify({ error: "Timeout ao enviar mensagem", code: "TIMEOUT" }), { 
              status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
          }
          throw err;
        }
        result = await resp.json();

        if (!resp.ok) {
          console.error("UAZAPI send error:", result);
          return new Response(JSON.stringify({ error: "Failed to send", details: result }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save outbound message — extract WhatsApp message ID for deduplication
        const msgId = (result as Record<string, Record<string, string>>)?.key?.id || crypto.randomUUID();
        // Attach msgId to result so frontend can save it for dedup
        (result as Record<string, unknown>)._msgId = msgId;

        // Find or create chat
        const { data: existingChat } = await serviceSupabase
          .from("uazapi_chats")
          .select("id")
          .eq("instance_id", instanceId)
          .eq("chat_id", chatJid)
          .maybeSingle();

        let chatDbId = existingChat?.id;
        if (!chatDbId) {
          const phone = chatJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
          const { data: newChat } = await serviceSupabase
            .from("uazapi_chats")
            .insert({
              instance_id: instanceId,
              chat_id: chatJid,
              contact_phone: phone,
              is_group: chatJid.includes("@g.us"),
            })
            .select("id")
            .single();
          chatDbId = newChat?.id;
        }

        if (chatDbId) {
          await serviceSupabase.from("uazapi_messages").insert({
            instance_id: instanceId,
            chat_id: chatDbId,
            message_id: msgId,
            from_me: true,
            type: type || "text",
            text_body: text || null,
            media_url: mediaUrl || null,
            media_filename: filename || null,
            status: "sent",
            timestamp: new Date().toISOString(),
            is_forwarded: body.isForwarded || false,
          });

          // Update chat preview
          await serviceSupabase
            .from("uazapi_chats")
            .update({
              last_message_preview: text || `[${type}]`,
              last_message_time: new Date().toISOString(),
              last_message_from_me: true,
            })
            .eq("id", chatDbId);
        }

        break;
      }

      case "sendInteractive": {
        if (!chatJid || !interactive) {
          return new Response(JSON.stringify({ error: "chatJid and interactive payload required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let sendBody: Record<string, unknown>;
        let interactiveEndpoints: string[];

        if (interactive.type === "buttons") {
          interactiveEndpoints = ["/send/buttons", "/chat/sendButtons", "/send/interactive"];
          sendBody = {
            number: chatJid,
            text: interactive.body,
            footer: interactive.footer || "Sismais Helpdesk",
            buttons: (interactive.buttons || []).map((b: any, i: number) => ({
              id: b.id || `btn_${i}`,
              text: b.text,
            })),
          };
        } else {
          interactiveEndpoints = ["/send/list", "/chat/sendList", "/send/interactive"];
          sendBody = {
            number: chatJid,
            text: interactive.body,
            footer: interactive.footer || "Sismais Helpdesk",
            title: interactive.listTitle || "Menu",
            buttonText: interactive.listButtonText || "Ver opções",
            sections: (interactive.listSections || []).map((s: any) => ({
              title: s.title,
              rows: s.rows.map((r: any) => ({
                rowId: r.id,
                title: r.title,
                description: r.description || "",
              })),
            })),
          };
        }

        let interResp: Response | null = null;
        let interSuccess = false;

        for (const ep of interactiveEndpoints) {
          try {
            interResp = await uazapiFetch(ep, sendBody);
            if (interResp.ok) {
              result = await interResp.json();
              interSuccess = true;
              break;
            }
            const errData = await interResp.json();
            if (interResp.status === 405 || interResp.status === 404) {
              console.log(`Interactive endpoint ${ep} not available (${interResp.status}), trying next...`);
              continue;
            }
            console.error(`UAZAPI interactive error on ${ep}:`, errData);
            result = errData;
            break;
          } catch (e) {
            console.error(`Interactive endpoint ${ep} failed:`, e);
            continue;
          }
        }

        if (!interSuccess) {
          // Fallback: send as plain text message so the user still gets the content
          console.log("Interactive messages not supported, falling back to plain text");
          const fallbackText = interactive.type === "buttons"
            ? `${interactive.body}\n\n${(interactive.buttons || []).map((b: any, i: number) => `${i + 1}. ${b.text}`).join("\n")}`
            : `${interactive.body}\n\n*${interactive.listTitle || "Opções"}*\n${(interactive.listSections || []).map((s: any) => s.rows.map((r: any) => `• ${r.title}${r.description ? ` - ${r.description}` : ""}`).join("\n")).join("\n")}`;

          const fallbackResp = await uazapiFetch("/send/text", { number: chatJid, text: fallbackText });
          result = await fallbackResp.json();

          if (!fallbackResp.ok) {
            console.error("UAZAPI fallback text send error:", result);
            return new Response(JSON.stringify({ error: "Failed to send interactive (and fallback)", details: result }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Save outbound message
        const interMsgId = (result as Record<string, Record<string, string>>)?.key?.id || crypto.randomUUID();

        const { data: existChat } = await serviceSupabase
          .from("uazapi_chats")
          .select("id")
          .eq("instance_id", instanceId)
          .eq("chat_id", chatJid)
          .maybeSingle();

        if (existChat?.id) {
          const label = interactive.type === "buttons"
            ? `[Botões] ${interactive.body}`
            : `[Lista] ${interactive.body}`;

          await serviceSupabase.from("uazapi_messages").insert({
            instance_id: instanceId,
            chat_id: existChat.id,
            message_id: interMsgId,
            from_me: true,
            type: interactive.type === "buttons" ? "buttons" : "list",
            text_body: interactive.body,
            buttons: interactive.type === "buttons" ? JSON.stringify(interactive.buttons) : null,
            list_data: interactive.type === "list" ? JSON.stringify(interactive.listSections) : null,
            status: "sent",
            timestamp: new Date().toISOString(),
          });

          await serviceSupabase
            .from("uazapi_chats")
            .update({
              last_message_preview: label.substring(0, 100),
              last_message_time: new Date().toISOString(),
              last_message_from_me: true,
            })
            .eq("id", existChat.id);
        }

        break;
      }

      case "sendReaction": {
        // Allow empty emoji (removal), but reject null/undefined
        if (!chatJid || reactionEmoji === undefined || reactionEmoji === null || !reactionMessageId) {
          return new Response(JSON.stringify({ error: "chatJid, emoji (can be empty for removal), and messageId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Resolve number from chatJid (digits only, no @s.whatsapp.net)
        let reactionNumber = chatJid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "").replace(/\D/g, "");

        // If chatJid is a LID or has no digits, resolve real phone
        if (!reactionNumber || !/^\d{8,}/.test(reactionNumber)) {
          const { data: chatRecord } = await serviceSupabase
            .from("uazapi_chats")
            .select("contact_phone")
            .eq("instance_id", instanceId)
            .eq("chat_id", chatJid)
            .maybeSingle();
          let realPhone = chatRecord?.contact_phone;
          if (!realPhone || !/^\d{8,}/.test(realPhone)) {
            const { data: convRecord } = await serviceSupabase
              .from("ai_conversations")
              .select("customer_phone")
              .eq("uazapi_chat_id", chatJid)
              .in("status", ["aguardando", "em_atendimento"])
              .maybeSingle();
            if (convRecord?.customer_phone && /^\d{8,}/.test(convRecord.customer_phone)) {
              realPhone = convRecord.customer_phone;
            }
          }
          if (realPhone && /^\d{8,}/.test(realPhone)) {
            reactionNumber = realPhone;
          }
        }

        console.log(`[sendReaction] number=${reactionNumber}, messageId=${reactionMessageId}, emoji=${reactionEmoji || '(removal)'}`);

        // UAZAPI endpoint for reactions — per UAZAPI docs: { phone, msgId, reaction }
        const reactionPayloads = [
          {
            endpoint: "/send/reaction",
            body: {
              phone: reactionNumber,
              msgId: reactionMessageId,
              reaction: reactionEmoji,
            },
          },
          {
            endpoint: "/message/react",
            body: {
              phone: reactionNumber,
              msgId: reactionMessageId,
              reaction: reactionEmoji,
            },
          },
          {
            endpoint: "/chat/sendReaction",
            body: {
              key: {
                remoteJid: chatJid.includes("@") ? chatJid : `${reactionNumber}@s.whatsapp.net`,
                fromMe: false,
                id: reactionMessageId,
              },
              reaction: reactionEmoji,
            },
          },
        ];
        let reactionSuccess = false;
        let lastReactionError: unknown = null;

        for (const { endpoint: ep, body: payload } of reactionPayloads) {
          try {
            console.log(`[sendReaction] Trying ${ep} with keys: ${Object.keys(payload).join(',')}`);
            const reactionResp = await uazapiFetch(ep, payload);
            
            if (reactionResp.ok) {
              result = await reactionResp.json();
              reactionSuccess = true;
              console.log(`[sendReaction] Success via ${ep}:`, result);
              break;
            }
            
            const respData = await reactionResp.json();
            console.log(`[sendReaction] ${ep} returned ${reactionResp.status}:`, respData);

            // Any non-success: log and try next endpoint
            lastReactionError = respData;
            console.error(`[sendReaction] UAZAPI error on ${ep} (${reactionResp.status}):`, respData);
            continue;
          } catch (e) {
            console.error(`[sendReaction] Endpoint ${ep} failed:`, e);
            lastReactionError = e;
            continue;
          }
        }

        if (!reactionSuccess) {
          // Return error — do NOT fake success
          const errMsg = (lastReactionError as any)?.error || (lastReactionError as any)?.message || "Reaction failed on all endpoints";
          console.error(`[sendReaction] All endpoints failed. Last error:`, lastReactionError);
          return new Response(JSON.stringify({ success: false, error: errMsg, details: lastReactionError }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "fetchContacts": {
        // Try multiple endpoint variants since UAZAPI versions differ
        const contactEndpoints = ["/v1/chats", "/chat/fetchChats", "/chats", "/contacts"];
        let contactsData: any = null;
        let contactsFetched = false;

        for (const ep of contactEndpoints) {
          try {
            const contactsResp = await uazapiFetch(ep);
            if (contactsResp.ok) {
              contactsData = await contactsResp.json();
              contactsFetched = true;
              break;
            }
            if (contactsResp.status === 404 || contactsResp.status === 405) {
              console.log(`Contacts endpoint ${ep} not available (${contactsResp.status}), trying next...`);
              continue;
            }
            // Other error
            contactsData = await contactsResp.json();
            console.error(`UAZAPI fetch contacts error on ${ep}:`, contactsData);
            break;
          } catch (e) {
            console.error(`Contacts endpoint ${ep} failed:`, e);
            continue;
          }
        }

        if (!contactsFetched) {
          console.log("No contacts endpoint available, returning empty list");
          result = { success: true, contacts: [], warning: "Contacts sync not supported by this UAZAPI version" };
          break;
        }

        const contacts = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || contactsData?.data || []);
        let synced = 0;

        for (const contact of contacts) {
          const contactJid = contact.id || contact.jid || contact.remoteJid || "";
          if (!contactJid || contactJid.includes("@g.us") || contactJid === "status@broadcast") continue;

          const contactPhone = contactJid.replace("@s.whatsapp.net", "").replace("@lid", "");
          const contactName = contact.name || contact.pushName || contact.notify || contact.verifiedName || null;
          const contactPic = contact.imgUrl || contact.profilePictureUrl || null;
          const isRealPhone = /^\d{8,}/.test(contactPhone);

          // Upsert into uazapi_chats
          const { data: existing } = await serviceSupabase
            .from("uazapi_chats")
            .select("id, contact_phone, chat_id")
            .eq("instance_id", instanceId)
            .eq("chat_id", contactJid)
            .maybeSingle();

          if (existing) {
            const updates: Record<string, unknown> = {};
            if (contactName) updates.contact_name = contactName;
            if (contactPic) updates.contact_picture_url = contactPic;
            // Only update contact_phone if we have a real phone and current one is a LID
            if (isRealPhone && (!existing.contact_phone || !/^\d{8,}/.test(existing.contact_phone))) {
              updates.contact_phone = contactPhone;
            }
            if (Object.keys(updates).length > 0) {
              await serviceSupabase.from("uazapi_chats").update(updates).eq("id", existing.id);
            }
          } else {
            await serviceSupabase.from("uazapi_chats").insert({
              instance_id: instanceId,
              chat_id: contactJid,
              contact_phone: isRealPhone ? contactPhone : null,
              contact_name: contactName,
              contact_picture_url: contactPic,
              is_group: false,
            });
          }
          synced++;
        }

        // Also fix existing chats with LID contact_phones using ai_conversations data
        const { data: lidChats } = await serviceSupabase
          .from("uazapi_chats")
          .select("id, chat_id, contact_phone")
          .eq("instance_id", instanceId)
          .eq("is_group", false);

        let fixed = 0;
        for (const chat of (lidChats || [])) {
          if (chat.contact_phone && /^\d{8,}/.test(chat.contact_phone)) continue;
          // Try to find real phone from ai_conversations
          const { data: conv } = await serviceSupabase
            .from("ai_conversations")
            .select("customer_phone, customer_name")
            .eq("uazapi_chat_id", chat.chat_id)
            .maybeSingle();
          if (conv?.customer_phone && /^\d{8,}/.test(conv.customer_phone)) {
            const updates: Record<string, unknown> = { contact_phone: conv.customer_phone };
            if (conv.customer_name && conv.customer_name !== conv.customer_phone) {
              updates.contact_name = conv.customer_name;
            }
            await serviceSupabase.from("uazapi_chats").update(updates).eq("id", chat.id);
            fixed++;
          }
        }

        result = { contacts_total: contacts.length, synced, lid_fixed: fixed };
        break;
      }

      case "startConversation": {
        // Start a new conversation with a phone number
        const targetPhone = body.chatJid?.replace(/\D/g, "") || "";
        if (!targetPhone || targetPhone.length < 8) {
          return new Response(JSON.stringify({ error: "Valid phone number required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const targetJid = `${targetPhone}@s.whatsapp.net`;

        // Find or create uazapi_chat
        const { data: existChat } = await serviceSupabase
          .from("uazapi_chats")
          .select("id")
          .eq("instance_id", instanceId)
          .eq("chat_id", targetJid)
          .maybeSingle();

        let uazapiChatId = existChat?.id;
        if (!uazapiChatId) {
          const { data: newChat } = await serviceSupabase
            .from("uazapi_chats")
            .insert({
              instance_id: instanceId,
              chat_id: targetJid,
              contact_phone: targetPhone,
              is_group: false,
            })
            .select("id")
            .single();
          uazapiChatId = newChat?.id;
        }

        // Find or create ai_conversation
        const { data: existConv } = await serviceSupabase
          .from("ai_conversations")
          .select("id")
          .eq("uazapi_chat_id", targetJid)
           .in("status", ["aguardando", "em_atendimento"])
          .maybeSingle();

        let convId = existConv?.id;
        if (!convId) {
          const { data: newConv } = await serviceSupabase
            .from("ai_conversations")
            .insert({
              customer_phone: targetPhone,
              customer_name: targetPhone,
              uazapi_chat_id: targetJid,
              communication_channel: "whatsapp",
              status: "aguardando",
              handler_type: "human",
            })
            .select("id")
            .single();
          convId = newConv?.id;
        }

        result = { chatId: uazapiChatId, conversationId: convId, chatJid: targetJid };
        break;
      }

      case "downloadMedia": {
        // Re-download media from UAZAPI for old/encrypted messages
        const targetMessageId = body.messageId as string;
        if (!targetMessageId) {
          return new Response(JSON.stringify({ error: "messageId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[downloadMedia] Attempting re-download for messageId=${targetMessageId}`);

        const handleJsonBase64 = async (resp: Response): Promise<Response | null> => {
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const jsonData = await resp.json();
            const b64 = jsonData.base64 || jsonData.data;
            if (b64) {
              const binaryStr = atob(b64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
              const mimeType = jsonData.mimetype || "application/octet-stream";
              return new Response(new Blob([bytes], { type: mimeType }), { headers: { "content-type": mimeType } });
            }
            // Handle UAZAPI cached response: {"cached":true,"fileURL":"..."}
            const fileUrl = jsonData.fileURL || jsonData.fileUrl || jsonData.url;
            if (fileUrl && typeof fileUrl === "string" && fileUrl.startsWith("http")) {
              console.log(`[downloadMedia] UAZAPI returned fileURL, downloading: ${fileUrl.substring(0, 80)}...`);
              try {
                const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
                if (fileResp.ok) {
                  return fileResp;
                }
              } catch { /* ignore */ }
            }
            return null;
          }
          return resp;
        };

        let mediaResp: Response | null = null;
        const mediaUrlForRetry = body.mediaUrl as string | undefined;
        const mediaKeyB64 = body.mediaKey as string | undefined;
        const mediaTypeHint = body.mediaType as string | undefined;
        const mediaMimetypeHint = body.mediaMimetype as string | undefined;

        // === PRIMARY: WhatsApp E2E decryption ===
        if (mediaKeyB64 && mediaUrlForRetry && mediaUrlForRetry.includes(".enc")) {
          console.log(`[downloadMedia] Attempting E2E decryption for msgId=${targetMessageId}`);
          try {
            const encResp = await fetch(mediaUrlForRetry);
            if (encResp.ok) {
              const encData = new Uint8Array(await encResp.arrayBuffer());
              const mediaKeyBytes = Uint8Array.from(atob(mediaKeyB64), c => c.charCodeAt(0));

              const hkdfInfoMap: Record<string, string> = {
                image: "WhatsApp Image Keys", audio: "WhatsApp Audio Keys",
                ptt: "WhatsApp Audio Keys", video: "WhatsApp Video Keys",
                document: "WhatsApp Document Keys", sticker: "WhatsApp Image Keys",
              };
              const hkdfInfo = hkdfInfoMap[mediaTypeHint || "audio"] || "WhatsApp Audio Keys";

              const hkdfKey = await crypto.subtle.importKey("raw", mediaKeyBytes, "HKDF", false, ["deriveBits"]);
              const expanded = new Uint8Array(await crypto.subtle.deriveBits(
                { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode(hkdfInfo) },
                hkdfKey, 112 * 8
              ));

              const aesKey = await crypto.subtle.importKey("raw", expanded.slice(16, 48), { name: "AES-CBC" }, false, ["decrypt"]);
              const decrypted = new Uint8Array(await crypto.subtle.decrypt(
                { name: "AES-CBC", iv: expanded.slice(0, 16) }, aesKey, encData.slice(0, -10)
              ));

              const finalMime = mediaMimetypeHint?.split(";")[0]?.trim() || "audio/ogg";
              mediaResp = new Response(new Blob([decrypted], { type: finalMime }), { status: 200, headers: { "content-type": finalMime } });
              console.log(`[downloadMedia] E2E decryption succeeded: ${decrypted.length} bytes`);
            } else {
              console.log(`[downloadMedia] E2E download failed: ${encResp.status} (encrypted URL may have expired)`);
            }
          } catch (err) {
            console.error("[downloadMedia] E2E decryption error:", err);
          }
        }

        // === FALLBACK: Direct fetch for non-.enc URLs ===
        if (!mediaResp && mediaUrlForRetry && !mediaUrlForRetry.includes(".enc")) {
          try {
            const resp = await fetch(mediaUrlForRetry);
            if (resp.ok) { mediaResp = resp; console.log("[downloadMedia] Direct fetch succeeded"); }
          } catch { /* ignore */ }
        }

        // === FALLBACK 2: Re-fetch from UAZAPI by messageId ===
        if (!mediaResp || !mediaResp.ok) {
          console.log(`[downloadMedia] Trying UAZAPI API re-download for msgId=${targetMessageId}`);
          const downloadEndpoints = [
            // Correct format per UAZAPI docs (field "id", not "messageId")
            { endpoint: "/message/download", body: { id: targetMessageId } },
            // Fallback variants
            { endpoint: "/message/download", body: { messageId: targetMessageId } },
            { endpoint: "/chat/downloadMedia", body: { id: targetMessageId } },
            { endpoint: "/chat/downloadMedia", body: { messageId: targetMessageId } },
            { endpoint: `/download/${targetMessageId}`, body: undefined as Record<string, unknown> | undefined },
            { endpoint: `/message/${targetMessageId}/download`, body: undefined as Record<string, unknown> | undefined },
          ];

          for (const { endpoint: ep, body: dlBody } of downloadEndpoints) {
            try {
              const dlResp = await uazapiFetch(ep, dlBody);
              if (dlResp.ok) {
                const processed = await handleJsonBase64(dlResp.clone());
                if (processed && processed.ok) {
                  mediaResp = processed;
                  console.log(`[downloadMedia] UAZAPI re-download succeeded via ${ep}`);
                  break;
                }
                // If handleJsonBase64 returned null, use original response as binary
                mediaResp = dlResp;
                console.log(`[downloadMedia] UAZAPI re-download succeeded (binary) via ${ep}`);
                break;
              }
              // Consume body to prevent resource leak
              await dlResp.text().catch(() => {});
              if (dlResp.status === 404 || dlResp.status === 405) {
                console.log(`[downloadMedia] Endpoint ${ep} not available (${dlResp.status}), trying next...`);
                continue;
              }
            } catch (e) {
              console.error(`[downloadMedia] Endpoint ${ep} failed:`, e);
              continue;
            }
          }
        }

        if (!mediaResp || !mediaResp.ok) {
          return new Response(JSON.stringify({ error: "All download attempts failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const rawBlob = await mediaResp.blob();
        const rawBytes = new Uint8Array(await rawBlob.arrayBuffer());

        // Validate: reject HTML error pages and JSON error responses
        if (rawBytes.length < 100) {
          return new Response(JSON.stringify({ error: "Downloaded content too small — likely an error response" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const textPreview = new TextDecoder().decode(rawBytes.slice(0, 200)).toLowerCase();
        if (textPreview.includes("<!doctype") || textPreview.includes("<html") || textPreview.includes("<head")) {
          return new Response(JSON.stringify({ error: "Downloaded content is an HTML error page, not media" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Detect real MIME from magic bytes — most reliable method
        const detectMime = (buf: Uint8Array): string | null => {
          if (buf.length < 12) return null;
          if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
          if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
          if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
              buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
          if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
          if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return "audio/ogg";
          if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
          if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video/mp4";
          if ((buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33)) return "audio/mpeg";
          return null;
        };

        const detectedMime = detectMime(rawBytes);
        const respContentType = mediaResp.headers.get("content-type") || "";
        // Priority: magic bytes > response header > caller hint > mediaType fallback
        const contentType = detectedMime
          || (respContentType && !respContentType.includes("octet-stream") && !respContentType.includes("binary") ? respContentType : null)
          || mediaMimetypeHint?.split(";")[0]?.trim()
          || (mediaTypeHint === "image" ? "image/jpeg" : mediaTypeHint === "video" ? "video/mp4" : mediaTypeHint === "audio" || mediaTypeHint === "ptt" ? "audio/ogg" : "application/octet-stream");
        const ext = contentType.includes("image/png") ? "png"
          : contentType.includes("image/webp") ? "webp"
          : contentType.includes("image") ? "jpg"
          : contentType.includes("audio") ? "ogg"
          : contentType.includes("video") ? "mp4"
          : contentType.includes("pdf") ? "pdf"
          : mediaTypeHint === "image" ? "jpg" : mediaTypeHint === "video" ? "mp4" : mediaTypeHint === "audio" || mediaTypeHint === "ptt" ? "ogg" : "bin";
        const filePath = `re-downloaded/${targetMessageId}.${ext}`;

        const uploadContentType = contentType.split(";")[0].trim();
        console.log(`[downloadMedia] Uploading: path=${filePath}, contentType=${uploadContentType}, detectedMime=${detectedMime}, size=${rawBytes.length}`);
        const { data: uploadData, error: uploadError } = await serviceSupabase.storage
          .from("whatsapp-media")
          .upload(filePath, new Blob([rawBytes], { type: uploadContentType }), {
            contentType: uploadContentType,
            upsert: true,
          });

        if (uploadError) {
          return new Response(JSON.stringify({ error: "Upload failed", details: uploadError }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: signedData } = await serviceSupabase.storage.from("whatsapp-media").createSignedUrl(uploadData.path, 31536000); // 365 days
        const newMediaUrl = signedData?.signedUrl || "";

        // Persist new URL in uazapi_messages (non-blocking)
        if (newMediaUrl) {
          try {
            await serviceSupabase.from("uazapi_messages")
              .update({ media_url: newMediaUrl })
              .eq("message_id", targetMessageId);
          } catch (e: unknown) {
            console.error("[downloadMedia] Failed to update uazapi_messages:", e);
          }

          try {
            await serviceSupabase.from("ai_messages")
              .update({ media_url: newMediaUrl })
              .eq("uazapi_message_id", targetMessageId);
            console.log(`[downloadMedia] ai_messages updated for msgId=${targetMessageId}`);
          } catch (e: unknown) {
            console.error("[downloadMedia] Failed to update ai_messages:", e);
          }
        }

        result = { mediaUrl: newMediaUrl, contentType };
        break;
      }

      case "sendContact": {
        const contactName = body.contactName as string;
        const contactPhone = (body.contactPhone as string)?.replace(/\D/g, "");
        if (!chatJid || !contactPhone) {
          return new Response(JSON.stringify({ error: "chatJid and contactPhone required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName || contactPhone}\nTEL;type=CELL;waid=${contactPhone}:+${contactPhone}\nEND:VCARD`;

        const contactEndpointVariants = ["/send/contact", "/sendContactVcard", "/chat/sendContact"];
        let contactSent = false;

        for (const ep of contactEndpointVariants) {
          try {
            const contactResp = await uazapiFetch(ep, {
              number: chatJid,
              contact: {
                fullName: contactName || contactPhone,
                phoneNumber: contactPhone,
              },
              vcard,
            });
            if (contactResp.ok) {
              result = await contactResp.json();
              contactSent = true;
              break;
            }
            if (contactResp.status === 404 || contactResp.status === 405) {
              console.log(`Contact endpoint ${ep} not available (${contactResp.status}), trying next...`);
              continue;
            }
            const errData = await contactResp.json();
            console.error(`UAZAPI sendContact error on ${ep}:`, errData);
            result = errData;
            break;
          } catch (e) {
            console.error(`Contact endpoint ${ep} failed:`, e);
            continue;
          }
        }

        if (!contactSent) {
          return new Response(JSON.stringify({ error: "Failed to send contact via all endpoints", details: result }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save outbound message
        const contactMsgId = (result as Record<string, Record<string, string>>)?.key?.id || crypto.randomUUID();
        const { data: existChat } = await serviceSupabase
          .from("uazapi_chats")
          .select("id")
          .eq("instance_id", instanceId)
          .eq("chat_id", chatJid)
          .maybeSingle();

        if (existChat?.id) {
          await serviceSupabase.from("uazapi_messages").insert({
            instance_id: instanceId,
            chat_id: existChat.id,
            message_id: contactMsgId,
            from_me: true,
            type: "contact",
            text_body: `[Contato] ${contactName || contactPhone}`,
            status: "sent",
            timestamp: new Date().toISOString(),
          });

          await serviceSupabase
            .from("uazapi_chats")
            .update({
              last_message_preview: `[Contato] ${contactName || contactPhone}`,
              last_message_time: new Date().toISOString(),
              last_message_from_me: true,
            })
            .eq("id", existChat.id);
        }

        break;
      }

      case "fetchProfilePicture": {
        console.log("[fetchProfilePicture] action called for instance:", instanceId, "jid:", body.chatJid);
        const targetJid = body.chatJid as string;
        if (!targetJid) {
          return new Response(JSON.stringify({ error: "chatJid required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let pictureUrl: string | null = null;
        // Try multiple endpoints
        const picEndpoints = ["/chat/fetchProfilePictureUrl", "/contact/profilePicture", "/chat/getProfilePictureUrl"];
        for (const ep of picEndpoints) {
          try {
            const picResp = await uazapiFetch(ep, { number: targetJid });
            if (picResp.ok) {
              const picData = await picResp.json();
              pictureUrl = picData.profilePictureUrl || picData.imgUrl || picData.url || picData.profilePicUrl || picData.picture || null;
              if (pictureUrl) break;
            }
            if (picResp.status === 404 || picResp.status === 405) continue;
          } catch {
            continue;
          }
        }

        // Save to DB if found
        if (pictureUrl) {
          await serviceSupabase
            .from("uazapi_chats")
            .update({ contact_picture_url: pictureUrl })
            .eq("instance_id", instanceId)
            .eq("chat_id", targetJid);
        }

        result = { pictureUrl };
        break;
      }

      case "configureWebhook": {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        // Include instance_id in webhook URL for proper multi-instance routing
        const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook?instance_id=${instanceId}`;
        const ourEvents = ["messages", "messages_update", "connection", "history", "call", "contacts", "presence", "groups", "labels", "chats", "chat_labels", "blocks", "leads"];

        console.log(`[configureWebhook] Adding webhook for instance ${instanceId} -> ${webhookUrl}`);

        // 1. Fetch existing webhooks to preserve them
        let existingWebhooks: Array<Record<string, unknown>> = [];
        try {
          const getResp = await uazapiFetch("/webhook");
          if (getResp.ok) {
            const existing = await getResp.json();
            console.log(`[configureWebhook] Existing webhooks:`, JSON.stringify(existing));
            if (Array.isArray(existing)) {
              existingWebhooks = existing;
            } else if (existing?.webhooks && Array.isArray(existing.webhooks)) {
              existingWebhooks = existing.webhooks;
            } else if (existing?.url) {
              existingWebhooks = [existing];
            }
          }
        } catch (e) {
          console.log(`[configureWebhook] Could not fetch existing webhooks:`, e);
        }

        // 2. Check if our webhook URL already exists (match by exact URL or by instance_id param)
        const alreadyExists = existingWebhooks.some((wh: Record<string, unknown>) => {
          const whUrl = String(wh.url || "");
          return whUrl === webhookUrl || whUrl.includes(`instance_id=${instanceId}`);
        });

        // Remove any old webhook URL without instance_id (legacy format)
        const legacyWebhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
        const hasLegacyWebhook = existingWebhooks.some((wh: Record<string, unknown>) => {
          const whUrl = String(wh.url || "");
          return whUrl === legacyWebhookUrl && !whUrl.includes("instance_id=");
        });
        if (hasLegacyWebhook) {
          console.log(`[configureWebhook] Found legacy webhook URL without instance_id, will be replaced`);
          try {
            await uazapiFetch("/webhook/remove", { url: legacyWebhookUrl });
          } catch { /* ignore removal errors */ }
        }

        if (alreadyExists) {
          console.log(`[configureWebhook] Webhook URL already configured, updating events only`);
          const webhookResp = await uazapiFetch("/webhook", {
            url: webhookUrl,
            enabled: true,
            events: ourEvents,
            excludeMessages: ["wasSentByApi"],
            addUrlEvents: true,
          });
          const webhookResult = await webhookResp.json();
          console.log(`[configureWebhook] Update response status=${webhookResp.status}:`, webhookResult);
          result = { webhookUrl, configured: true, alreadyExisted: true, details: webhookResult };
        } else {
          // 3. Add new webhook without replacing existing ones
          let added = false;
          try {
            const addResp = await uazapiFetch("/webhook/add", {
              url: webhookUrl,
              enabled: true,
              events: ourEvents,
              excludeMessages: ["wasSentByApi"],
            });
            if (addResp.ok) {
              const addResult = await addResp.json();
              console.log(`[configureWebhook] /webhook/add succeeded:`, addResult);
              result = { webhookUrl, configured: true, method: "add", details: addResult };
              added = true;
            } else {
              console.log(`[configureWebhook] /webhook/add not available (${addResp.status}), using fallback`);
            }
          } catch (e) {
            console.log(`[configureWebhook] /webhook/add failed, using fallback:`, e);
          }

          if (!added) {
            // Fallback: use addUrlEvents=true to append instead of replace
            const webhookResp = await uazapiFetch("/webhook", {
              url: webhookUrl,
              enabled: true,
              events: ourEvents,
              excludeMessages: ["wasSentByApi"],
              addUrlEvents: true,
            });
            const webhookResult = await webhookResp.json();
            console.log(`[configureWebhook] Fallback response status=${webhookResp.status}:`, webhookResult);

            if (!webhookResp.ok) {
              return new Response(JSON.stringify({ error: "Failed to configure webhook", details: webhookResult }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            result = { webhookUrl, configured: true, method: "fallback", details: webhookResult };
          }
        }

        // Save webhook URL in DB
        await serviceSupabase
          .from("uazapi_instances")
          .update({ webhook_url: webhookUrl })
          .eq("id", instanceId);

        break;
      }

      case "checkOnWhatsApp": {
        const phoneToCheck = body.phone as string;
        if (!phoneToCheck) {
          return new Response(JSON.stringify({ error: "phone is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const cleanPhone = phoneToCheck.replace(/\D/g, "");
        console.log(`[checkOnWhatsApp] Checking number: ${cleanPhone}`);

        // Try multiple UAZAPI endpoints for checking WhatsApp registration
        const checkEndpoints = [
          { endpoint: "/misc/onWhatsApp", body: { number: cleanPhone } },
          { endpoint: "/chat/onWhatsApp", body: { number: cleanPhone } },
          { endpoint: "/misc/isOnWhatsApp", body: { number: cleanPhone } },
        ];

        let checkResult: any = null;
        let checkSuccess = false;

        for (const variant of checkEndpoints) {
          try {
            const checkResp = await uazapiFetch(variant.endpoint, variant.body);
            if (checkResp.ok) {
              checkResult = await checkResp.json();
              checkSuccess = true;
              console.log(`[checkOnWhatsApp] ${variant.endpoint} succeeded:`, checkResult);
              break;
            }
            const status = checkResp.status;
            if (status === 404 || status === 405) {
              console.log(`[checkOnWhatsApp] ${variant.endpoint} not available (${status}), trying next...`);
              continue;
            }
            checkResult = await checkResp.json();
            break;
          } catch (e) {
            console.error(`[checkOnWhatsApp] ${variant.endpoint} failed:`, e);
            continue;
          }
        }

        if (!checkSuccess) {
          // If all endpoints fail, return unknown (don't block the user)
          console.warn("[checkOnWhatsApp] All endpoints failed, returning unknown");
          result = { exists: null, jid: null, unknown: true };
          break;
        }

        // Parse UAZAPI response — different versions return different formats
        // Common: { exists: true, jid: "5511...@s.whatsapp.net" }
        // Also: [{ exists: true, jid: "..." }] or { result: [{ exists: true }] }
        let exists = false;
        let jid: string | null = null;

        if (Array.isArray(checkResult)) {
          exists = checkResult[0]?.exists === true;
          jid = checkResult[0]?.jid || null;
        } else if (Array.isArray(checkResult?.result)) {
          exists = checkResult.result[0]?.exists === true;
          jid = checkResult.result[0]?.jid || null;
        } else if (checkResult?.exists !== undefined) {
          exists = checkResult.exists === true;
          jid = checkResult.jid || null;
        } else {
          // Unknown format — don't block
          exists = true;
          jid = null;
          console.warn("[checkOnWhatsApp] Unknown response format, assuming exists:", checkResult);
        }

        result = { exists, jid };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("uazapi-proxy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
