import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackMetric, trackError } from "../_shared/pipeline-metrics.ts";
import { generateRequestId } from "../_shared/structured-logger.ts";
import { corsHeaders } from "../_shared/supabase-helpers.ts";
import { cachedQuery } from "../_shared/cache.ts";

// ===== CSAT SURVEY HELPER =====
function looksLikeCSATResponse(text: string, config: any): boolean {
  if (!text || text.trim().length === 0) return false;
  const trimmed = text.trim();
  const num = parseInt(trimmed);
  if (!isNaN(num)) {
    if (config.scale_type === 'stars_1_5' && num >= 1 && num <= 5) return true;
    if (config.scale_type === 'nps_0_10' && num >= 0 && num <= 10) return true;
    if (config.scale_type === 'thumbs' && (num === 1 || num === 2)) return true;
    if (config.scale_type === 'emoji' && num >= 1 && num <= 5) return true;
  }
  const csatEmojis = ['⭐', '👍', '👎', '😡', '😕', '😐', '🙂', '😍', '❤️', '💚', '👏'];
  if (csatEmojis.some(e => trimmed.includes(e)) && trimmed.length < 20) return true;
  const words = trimmed.split(/\s+/).length;
  if (words <= 15) {
    const greetings = ['bom dia', 'boa tarde', 'boa noite', 'olá', 'oi', 'oie', 'opa'];
    const lower = trimmed.toLowerCase();
    if (greetings.some(g => lower.startsWith(g))) return false;
    if (trimmed.endsWith('?')) return false;
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const _webhookStartMs = Date.now();
    const _requestId = generateRequestId();
    const body = await req.json();
    const bodyStr = JSON.stringify(body);
    // Log only non-PII fields from webhook payload
    console.log("Webhook event:", JSON.stringify({ event: body.EventType || body.event || body.type, ts: new Date().toISOString(), bodyLength: bodyStr.length }));

    const event = body.EventType || body.event || body.type;

    // ===== EARLY RETURN for irrelevant events (Task 7) =====
    const ignoredEvents = ["connection.update", "presence.update", "contacts.update", "groups.update"];
    if (ignoredEvents.includes(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== MESSAGE RECEIVED =====
    if (event === "messages" || event === "messages.upsert" || event === "message") {
      // UAZAPI v2: message is at body.message
      // UAZAPI v1 / baileys: message is at body.data?.message or body.data
      const msg = body.message || body.data?.message || body.data;
      if (!msg) {
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const instanceName = body.instanceName || body.instance || body.data?.instance;
      const baseUrl = body.BaseUrl || null;
      
      // ===== fromMe detection (UAZAPI v2 uses msg.fromMe directly) =====
      const fromMe = msg.fromMe === true || msg.key?.fromMe === true || msg.wasSentByApi === true;

      // If it's our own sent message echo, skip the ai_messages bridge entirely
      // We still save to uazapi_messages for completeness
      console.log(`fromMe=${fromMe}, wasSentByApi=${msg.wasSentByApi}`);

      // ===== Identify sender/chat =====
      // UAZAPI v2: chatid has the real phone, sender may be a LID
      const chatJid = msg.chatid || msg.key?.remoteJid || msg.from || body.chat?.id || "";
      const senderJid = msg.sender || msg.key?.remoteJid || chatJid;
      const msgId = msg.messageid || msg.key?.id || msg.id || crypto.randomUUID();
      const pushName = msg.senderName || msg.pushName || body.chat?.wa_name || body.sender?.pushName || "";

      // Extract real phone number
      const extractPhone = (jid: string): string => {
        return jid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "").replace(/[\s\-\+\(\)]/g, "");
      };

      // UAZAPI v2 provides sender_pn (real phone) even when sender is a LID
      let phoneNumber = "";
      const senderPn = msg.sender_pn || body.event?.sender_pn || "";
      if (senderPn && /\d{8,}/.test(extractPhone(senderPn))) {
        phoneNumber = extractPhone(senderPn);
      } else if (/\d{8,}/.test(extractPhone(chatJid))) {
        phoneNumber = extractPhone(chatJid);
      } else {
        // Deep search for any phone in payload
        const candidates = [
          msg.chatid, msg.sender_pn, msg.sender,
          body.chat?.wa_chatid, body.chat?.owner, body.owner,
          msg.key?.participant, msg.participant, msg.from,
          body.sender?.id, body.sender?.phone, body.sender?.jid,
        ];
        for (const c of candidates) {
          if (!c || typeof c !== "string") continue;
          const cleaned = extractPhone(c);
          if (/^\d{8,}/.test(cleaned)) { phoneNumber = cleaned; break; }
        }
        if (!phoneNumber) {
          const phoneMatch = bodyStr.match(/"(\d{10,15})@s\.whatsapp\.net"/);
          phoneNumber = phoneMatch ? phoneMatch[1] : extractPhone(chatJid);
        }
      }

      // Fix: For outgoing messages (fromMe), the relevant phone is the CONTACT (chatJid),
      // not the sender (which is the instance owner). Override phoneNumber accordingly.
      // Note: isGroup is checked inline here since the const is declared later
      const isGroupChat = chatJid.includes("@g.us");
      if (fromMe && !isGroupChat) {
        const chatJidPhone = extractPhone(chatJid);
        if (/^\d{8,}/.test(chatJidPhone) && chatJidPhone !== (body.owner || "").replace(/\D/g, "")) {
          phoneNumber = chatJidPhone;
        }
      }

      // Use chatJid (which has real phone in UAZAPI v2) as the chat identifier
      // But also keep the LID-based remoteJid for lookup
      const remoteJid = msg.key?.remoteJid || chatJid;
      const isLidReference = remoteJid.includes("@lid") || 
        (!remoteJid.includes("@s.whatsapp.net") && !remoteJid.includes("@g.us") && !/^\d/.test(remoteJid));

      // ===== DEDUPLICAÇÃO: verificar message_id antes de qualquer processamento =====
      // Previne processamento duplicado em caso de retry do UAZAPI.
      // A tabela uazapi_messages tem UNIQUE (message_id, instance_id), mas verificar
      // aqui evita todo o processamento desnecessário (inclui chamadas a process-incoming-message).
      // Otimização Task 5: 1 query (uazapi_messages) em vez de 3; instance lookup cacheado 5 min.
      if (msgId && !msgId.startsWith('uuid-') && instanceName) {
        // Buscar instância para ter o instance_id (cached 5 min via shared cache)
        const instanceForDedupData = await cachedQuery(
          `instance:${instanceName}`,
          5 * 60 * 1000,
          async () => {
            const res = await supabase
              .from("uazapi_instances")
              .select("id")
              .or(`instance_name.eq.${instanceName},name.eq.${instanceName}`)
              .limit(1)
              .maybeSingle();
            return res.data;
          }
        );

        if (instanceForDedupData?.id) {
          // Single composite query — uazapi_messages has UNIQUE(message_id, instance_id)
          const { data: existingMsg } = await supabase
            .from("uazapi_messages")
            .select("id")
            .eq("message_id", msgId)
            .eq("instance_id", instanceForDedupData.id)
            .maybeSingle()

          if (existingMsg) {
            // Mensagem já existe — skip seguro (downstream upsert + ai_messages check
            // em linha ~1438 tratam casos de falha parcial caso o retry prossiga)
            console.log(JSON.stringify({
              level: 'info', fn: 'uazapi-webhook', step: 'dedup_skip',
              message_id: msgId, reason: 'already_processed'
            }))
            return new Response(JSON.stringify({ ok: true, skipped: 'duplicate_message_id' }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
          }
        }
      }

      // ===== Message type and content =====
      const rawType = msg.messageType || msg.type || msg.mediaType || "text";
      let messageType = rawType.toLowerCase();

      // Skip poll update messages — they are vote updates on an existing poll message,
      // not new standalone messages. Returning early avoids inserting "[pollupdatemessage]".
      if (messageType === "pollupdatemessage" || messageType === "poll_update" || messageType === "pollupdate") {
        console.log(`Skipping poll update message (msgId=${msgId}) — not a new message`);
        return new Response(JSON.stringify({ ok: true, skipped: "poll_update" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== PROTOCOL MESSAGE (REVOKE) — detect deletion inside normal message flow =====
      const protocolMsg = msg.content?.protocolMessage || msg.message?.protocolMessage;
      if (protocolMsg && (protocolMsg.type === 0 || protocolMsg.type === "REVOKE")) {
        const revokedMsgId = protocolMsg.key?.id;
        console.log(`ProtocolMessage REVOKE detected inside messages event, revokedMsgId=${revokedMsgId}`);
        if (revokedMsgId) {
          const { data: origMsg } = await supabase
            .from("uazapi_messages")
            .select("id, text_body, media_url, type, media_mimetype")
            .eq("message_id", revokedMsgId)
            .maybeSingle();
          if (origMsg) {
            const deletedAt = new Date().toISOString();
            await Promise.all([
              supabase.from("uazapi_messages").update({
                deleted_by_sender: true,
                deleted_at: deletedAt,
                original_content_preserved: {
                  text_body: origMsg.text_body,
                  media_url: origMsg.media_url,
                  type: origMsg.type,
                  media_mimetype: origMsg.media_mimetype,
                },
              }).eq("id", origMsg.id),
              supabase.from("ai_messages").update({
                deleted_by_sender: true,
                deleted_at: deletedAt,
              }).eq("uazapi_message_id", revokedMsgId),
            ]);
            console.log(`Message ${revokedMsgId} marked as deleted_by_sender (via protocolMessage)`);
          }
        }
        return new Response(JSON.stringify({ ok: true, handled: "revoke" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== EDIT MESSAGE — detect edit inside normal message flow =====
      if (messageType === "editmessage" || messageType === "editedmessage" || msg.editedMessage) {
        const editedMsgId = msg.content?.editedMessage?.message?.protocolMessage?.key?.id
          || msg.content?.protocolMessage?.key?.id
          || msg.message?.editedMessage?.key?.id
          || msg.key?.id;
        const newText = msg.content?.editedMessage?.message?.conversation
          || msg.content?.editedMessage?.message?.extendedTextMessage?.text
          || msg.editedMessage?.conversation
          || msg.editedMessage?.extendedTextMessage?.text
          || msg.text || "";
        console.log(`EditMessage detected inside messages event, editedMsgId=${editedMsgId}, newText=${newText?.substring(0, 50)}`);
        if (editedMsgId && newText) {
          const { data: origMsg } = await supabase
            .from("uazapi_messages")
            .select("id, text_body, edit_history")
            .eq("message_id", editedMsgId)
            .maybeSingle();
          if (origMsg) {
            const editedAt = new Date().toISOString();
            const existingHistory = Array.isArray(origMsg.edit_history) ? origMsg.edit_history : [];
            const updatedHistory = [...existingHistory, { body: origMsg.text_body, edited_at: editedAt }];
            // Parallelize: update uazapi_messages + fetch ai_messages simultaneously
            const [, { data: aiMsg }] = await Promise.all([
              supabase.from("uazapi_messages").update({
                text_body: newText,
                edited_by_sender: true,
                edit_history: updatedHistory,
              }).eq("id", origMsg.id),
              supabase
                .from("ai_messages")
                .select("id, edit_history")
                .eq("uazapi_message_id", editedMsgId)
                .maybeSingle(),
            ]);
            if (aiMsg) {
              const aiHistory = Array.isArray(aiMsg.edit_history) ? aiMsg.edit_history : [];
              const updatedAiHistory = [...aiHistory, { body: origMsg.text_body, edited_at: editedAt }];
              await supabase.from("ai_messages").update({
                content: newText,
                edited_by_sender: true,
                edit_history: updatedAiHistory,
              }).eq("id", aiMsg.id);
            }
            console.log(`Message ${editedMsgId} marked as edited (via editMessage)`);
          }
        }
        return new Response(JSON.stringify({ ok: true, handled: "edit" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (messageType === "pollupdatemessage" || messageType === "poll_update" || messageType === "pollupdate") {
        console.log(`Skipping poll update message (msgId=${msgId}) — not a new message`);
        return new Response(JSON.stringify({ ok: true, skipped: "poll_update" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== REACTION MESSAGE HANDLING =====
      const isReaction = messageType === "reactionmessage" || messageType === "reaction";
      let reactionTargetMsgId: string | null = null;
      let reactionEmoji: string | null = null;
      if (isReaction) {
        const reactionData = msg.content?.reactionMessage || msg.reaction || msg.message?.reactionMessage || {};
        reactionTargetMsgId = reactionData?.key?.id || reactionData?.targetMessageId || null;
        reactionEmoji = reactionData?.text || msg.text || (typeof msg.content === "string" ? msg.content : null) || null;
        console.log(`Reaction detected: emoji=${reactionEmoji}, targetMsgId=${reactionTargetMsgId}`);
        // If empty emoji, it means the reaction was removed — delete from ai_messages
        if (!reactionEmoji) {
          console.log("Reaction removed (empty emoji), deleting from ai_messages");
          if (reactionTargetMsgId) {
            await supabase.from("ai_messages").delete()
              .eq("reaction_to_message_id", reactionTargetMsgId)
              .not("reaction_emoji", "is", null);
            console.log(`Deleted reaction records for target message ${reactionTargetMsgId}`);
          }
          return new Response(JSON.stringify({ ok: true, handled: "reaction_removed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ===== QUOTED MESSAGE EXTRACTION =====
      let quotedMsgId: string | null = null;
      let quotedContent: string | null = null;
      let quotedSenderName: string | null = null;
      if (!isReaction) {
        const contextInfo = msg.content?.extendedTextMessage?.contextInfo
          || msg.message?.extendedTextMessage?.contextInfo
          || msg.content?.imageMessage?.contextInfo
          || msg.content?.videoMessage?.contextInfo
          || msg.content?.audioMessage?.contextInfo
          || msg.content?.documentMessage?.contextInfo
          || null;
        if (contextInfo?.stanzaId) {
          quotedMsgId = contextInfo.stanzaId;
          quotedSenderName = contextInfo.participant
            ? contextInfo.participant.replace("@s.whatsapp.net", "").replace("@lid", "")
            : null;
          // Try to get quoted text from the payload itself
          const qm = contextInfo.quotedMessage;
          quotedContent = qm?.conversation || qm?.extendedTextMessage?.text || qm?.imageMessage?.caption || qm?.videoMessage?.caption || null;
          console.log(`Quoted message detected: stanzaId=${quotedMsgId}, content=${quotedContent?.substring(0, 50)}`);
        }
      }
      let textBody = "";
      let caption = "";
      let mediaUrl = "";
      let mediaMimetype: string | null = null;
      let mediaFilename: string | null = null;
      const mediaSize: number | null = null;
      let mediaType: string | null = null;

      // UAZAPI v2 format: msg.text has the text, msg.content may be string or object
      if (messageType === "conversation" || messageType === "extendedtextmessage" || messageType === "text") {
        messageType = "text";
        textBody = msg.text || (typeof msg.content === "string" ? msg.content : msg.content?.text) || 
          msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.body || "";
      } else if (messageType === "imagemessage" || messageType === "image") {
        messageType = "image";
        mediaType = "image";
        caption = msg.caption || msg.content?.caption || msg.message?.imageMessage?.caption || "";
        textBody = caption || "[Imagem]";
        mediaMimetype = msg.mimetype || msg.content?.mimetype || msg.message?.imageMessage?.mimetype || null;
        mediaUrl = msg.mediaUrl || msg.media?.url || msg.fileUrl || msg.content?.URL || msg.content?.url || msg.message?.imageMessage?.url || "";
      } else if (messageType === "audiomessage" || messageType === "audio" || messageType === "ptt") {
        const isPtt = messageType === "ptt" || msg.message?.audioMessage?.ptt || msg.ptt || msg.content?.PTT;
        messageType = isPtt ? "ptt" : "audio";
        mediaType = isPtt ? "ptt" : "audio";
        textBody = "[Áudio]";
        mediaMimetype = msg.mimetype || msg.content?.mimetype || msg.message?.audioMessage?.mimetype || null;
        mediaUrl = msg.mediaUrl || msg.media?.url || msg.fileUrl || msg.content?.URL || msg.content?.url || msg.message?.audioMessage?.url || "";
      } else if (messageType === "videomessage" || messageType === "video") {
        messageType = "video";
        mediaType = "video";
        caption = msg.caption || msg.content?.caption || msg.message?.videoMessage?.caption || "";
        textBody = caption || "[Vídeo]";
        mediaMimetype = msg.mimetype || msg.content?.mimetype || msg.message?.videoMessage?.mimetype || null;
        mediaUrl = msg.mediaUrl || msg.media?.url || msg.fileUrl || msg.content?.URL || msg.content?.url || msg.message?.videoMessage?.url || "";
      } else if (messageType === "documentmessage" || messageType === "document") {
        messageType = "document";
        mediaType = "document";
        mediaFilename = msg.fileName || msg.content?.fileName || msg.message?.documentMessage?.fileName || null;
        textBody = `[Documento: ${mediaFilename || "arquivo"}]`;
        mediaMimetype = msg.mimetype || msg.content?.mimetype || msg.message?.documentMessage?.mimetype || null;
        mediaUrl = msg.mediaUrl || msg.media?.url || msg.fileUrl || msg.content?.URL || msg.content?.url || msg.message?.documentMessage?.url || "";
      } else if (messageType === "stickermessage" || messageType === "sticker") {
        messageType = "sticker";
        mediaType = "sticker";
        textBody = "[Figurinha]";
        mediaMimetype = msg.mimetype || msg.content?.mimetype || msg.message?.stickerMessage?.mimetype || null;
        mediaUrl = msg.mediaUrl || msg.media?.url || msg.fileUrl || msg.content?.URL || msg.content?.url || msg.message?.stickerMessage?.url || "";
      } else {
        textBody = msg.text || msg.body || (typeof msg.content === "string" ? msg.content : "") || "";
        mediaUrl = msg.mediaUrl || msg.media?.url || msg.fileUrl || "";
        // Infer mediaType from mimetype or URL when messageType is unrecognized
        if (mediaUrl) {
          const inferredMime = msg.mimetype || msg.content?.mimetype || "";
          if (inferredMime.startsWith("image/")) mediaType = "image";
          else if (inferredMime.startsWith("video/")) mediaType = "video";
          else if (inferredMime.startsWith("audio/")) mediaType = "audio";
          else mediaType = "document";
          mediaMimetype = inferredMime || null;
          console.log(`[Media] Inferred mediaType=${mediaType} for unknown messageType=${messageType}`);
        }
      }

      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) > 1e12 ? Number(msg.messageTimestamp) : Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      console.log(`Message parsed: chatJid=${chatJid}, isLid=${isLidReference}, phone=${phoneNumber ? phoneNumber.slice(0, -4) + '****' : 'none'}, fromMe=${fromMe}, type=${messageType}, mediaUrl=${mediaUrl ? 'yes' : 'no'}`);

      // ===== Find instance =====
      // Priority order: 1) instance_id query param, 2) instanceName, 3) baseUrl, 4) fallback
      let inst: { id: string; api_url: string; api_token: string; kanban_board_id?: string | null } | null = null;

      // PRIORITY 1: instance_id from webhook URL query param (unique per instance)
      const webhookUrl = new URL(req.url);
      const queryInstanceId = webhookUrl.searchParams.get("instance_id");
      if (queryInstanceId) {
        inst = await cachedQuery(`instance:id:${queryInstanceId}`, 5 * 60 * 1000, async () => {
          const { data } = await supabase.from("uazapi_instances").select("id, api_url, api_token, kanban_board_id").eq("id", queryInstanceId).eq("is_active", true).maybeSingle();
          return data;
        });
        if (inst) console.log(`Instance resolved via query param: ${inst.id}`);
      }

      // PRIORITY 2: instanceName from webhook payload
      if (!inst && instanceName) {
        inst = await cachedQuery(`instance:name:${instanceName}`, 5 * 60 * 1000, async () => {
          const { data } = await supabase.from("uazapi_instances").select("id, api_url, api_token, kanban_board_id").eq("is_active", true).eq("instance_name", instanceName).maybeSingle();
          return data;
        });
        if (inst) console.log(`Instance resolved via instanceName: ${instanceName}`);
      }

      // PRIORITY 2.5: owner phone from webhook payload
      if (!inst) {
        const ownerPhone = (body.owner || "").replace(/\D/g, "");
        if (ownerPhone && /^\d{8,}/.test(ownerPhone)) {
          const { data } = await supabase
            .from("uazapi_instances")
            .select("id, api_url, api_token, kanban_board_id")
            .eq("is_active", true)
            .eq("phone_number", ownerPhone)
            .maybeSingle();
          inst = data;
          if (inst) console.log(`Instance resolved via owner phone: ${ownerPhone ? ownerPhone.slice(0, -4) + '****' : 'unknown'} -> ${inst.id}`);
        }
      }

      // PRIORITY 3: baseUrl matching
      if (!inst && baseUrl) {
        const normalizedUrl = baseUrl.replace(/\/+$/, "");
        const { data } = await supabase.from("uazapi_instances").select("id, api_url, api_token, kanban_board_id").eq("is_active", true).eq("api_url", normalizedUrl).limit(1);
        inst = data?.[0] ?? null;
        if (!inst) {
          const { data: d2 } = await supabase.from("uazapi_instances").select("id, api_url, api_token, kanban_board_id").eq("is_active", true).ilike("api_url", `${normalizedUrl}%`).limit(1);
          inst = d2?.[0] ?? null;
        }
        if (inst) console.log(`Instance resolved via baseUrl: ${normalizedUrl}`);
      }

      // PRIORITY 4: fallback to first active instance
      if (!inst) {
        const { data: fallbackInstances } = await supabase.from("uazapi_instances").select("id, api_url, api_token, kanban_board_id").eq("is_active", true).limit(1);
        inst = fallbackInstances?.[0] ?? null;
        if (inst) console.log(`Instance resolved via fallback (first active): ${inst.id}`);
      }
      if (!inst) {
        console.log("No active instance found for:", queryInstanceId || instanceName || baseUrl);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // TEST MODE: Note - test_mode only affects AI agent activation, NOT message saving.
      // Messages are always saved regardless of test_mode. The check is done before AI trigger (see below).

      // ===== Download media and re-upload to Supabase Storage =====
      // Helper: validate magic bytes to ensure we got real media, not an HTML error page
      function validateMagicBytes(data: Uint8Array, expectedType: string | null): boolean {
        if (data.length < 12) return false;
        // JPEG: FF D8 FF
        if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) return true;
        // PNG: 89 50 4E 47
        if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return true;
        // WebP: RIFF....WEBP
        if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
            data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return true;
        // OGG: 4F 67 67 53
        if (data[0] === 0x4F && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) return true;
        // MP4/M4A: ftyp at offset 4
        if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
        // MP3: ID3 tag or sync word
        if ((data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) || (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0)) return true;
        // PDF: %PDF
        if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) return true;
        // GIF: GIF8
        if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return true;
        // For documents/stickers, be more lenient — allow if not clearly HTML
        if (expectedType === "document" || expectedType === "sticker") {
          // Reject if starts with < (HTML)
          return data[0] !== 0x3C;
        }
        return false;
      }

      let storedMediaUrl = "";
      if (mediaType) {
        try {
          let mediaResponse: Response | null = null;
          let mediaBlob: Blob | null = null;
          let isThumbnailFallback = false;

          // ========== PRIORITY 1: Download via UAZAPI API (most reliable) ==========
          // Helper to process JSON responses from UAZAPI (base64 or fileURL)
          const processJsonBase64 = async (resp: Response): Promise<Blob | null> => {
            try {
              const json = await resp.json();
              const b64 = json.data || json.base64 || json.file || json.media;
              const mime = json.mimetype || json.mimeType || mediaMimetype || "application/octet-stream";
              if (b64 && typeof b64 === "string" && b64.length > 100) {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                if (validateMagicBytes(bytes, mediaType)) {
                  return new Blob([bytes], { type: mime });
                }
              }
              // Handle UAZAPI cached response: {"cached":true,"fileURL":"https://..."}
              const fileUrl = json.fileURL || json.fileUrl || json.url;
              if (fileUrl && typeof fileUrl === "string" && fileUrl.startsWith("http")) {
                console.log(`[Media] UAZAPI returned fileURL, downloading: ${fileUrl.substring(0, 80)}...`);
                try {
                  const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
                  if (fileResp.ok) {
                    const fileBytes = new Uint8Array(await fileResp.arrayBuffer());
                    if (fileBytes.length > 100 && validateMagicBytes(fileBytes, mediaType)) {
                      const fileMime = fileResp.headers.get("content-type") || mime;
                      return new Blob([fileBytes], { type: fileMime });
                    }
                    // Even if magic bytes don't match, accept large files as documents
                    if (fileBytes.length > 1024) {
                      const fileMime = fileResp.headers.get("content-type") || mime;
                      console.log(`[Media] fileURL content doesn't match media magic bytes but is ${fileBytes.length}b — accepting as-is`);
                      return new Blob([fileBytes], { type: fileMime });
                    }
                  }
                } catch (fetchErr) {
                  console.log(`[Media] fileURL fetch failed: ${(fetchErr as Error).message}`);
                }
              }
            } catch { /* ignore */ }
            return null;
          };

          if (inst.api_url && inst.api_token && msgId) {
            console.log(`[Media] Attempting UAZAPI API download for msgId=${msgId}`);
            const apiUrl = inst.api_url.replace(/\/+$/, "");
            // Try multiple endpoints (UAZAPI versions vary)
            // NOTE: Keep in sync with retryEndpoints below (same endpoints, different field name due to loop destructuring)
            const downloadEndpoints = [
              // Variantes com campo "messageId"
              { endpoint: "/chat/downloadMedia", body: { messageId: msgId } },
              { endpoint: "/message/download",   body: { messageId: msgId } },
              // Variantes com campo "id" (algumas versões do UAZAPI usam "id")
              { endpoint: "/chat/downloadMedia", body: { id: msgId } },
              { endpoint: "/message/download",   body: { id: msgId } },
              // Variantes com ambos campos
              { endpoint: "/chat/downloadMedia", body: { messageId: msgId, id: msgId } },
              // GET endpoints
              { endpoint: `/download/${msgId}`,         body: undefined as Record<string, unknown> | undefined },
              { endpoint: `/message/${msgId}/download`, body: undefined as Record<string, unknown> | undefined },
            ];
            for (const { endpoint, body: epBody } of downloadEndpoints) {
              if (mediaBlob) break;
              try {
                const dlResp = await fetch(`${apiUrl}${endpoint}`, {
                  method: epBody ? "POST" : "GET",
                  headers: {
                    "Content-Type": "application/json",
                    "token": inst.api_token,
                  },
                  body: epBody ? JSON.stringify(epBody) : undefined,
                });
                if (dlResp.status === 404 || dlResp.status === 405) {
                  console.log(`[Media] Endpoint ${endpoint} not available (${dlResp.status}), trying next...`);
                  continue;
                }
                if (!dlResp.ok) {
                  console.log(`[Media] Endpoint ${endpoint} failed: status=${dlResp.status}`);
                  continue;
                }
                const dlContentType = dlResp.headers.get("content-type") || "";
                if (dlContentType.includes("application/json")) {
                  const result = await processJsonBase64(new Response(await dlResp.text(), { headers: dlResp.headers }));
                  if (result) {
                    mediaBlob = result;
                    console.log(`[Media] UAZAPI API download succeeded via ${endpoint} (JSON/base64): ${result.size} bytes`);
                  }
                } else {
                  const bytes = new Uint8Array(await dlResp.arrayBuffer());
                  if (bytes.length > 100 && validateMagicBytes(bytes, mediaType)) {
                    mediaBlob = new Blob([bytes], { type: dlContentType || mediaMimetype || "application/octet-stream" });
                    console.log(`[Media] UAZAPI API download succeeded via ${endpoint} (binary): ${bytes.length} bytes`);
                  } else {
                    console.log(`[Media] UAZAPI API binary via ${endpoint}: invalid content, size=${bytes.length}`);
                  }
                }
              } catch (apiErr) {
                console.log(`[Media] Endpoint ${endpoint} error: ${(apiErr as Error).message}`);
                continue;
              }
            }
          }

          // ========== PRIORITY 2: WhatsApp E2E Media Decryption ==========
          if (!mediaBlob) {
            const contentObj = msg.content || msg.message?.[rawType] || {};
            const mediaKeyB64 = contentObj.mediaKey || contentObj.MediaKey;
            const encUrl = mediaUrl;

            if (mediaKeyB64 && encUrl && encUrl.includes(".enc")) {
              console.log(`[Media] Attempting WhatsApp E2E decryption for msgId=${msgId}, type=${mediaType}`);
              try {
                const encResp = await fetch(encUrl);
                if (!encResp.ok) {
                  console.log(`[Media] E2E download failed: ${encResp.status}`);
                } else {
                  const encData = new Uint8Array(await encResp.arrayBuffer());
                  console.log(`[Media] Downloaded encrypted file: ${encData.length} bytes`);

                  const mediaKeyBytes = Uint8Array.from(atob(mediaKeyB64), c => c.charCodeAt(0));
                  const hkdfInfoMap: Record<string, string> = {
                    image: "WhatsApp Image Keys",
                    audio: "WhatsApp Audio Keys",
                    ptt: "WhatsApp Audio Keys",
                    video: "WhatsApp Video Keys",
                    document: "WhatsApp Document Keys",
                    sticker: "WhatsApp Image Keys",
                  };
                  const hkdfInfo = hkdfInfoMap[mediaType || "audio"] || "WhatsApp Audio Keys";
                  const infoBytes = new TextEncoder().encode(hkdfInfo);
                  const hkdfKey = await crypto.subtle.importKey("raw", mediaKeyBytes, "HKDF", false, ["deriveBits"]);
                  const expandedBits = await crypto.subtle.deriveBits(
                    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: infoBytes },
                    hkdfKey, 112 * 8
                  );
                  const expanded = new Uint8Array(expandedBits);
                  const iv = expanded.slice(0, 16);
                  const cipherKey = expanded.slice(16, 48);
                  const encFileData = encData.slice(0, encData.length - 10);
                  const aesKey = await crypto.subtle.importKey("raw", cipherKey, { name: "AES-CBC" }, false, ["decrypt"]);
                  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, aesKey, encFileData);
                  const decryptedBytes = new Uint8Array(decrypted);
                  const finalMime = mediaMimetype?.split(";")[0]?.trim() || "audio/ogg";
                  
                  if (validateMagicBytes(decryptedBytes, mediaType)) {
                    mediaBlob = new Blob([decryptedBytes], { type: finalMime });
                    console.log(`[Media] E2E decryption succeeded: ${decryptedBytes.length} bytes, mime=${finalMime}`);
                  } else {
                    console.log(`[Media] E2E decryption produced invalid content (magic bytes mismatch)`);
                  }
                }
              } catch (decryptErr) {
                console.error("[Media] E2E decryption error:", decryptErr);
              }
            }
          }

          // === PRIORITY 3: Direct URL fetch (only if NOT encrypted .enc media) ===
          if (!mediaBlob && mediaUrl && mediaUrl.startsWith("http") && !mediaUrl.includes(".enc")) {
            console.log(`[Media] Fallback - Direct fetch for msgId=${msgId}`);
            try {
              mediaResponse = await fetch(mediaUrl);
              if (mediaResponse.ok) {
                const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
                if (bytes.length > 100 && validateMagicBytes(bytes, mediaType)) {
                  const ct = mediaResponse.headers.get("content-type") || mediaMimetype || "application/octet-stream";
                  mediaBlob = new Blob([bytes], { type: ct });
                  console.log(`[Media] Direct fetch succeeded: ${bytes.length} bytes`);
                } else {
                  console.log(`[Media] Direct fetch returned invalid content: size=${bytes.length}, likely HTML error page`);
                }
              } else {
                console.log(`[Media] Direct fetch failed: status=${mediaResponse.status}`);
              }
            } catch {
              console.log(`[Media] Direct fetch error`);
            }
          }

          // === PRIORITY 4: JPEGThumbnail from payload (images only) ===
          if (!mediaBlob && (mediaType === "image" || mediaType === "sticker")) {
            const contentObj = msg.content || msg.message?.[rawType] || {};
            const thumbnail = contentObj.JPEGThumbnail || msg.message?.imageMessage?.jpegThumbnail || msg.message?.stickerMessage?.pngThumbnail;
            if (thumbnail && typeof thumbnail === "string" && thumbnail.length > 10) {
              console.log(`[Media] Using JPEGThumbnail fallback (${thumbnail.length} chars)`);
              try {
                const binaryStr = atob(thumbnail);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                if (validateMagicBytes(bytes, mediaType)) {
                  mediaBlob = new Blob([bytes], { type: "image/jpeg" });
                  isThumbnailFallback = true;
                } else {
                  console.log(`[Media] Thumbnail magic bytes invalid`);
                }
              } catch (thumbErr) {
                console.error("[Media] Thumbnail decode error:", thumbErr);
              }
            }
          }

          // === Upload validated media to Supabase Storage ===
          if (mediaBlob && mediaBlob.size > 0 && mediaBlob.size < 25 * 1024 * 1024) {
            const effectiveMime = mediaBlob.type || mediaMimetype || "application/octet-stream";
            const fallbackByType: Record<string, { ext: string; mime: string }> = {
              image: { ext: "jpg", mime: "image/jpeg" },
              sticker: { ext: "webp", mime: "image/webp" },
              audio: { ext: "ogg", mime: "audio/ogg" },
              ptt: { ext: "ogg", mime: "audio/ogg" },
              video: { ext: "mp4", mime: "video/mp4" },
              document: { ext: "bin", mime: "application/octet-stream" },
            };
            const fallback = fallbackByType[mediaType || ""] || { ext: "bin", mime: "application/octet-stream" };
            const ext = effectiveMime.includes("image/jpeg") ? "jpg"
              : effectiveMime.includes("image/png") ? "png"
              : effectiveMime.includes("image/webp") ? "webp"
              : effectiveMime.includes("image/gif") ? "gif"
              : effectiveMime.includes("audio/ogg") || effectiveMime.includes("audio/opus") || effectiveMime.includes("codecs=opus") ? "ogg"
              : effectiveMime.includes("audio/mp4") || effectiveMime.includes("audio/m4a") || effectiveMime.includes("audio/aac") ? "m4a"
              : effectiveMime.includes("audio/mpeg") ? "mp3"
              : effectiveMime.includes("video/mp4") ? "mp4"
              : effectiveMime.includes("application/pdf") ? "pdf"
              : fallback.ext;
            const cleanMime = effectiveMime.split(";")[0].trim();
            const uploadContentType = (cleanMime !== "application/octet-stream" && !cleanMime.includes("binary"))
              ? cleanMime : fallback.mime;

            const direction = fromMe ? "outgoing" : "incoming";
            const storageDir = isThumbnailFallback ? `thumbnails/${direction}` : direction;
            const filePath = `${storageDir}/${phoneNumber}/${Date.now()}-${msgId.substring(0, 8)}.${ext}`;
            const uploadBlob = new Blob([mediaBlob], { type: uploadContentType });
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("whatsapp-media")
              .upload(filePath, uploadBlob, { contentType: uploadContentType, upsert: true });

            if (!uploadError && uploadData) {
              const { data: signedData } = await supabase.storage.from("whatsapp-media").createSignedUrl(uploadData.path, 31536000);
              storedMediaUrl = signedData?.signedUrl || "";
              console.log(`Media stored, path: ${uploadData.path}`);
            } else {
              console.error("Media upload error:", uploadError);
              // FALLBACK: preserve original CDN URL so the message isn't saved with empty media_url
              if (mediaUrl && mediaUrl.startsWith("http")) {
                storedMediaUrl = mediaUrl;
                console.log(`[Media] Upload failed, preserving original CDN URL as fallback`);
              }
            }
          } else if (!mediaBlob) {
            // Media download failed — will be queued for async retry after message save (Task 4)
            console.log(`[Media] All download attempts failed for type=${mediaType}, msgId=${msgId}. Will queue for async retry.`);
          }
        } catch (mediaErr) {
          console.error("Media download/upload error:", mediaErr);
        }
      }

      const finalMediaUrl = storedMediaUrl || mediaUrl || "";

      // ===== UAZAPI CHAT =====
      // Try to find chat by chatJid first (real phone JID), then by remoteJid (may be LID)
      let existingChat: { id: string; contact_picture_url: string | null; enriched_at: string | null } | null = null;
      
      const { data: chatByJid } = await supabase
        .from("uazapi_chats")
        .select("id, contact_picture_url, enriched_at")
        .eq("instance_id", inst.id)
        .eq("chat_id", chatJid)
        .maybeSingle();
      existingChat = chatByJid;

      // If not found by chatJid, try remoteJid (for LID-based chats)
      if (!existingChat && remoteJid !== chatJid) {
        const { data: chatByRemote } = await supabase
          .from("uazapi_chats")
          .select("id, contact_picture_url, enriched_at")
          .eq("instance_id", inst.id)
          .eq("chat_id", remoteJid)
          .maybeSingle();
        existingChat = chatByRemote;
      }

      const isGroup = chatJid.includes("@g.us");
      // For groups, extract group name from payload (not the sender's pushName)
      const groupName = body.chat?.name || body.chat?.subject || body.groupMetadata?.subject || msg.pushName || 'Grupo ' + chatJid.split("@")[0];
      const chatContactName = isGroup
        ? (groupName || chatJid)
        : (fromMe ? null : (pushName || null));

      // ===== GROUP METADATA (Task 10) =====
      let groupSenderJid: string | null = null;
      let groupSenderName: string | null = null;
      let groupSenderPhone: string | null = null;
      if (isGroup) {
        groupSenderJid = msg.key?.participant || msg.participant || body.sender?.id || null;
        groupSenderName = msg.pushName || msg.senderName || body.sender?.pushName || null;
        groupSenderPhone = groupSenderJid ? groupSenderJid.replace(/@.*$/, "").replace(/\D/g, "") : null;
      }

      // Extract profile picture from webhook payload (temp WhatsApp CDN URLs)
      const contactPic = body.chat?.profilePictureUrl || body.chat?.imgUrl || body.chat?.imagePreview ||
                         body.sender?.profilePictureUrl || body.sender?.imgUrl ||
                         msg.profilePictureUrl || msg.imgUrl || null;

      let chatDbId = existingChat?.id;
      if (!chatDbId) {
        // Log debug for new contacts
        if (!isGroup) {
          Promise.resolve(supabase.from("ai_automation_logs").insert({
            status: "completed",
            trigger_data: {
              type: "webhook_contact_debug",
              chatJid, senderJid, pushName, phoneNumber, contactPic,
              sender: body.sender || null,
              chat: body.chat || null,
            },
            actions_executed: [{ action: "debug_new_contact", phone: phoneNumber }],
          })).catch(() => { /* ignore */ });
        }

        const { data: newChat } = await supabase
          .from("uazapi_chats")
          .insert({
            instance_id: inst.id,
            chat_id: chatJid,
            contact_phone: isGroup ? null : phoneNumber,
            contact_name: chatContactName,
            is_group: isGroup,
            // Don't save contactPic directly — it's a temporary WhatsApp URL
          })
          .select("id")
          .single();
        chatDbId = newChat?.id;

        // Fire-and-forget: enrich contact (fetches avatar + info)
        if (!isGroup && phoneNumber) {
          const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-sync-avatars`;
          fetch(enrichUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({ instance_id: inst.id, phone: phoneNumber, temp_url: contactPic }),
          }).catch((e) => console.error("Avatar sync fire-and-forget error:", e));
        }
      }

      if (!chatDbId) {
        console.error(JSON.stringify({
          level: 'error', fn: 'uazapi-webhook', step: 'chat_not_found',
          message: 'Failed to get/create chat — saving to dead_letter to prevent message loss',
          chatJid, phoneNumber: phoneNumber ? phoneNumber.slice(0, -4) + '****' : 'none',
          msgId, instance_id: inst.id
        }));
        // Salvar no dead_letter para não perder a mensagem
        await supabase.from("dead_letter_messages").insert({
          source: "uazapi-webhook",
          conversation_id: null,
          uazapi_message_id: msgId,
          payload: { chatJid, phoneNumber, fromMe, textBody, messageType, instanceId: inst.id },
          error_message: "chat_not_found: falha ao obter/criar uazapi_chat",
        }).catch((e: Error) => console.error("[uazapi-webhook] dead_letter insert failed:", e.message));
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === Enrich existing chats without photo (fire-and-forget) ===
      if (existingChat && !isGroup && phoneNumber && !existingChat.contact_picture_url) {
        const shouldEnrich = !existingChat.enriched_at ||
          (Date.now() - new Date(existingChat.enriched_at).getTime()) > 24 * 60 * 60 * 1000;
        if (shouldEnrich || contactPic) {
          // Use whatsapp-sync-avatars directly with temp_url for best results
          const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-sync-avatars`;
          fetch(syncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({ instance_id: inst.id, phone: phoneNumber, temp_url: contactPic }),
          }).catch((e) => console.error("Avatar sync existing chat error:", e));
        }
      }

      // Save UAZAPI message (upsert by message_id to avoid duplicates)
      const { data: uazapiMsgRow, error: uazapiMsgErr } = await supabase.from("uazapi_messages").upsert(
        {
          instance_id: inst.id,
          chat_id: chatDbId,
          message_id: msgId,
          from_me: fromMe,
          sender_phone: phoneNumber,
          sender_name: pushName || null,
          type: isReaction ? "reactionmessage" : messageType,
          text_body: isReaction ? reactionEmoji : (textBody || null),
          caption: caption || null,
          media_url: finalMediaUrl || null,
          media_mimetype: mediaMimetype,
          media_filename: mediaFilename,
          media_size: mediaSize,
          quoted_message_id: isReaction ? reactionTargetMsgId : quotedMsgId,
          status: fromMe ? "sent" : "received",
          timestamp,
        },
        { onConflict: "message_id" }
      ).select("id").maybeSingle();
      if (uazapiMsgErr) {
        console.error(JSON.stringify({
          level: 'error', fn: 'uazapi-webhook', step: 'uazapi_msg_upsert_failed',
          msgId, error: uazapiMsgErr.message, details: uazapiMsgErr.details,
        }));
      }
      const uazapiMsgDbId = uazapiMsgRow?.id || null;

      // For reactions, skip chat preview update and bridge — handle specially
      if (isReaction) {
        // Don't update chat preview for reactions, don't increment unread
        // Bridge reaction to ai_messages
        if (reactionTargetMsgId && reactionEmoji) {
          // Find the conversation linked to this chat
          let reactionConvId: string | null = null;
          const { data: convForReaction } = await supabase
            .from("ai_conversations")
            .select("id")
            .eq("uazapi_chat_id", chatJid)
            .in("status", ["aguardando", "em_atendimento"])
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          reactionConvId = convForReaction?.id || null;

          if (reactionConvId) {
            // Check if reaction already exists for this user on this target message
            const { data: existingReaction } = await supabase
              .from("ai_messages")
              .select("id")
              .eq("conversation_id", reactionConvId)
              .eq("reaction_to_message_id", reactionTargetMsgId)
              .eq("uazapi_message_id", msgId)
              .maybeSingle();

            if (!existingReaction) {
              await supabase.from("ai_messages").insert({
                conversation_id: reactionConvId,
                role: fromMe ? "agent" : "user",
                content: reactionEmoji,
                uazapi_message_id: msgId,
                reaction_to_message_id: reactionTargetMsgId,
                reaction_emoji: reactionEmoji,
                whatsapp_instance_id: inst?.id || null,
              });
              console.log(`Reaction bridged to ai_messages: ${reactionEmoji} -> ${reactionTargetMsgId}`);
            }
          }
        }
        return new Response(JSON.stringify({ ok: true, reaction: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update chat preview + real phone if discovered
      const chatUpdate: Record<string, unknown> = {
        last_message_preview: textBody || caption || `[${messageType}]`,
        last_message_time: timestamp,
        last_message_from_me: fromMe,
      };
      // For individual chats, update contact_name with sender's pushName
      // For groups, update contact_name with group name (not sender's name)
      if (isGroup) {
        if (groupName) chatUpdate.contact_name = groupName;
      } else {
        if (pushName && !fromMe) chatUpdate.contact_name = pushName;
        // Always use chatJid phone for individual chats to prevent overwriting with owner's phone
        const chatJidPhoneForUpdate = extractPhone(chatJid);
        if (/^\d{8,}/.test(chatJidPhoneForUpdate)) {
          chatUpdate.contact_phone = chatJidPhoneForUpdate;
        }
      }
      // Update profile picture if available and not already set
      if (contactPic) {
        chatUpdate.contact_picture_url = contactPic;
      }
      // Parallelize: chat update + unread/ignore check in one round-trip (saves ~1 sequential query)
      const [, { data: chatMetaForFlags }] = await Promise.all([
        supabase.from("uazapi_chats").update(chatUpdate).eq("id", chatDbId),
        supabase.from("uazapi_chats").select("unread_count, is_ignored").eq("id", chatDbId).single(),
      ]);

      // Increment unread for incoming (fire-and-forget, non-blocking)
      if (!fromMe && chatMetaForFlags) {
        supabase.from("uazapi_chats").update({ unread_count: (chatMetaForFlags.unread_count || 0) + 1 }).eq("id", chatDbId).then(() => {});
      }

      const chatIsIgnored = chatMetaForFlags?.is_ignored === true;

      // ===== BRIDGE TO ai_conversations & ai_messages =====
      // Bridge incoming messages AND outbound messages sent directly from WhatsApp (not via API)
      const wasSentByApi = msg.wasSentByApi === true;
      const shouldBridge = !fromMe || (fromMe && !wasSentByApi);

      if (chatIsIgnored) {
        console.log(`Skipping ignored chat ${chatDbId} (${chatJid})`);
      } else if (shouldBridge) {
        // Find or create ai_conversation linked to this chat
        // Try by chatJid first, then by remoteJid
        let existingConv: { id: string; current_agent_id: string | null; handler_type: string | null } | null = null;
        
        // Search by uazapi_chat_id with limit(1) to avoid maybeSingle() error when duplicates exist
        // IMPORTANT: Filter by whatsapp_instance_id to isolate conversations per instance
        const { data: convByJid } = await supabase
          .from("ai_conversations")
          .select("id, current_agent_id, handler_type")
          .eq("uazapi_chat_id", chatJid)
          .eq("whatsapp_instance_id", inst.id)
          .not("status", "in", '("finalizado","resolvido","cancelado")')
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existingConv = convByJid;

        if (!existingConv && remoteJid !== chatJid) {
          const { data: convByRemote } = await supabase
            .from("ai_conversations")
            .select("id, current_agent_id, handler_type")
            .eq("uazapi_chat_id", remoteJid)
            .eq("whatsapp_instance_id", inst.id)
            .not("status", "in", '("finalizado","resolvido","cancelado")')
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingConv = convByRemote;
        }

        // Fallback: search by customer_phone to avoid creating duplicate conversations
        // This catches cases where the same contact uses different JID formats
        // IMPORTANT: Filter by whatsapp_instance_id to allow same contact on different instances
        if (!existingConv && /^\d{8,}/.test(phoneNumber)) {
          const { data: convByPhone } = await supabase
            .from("ai_conversations")
            .select("id, current_agent_id, handler_type")
            .eq("customer_phone", phoneNumber)
            .eq("whatsapp_instance_id", inst.id)
            .not("status", "in", '("finalizado","resolvido","cancelado")')
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingConv = convByPhone;
          // Guard: don't hijack a conversation that already has a different contact's chatJid
          // Helper: extract phone digits from JID (strips @s.whatsapp.net, @c.us, etc.)
          const extractPhoneFromJid = (jid: string): string => jid.replace(/@.*$/, '').replace(/\D/g, '');

          if (existingConv) {
            const { data: existingFull } = await supabase
              .from("ai_conversations")
              .select("uazapi_chat_id")
              .eq("id", existingConv.id)
              .single();

            const existingPhone = existingFull?.uazapi_chat_id ? extractPhoneFromJid(existingFull.uazapi_chat_id) : '';
            const incomingPhone = phoneNumber.replace(/\D/g, '');

            if (existingFull?.uazapi_chat_id &&
                existingFull.uazapi_chat_id !== chatJid &&
                existingFull.uazapi_chat_id !== remoteJid &&
                existingPhone !== incomingPhone) {
              // Phones are truly different — this is a different contact, create new conversation
              console.log(`Phone match conv ${existingConv.id} has different contact: existing JID phone ${existingPhone} vs incoming ${incomingPhone}, creating new conversation`);
              existingConv = null;
            } else if (existingFull?.uazapi_chat_id &&
                existingFull.uazapi_chat_id !== chatJid &&
                existingPhone === incomingPhone) {
              // Same phone, different JID format — reuse conversation and update JID
              console.log(`Same phone ${incomingPhone}, updating JID from ${existingFull.uazapi_chat_id} to ${chatJid} on conv ${existingConv.id}`);
            } else {
              await supabase.from("ai_conversations").update({ uazapi_chat_id: chatJid }).eq("id", existingConv.id);
              console.log(`Linked existing conv ${existingConv.id} to chatJid ${chatJid} via phone ${phoneNumber ? phoneNumber.slice(0, -4) + '****' : 'unknown'}`);
            }
          }
        }

        let conversationId = existingConv?.id;

        // ===== GRACE PERIOD v2: duas janelas + 3 saídas LLM =====
        if (!conversationId && !fromMe && !isGroup) {
          // Busca stages com status_type = 'resolvido' para não hardcodar status
          const { data: resolvedStageIds } = await supabase
            .from("kanban_stages")
            .select("id")
            .eq("status_type", "resolvido");

          const resolvedIds = (resolvedStageIds || []).map((s: { id: string }) => s.id);
          const hardcodedStatuses = ["finalizado", "resolvido", "aguardando_cliente"];

          const stageFilter = resolvedIds.length
            ? `,stage_id.in.(${resolvedIds.join(",")})`
            : "";

          const { data: recentClosed } = await supabase
            .from("ai_conversations")
            .select("id, status, resolved_at, csat_sent_at, csat_responded_at, reopen_count, ticket_subject, problem_summary")
            .eq("whatsapp_instance_id", inst.id)
            .or(`uazapi_chat_id.eq.${chatJid},customer_phone.eq.${phoneNumber}`)
            .or(
              `status.in.(${hardcodedStatuses.join(",")})${stageFilter}`
            )
            .order("resolved_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          if (recentClosed) {
            // Lê configuração do grace period
            let absorbMinutes = 5;
            let smartMinutes = 30;
            let smartClassifyEnabled = true;

            const { data: graceConfigs } = await supabase
              .from("platform_ai_config")
              .select("feature, extra_config")
              .in("feature", ["grace_period_config", "post_close_grace_minutes", "suppress_post_close_tickets"]);

            const hasNewConfig = (graceConfigs || []).some(c => c.feature === "grace_period_config");

            for (const cfg of graceConfigs || []) {
              const ec = cfg.extra_config as Record<string, unknown> | null;
              if (cfg.feature === "grace_period_config" && ec) {
                absorbMinutes = Number(ec.absorb_minutes ?? 5);
                smartMinutes = Number(ec.smart_minutes ?? 30);
                smartClassifyEnabled = ec.smart_classify_enabled !== false;
              }
              if (!hasNewConfig) {
                if (cfg.feature === "post_close_grace_minutes" && ec && "minutes" in ec) {
                  smartMinutes = Number(ec.minutes) || 30;
                }
                if (cfg.feature === "suppress_post_close_tickets" && ec) {
                  smartClassifyEnabled = !!(ec.smart_classify ?? true);
                }
              }
            }

            const closedAt = recentClosed.resolved_at || recentClosed.csat_sent_at;
            const closedMs = closedAt ? Date.now() - new Date(closedAt).getTime() : Infinity;
            const withinAbsorb = closedMs < absorbMinutes * 60 * 1000;
            const withinSmart = closedMs < smartMinutes * 60 * 1000;

            // ── JANELA CURTA: absorção por regex (sem LLM) ──
            if (withinAbsorb) {
              const normalizedText = (textBody || "").trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

              const isDismissable =
                !normalizedText ||
                /^(ok|okay|oks?|ta|tá|sim|nao|não|beleza|blz|certo|entendi|perfeito|show|massa|top|valeu|vlw|flw|falou|tmj|obg|obrigad[oa]s?|brigad[oa]s?|thanks?|thank\s*you|ty|thx|de\s*nada|👍|🙏|❤️?|😊|😁|😀|✅|💚|👏|🤝|💪|🫡|😘|🥰|☺️?|😃|😄|👌|🔝|✌️?)$/i.test(normalizedText) ||
                /^(muito\s+)?obrigad[oa]/.test(normalizedText) ||
                /^valeu\s+(pela|por|de)/.test(normalizedText) ||
                /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]{1,15}$/u.test(normalizedText);

              const looksLikeCSAT = /^(csat_\d{1,2}|\d{1,2}\s*⭐?|[1-9]|10)$/i.test(normalizedText);
              const awaitingCSAT = recentClosed.csat_sent_at && !recentClosed.csat_responded_at;

              if (isDismissable || looksLikeCSAT) {
                await supabase.from("ai_messages").insert({
                  conversation_id: recentClosed.id,
                  role: "user",
                  content: textBody || `[${messageType}]`,
                  uazapi_message_id: msgId,
                  media_url: finalMediaUrl || null,
                  media_type: mediaType,
                  whatsapp_instance_id: inst?.id || null,
                });

                if (awaitingCSAT && looksLikeCSAT) {
                  conversationId = recentClosed.id;
                  existingConv = { id: recentClosed.id, current_agent_id: null, handler_type: null };
                } else {
                  console.log(`[Grace Absorb] dismissed "${(textBody || "").slice(0, 30)}" — conv ${recentClosed.id}`);
                  return new Response(JSON.stringify({ ok: true, grace_period: true, dismissed: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }
              // Se não é dismissable na janela curta, cai para janela longa
            }

            // ── JANELA LONGA: LLM com 3 saídas ──
            if (!conversationId && withinSmart && smartClassifyEnabled) {
              const messageForClassify = (textBody || "").trim();

              if (messageForClassify && messageForClassify.length <= 500) {
                // Lock otimista: verifica se mensagem já foi processada
                if (msgId) {
                  const { data: alreadyProcessed } = await supabase
                    .from("ai_messages")
                    .select("id")
                    .eq("uazapi_message_id", msgId)
                    .maybeSingle();
                  if (alreadyProcessed) {
                    console.log(`[Grace Smart] msgId ${msgId} já processado, skipping`);
                    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
                      headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                  }
                }

                let graceClassification: "dismiss" | "same_subject" | "new_subject" = "new_subject";

                try {
                  const classifyApiKey = Deno.env.get("OPENROUTER_API_KEY");
                  if (classifyApiKey) {
                    const ticketSubject = ((recentClosed as any).ticket_subject || "").replace(/["\n\r]/g, " ").slice(0, 100);
                    const problemSummary = ((recentClosed as any).problem_summary || "").replace(/["\n\r]/g, " ").slice(0, 200);

                    const classifyRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${classifyApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "https://sismais.com",
                        "X-Title": "Sismais Grace Period Classifier",
                      },
                      body: JSON.stringify({
                        model: "google/gemini-3.1-flash-lite-preview",
                        max_tokens: 20,
                        temperature: 0,
                        messages: [
                          {
                            role: "system",
                            content: `Você classifica mensagens de WhatsApp enviadas após o encerramento de um ticket de suporte.

Contexto do ticket encerrado:
- Assunto: "${ticketSubject}"
- Problema: "${problemSummary}"

Responda APENAS com uma palavra:
- "dismiss"       → agradecimento, confirmação, despedida, resposta CSAT, emoji, ou qualquer coisa que não seja novo problema
- "same_subject"  → novo problema, mas RELACIONADO ao mesmo assunto/módulo do ticket encerrado
- "new_subject"   → problema COMPLETAMENTE DIFERENTE do ticket encerrado

Exemplos de dismiss: "ok obrigado", "valeu resolveu", "show", "nota 5", "8"
Exemplos de same_subject: "voltou o mesmo erro", "ainda não funciona o login", "continua dando o mesmo problema"
Exemplos de new_subject: "agora a nota fiscal não sai", "preciso cancelar meu plano", "meu boleto não chegou"`,
                          },
                          {
                            role: "user",
                            content: `Mensagem enviada ${Math.round(closedMs / 1000)}s após encerramento: "${messageForClassify}"`,
                          },
                        ],
                      }),
                      signal: AbortSignal.timeout(5000),
                    });

                    if (classifyRes.ok) {
                      const classifyData = await classifyRes.json();
                      const answer = (classifyData?.choices?.[0]?.message?.content || "").trim().toLowerCase();
                      if (answer.includes("dismiss")) graceClassification = "dismiss";
                      else if (answer.includes("same_subject")) graceClassification = "same_subject";
                      else graceClassification = "new_subject";
                      console.log(`[Grace Smart] "${messageForClassify.slice(0, 50)}" → ${graceClassification}`);
                    }
                  }
                } catch (classifyErr) {
                  console.warn("[Grace Smart] classify failed, defaulting to new_subject:", classifyErr);
                }

                // Insere mensagem antes de qualquer roteamento
                await supabase.from("ai_messages").insert({
                  conversation_id: recentClosed.id,
                  role: "user",
                  content: textBody || `[${messageType}]`,
                  uazapi_message_id: msgId,
                  media_url: finalMediaUrl || null,
                  media_type: mediaType,
                  whatsapp_instance_id: inst?.id || null,
                });

                if (graceClassification === "dismiss") {
                  console.log(`[Grace Smart] dismissed "${messageForClassify.slice(0, 50)}" — conv ${recentClosed.id}`);
                  return new Response(JSON.stringify({ ok: true, grace_period: true, ai_dismissed: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                } else if (graceClassification === "same_subject") {
                  // Reabre o ticket existente
                  console.log(`[Grace Smart] same_subject — reopening conv ${recentClosed.id}`);
                  await supabase.from("ai_conversations").update({
                    status: "em_atendimento",
                    handler_type: null,
                    reopen_count: ((recentClosed as any).reopen_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                  }).eq("id", recentClosed.id);

                  conversationId = recentClosed.id;
                  existingConv = { id: recentClosed.id, current_agent_id: null, handler_type: null };
                } else {
                  // new_subject: cria novo ticket — passa parent_ticket_id para uso abaixo
                  console.log(`[Grace Smart] new_subject — new ticket with parent_ticket_id=${recentClosed.id}`);
                  ;(req as any)._gracePeriodParentTicketId = recentClosed.id;
                }
              }
            } else if (!conversationId && withinSmart && !smartClassifyEnabled) {
              // Smart classify desabilitado: reabre diretamente
              await supabase.from("ai_conversations").update({
                status: "em_atendimento",
                handler_type: null,
                reopen_count: ((recentClosed as any).reopen_count || 0) + 1,
                updated_at: new Date().toISOString(),
              }).eq("id", recentClosed.id);

              await supabase.from("ai_messages").insert({
                conversation_id: recentClosed.id,
                role: "user",
                content: textBody || `[${messageType}]`,
                uazapi_message_id: msgId,
                media_url: finalMediaUrl || null,
                media_type: mediaType,
                whatsapp_instance_id: inst?.id || null,
              });

              conversationId = recentClosed.id;
              existingConv = { id: recentClosed.id, current_agent_id: null, handler_type: null };
            }
          }
        }
        // ===== FIM GRACE PERIOD v2 =====

        if (!conversationId) {
          // Buscar board padrão e etapa de entrada para novos atendimentos
          let defaultBoardId: string | null = null;
          let defaultStageId: string | null = null;
          let initialStatus = "em_atendimento";

          try {
            // 0. Prioridade: usar kanban_board_id da instância WhatsApp
            if (inst?.kanban_board_id) {
              defaultBoardId = inst.kanban_board_id;
              console.log(`Using instance kanban_board_id: ${defaultBoardId}`);
            }

            // 1. Fallback: Buscar configurações de board/etapa da platform_ai_config
            if (!defaultBoardId) {
              const { data: boardConfig } = await supabase
                .from("platform_ai_config")
                .select("enabled")
                .eq("feature", "default_board_id")
                .maybeSingle();
              const { data: stageConfig } = await supabase
                .from("platform_ai_config")
                .select("enabled")
                .eq("feature", "default_stage_id")
                .maybeSingle();

              const configBoardId = boardConfig?.enabled;
              const configStageId = stageConfig?.enabled;

              if (typeof configBoardId === "string" && configBoardId) {
                defaultBoardId = configBoardId;
                if (typeof configStageId === "string" && configStageId) {
                  defaultStageId = configStageId;
                }
              }
            }

            // 2. Fallback: buscar board com is_default = true
            if (!defaultBoardId) {
              const { data: defaultBoard } = await supabase
                .from("kanban_boards")
                .select("id")
                .eq("is_default", true)
                .eq("active", true)
                .limit(1)
                .maybeSingle();
              if (defaultBoard) defaultBoardId = defaultBoard.id;
            }

            // 3. Buscar etapa de entrada do board
            if (defaultBoardId && !defaultStageId) {
              const { data: entryStage } = await supabase
                .from("kanban_stages")
                .select("id, status_type")
                .eq("board_id", defaultBoardId)
                .eq("is_entry", true)
                .eq("active", true)
                .limit(1)
                .maybeSingle();
              if (entryStage) {
                defaultStageId = entryStage.id;
                initialStatus = entryStage.status_type || "aguardando";
              }
            } else if (defaultStageId) {
              // Buscar o status_type da etapa configurada
              const { data: stage } = await supabase
                .from("kanban_stages")
                .select("status_type")
                .eq("id", defaultStageId)
                .maybeSingle();
              if (stage) initialStatus = stage.status_type || "aguardando";
            }

            console.log(`New conv: board=${defaultBoardId}, stage=${defaultStageId}, status=${initialStatus}`);
          } catch (e) {
            console.error("Error fetching default board/stage:", e);
          }

          // === DEDUPLICATION: Re-check for existing conversation right before insert ===
          // This prevents race conditions when multiple webhook events arrive simultaneously
          // IMPORTANT: Filter by whatsapp_instance_id to isolate per instance
          if (/^\d{8,}/.test(phoneNumber)) {
            const { data: raceCheckConv } = await supabase
              .from("ai_conversations")
              .select("id, current_agent_id, handler_type")
              .eq("customer_phone", phoneNumber)
              .eq("whatsapp_instance_id", inst.id)
              .not("status", "in", '("finalizado","resolvido","cancelado")')
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (raceCheckConv) {
              console.log(`[uazapi-webhook] Race condition avoided: found existing conv ${raceCheckConv.id} for phone ${phoneNumber ? phoneNumber.slice(0, -4) + '****' : 'unknown'}`);
              existingConv = raceCheckConv;
              conversationId = raceCheckConv.id;
              // Update uazapi_chat_id if needed
              await supabase.from("ai_conversations").update({ uazapi_chat_id: chatJid }).eq("id", raceCheckConv.id);
            }
          }

          if (!conversationId) {
          const convInsertPayload = {
              customer_phone: isGroup ? chatJid : phoneNumber,
              customer_name: isGroup
                ? (groupName || chatJid)
                : (fromMe ? phoneNumber : (pushName || phoneNumber)),
              uazapi_chat_id: chatJid,
              communication_channel: "whatsapp",
              status: isGroup ? "aguardando" : initialStatus,
              handler_type: isGroup ? "human" : (fromMe ? "human" : "ai"),
              whatsapp_instance_id: inst.id,
              ...(defaultBoardId ? { kanban_board_id: defaultBoardId } : {}),
              ...(defaultStageId ? { kanban_stage_id: defaultStageId, stage_id: defaultStageId } : {}),
              // Group metadata (Task 10)
              ...(isGroup ? { is_group: true, group_name: groupName, group_jid: chatJid } : {}),
              parent_ticket_id: (req as any)._gracePeriodParentTicketId || null,
            };
          console.log("[uazapi-webhook] Creating new conversation:", JSON.stringify(convInsertPayload));
          const { data: newConv, error: convInsertError } = await supabase
            .from("ai_conversations")
            .insert(convInsertPayload)
            .select("id")
            .single();
          if (convInsertError) {
            console.error("[uazapi-webhook] ERROR creating conversation:", JSON.stringify(convInsertError));
            // Retry once on conversation creation failure
            const { data: retryConv, error: retryError } = await supabase
              .from("ai_conversations")
              .insert(convInsertPayload)
              .select("id")
              .single();
            if (retryError) {
              console.error("[uazapi-webhook] RETRY also failed:", JSON.stringify(retryError));
            }
            conversationId = retryConv?.id;
          } else {
            conversationId = newConv?.id;
          }
          console.log("[uazapi-webhook] Conversation created:", conversationId || "FAILED");

          // Auto-link client (fire and forget)
          if (conversationId && phoneNumber && !fromMe && !isGroup) {
            supabase.functions.invoke('sismais-client-auto-link', {
              body: { conversation_id: conversationId, customer_phone: phoneNumber, whatsapp_instance_id: inst?.id || null }
            }).catch(err => console.error('[uazapi-webhook] Auto-link error:', err));

            // Classify ticket priority (fire and forget — must not block webhook response)
            supabase.functions.invoke('ticket-priority-classifier', {
              body: { conversation_id: conversationId, message_content: textBody || '' }
            }).catch(err => console.error('[uazapi-webhook] Priority classifier error:', err));

            // Classify ticket category (fire and forget)
            supabase.functions.invoke('ticket-category-classifier', {
              body: { conversation_id: conversationId, message_content: textBody || '' }
            }).catch(err => console.error('[uazapi-webhook] Category classifier error:', err));
          }
          }
        } else {
          // Update with real phone if needed
          if (/^\d{8,}/.test(phoneNumber) && !fromMe) {
            const convUpdate: Record<string, unknown> = {
              customer_phone: phoneNumber,
              customer_name: pushName || undefined,
            };
            // Update group metadata on existing conversations (Task 10)
            if (isGroup) {
              convUpdate.is_group = true;
              convUpdate.group_jid = chatJid;
              if (groupName) convUpdate.group_name = groupName;
            }
            await supabase.from("ai_conversations").update(convUpdate).eq("id", conversationId);
          } else if (isGroup && conversationId) {
            // Update group metadata even if phone doesn't need updating
            const groupUpdate: Record<string, unknown> = { is_group: true, group_jid: chatJid };
            if (groupName) groupUpdate.group_name = groupName;
            await supabase.from("ai_conversations").update(groupUpdate).eq("id", conversationId);
          }
        }

        if (conversationId) {
          // Check for duplicate: skip if ai_message with same uazapi_message_id exists
          const { data: existingMsg } = await supabase
            .from("ai_messages")
            .select("id")
            .eq("uazapi_message_id", msgId)
            .maybeSingle();

          let csatConvPreCheck: any = null;
          if (!existingMsg) {
            // For fromMe messages sent directly from WhatsApp, use role "agent"
            // For incoming messages, use role "user"
            const messageRole = fromMe ? "agent" : "user";

            // If this message quotes another, try to resolve quoted content from DB
            let resolvedQuotedContent = quotedContent;
            let resolvedQuotedSenderName = quotedSenderName;
            if (quotedMsgId && !resolvedQuotedContent) {
              // Lookup quoted message in uazapi_messages
              const { data: quotedMsg } = await supabase
                .from("uazapi_messages")
                .select("text_body, sender_name, sender_phone")
                .eq("message_id", quotedMsgId)
                .maybeSingle();
              if (quotedMsg) {
                resolvedQuotedContent = quotedMsg.text_body || null;
                resolvedQuotedSenderName = quotedMsg.sender_name || quotedMsg.sender_phone || resolvedQuotedSenderName;
              }
            }

            // ===== PRE-FETCH CSAT STATE before inserting message =====
            // Must happen BEFORE insert to avoid race condition with DB triggers
            const { data: csatData } = await supabase
              .from("ai_conversations")
              .select("id, status, started_at, human_started_at, uazapi_chat_id, csat_sent_at, csat_responded_at")
              .eq("id", conversationId)
              .in("status", ["aguardando_cliente", "finalizado"])
              .not("csat_sent_at", "is", null)
              .is("csat_responded_at", null)
              .maybeSingle();
            csatConvPreCheck = csatData;

            let { data: insertedMsg, error: insertMsgError } = await supabase.from("ai_messages").insert({
              conversation_id: conversationId,
              role: messageRole,
              content: textBody || `[${messageType}]`,
              uazapi_message_id: msgId,
              media_url: finalMediaUrl || null,
              media_type: mediaType,
              delivery_status: fromMe ? "sent" : null,
              quoted_message_id: quotedMsgId || null,
              quoted_content: resolvedQuotedContent || null,
              quoted_sender_name: resolvedQuotedSenderName || null,
              whatsapp_instance_id: inst?.id || null,
              // Group sender metadata (Task 10)
              ...(isGroup && groupSenderName ? { sender_name: groupSenderName } : {}),
              ...(isGroup && groupSenderPhone ? { sender_phone: groupSenderPhone } : {}),
            }).select("id").single();
            if (insertMsgError) {
              console.error("[uazapi-webhook] ERROR inserting ai_message:", JSON.stringify(insertMsgError));
              // Retry 1 (após 500ms)
              await new Promise(r => setTimeout(r, 500));
              const { data: retryMsg, error: retryMsgErr } = await supabase
                .from("ai_messages")
                .insert({
                  conversation_id: conversationId,
                  role: messageRole,
                  content: textBody || `[${messageType}]`,
                  uazapi_message_id: msgId,
                  media_url: finalMediaUrl || null,
                  media_type: mediaType,
                  delivery_status: fromMe ? "sent" : null,
                  quoted_message_id: quotedMsgId || null,
                  quoted_content: resolvedQuotedContent || null,
                  quoted_sender_name: resolvedQuotedSenderName || null,
                  whatsapp_instance_id: inst?.id || null,
                  ...(isGroup && groupSenderName ? { sender_name: groupSenderName } : {}),
                  ...(isGroup && groupSenderPhone ? { sender_phone: groupSenderPhone } : {}),
                }).select("id").single();
              if (retryMsgErr) {
                console.error("[uazapi-webhook] ai_message RETRY 1 failed:", JSON.stringify(retryMsgErr));
                // Retry 2 (após 1000ms)
                await new Promise(r => setTimeout(r, 1000));
                const { data: retry2Msg, error: retry2Err } = await supabase
                  .from("ai_messages")
                  .insert({
                    conversation_id: conversationId,
                    role: messageRole,
                    content: textBody || `[${messageType}]`,
                    uazapi_message_id: msgId,
                    media_url: finalMediaUrl || null,
                    media_type: mediaType,
                    delivery_status: fromMe ? "sent" : null,
                    whatsapp_instance_id: inst?.id || null,
                  }).select("id").single();
                if (retry2Err) {
                  console.error("[uazapi-webhook] CRITICAL: ai_message all retries failed, saving to dead-letter");
                  await supabase.from("dead_letter_messages").insert({
                    source: "uazapi-webhook",
                    conversation_id: conversationId,
                    uazapi_message_id: msgId,
                    payload: { role: messageRole, content: textBody || `[${messageType}]`, media_url: finalMediaUrl, media_type: mediaType },
                    error_message: `${retry2Err.message}: ${retry2Err.details || ""}`,
                  }).catch((dlErr: any) => console.error("[uazapi-webhook] Dead-letter insert failed:", dlErr));
                } else {
                  insertedMsg = retry2Msg;
                }
              } else {
                insertedMsg = retryMsg;
              }
            }

            // ===== ATUALIZAR last_customer_message_at =====
            // Garante que conversas com novas mensagens do cliente sobem no inbox
            if (!fromMe && conversationId) {
              supabase.from("ai_conversations")
                .update({ last_customer_message_at: timestamp })
                .eq("id", conversationId)
                .then(({ error }) => {
                  if (error) console.error("[uazapi-webhook] last_customer_message_at update failed:", error.message);
                });
            }

            // ===== MEDIA DOWNLOAD QUEUE (Task 4) =====
            // If media download failed during synchronous attempt, queue for async retry
            if (mediaType && !storedMediaUrl && insertedMsg?.id) {
              const contentObj = msg.content || msg.message?.[rawType] || {};
              const mediaKeyForQueue = contentObj.mediaKey || contentObj.MediaKey || null;
              console.log(`[Media Queue] Inserting into media_download_queue for msgId=${msgId}, type=${mediaType}`);
              await supabase.from("media_download_queue").insert({
                message_id: msgId,
                instance_id: inst.id,
                ai_message_id: insertedMsg.id,
                uazapi_message_db_id: uazapiMsgDbId,
                conversation_id: conversationId,
                media_url_source: mediaUrl || "",
                media_key: mediaKeyForQueue || null,
                media_type: mediaType,
                mimetype: mediaMimetype || null,
                status: "pending",
              });

              // Fire-and-forget: trigger media-worker
              fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/media-worker`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
              }).catch(() => {});
            }

            // ===== ASYNC TRANSCRIPTION for audio/image/ptt messages (incoming AND outgoing) =====
            const transcriptionUrl = storedMediaUrl
              || (mediaUrl && mediaUrl.startsWith("http") ? mediaUrl : "")
              || (finalMediaUrl && finalMediaUrl.startsWith("http") ? finalMediaUrl : "");
            if (transcriptionUrl && (mediaType === "audio" || mediaType === "ptt" || mediaType === "image" || mediaType === "video")) {
              console.log(`[webhook] Triggering transcription for ${mediaType} message (msgId=${msgId}), using=${storedMediaUrl ? 'stored' : (mediaUrl ? 'cdn-raw' : 'final-fallback')}`);
              supabase.functions.invoke("transcribe-media", {
                body: {
                  conversation_id: conversationId,
                  message_id: insertedMsg?.id || null,
                  media_url: transcriptionUrl,
                  media_type: mediaType,
                },
              }).catch((err: unknown) => console.error("[transcription] invoke failed:", err));
            } else if (!transcriptionUrl && (mediaType === "audio" || mediaType === "ptt" || mediaType === "image" || mediaType === "video")) {
              // Mark message as transcription-failed so the UI can show retry button
              console.warn(`[webhook] No media URL available for transcription of ${mediaType} message (msgId=${msgId})`);
              if (insertedMsg?.id) {
                await supabase.from("ai_messages").update({
                  content: mediaType === "image" ? "[Imagem - processamento falhou]" : mediaType === "video" ? "[Vídeo - transcrição falhou]" : "[Áudio - transcrição falhou]",
                }).eq("id", insertedMsg.id);
              }
            }

            // Update conversation counts
            const countField = fromMe ? "ai_messages_count" : "human_messages_count";
            const { data: convData } = await supabase
              .from("ai_conversations")
              .select(countField)
              .eq("id", conversationId)
              .single();
            if (convData) {
              await supabase.from("ai_conversations").update({
                [countField]: ((convData as Record<string, number>)[countField] || 0) + 1,
              }).eq("id", conversationId);
            }
          }

          // ===== CSAT RESPONSE HANDLING =====
          // Use pre-fetched CSAT state (queried BEFORE message insert to avoid trigger race condition)
          const csatConv = csatConvPreCheck;

          if (csatConv && !fromMe && textBody) {
            // Check for CSAT rating: look for number 1-10 in text or list response ID (csat_1 to csat_10)
            let csatRating: number | null = null;
            
            // Check list selection IDs (csat_1, csat_2, etc.)
            const listMatch = textBody.match(/csat_(\d{1,2})/i);
            if (listMatch) {
              csatRating = parseInt(listMatch[1]);
            }
            
            // Check plain number response
            if (!csatRating) {
              const numMatch = textBody.trim().match(/^(\d{1,2})$/);
              if (numMatch) {
                const num = parseInt(numMatch[1]);
                if (num >= 1 && num <= 10) csatRating = num;
              }
            }

            // Check for star emoji patterns like "1 ⭐"
            if (!csatRating) {
              const starMatch = textBody.match(/(\d{1,2})\s*⭐/);
              if (starMatch) {
                const num = parseInt(starMatch[1]);
                if (num >= 1 && num <= 10) csatRating = num;
              }
            }

            if (csatRating && csatRating >= 1 && csatRating <= 10) {
              console.log(`CSAT rating received: ${csatRating} for conversation ${conversationId}`);

              // Save rating + csat_score (1-5) + csat_responded_at
              const csatUpdate: Record<string, unknown> = {
                csat_rating: csatRating,
                rated_at: new Date().toISOString(),
                csat_responded_at: new Date().toISOString(),
              };
              if (csatRating >= 1 && csatRating <= 5) {
                csatUpdate.csat_score = csatRating;
              }
              await supabase.from("ai_conversations").update(csatUpdate).eq("id", conversationId);

              // Send appropriate follow-up via WhatsApp
              const apiUrl = inst.api_url.replace(/\/$/, "");

              if (csatRating <= 3) {
                // Low score: ask for feedback, keep conversation active
                const feedbackMsg = `😔 Lamentamos que sua experiência não tenha sido satisfatória (nota ${csatRating}/10).\n\nPoderia nos dizer o que podemos melhorar? Sua resposta é muito importante para aprimorarmos nosso atendimento.\n\n_Um atendente irá acompanhar seu feedback._`;

                await fetch(`${apiUrl}/send/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token: inst.api_token },
                  body: JSON.stringify({ number: chatJid, text: feedbackMsg }),
                });

                // Save follow-up message
                await supabase.from("ai_messages").insert({
                  conversation_id: conversationId,
                  role: "assistant",
                  content: feedbackMsg,
                  whatsapp_instance_id: inst?.id || null,
                });

                // Reopen conversation for agent follow-up
                await supabase.from("ai_conversations").update({
                  status: "em_atendimento",
                  handler_type: "human",
                }).eq("id", conversationId);

                console.log(`Low CSAT (${csatRating}): conversation ${conversationId} reopened for agent follow-up`);
              } else {
                // Score 4-10: thank and close
                const thankMsg = csatRating >= 8
                  ? `🎉 Muito obrigado pela avaliação nota ${csatRating}/10! Ficamos muito felizes que você tenha tido uma ótima experiência. Estamos sempre à disposição! 💚`
                  : `😊 Obrigado pela sua avaliação (nota ${csatRating}/10)! Agradecemos seu feedback e estamos sempre buscando melhorar. Até a próxima! 💚`;

                await fetch(`${apiUrl}/send/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token: inst.api_token },
                  body: JSON.stringify({ number: chatJid, text: thankMsg }),
                });

                // Save thank you message
                await supabase.from("ai_messages").insert({
                  conversation_id: conversationId,
                  role: "assistant",
                  content: thankMsg,
                  whatsapp_instance_id: inst?.id || null,
                });

                // Close the conversation with proper resolution times
                const nowMs = Date.now();
                const resolutionTime = csatConv.started_at
                  ? Math.round((nowMs - new Date(csatConv.started_at).getTime()) / 1000)
                  : null;
                const resolutionSeconds = csatConv.human_started_at
                  ? Math.round((nowMs - new Date(csatConv.human_started_at).getTime()) / 1000)
                  : resolutionTime;

                await supabase.from("ai_conversations").update({
                  status: "finalizado",
                  resolved_at: new Date().toISOString(),
                  resolution_time_seconds: resolutionTime,
                  resolution_seconds: resolutionSeconds,
                }).eq("id", conversationId);

                // Avaliar qualidade do atendimento via IA (fire-and-forget)
                supabase.functions.invoke("evaluate-service", {
                  body: { conversation_id: conversationId },
                }).catch(() => {});

                console.log(`CSAT ${csatRating}: conversation ${conversationId} closed with thanks`);
              }

              // Skip AI auto-reply for CSAT conversations
              return new Response(JSON.stringify({ ok: true, csat: csatRating }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            } else if (!fromMe) {
              // If awaiting_csat but response is not a valid rating, treat as feedback for low rating
              const { data: ratedConv } = await supabase
                .from("ai_conversations")
                .select("csat_rating, csat_feedback")
                .eq("id", conversationId)
                .single();

              if (ratedConv?.csat_rating && ratedConv.csat_rating <= 3 && !ratedConv.csat_feedback) {
                // Save as CSAT feedback + csat_comment
                await supabase.from("ai_conversations").update({
                  csat_feedback: textBody,
                  csat_comment: textBody,
                  status: "em_atendimento",
                  handler_type: "human",
                }).eq("id", conversationId);

                const ackMsg = "✅ Agradecemos muito pelo seu feedback! Um atendente irá analisar sua sugestão. Até breve!";
                const apiUrl2 = inst.api_url.replace(/\/$/, "");
                await fetch(`${apiUrl2}/send/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token: inst.api_token },
                  body: JSON.stringify({ number: chatJid, text: ackMsg }),
                });

                await supabase.from("ai_messages").insert({
                  conversation_id: conversationId,
                  role: "assistant",
                  content: ackMsg,
                  whatsapp_instance_id: inst?.id || null,
                });
              }
            }
          }

          // Trigger AI auto-reply ONLY for incoming text messages when handler is AI
          const aiReplyConditions = {
            fromMe, textBody: !!textBody, messageType, 
            handlerType: existingConv?.handler_type || "ai",
            existingMsg: !!existingMsg,
            csatConvStatus: csatConv?.status,
            conversationId,
          };
          console.log("[uazapi-webhook] AI auto-reply conditions:", JSON.stringify(aiReplyConditions));
          // TEST MODE: check if AI should be blocked for this phone
          let testModeBlocked = false;
          if (inst?.id && phoneNumber && !fromMe) {
            const { data: tmConfig } = await supabase.from("uazapi_instances").select("test_mode, test_phone_number").eq("id", inst.id).single();
            if (tmConfig?.test_mode === true && tmConfig?.test_phone_number) {
              const tp = tmConfig.test_phone_number.replace(/\D/g, "");
              const mp = phoneNumber.replace(/\D/g, "");
              if (mp && !mp.includes(tp) && !tp.includes(mp)) {
                testModeBlocked = true;
                console.log(`[uazapi-webhook] TEST MODE: AI blocked for ${mp ? mp.slice(0, -4) + '****' : 'unknown'} (test phone: ${tp ? tp.slice(0, -4) + '****' : 'unknown'}). Message was saved normally.`);
              }
            }
          }

          // Trigger AI reply for text AND media messages (audio/ptt/image)
          // For media messages, use placeholder text if textBody is empty
          const isMediaMessage = ["audio", "ptt", "image", "video"].includes(messageType);
          const aiReplyText = textBody || (isMediaMessage ? `[${messageType === "ptt" ? "Áudio" : messageType === "audio" ? "Áudio" : messageType === "video" ? "Vídeo" : "Imagem"}]` : "");
          const shouldTriggerAI = !fromMe && !isGroup && (textBody || isMediaMessage) && ["text", "audio", "ptt", "image", "video"].includes(messageType) && (existingConv?.handler_type || "ai") === "ai" && !existingMsg && (!csatConv || csatConv.status !== "aguardando_cliente") && !testModeBlocked;

          // Log de condições para trigger IA (apenas mensagens incoming que não disparam)
          if (!fromMe && !isGroup && !shouldTriggerAI) {
            console.log(`[uazapi-webhook] AI skipped: handler=${existingConv?.handler_type ?? "null"} dup=${!!existingMsg} csat=${csatConv?.status ?? "none"} test=${testModeBlocked} conv=${conversationId}`);
          }

          // Metricas: registrar mensagem recebida
          trackMetric(supabase, {
            edge_function: 'uazapi-webhook',
            event_type: 'message_received',
            request_id: _requestId,
            conversation_id: conversationId,
            latency_ms: Date.now() - _webhookStartMs,
            metadata: { message_type: messageType, from_me: fromMe, should_trigger_ai: shouldTriggerAI },
          });

          // --- CSAT Survey Response Interception ---
          // Intercepts responses to csat_surveys table BEFORE handing off to orchestrator
          if (!fromMe && textBody) {
            try {
              const { data: pendingSurvey } = await supabase
                .from('csat_surveys')
                .select('*, config:csat_board_configs(*)')
                .eq('customer_phone', phoneNumber)
                .eq('instance_id', inst.id)
                .in('status', ['sent', 'resent'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (pendingSurvey) {
                const windowEnd = new Date(
                  new Date(pendingSurvey.created_at).getTime() +
                  pendingSurvey.response_window_hours * 3600 * 1000
                );

                if (new Date() < windowEnd) {
                  const isDirectReply = quotedMsgId === pendingSurvey.sent_message_id;
                  if (isDirectReply || looksLikeCSATResponse(textBody, pendingSurvey.config)) {
                    const { data: locked } = await supabase
                      .from('csat_surveys')
                      .update({ status: 'processing' })
                      .eq('id', pendingSurvey.id)
                      .in('status', ['sent', 'resent'])
                      .select()
                      .maybeSingle();

                    if (locked) {
                      try {
                        const classifyResponse = await supabase.functions.invoke('csat-processor', {
                          body: { action: 'classify', surveyId: locked.id, message: textBody, quotedMsgId }
                        });
                        const classifyResult = classifyResponse.data;

                        if (classifyResult?.is_csat_response) {
                          console.log(`[CSAT] Survey ${locked.id} answered with score ${classifyResult.score}`);
                          // If no active conversation, stop here — no orchestrator needed
                          if (!conversationId) {
                            return new Response(JSON.stringify({ success: true, csat_handled: true }), {
                              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                            });
                          }
                        } else {
                          // Not a CSAT response — revert status so survey stays active
                          await supabase
                            .from('csat_surveys')
                            .update({ status: pendingSurvey.status })
                            .eq('id', locked.id);
                        }
                      } catch (csatError) {
                        console.error('[CSAT] classify error, reverting:', csatError);
                        await supabase
                          .from('csat_surveys')
                          .update({ status: pendingSurvey.status })
                          .eq('id', locked.id);
                      }
                    }
                  }
                }
              }
            } catch (csatCheckError) {
              console.error('[CSAT] check error (non-blocking):', csatCheckError);
            }
          }
          // --- End CSAT Survey Interception ---

          if (shouldTriggerAI) {
            // Feature flags para controle do pipeline
            const USE_NEW_PIPELINE = (Deno.env.get('FF_NEW_PIPELINE') ?? 'true') === 'true';
            const USE_SHADOW_PIPELINE = (Deno.env.get('FF_SHADOW_PIPELINE') ?? 'false') === 'true';
            const USE_ASYNC_DEBOUNCE = Deno.env.get('FF_ASYNC_DEBOUNCE') === 'true';

            // For media messages, skip immediate AI reply — transcribe-media will trigger it after transcription
            if (isMediaMessage) {
              console.log(`[uazapi-webhook] Media message (${messageType}) — AI reply will be triggered after transcription`);
            } else if (USE_ASYNC_DEBOUNCE) {
              // ── DEBOUNCE ASSÍNCRONO (novo) ──────────────────────────────────
              // Salva flag no DB e retorna imediatamente. Um segundo invoke
              // (ou pg_cron) processará após o debounce window.
              console.log(`[uazapi-webhook] Async debounce: marking message for deferred processing`);
              await supabase.from("ai_messages")
                .update({ intent: 'pending_ai_reply' })
                .eq("conversation_id", conversationId)
                .eq("role", "user")
                .order("created_at", { ascending: false })
                .limit(1);

              // Fire-and-forget: schedule processing after 3s via a lightweight edge function call
              // This avoids blocking the webhook handler
              setTimeout(() => {
                const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-incoming-message`;
                fetch(processUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({
                    conversation_id: conversationId,
                    message_content: aiReplyText,
                    message_id: msgId,
                    debounce_check: true,
                  }),
                }).catch(err => console.error("[uazapi-webhook] Deferred process-incoming failed:", err));
              }, 3000);
            } else {
              // ── DEBOUNCE SÍNCRONO (legado) ──────────────────────────────────
              const DEBOUNCE_MS = 4000;
              console.log(`[uazapi-webhook] Debounce: waiting ${DEBOUNCE_MS}ms before AI reply for ${chatJid}`);
              await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS));

              // After waiting, check if newer messages arrived in this conversation
              const { data: newerMsgs } = await supabase
                .from("uazapi_messages")
                .select("id, timestamp")
                .eq("chat_id", chatDbId)
                .eq("from_me", false)
                .gt("timestamp", timestamp)
                .limit(1);

              if (newerMsgs && newerMsgs.length > 0) {
                console.log(`[uazapi-webhook] Debounce: newer message found, skipping AI reply for this message (${msgId}). The newer message will trigger the reply.`);
              } else {
                // No newer messages — this is the last message in the burst, proceed with AI reply
                try {
                  if (USE_NEW_PIPELINE) {
                    // ── PIPELINE COMPLETO (novo) ──────────────────────────────
                    console.log("[uazapi-webhook] Triggering process-incoming-message (NEW pipeline):", { chatJid, conversationId, text: aiReplyText?.substring(0, 50) });
                    const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-incoming-message`;
                    const processResp = await fetch(processUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({
                        conversation_id: conversationId,
                        message_content: aiReplyText,
                        message_id: msgId,
                      }),
                    });
                    const processResult = await processResp.text();
                    console.log(`[uazapi-webhook] process-incoming-message result: status=${processResp.status}, result=${processResult.substring(0, 200)}`);
                    trackMetric(supabase, {
                      edge_function: 'uazapi-webhook',
                      event_type: processResp.ok ? 'pipeline_complete' : 'pipeline_error',
                      request_id: _requestId,
                      conversation_id: conversationId,
                      webhook_to_reply_ms: Date.now() - _webhookStartMs,
                      success: processResp.ok,
                      error_message: processResp.ok ? undefined : processResult.substring(0, 500),
                      metadata: { pipeline: 'new' },
                    });
                  } else {
                    // ── PIPELINE SIMPLIFICADO (legado — ai-whatsapp-reply) ────
                    const aiReplyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-whatsapp-reply`;
                    console.log("[uazapi-webhook] Triggering AI auto-reply (LEGACY pipeline, after debounce):", { chatJid, conversationId, text: aiReplyText?.substring(0, 50) });
                    const aiReplyResp = await fetch(aiReplyUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({
                        messageId: msgId,
                        chatId: chatDbId,
                        instanceId: inst.id,
                        conversationId,
                        text: aiReplyText,
                      }),
                    });
                    const aiReplyResult = await aiReplyResp.text();
                    console.log(`AI auto-reply triggered for: ${chatJid}, status=${aiReplyResp.status}, result=${aiReplyResult.substring(0, 200)}`);
                    trackMetric(supabase, {
                      edge_function: 'uazapi-webhook',
                      event_type: aiReplyResp.ok ? 'pipeline_complete' : 'pipeline_error',
                      request_id: _requestId,
                      conversation_id: conversationId,
                      webhook_to_reply_ms: Date.now() - _webhookStartMs,
                      success: aiReplyResp.ok,
                      error_message: aiReplyResp.ok ? undefined : aiReplyResult.substring(0, 500),
                      metadata: { pipeline: 'legacy' },
                    });
                  }

                  // ── SHADOW MODE: pipeline completo em paralelo (sem enviar resposta) ──
                  if (USE_SHADOW_PIPELINE && !USE_NEW_PIPELINE) {
                    console.log("[uazapi-webhook] SHADOW: Triggering process-incoming-message in shadow mode");
                    const shadowUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-incoming-message`;
                    fetch(shadowUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({
                        conversation_id: conversationId,
                        message_content: aiReplyText,
                        message_id: msgId,
                        shadow_mode: true,
                      }),
                    }).catch(err => console.error("[uazapi-webhook] Shadow pipeline error:", err));
                  }
                } catch (aiErr) {
                  console.error("AI pipeline trigger failed:", aiErr);
                }
              }
            }
          } else {
            console.log("[uazapi-webhook] AI auto-reply SKIPPED:", JSON.stringify(aiReplyConditions));
          }
        }
      }
    }

    // ===== MESSAGE STATUS UPDATE / FILE DOWNLOADED =====
    if (event === "messages_update" || event === "messages.update" || event === "message_status" || event === "FileDownloadedMessage") {
      const updates = body.event || body.data?.messages || body.data || [];
      const list = Array.isArray(updates) ? updates : [updates];

      for (const upd of list) {
        // ===== FILE DOWNLOADED — media is now available =====
        const fileType = upd.Type || upd.type || body.type || "";
        const isFileDownloaded = fileType === "FileDownloaded" || fileType === "FileDownloadedMessage" || event === "FileDownloadedMessage";

        if (isFileDownloaded) {
          const fileUrl = upd.FileURL || upd.fileUrl || upd.fileURL || body.event?.FileURL || "";
          const fileMessageIds = upd.MessageIDs || [upd.MessageID || upd.messageId];
          const fileMimeType = upd.MimeType || upd.mimeType || upd.mimetype || "application/octet-stream";

          console.log(`[FileDownloaded] FileURL=${fileUrl?.substring(0, 80)}, MessageIDs=${JSON.stringify(fileMessageIds)}, mime=${fileMimeType}`);

          if (!fileUrl || !fileMessageIds?.length) continue;

          for (const mid of fileMessageIds) {
            if (!mid) continue;

            // Find existing uazapi_message to get context
            const { data: existingMsg } = await supabase
              .from("uazapi_messages")
              .select("id, instance_id, chat_id, from_me, sender_phone, type, media_url, media_mimetype")
              .eq("message_id", mid)
              .maybeSingle();

            if (!existingMsg) {
              console.log(`[FileDownloaded] Message ${mid} not found in uazapi_messages, skipping`);
              continue;
            }

            // Skip if message already has a valid stored media URL (not .enc)
            if (existingMsg.media_url && !existingMsg.media_url.includes(".enc") && existingMsg.media_url.includes("supabase")) {
              console.log(`[FileDownloaded] Message ${mid} already has stored media, skipping`);
              continue;
            }

            try {
              // Download file from the decrypted FileURL
              console.log(`[FileDownloaded] Downloading from: ${fileUrl.substring(0, 80)}`);
              const mediaResp = await fetch(fileUrl);
              if (!mediaResp.ok) {
                console.error(`[FileDownloaded] Download failed: ${mediaResp.status}`);
                continue;
              }

              // Determine extension from MIME type
              const cleanMime = fileMimeType.split(";")[0].trim();
              const extMap: Record<string, string> = {
                "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
                "audio/ogg": "ogg", "audio/opus": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "m4a",
                "video/mp4": "mp4", "application/pdf": "pdf",
              };
              const ext = extMap[cleanMime] || cleanMime.split("/")[1] || "bin";
              const uploadContentType = cleanMime !== "application/octet-stream" ? cleanMime : (existingMsg.media_mimetype || "application/octet-stream");

              const rawBlob = await mediaResp.blob();
              const blob = new Blob([rawBlob], { type: uploadContentType });

              if (blob.size === 0 || blob.size > 25 * 1024 * 1024) {
                console.log(`[FileDownloaded] Invalid blob size: ${blob.size}`);
                continue;
              }

              const direction = existingMsg.from_me ? "outgoing" : "incoming";
              const phone = existingMsg.sender_phone || "unknown";
              const filePath = `${direction}/${phone}/${Date.now()}-${mid.substring(0, 8)}.${ext}`;

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from("whatsapp-media")
                .upload(filePath, blob, { contentType: uploadContentType, upsert: true });

              if (uploadError || !uploadData) {
                console.error(`[FileDownloaded] Upload error:`, uploadError);
                continue;
              }

              const { data: signedData } = await supabase.storage
                .from("whatsapp-media")
                .createSignedUrl(uploadData.path, 31536000); // 365 days

              const storedUrl = signedData?.signedUrl || "";
              console.log(`[FileDownloaded] Media stored: ${uploadData.path}`);

              // Update both tables with new media URL in parallel
              await Promise.all([
                supabase.from("uazapi_messages").update({
                  media_url: storedUrl,
                  media_mimetype: uploadContentType,
                }).eq("id", existingMsg.id),
                supabase.from("ai_messages").update({
                  media_url: storedUrl,
                  media_type: existingMsg.type,
                }).eq("uazapi_message_id", mid),
              ]);

              console.log(`[FileDownloaded] Updated media URLs for message ${mid}`);

              // Trigger transcription for audio/ptt/image
              const transcribableTypes = ["audio", "ptt", "image", "video"];
              const msgType = existingMsg.type || "";
              if (transcribableTypes.includes(msgType) && storedUrl) {
                // Find the ai_message to get conversation_id
                const { data: aiMsg } = await supabase
                  .from("ai_messages")
                  .select("id, conversation_id")
                  .eq("uazapi_message_id", mid)
                  .maybeSingle();

                if (aiMsg?.conversation_id) {
                  console.log(`[FileDownloaded] Triggering transcription for ${msgType}, conversation=${aiMsg.conversation_id}`);
                  const transcribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-media`;
                  fetch(transcribeUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                    },
                    body: JSON.stringify({
                      conversation_id: aiMsg.conversation_id,
                      message_id: aiMsg.id,
                      media_url: storedUrl,
                      media_type: msgType,
                    }),
                  }).catch((e) => console.error("[FileDownloaded] Transcription trigger error:", e));
                }
              }
            } catch (fileErr) {
              console.error(`[FileDownloaded] Error processing message ${mid}:`, fileErr);
            }
          }
          continue; // Skip status update logic for FileDownloaded events
        }

        // ===== REGULAR STATUS UPDATE (delivered/read/sent) =====
        const msgIds = upd.MessageIDs || [upd.key?.id || upd.id];
        const status = upd.Type || upd.update?.status || upd.status;
        if (!status) continue;

        const statusMap: Record<string, string> = {
          Delivered: "delivered", Read: "read", Sent: "sent",
          "0": "pending", "1": "sent", "2": "delivered", "3": "read", "4": "played",
          PENDING: "pending", SENT: "sent", DELIVERY_ACK: "delivered", READ: "read", PLAYED: "played",
        };

        const mapped = statusMap[String(status)] || String(status).toLowerCase();
        // Parallelize status updates across both tables and all message IDs
        await Promise.all(msgIds.filter(Boolean).flatMap((mid: string) => [
          supabase.from("uazapi_messages").update({ status: mapped }).eq("message_id", mid),
          supabase.from("ai_messages").update({ delivery_status: mapped }).eq("uazapi_message_id", mid),
        ]));
      }
    }

    // ===== CHAT UPDATE (avatar extraction) =====
    if (event === "chats" || event === "chats.update") {
      const chat = body.chat || body.data?.chat || body.data || {};
      const chatImagePreview = chat.imagePreview || chat.profilePictureUrl || chat.imgUrl || null;
      const chatId = chat.wa_chatid || chat.id || "";
      const chatPhone = chatId.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(/\D/g, "");
      
      if (chatImagePreview && chatPhone && chatPhone.length >= 8 && !chatId.includes("@g.us")) {
        // Find the instance
        const owner = body.owner || chat.owner || "";
        if (owner) {
          const { data: chatInst } = await supabase
            .from("uazapi_instances")
            .select("id")
            .eq("phone_number", owner)
            .eq("is_active", true)
            .maybeSingle();
          
          if (chatInst) {
            // Check if this chat already has a stored avatar
            const { data: existingChatRecord } = await supabase
              .from("uazapi_chats")
              .select("id, contact_picture_url")
              .eq("instance_id", chatInst.id)
              .eq("contact_phone", chatPhone)
              .maybeSingle();
            
            if (existingChatRecord && !existingChatRecord.contact_picture_url) {
              // Fire-and-forget: download and store the avatar
              const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-sync-avatars`;
              fetch(syncUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({ instance_id: chatInst.id, phone: chatPhone, temp_url: chatImagePreview }),
              }).catch((e) => console.error("Chat event avatar sync error:", e));
            }
          }
        }
      }
    }

    // ===== PRESENCE (typing / last seen) =====
    if (event === "presence" || event === "presence.update") {
      console.log("Presence update:", JSON.stringify(body).substring(0, 300));
      const presenceData = body.event || body.data || body;
      const presenceJid = presenceData.id || presenceData.chatId || presenceData.from || "";
      const presenceType = presenceData.presences?.[Object.keys(presenceData.presences || {})[0]]?.lastKnownPresence
        || presenceData.type || presenceData.status || "";

      if (presenceJid) {
        const presencePhone = presenceJid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(/\D/g, "");
        const isTyping = presenceType === "composing" || presenceType === "recording";
        const isAvailable = presenceType === "available";

        // Find instance
        const owner = body.owner || body.instanceName || "";
        let presenceInstId: string | null = null;
        if (owner) {
          const { data: pi } = await supabase.from("uazapi_instances").select("id").eq("is_active", true).or(`instance_name.eq.${owner},phone_number.eq.${owner}`).maybeSingle();
          presenceInstId = pi?.id || null;
        }
        if (!presenceInstId) {
          const { data: pi } = await supabase.from("uazapi_instances").select("id").eq("is_active", true).limit(1).maybeSingle();
          presenceInstId = pi?.id || null;
        }

        if (presenceInstId && presencePhone) {
          const updatePayload: Record<string, unknown> = { is_typing: isTyping };
          if (isAvailable || isTyping) {
            updatePayload.last_seen_online = new Date().toISOString();
          }
          await supabase.from("uazapi_chats").update(updatePayload)
            .eq("instance_id", presenceInstId)
            .eq("contact_phone", presencePhone);
        }
      }
    }

    // ===== CONNECTION STATUS =====
    if (event === "connection" || event === "connection.update") {
      console.log("Connection event:", JSON.stringify(body).substring(0, 300));
      const connData = body.event || body.data || body;
      const connState = connData.state || connData.status || connData.connection || "";
      const instanceName = body.instanceName || body.instance || "";

      if (instanceName && connState) {
        const statusMap: Record<string, string> = {
          open: "connected", close: "disconnected", connecting: "connecting",
          connected: "connected", disconnected: "disconnected", loggedOut: "disconnected",
        };
        const mappedStatus = statusMap[connState] || connState;
        const updateData: Record<string, unknown> = { status: mappedStatus };
        if (mappedStatus === "connected") {
          updateData.last_seen_at = new Date().toISOString();
        }

        await supabase.from("uazapi_instances").update(updateData)
          .eq("instance_name", instanceName).eq("is_active", true);
        console.log(`Instance ${instanceName} status updated to ${mappedStatus}`);
      }
    }

    // ===== HISTORY (sync) =====
    if (event === "history" || event === "history.set") {
      console.log("History sync event received, messages count:", body.data?.messages?.length || body.event?.messages?.length || "unknown");
      // Log only — bulk import of old messages can be done via import-chat-history function
    }

    // ===== CALL (VoIP) =====
    if (event === "call" || event === "call.update") {
      console.log("Call event:", JSON.stringify(body).substring(0, 300));
      const callData = body.event || body.data || body;
      const callList = Array.isArray(callData) ? callData : [callData];

      for (const call of callList) {
        const callerJid = call.from || call.chatId || call.id || "";
        const callStatus = call.status || call.type || "received";
        const isVideo = call.isVideo === true;
        const callerPhone = callerJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

        if (!callerPhone) continue;

        // Find instance
        const owner = body.owner || body.instanceName || "";
        let callInstId: string | null = null;
        if (owner) {
          const { data: ci } = await supabase.from("uazapi_instances").select("id").eq("is_active", true).or(`instance_name.eq.${owner},phone_number.eq.${owner}`).maybeSingle();
          callInstId = ci?.id || null;
        }
        if (!callInstId) {
          const { data: ci } = await supabase.from("uazapi_instances").select("id").eq("is_active", true).limit(1).maybeSingle();
          callInstId = ci?.id || null;
        }
        if (!callInstId) continue;

        // Find or create chat
        const { data: callChat } = await supabase.from("uazapi_chats").select("id")
          .eq("instance_id", callInstId).eq("contact_phone", callerPhone).maybeSingle();

        let callChatDbId = callChat?.id;
        if (!callChatDbId) {
          const { data: newChat } = await supabase.from("uazapi_chats").insert({
            instance_id: callInstId, chat_id: callerJid, contact_phone: callerPhone, is_group: false,
          }).select("id").single();
          callChatDbId = newChat?.id;
        }

        if (callChatDbId) {
          const callLabel = callStatus === "missed" || callStatus === "reject" || callStatus === "timeout"
            ? (isVideo ? "📹 Chamada de vídeo perdida" : "📞 Chamada de voz perdida")
            : (isVideo ? "📹 Chamada de vídeo recebida" : "📞 Chamada de voz recebida");

          await supabase.from("uazapi_messages").insert({
            instance_id: callInstId, chat_id: callChatDbId, message_id: `call_${Date.now()}`,
            from_me: false, type: "call", text_body: callLabel, status: "received", timestamp: new Date().toISOString(),
          });
          await supabase.from("uazapi_chats").update({
            last_message_preview: callLabel, last_message_time: new Date().toISOString(), last_message_from_me: false,
          }).eq("id", callChatDbId);
        }
      }
    }

    // ===== CONTACTS UPDATE =====
    if (event === "contacts" || event === "contacts.update" || event === "contacts.upsert") {
      console.log("Contacts event:", JSON.stringify(body).substring(0, 300));
      const contactsList = body.event || body.data?.contacts || body.data || [];
      const contacts = Array.isArray(contactsList) ? contactsList : [contactsList];

      for (const contact of contacts) {
        const contactJid = contact.id || contact.jid || "";
        const contactName = contact.name || contact.notify || contact.pushName || "";
        const contactImg = contact.imgUrl || contact.profilePictureUrl || null;
        const contactPhone = contactJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

        if (!contactPhone || contactPhone.length < 8) continue;

        const updatePayload: Record<string, unknown> = {};
        if (contactName) updatePayload.contact_name = contactName;
        if (contactImg) updatePayload.contact_picture_url = contactImg;

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from("uazapi_chats").update(updatePayload).eq("contact_phone", contactPhone);
        }
      }
    }

    // ===== GROUPS =====
    if (event === "groups" || event === "groups.update" || event === "groups.upsert") {
      console.log("Groups event:", JSON.stringify(body).substring(0, 300));
      const groupData = body.event || body.data || body;
      const groups = Array.isArray(groupData) ? groupData : [groupData];

      for (const group of groups) {
        const groupJid = group.id || group.jid || "";
        const subject = group.subject || group.name || "";
        const description = group.desc || group.description || "";

        if (!groupJid) continue;

        const updatePayload: Record<string, unknown> = { is_group: true };
        if (subject) { updatePayload.group_subject = subject; updatePayload.contact_name = subject; }
        if (description) updatePayload.group_description = description;

        await supabase.from("uazapi_chats").update(updatePayload).eq("chat_id", groupJid);
      }
    }

    // ===== LABELS =====
    if (event === "labels" || event === "labels.update" || event === "labels.association") {
      console.log("Labels event:", JSON.stringify(body).substring(0, 300));
      // Log for future use — labels management can be extended
    }

    // ===== CHAT LABELS =====
    if (event === "chat_labels" || event === "chatlabels" || event === "label_association") {
      console.log("Chat labels event:", JSON.stringify(body).substring(0, 300));
      const labelData = body.event || body.data || body;
      const chatJid = labelData.chatId || labelData.id || "";
      const labelName = labelData.labelName || labelData.label?.name || "";
      const labelAction = labelData.type || labelData.action || "add"; // add or remove

      if (chatJid && labelName) {
        const { data: chatRecord } = await supabase.from("uazapi_chats").select("id, whatsapp_labels").eq("chat_id", chatJid).maybeSingle();
        if (chatRecord) {
          let currentLabels = Array.isArray(chatRecord.whatsapp_labels) ? chatRecord.whatsapp_labels : [];
          if (labelAction === "remove" || labelAction === "delete") {
            currentLabels = currentLabels.filter((l: string) => l !== labelName);
          } else if (!currentLabels.includes(labelName)) {
            currentLabels = [...currentLabels, labelName];
          }
          await supabase.from("uazapi_chats").update({ whatsapp_labels: currentLabels }).eq("id", chatRecord.id);

          // Also sync to ai_conversations tags
          await supabase.from("ai_conversations").update({ tags: currentLabels }).eq("uazapi_chat_id", chatJid);
        }
      }
    }

    // ===== BLOCKS =====
    if (event === "blocks" || event === "blocklist" || event === "blocklist.update") {
      console.log("Blocks event:", JSON.stringify(body).substring(0, 300));
      const blockData = body.event || body.data || body;
      const blockList = Array.isArray(blockData) ? blockData : [blockData];

      for (const block of blockList) {
        const blockedJid = block.id || block.jid || block.contact || "";
        const blockAction = block.action || block.type || "block"; // block or unblock
        const blockedPhone = blockedJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

        if (blockedPhone) {
          await supabase.from("uazapi_chats").update({
            is_blocked: blockAction === "block" || blockAction === "add",
          }).eq("contact_phone", blockedPhone);
        }
      }
    }

    // ===== LEADS =====
    if (event === "leads" || event === "leads.update") {
      console.log("Leads event:", JSON.stringify(body).substring(0, 300));
      const leadData = body.event || body.data || body;
      const leads = Array.isArray(leadData) ? leadData : [leadData];

      for (const lead of leads) {
        const leadPhone = (lead.phone || lead.wa_id || lead.id || "").replace(/\D/g, "");
        const leadName = lead.name || lead.firstName || "";

        if (!leadPhone || leadPhone.length < 8) continue;

        // Upsert customer profile
        const { data: existing } = await supabase.from("customer_profiles").select("id").eq("phone", leadPhone).maybeSingle();
        if (!existing) {
          await supabase.from("customer_profiles").insert({
            phone: leadPhone, nome: leadName || null,
          });
          console.log(`Lead created as customer_profile: ${leadPhone}`);
        }
      }
    }

    // ===== MESSAGE REVOKE / DELETE =====
    if (event === "message_revoke" || event === "messages.delete" || event === "message.revoke") {
      console.log("Message revoke/delete event detected");
      const revokeData = body.message || body.data?.message || body.data || body.event || {};
      const revokedMsgId = revokeData.key?.id || revokeData.id || revokeData.messageId || revokeData.MessageId || null;

      if (revokedMsgId) {
        console.log(`Processing revoke for message_id=${revokedMsgId}`);
        const { data: origMsg } = await supabase
          .from("uazapi_messages")
          .select("id, text_body, media_url, type, media_mimetype")
          .eq("message_id", revokedMsgId)
          .maybeSingle();

        if (origMsg) {
          const deletedAt = new Date().toISOString();
          await Promise.all([
            supabase.from("uazapi_messages").update({
              deleted_by_sender: true,
              deleted_at: deletedAt,
              original_content_preserved: {
                text_body: origMsg.text_body,
                media_url: origMsg.media_url,
                type: origMsg.type,
                media_mimetype: origMsg.media_mimetype,
              },
            }).eq("id", origMsg.id),
            supabase.from("ai_messages").update({
              deleted_by_sender: true,
              deleted_at: deletedAt,
            }).eq("uazapi_message_id", revokedMsgId),
          ]);

          console.log(`Message ${revokedMsgId} marked as deleted_by_sender`);
        } else {
          console.log(`Original message not found for revoke: ${revokedMsgId}`);
        }
      }
    }

    // ===== MESSAGE EDIT =====
    if (event === "message.edit" || event === "messages.edit" || event === "message_edit") {
      console.log("Message edit event detected");
      const editData = body.message || body.data?.message || body.data || body.event || {};
      const editedMsgId = editData.key?.id || editData.id || editData.messageId || editData.MessageId || null;
      const newText = editData.editedMessage?.conversation || editData.editedMessage?.extendedTextMessage?.text || editData.text || editData.newBody || editData.body || "";

      if (editedMsgId && newText) {
        console.log(`Processing edit for message_id=${editedMsgId}, newText=${newText.substring(0, 50)}`);
        const { data: origMsg } = await supabase
          .from("uazapi_messages")
          .select("id, text_body, edit_history")
          .eq("message_id", editedMsgId)
          .maybeSingle();

        if (origMsg) {
          const editedAt = new Date().toISOString();
          const existingHistory = Array.isArray(origMsg.edit_history) ? origMsg.edit_history : [];
          const updatedHistory = [...existingHistory, { body: origMsg.text_body, edited_at: editedAt }];

          // Parallelize: update uazapi_messages + fetch ai_messages simultaneously
          const [, { data: aiMsg }] = await Promise.all([
            supabase.from("uazapi_messages").update({
              text_body: newText,
              edited_by_sender: true,
              edit_history: updatedHistory,
            }).eq("id", origMsg.id),
            supabase
              .from("ai_messages")
              .select("id, edit_history")
              .eq("uazapi_message_id", editedMsgId)
              .maybeSingle(),
          ]);

          if (aiMsg) {
            const aiHistory = Array.isArray(aiMsg.edit_history) ? aiMsg.edit_history : [];
            const updatedAiHistory = [...aiHistory, { body: origMsg.text_body, edited_at: editedAt }];
            await supabase.from("ai_messages").update({
              content: newText,
              edited_by_sender: true,
              edit_history: updatedAiHistory,
            }).eq("id", aiMsg.id);
          }

          console.log(`Message ${editedMsgId} marked as edited_by_sender`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook CRITICAL error (returning 500 for retry):", error);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


