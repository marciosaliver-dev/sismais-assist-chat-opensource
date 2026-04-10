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
    const { phone, instance_id, conversation_id, days = 30 } = await req.json();
    if (!phone || !instance_id || !conversation_id) {
      return new Response(JSON.stringify({ error: "phone, instance_id and conversation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    console.log(`[import-chat-history] Starting for ${cleanPhone}, days=${days}`);

    // Get instance credentials
    const { data: instance } = await supabase
      .from("uazapi_instances")
      .select("id, api_url, api_token")
      .eq("id", instance_id)
      .eq("is_active", true)
      .single();

    if (!instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = instance.api_url.replace(/\/$/, "");
    const headers = { "Content-Type": "application/json", token: instance.api_token };
    const chatId = `${cleanPhone}@s.whatsapp.net`;

    // Try to fetch messages from UAZAPI — expanded endpoint list
    let allMessages: any[] = [];
    let apiReached = false;
    const msgLimit = 100;
    const fetchEndpoints = [
      { url: `/message~find`, method: "POST", body: { where: { key: { remoteJid: chatId } }, limit: msgLimit } },
      { url: `/message/find`, method: "POST", body: { where: { key: { remoteJid: chatId } }, limit: msgLimit } },
      { url: `/message/findMessages`, method: "POST", body: { where: { key: { remoteJid: chatId } }, limit: msgLimit } },
      { url: `/chat/fetchMessages`, method: "POST", body: { chatId, count: msgLimit } },
      { url: `/chat/messages/${chatId}?count=${msgLimit}`, method: "GET" },
      { url: `/chat/messages?chatId=${chatId}&count=${msgLimit}`, method: "GET" },
      { url: `/v1/chat/messages?chatId=${chatId}&count=${msgLimit}`, method: "GET" },
      { url: `/chat/messages`, method: "POST", body: { chatId, count: msgLimit } },
    ];

    for (const ep of fetchEndpoints) {
      try {
        const opts: RequestInit = { method: ep.method, headers };
        if (ep.body) opts.body = JSON.stringify(ep.body);
        const resp = await fetch(`${apiUrl}${ep.url}`, opts);
        const statusCode = resp.status;
        const bodyText = await resp.text();
        console.log(`[import-chat-history] ${ep.method} ${ep.url} → ${statusCode}, body preview: ${bodyText.substring(0, 200)}`);
        
        if (resp.ok || statusCode === 200) {
          apiReached = true;
          try {
            const data = JSON.parse(bodyText);
            const msgs = data.messages || data.data || data.result || (Array.isArray(data) ? data : []);
            if (Array.isArray(msgs) && msgs.length > 0) {
              allMessages = msgs;
              console.log(`[import-chat-history] Got ${msgs.length} messages from ${ep.url}`);
              break;
            }
          } catch (_parseErr) {
            console.log(`[import-chat-history] Failed to parse response from ${ep.url}`);
          }
        } else if (statusCode !== 404) {
          apiReached = true;
        }
      } catch (e) {
        console.log(`[import-chat-history] Endpoint ${ep.url} network error: ${e}`);
      }
    }

    if (allMessages.length === 0) {
      // Mark as imported (no history available)
      await supabase.from("uazapi_chats")
        .update({ history_imported_at: new Date().toISOString() })
        .eq("instance_id", instance_id)
        .eq("contact_phone", cleanPhone);

      return new Response(JSON.stringify({ 
        ok: true, 
        imported: 0, 
        api_reached: apiReached,
        message: apiReached ? "No messages found in chat history" : "Could not reach UAZAPI API — all endpoints failed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filteredMessages = allMessages.slice(0, 100);
    console.log(`[import-chat-history] Processing ${filteredMessages.length} messages`);

    // Get the chat DB record
    const { data: chatRecord } = await supabase
      .from("uazapi_chats")
      .select("id")
      .eq("instance_id", instance_id)
      .eq("contact_phone", cleanPhone)
      .maybeSingle();

    // Get conversation started_at for timestamp fallback
    const { data: convRecord } = await supabase
      .from("ai_conversations")
      .select("started_at")
      .eq("id", conversation_id)
      .single();
    const conversationStartedAt = convRecord?.started_at ? new Date(convRecord.started_at) : new Date();

    // Fetch existing messages for deduplication (by uazapi_message_id AND by content+role)
    const { data: existingMsgs } = await supabase
      .from("ai_messages")
      .select("id, content, role, created_at, uazapi_message_id")
      .eq("conversation_id", conversation_id);

    const existingByMsgId = new Set(
      (existingMsgs || []).filter(m => m.uazapi_message_id).map(m => m.uazapi_message_id)
    );
    const existingByContent = new Set(
      (existingMsgs || []).map(m => `${m.role}|${(m.content || '').substring(0, 100)}`)
    );

    console.log(`[import-chat-history] Existing messages: ${existingMsgs?.length || 0} (byId: ${existingByMsgId.size}, byContent: ${existingByContent.size})`);

    let importedCount = 0;
    let skippedDupes = 0;

    for (let index = 0; index < filteredMessages.length; index++) {
      const msg = filteredMessages[index];
      try {
        const msgId = msg.key?.id || msg.id || msg.messageid || crypto.randomUUID();
        const fromMe = msg.key?.fromMe === true || msg.fromMe === true;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 
                     msg.text || msg.body || "";
        const ts = msg.messageTimestamp || msg.timestamp || msg.t;
        
        // Timestamp: use real timestamp if available, otherwise place BEFORE conversation start
        let timestamp: string;
        if (ts) {
          timestamp = new Date(Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000).toISOString();
        } else {
          // Place messages before conversation start, spaced 1min apart
          const fallbackTs = new Date(conversationStartedAt.getTime() - (filteredMessages.length - index) * 60000);
          timestamp = fallbackTs.toISOString();
        }

        if (!text && !msg.message?.imageMessage && !msg.message?.audioMessage && !msg.message?.videoMessage) {
          continue;
        }

        const messageType = msg.message?.imageMessage ? "image" :
                           msg.message?.audioMessage ? "audio" :
                           msg.message?.videoMessage ? "video" :
                           msg.message?.documentMessage ? "document" : "text";

        const displayText = text || 
          (messageType === "image" ? "[Imagem]" : 
           messageType === "audio" ? "[Áudio]" : 
           messageType === "video" ? "[Vídeo]" : 
           messageType === "document" ? "[Documento]" : "[Mensagem]");

        // Dedup check: by uazapi_message_id
        if (existingByMsgId.has(msgId)) {
          skippedDupes++;
          continue;
        }

        // Dedup check: by content + role
        const role = fromMe ? "assistant" : "user";
        const contentKey = `${role}|${displayText.substring(0, 100)}`;
        if (existingByContent.has(contentKey)) {
          skippedDupes++;
          continue;
        }

        // Upsert to uazapi_messages
        if (chatRecord) {
          await supabase.from("uazapi_messages").upsert({
            instance_id: instance.id,
            chat_id: chatRecord.id,
            message_id: msgId,
            from_me: fromMe,
            sender_phone: fromMe ? null : cleanPhone,
            type: messageType,
            text_body: displayText,
            status: fromMe ? "sent" : "received",
            timestamp,
          }, { onConflict: "message_id" });
        }

        // Insert to ai_messages (already deduped above)
        await supabase.from("ai_messages").insert({
          conversation_id,
          role,
          content: displayText,
          uazapi_message_id: msgId,
          created_at: timestamp,
          imported_from_history: true,
          media_type: messageType !== "text" ? messageType : null,
        });

        // Add to dedup sets to prevent intra-batch duplicates
        existingByMsgId.add(msgId);
        existingByContent.add(contentKey);
        importedCount++;
      } catch (e) {
        console.log(`[import-chat-history] Message import error:`, e);
      }
    }

    // Mark history as imported
    if (chatRecord) {
      await supabase.from("uazapi_chats")
        .update({ history_imported_at: new Date().toISOString() })
        .eq("id", chatRecord.id);
    }

    console.log(`[import-chat-history] Done: ${importedCount} imported, ${skippedDupes} duplicates skipped`);

    return new Response(JSON.stringify({ ok: true, imported: importedCount, skipped_duplicates: skippedDupes, api_reached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[import-chat-history] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
