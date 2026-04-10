import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cachedQuery } from "../_shared/cache.ts";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET = Meta webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (!mode || !token || !challenge) {
      return new Response("Missing parameters", { status: 400 });
    }

    // Lookup verify token from DB
    const { data: account } = await supabase
      .from("whatsapp_business_accounts")
      .select("webhook_verify_token")
      .eq("is_active", true)
      .single();

    if (mode === "subscribe" && token === account?.webhook_verify_token) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    console.error("Webhook verification failed - token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  // POST = Incoming messages & status updates
  if (req.method === "POST") {
    try {
      const payload = await req.json();

      const entries = payload.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          const metadata = value.metadata;

          // Find WABA account (cached for 10 minutes to avoid repeated DB lookups)
          const wabaAccount = await cachedQuery(
            `waba:phone_number_id:${metadata?.phone_number_id}`,
            10 * 60 * 1000,
            async () => {
              const { data } = await supabase
                .from("whatsapp_business_accounts")
                .select("id")
                .eq("phone_number_id", metadata?.phone_number_id)
                .eq("is_active", true)
                .single();
              return data;
            }
          );

          // Process incoming messages (parallelized with error isolation)
          if (value.messages) {
            const insertResults = await Promise.allSettled(
              value.messages.map(async (msg: Record<string, unknown>) => {
                const messageData: Record<string, unknown> = {
                  message_id: msg.id,
                  from_phone: msg.from,
                  to_phone: (metadata as Record<string, unknown>)?.display_phone_number || "",
                  direction: "inbound",
                  type: msg.type || "text",
                  status: "received",
                  waba_id: wabaAccount?.id || null,
                };

                // Extract content by type
                if (msg.type === "text") {
                  messageData.text_body = (msg.text as Record<string, unknown>)?.body;
                } else if (msg.type === "image") {
                  messageData.text_body = (msg.image as Record<string, unknown>)?.caption || "[Imagem]";
                  messageData.media_url = (msg.image as Record<string, unknown>)?.id; // Media ID, needs download
                  messageData.media_mime_type = (msg.image as Record<string, unknown>)?.mime_type;
                } else if (msg.type === "video") {
                  messageData.text_body = (msg.video as Record<string, unknown>)?.caption || "[Vídeo]";
                  messageData.media_url = (msg.video as Record<string, unknown>)?.id;
                  messageData.media_mime_type = (msg.video as Record<string, unknown>)?.mime_type;
                } else if (msg.type === "audio") {
                  messageData.text_body = "[Áudio]";
                  messageData.media_url = (msg.audio as Record<string, unknown>)?.id;
                  messageData.media_mime_type = (msg.audio as Record<string, unknown>)?.mime_type;
                } else if (msg.type === "document") {
                  messageData.text_body = (msg.document as Record<string, unknown>)?.filename || "[Documento]";
                  messageData.media_url = (msg.document as Record<string, unknown>)?.id;
                  messageData.media_mime_type = (msg.document as Record<string, unknown>)?.mime_type;
                } else if (msg.type === "interactive") {
                  const interactive = msg.interactive as Record<string, unknown>;
                  messageData.interactive_type = interactive?.type;
                  messageData.interactive_payload = interactive;
                  messageData.text_body =
                    (interactive?.button_reply as Record<string, unknown>)?.title ||
                    (interactive?.list_reply as Record<string, unknown>)?.title ||
                    "[Interativo]";
                } else {
                  messageData.text_body = `[${msg.type}]`;
                }

                // Check for contact info
                if (value.contacts?.[0]) {
                  const contact = value.contacts[0];
                  // Store contact name in conversation context if needed
                  console.log(`Contact: ${contact.profile?.name} (${msg.from})`);
                }

                const { error: insertError } = await supabase
                  .from("whatsapp_messages")
                  .insert(messageData);

                if (insertError) {
                  throw insertError;
                }

                console.log(`Inbound message saved from ${msg.from}`);
              })
            );

            // Log any failed inserts without crashing the webhook
            insertResults.forEach((result, index) => {
              if (result.status === "rejected") {
                console.error(`Error saving message[${index}]:`, result.reason);
              }
            });
          }

          // Process status updates (parallelized)
          if (value.statuses) {
            const statusResults = await Promise.allSettled(
              value.statuses.map(async (status: any) => {
                const { error: updateError } = await supabase
                  .from("whatsapp_messages")
                  .update({
                    status: status.status,
                    status_timestamp: status.timestamp
                      ? new Date(parseInt(status.timestamp) * 1000).toISOString()
                      : new Date().toISOString(),
                    conversation_id: status.conversation?.id || null,
                    conversation_origin: status.conversation?.origin?.type || null,
                    conversation_category: status.pricing?.category || null,
                    is_billable: status.pricing?.billable || false,
                  })
                  .eq("message_id", status.id);

                if (updateError) throw updateError;
                console.log(`Status updated: ${status.id} -> ${status.status}`);
              })
            );
            statusResults.forEach((result, i) => {
              if (result.status === "rejected") {
                console.error(`Error updating status[${i}]:`, result.reason);
              }
            });
          }
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response("Error", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
