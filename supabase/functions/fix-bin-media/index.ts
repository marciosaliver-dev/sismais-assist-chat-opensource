import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/supabase-helpers.ts";

// Detect real MIME type from magic bytes (includes HEIC for iPhone photos)
function detectMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return "audio/ogg";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  // ftyp box (MP4, HEIC, HEIF, M4A)
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const ftyp = new TextDecoder().decode(buf.slice(8, 12));
    if (ftyp === "heic" || ftyp === "heix" || ftyp === "hevc" || ftyp === "mif1") return "image/heic";
    if (ftyp === "M4A " || ftyp === "M4B ") return "audio/mp4";
    return "video/mp4";
  }
  if ((buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) || (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33)) return "audio/mpeg";
  return null;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "image/heic": "heic", "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
    "application/pdf": "pdf", "audio/mp4": "m4a",
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

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const mode = body.mode || "fix"; // "fix" = re-upload with correct mime, "cleanup" = clear garbage entries, "redownload" = try UAZAPI
  const limit = body.limit || 50;

  try {
    const { data: binMessages, error } = await supabase
      .from("ai_messages")
      .select("id, media_url, media_type, uazapi_message_id, conversation_id")
      .like("media_url", "%.bin%")
      .not("media_url", "is", null)
      .limit(limit);

    if (error) throw error;
    if (!binMessages || binMessages.length === 0) {
      return new Response(JSON.stringify({ message: "No .bin files to fix", fixed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixed = 0;
    let cleaned = 0;
    let redownloaded = 0;
    let skipped = 0;
    let errors = 0;
    const details: string[] = [];

    for (const msg of binMessages) {
      try {
        const urlMatch = msg.media_url.match(/\/object\/sign\/whatsapp-media\/([^?]+)/);
        if (!urlMatch) {
          // Non-standard URL — try to clear it
          if (mode === "cleanup") {
            await supabase.from("ai_messages").update({ media_url: null }).eq("id", msg.id);
            details.push(`${msg.id}: cleared non-parseable URL`);
            cleaned++;
          } else {
            details.push(`${msg.id}: could not parse storage path`);
            skipped++;
          }
          continue;
        }

        const oldPath = decodeURIComponent(urlMatch[1]);

        // Try to download existing file from storage
        const { data: fileData, error: dlError } = await supabase.storage
          .from("whatsapp-media")
          .download(oldPath);

        if (dlError || !fileData) {
          // File doesn't exist in storage — clear the URL so UI shows "unavailable" instead of blank
          if (mode === "cleanup" || mode === "fix") {
            await supabase.from("ai_messages").update({ media_url: null }).eq("id", msg.id);
            details.push(`${msg.id}: file not in storage, cleared URL`);
            cleaned++;
          } else {
            details.push(`${msg.id}: download failed — ${dlError?.message}`);
            errors++;
          }
          continue;
        }

        const bytes = new Uint8Array(await fileData.arrayBuffer());

        // Small files (< 500 bytes) are garbage — error responses, empty files
        if (bytes.length < 500) {
          const text = new TextDecoder().decode(bytes).trim();
          details.push(`${msg.id}: garbage (${bytes.length}b), content: "${text.slice(0, 80)}" — clearing`);
          await supabase.from("ai_messages").update({ media_url: null }).eq("id", msg.id);
          // Also delete garbage file from storage
          await supabase.storage.from("whatsapp-media").remove([oldPath]);
          cleaned++;
          continue;
        }

        const mime = detectMime(bytes);

        if (!mime) {
          // Check if it's an HTML error page or JSON error
          const textPreview = new TextDecoder().decode(bytes.slice(0, 300)).toLowerCase();
          if (textPreview.includes("<html") || textPreview.includes("<!doctype") || textPreview.includes("error") || textPreview.includes("not found")) {
            await supabase.from("ai_messages").update({ media_url: null }).eq("id", msg.id);
            await supabase.storage.from("whatsapp-media").remove([oldPath]);
            details.push(`${msg.id}: HTML/error page (${bytes.length}b) — cleared`);
            cleaned++;
          } else if (mode === "redownload" && msg.uazapi_message_id) {
            // Try to re-download from UAZAPI
            // Get instance from conversation
            const { data: conv } = await supabase
              .from("ai_conversations")
              .select("whatsapp_instance_id")
              .eq("id", msg.conversation_id)
              .single();

            if (conv?.whatsapp_instance_id) {
              try {
                const { data: result } = await supabase.functions.invoke("uazapi-proxy", {
                  body: {
                    action: "downloadMedia",
                    instanceId: conv.whatsapp_instance_id,
                    messageId: msg.uazapi_message_id,
                    mediaType: msg.media_type,
                  },
                });
                if (result?.mediaUrl) {
                  details.push(`${msg.id}: re-downloaded via UAZAPI → ${result.contentType}`);
                  redownloaded++;
                } else {
                  details.push(`${msg.id}: UAZAPI re-download failed, unknown format (${bytes.length}b)`);
                  skipped++;
                }
              } catch (e) {
                details.push(`${msg.id}: UAZAPI re-download error: ${(e as Error).message}`);
                skipped++;
              }
            } else {
              details.push(`${msg.id}: no instance_id, unknown format (${bytes.length}b) — skipping`);
              skipped++;
            }
          } else {
            details.push(`${msg.id}: unknown format (${bytes.length}b), first bytes: [${Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}] — skipping`);
            skipped++;
          }
          continue;
        }

        // We have a valid mime — re-upload with correct extension and content-type
        const ext = mimeToExt(mime);
        const newPath = oldPath.replace(/\.bin$/, `.${ext}`);

        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(newPath, new Blob([bytes], { type: mime }), {
            contentType: mime,
            upsert: true,
          });

        if (uploadError) {
          details.push(`${msg.id}: upload failed — ${uploadError.message}`);
          errors++;
          continue;
        }

        const { data: signedData } = await supabase.storage
          .from("whatsapp-media")
          .createSignedUrl(newPath, 31536000);

        if (!signedData?.signedUrl) {
          details.push(`${msg.id}: signed URL creation failed`);
          errors++;
          continue;
        }

        await supabase
          .from("ai_messages")
          .update({ media_url: signedData.signedUrl })
          .eq("id", msg.id);

        if (msg.uazapi_message_id) {
          await supabase
            .from("uazapi_messages")
            .update({ media_url: signedData.signedUrl })
            .eq("message_id", msg.uazapi_message_id);
        }

        // Delete old .bin file
        if (newPath !== oldPath) {
          await supabase.storage.from("whatsapp-media").remove([oldPath]);
        }

        details.push(`${msg.id}: ${oldPath} → ${newPath} (${mime})`);
        fixed++;
      } catch (e) {
        details.push(`${msg.id}: exception — ${(e as Error).message}`);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ total: binMessages.length, fixed, cleaned, redownloaded, skipped, errors, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fix-bin-media error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
