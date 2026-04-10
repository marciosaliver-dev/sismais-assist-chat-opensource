import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/supabase-helpers.ts";

// Detect MIME from magic bytes
function detectMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return "audio/ogg";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video/mp4";
  if ((buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33)) return "audio/mpeg";
  // Accept large binary as generic (documents, etc.)
  return null;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "application/pdf": "pdf",
  };
  return map[mime] || "bin";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const limit = body.limit || 20;

  try {
    // Find images with null media_url that have uazapi_message_id
    const { data: messages, error } = await supabase
      .from("ai_messages")
      .select("id, uazapi_message_id, media_type, conversation_id")
      .is("media_url", null)
      .eq("media_type", "image")
      .not("uazapi_message_id", "is", null)
      .limit(limit);

    if (error) throw error;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: "No images to recover", recovered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all unique conversation_ids to find instance_ids
    const convIds = [...new Set(messages.map(m => m.conversation_id).filter(Boolean))];
    const { data: convs } = await supabase
      .from("ai_conversations")
      .select("id, whatsapp_instance_id")
      .in("id", convIds);

    const convInstanceMap = new Map<string, string>();
    for (const c of convs || []) {
      if (c.whatsapp_instance_id) convInstanceMap.set(c.id, c.whatsapp_instance_id);
    }

    // Get all unique instance_ids to fetch credentials
    const instanceIds = [...new Set(convInstanceMap.values())];
    const { data: instances } = await supabase
      .from("uazapi_instances")
      .select("id, api_url, api_token")
      .in("id", instanceIds);

    const instanceMap = new Map<string, { api_url: string; api_token: string }>();
    for (const inst of instances || []) {
      instanceMap.set(inst.id, { api_url: inst.api_url, api_token: inst.api_token });
    }

    let recovered = 0;
    let failed = 0;
    const details: string[] = [];

    for (const msg of messages) {
      const instanceId = convInstanceMap.get(msg.conversation_id);
      const inst = instanceId ? instanceMap.get(instanceId) : null;

      if (!inst) {
        details.push(`${msg.id}: no instance found — skipping`);
        failed++;
        continue;
      }

      const msgId = msg.uazapi_message_id!;
      let mediaBlob: Blob | null = null;

      // Try UAZAPI download endpoints
      const apiUrl = inst.api_url.replace(/\/+$/, "");
      const endpoints = [
        { endpoint: "/message/download", body: { id: msgId } },
        { endpoint: "/message/download", body: { messageId: msgId } },
        { endpoint: "/chat/downloadMedia", body: { id: msgId } },
        { endpoint: "/chat/downloadMedia", body: { messageId: msgId } },
      ];

      for (const { endpoint, body: epBody } of endpoints) {
        if (mediaBlob) break;
        try {
          const resp = await fetch(`${apiUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: inst.api_token },
            body: JSON.stringify(epBody),
            signal: AbortSignal.timeout(30000),
          });

          if (!resp.ok) continue;

          const ct = resp.headers.get("content-type") || "";

          if (ct.includes("application/json")) {
            const json = await resp.json();

            // Base64 response
            const b64 = json.data || json.base64 || json.media || json.file;
            if (b64 && typeof b64 === "string" && b64.length > 100) {
              const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
              if (binary.length > 100) {
                const mime = detectMime(binary) || json.mimetype || "image/jpeg";
                mediaBlob = new Blob([binary], { type: mime });
                break;
              }
            }

            // fileURL response
            const fileUrl = json.fileURL || json.fileUrl || json.url;
            if (fileUrl && typeof fileUrl === "string" && fileUrl.startsWith("http")) {
              try {
                const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
                if (fileResp.ok) {
                  const bytes = new Uint8Array(await fileResp.arrayBuffer());
                  if (bytes.length > 100) {
                    const mime = detectMime(bytes) || fileResp.headers.get("content-type") || "image/jpeg";
                    mediaBlob = new Blob([bytes], { type: mime });
                    break;
                  }
                }
              } catch { /* ignore */ }
            }
          } else {
            // Binary response
            const bytes = new Uint8Array(await resp.arrayBuffer());
            if (bytes.length > 100) {
              const mime = detectMime(bytes) || ct || "image/jpeg";
              mediaBlob = new Blob([bytes], { type: mime });
              break;
            }
          }
        } catch { continue; }
      }

      if (!mediaBlob || mediaBlob.size < 100) {
        details.push(`${msg.id} (${msgId}): all download attempts failed`);
        failed++;
        continue;
      }

      // Validate not garbage
      const blobBytes = new Uint8Array(await mediaBlob.arrayBuffer());
      const textPreview = new TextDecoder().decode(blobBytes.slice(0, 100)).toLowerCase();
      if (textPreview.includes("<html") || textPreview.includes("error") || textPreview.includes("not found")) {
        details.push(`${msg.id} (${msgId}): downloaded content is error page — skipping`);
        failed++;
        continue;
      }

      // Upload to Supabase Storage
      const mime = mediaBlob.type || "image/jpeg";
      const ext = mimeToExt(mime);
      const phone = msgId.substring(0, 13); // approximate
      const filePath = `recovered/${msgId}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(filePath, new Blob([blobBytes], { type: mime }), {
          contentType: mime,
          upsert: true,
        });

      if (uploadError) {
        details.push(`${msg.id} (${msgId}): upload failed — ${uploadError.message}`);
        failed++;
        continue;
      }

      const { data: signedData } = await supabase.storage
        .from("whatsapp-media")
        .createSignedUrl(uploadData.path, 31536000);

      if (!signedData?.signedUrl) {
        details.push(`${msg.id} (${msgId}): signed URL failed`);
        failed++;
        continue;
      }

      // Update ai_messages with recovered URL
      const { error: updateError } = await supabase
        .from("ai_messages")
        .update({ media_url: signedData.signedUrl })
        .eq("id", msg.id);

      if (updateError) {
        details.push(`${msg.id} (${msgId}): upload ok but DB update failed — ${updateError.message}`);
        failed++;
        continue;
      }

      // Update uazapi_messages too
      await supabase
        .from("uazapi_messages")
        .update({ media_url: signedData.signedUrl })
        .eq("message_id", msgId);

      details.push(`${msg.id} (${msgId}): recovered! ${mime}, ${blobBytes.length}b`);
      recovered++;
    }

    return new Response(
      JSON.stringify({ total: messages.length, recovered, failed, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("recover-media error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
