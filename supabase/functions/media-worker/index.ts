import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/supabase-helpers.ts";

const BATCH_SIZE = 10;
const RETRY_DELAYS = [0, 5_000, 15_000, 60_000, 300_000]; // 0s, 5s, 15s, 1m, 5m

// Detect real MIME type from magic bytes — returns null if unknown
function detectMimeFromBytes(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null;
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image/png";
  // WebP (RIFF....WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "image/webp";
  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
  // OGG
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "audio/ogg";
  // PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "application/pdf";
  // MP4 (ftyp at offset 4)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "video/mp4";
  // MP3
  if ((buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) || (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)) return "audio/mpeg";
  return null;
}

function isValidMedia(buffer: Uint8Array): boolean {
  if (buffer.length < 100) return false;
  // Reject HTML error pages
  const textStart = new TextDecoder().decode(buffer.slice(0, 200)).toLowerCase();
  if (textStart.includes("<!doctype") || textStart.includes("<html") || textStart.includes("<head") || textStart.includes("error") || textStart.includes("not found")) return false;
  // Reject JSON error responses
  if (textStart.trimStart().startsWith("{") || textStart.trimStart().startsWith("[")) return false;
  // Must match a known media format via magic bytes
  return detectMimeFromBytes(buffer) !== null;
}

function getExtension(mimetype: string | null, mediaType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
    "application/pdf": "pdf", "audio/mp4": "m4a",
  };
  if (mimetype && map[mimetype]) return map[mimetype];
  const typeMap: Record<string, string> = {
    image: "jpg", video: "mp4", audio: "ogg", document: "bin", sticker: "webp", ptt: "ogg",
  };
  return typeMap[mediaType] || "bin";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch pending items ready for processing
    const now = new Date().toISOString();
    const { data: items, error: fetchError } = await supabase
      .from("media_download_queue")
      .select("*")
      .in("status", ["pending"])
      .lte("next_retry_at", now)
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const item of items) {
      // Mark as processing (optimistic lock)
      const { data: locked } = await supabase
        .from("media_download_queue")
        .update({ status: "processing", updated_at: now })
        .eq("id", item.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      // Skip if another worker already grabbed it
      if (!locked) continue;

      try {
        const mediaBuffer = await downloadMedia(item, supabase);

        if (!mediaBuffer || !isValidMedia(new Uint8Array(mediaBuffer))) {
          throw new Error("Invalid media content (HTML or empty)");
        }

        // Detect real MIME from magic bytes, falling back to stored mimetype
        const mediaBytes = new Uint8Array(mediaBuffer);
        const detectedMime = detectMimeFromBytes(mediaBytes);
        const effectiveMime = detectedMime || item.mimetype || "application/octet-stream";
        const ext = getExtension(effectiveMime, item.media_type);
        const storagePath = `downloaded/${item.message_id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(storagePath, mediaBuffer, {
            contentType: effectiveMime,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Create signed URL (1 year)
        const { data: signedData } = await supabase.storage
          .from("whatsapp-media")
          .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

        const signedUrl = signedData?.signedUrl;
        if (!signedUrl) throw new Error("Failed to create signed URL");

        // Update queue item
        await supabase
          .from("media_download_queue")
          .update({
            status: "completed",
            storage_path: storagePath,
            signed_url: signedUrl,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        // Update uazapi_messages
        if (item.uazapi_message_db_id) {
          await supabase
            .from("uazapi_messages")
            .update({ media_url: signedUrl })
            .eq("id", item.uazapi_message_db_id);
        }

        // Update ai_messages — CRITICAL for UI update via Realtime
        if (item.ai_message_id) {
          await supabase
            .from("ai_messages")
            .update({ media_url: signedUrl })
            .eq("id", item.ai_message_id);
        }

        processed++;
        console.log(`Media downloaded successfully for ${item.message_id}`);
      } catch (err) {
        const attempts = item.attempts + 1;
        const retryDelay = RETRY_DELAYS[Math.min(attempts, RETRY_DELAYS.length - 1)];
        const nextRetry = new Date(Date.now() + retryDelay).toISOString();

        await supabase
          .from("media_download_queue")
          .update({
            status: attempts >= item.max_attempts ? "failed" : "pending",
            attempts,
            last_error: String(err),
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        failed++;
        console.error(`Media download failed for ${item.message_id} (attempt ${attempts}):`, err);
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("media-worker error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function downloadMedia(
  item: { media_url_source: string; media_key?: string; message_id: string; instance_id?: string },
  supabase: any
): Promise<ArrayBuffer | null> {
  // Strategy 1: Direct URL fetch (non-encrypted)
  if (item.media_url_source && !item.media_url_source.endsWith(".enc")) {
    try {
      const res = await fetch(item.media_url_source, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 100) return buf;
      }
    } catch { /* fallthrough to next strategy */ }
  }

  // Strategy 2: UAZAPI downloadMedia endpoint
  if (item.instance_id) {
    const { data: instance } = await supabase
      .from("uazapi_instances")
      .select("api_url, api_token")
      .eq("id", item.instance_id)
      .single();

    if (instance) {
      const endpoints = [
        { url: `${instance.api_url}/chat/downloadMedia`, body: { messageId: item.message_id } },
        { url: `${instance.api_url}/chat/downloadMedia`, body: { id: item.message_id } },
        { url: `${instance.api_url}/message/download`, body: { messageId: item.message_id } },
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instance.api_token },
            body: JSON.stringify(ep.body),
            signal: AbortSignal.timeout(30_000),
          });

          if (!res.ok) continue;

          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const json = await res.json();
            const b64 = json.data || json.base64 || json.media || json.file;
            if (b64 && typeof b64 === "string") {
              const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              if (binary.length > 100) return binary.buffer;
            }
            // Handle UAZAPI cached response: {"cached":true,"fileURL":"..."}
            const fileUrl = json.fileURL || json.fileUrl || json.url;
            if (fileUrl && typeof fileUrl === "string" && fileUrl.startsWith("http")) {
              try {
                const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
                if (fileResp.ok) {
                  const buf = await fileResp.arrayBuffer();
                  if (buf.byteLength > 100) return buf;
                }
              } catch { /* ignore */ }
            }
          } else {
            const buf = await res.arrayBuffer();
            if (buf.byteLength > 100) return buf;
          }
        } catch { /* try next endpoint */ }
      }
    }
  }

  return null;
}
