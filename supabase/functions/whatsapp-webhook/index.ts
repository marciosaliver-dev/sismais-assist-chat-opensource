import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UazapiMessage {
  event: string;
  instanceId: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { url: string; mimetype: string; caption?: string };
      audioMessage?: { url: string; mimetype: string; seconds: number };
      videoMessage?: { url: string; mimetype: string; caption?: string; seconds: number };
      documentMessage?: { url: string; mimetype: string; fileName: string };
    };
    messageTimestamp?: number;
    status?: string;
  };
}

function extractPhoneNumber(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

function extractMessageContent(message: UazapiMessage["data"]["message"]): {
  type: string;
  content: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaDuration?: number;
} {
  if (!message) {
    return { type: "text", content: "" };
  }

  if (message.conversation) {
    return { type: "text", content: message.conversation };
  }

  if (message.extendedTextMessage?.text) {
    return { type: "text", content: message.extendedTextMessage.text };
  }

  if (message.imageMessage) {
    return {
      type: "image",
      content: message.imageMessage.caption || "[Imagem]",
      mediaUrl: message.imageMessage.url,
      mediaMimeType: message.imageMessage.mimetype,
    };
  }

  if (message.audioMessage) {
    return {
      type: "audio",
      content: "[Áudio]",
      mediaUrl: message.audioMessage.url,
      mediaMimeType: message.audioMessage.mimetype,
      mediaDuration: message.audioMessage.seconds,
    };
  }

  if (message.videoMessage) {
    return {
      type: "video",
      content: message.videoMessage.caption || "[Vídeo]",
      mediaUrl: message.videoMessage.url,
      mediaMimeType: message.videoMessage.mimetype,
      mediaDuration: message.videoMessage.seconds,
    };
  }

  if (message.documentMessage) {
    return {
      type: "document",
      content: `[Documento: ${message.documentMessage.fileName}]`,
      mediaUrl: message.documentMessage.url,
      mediaMimeType: message.documentMessage.mimetype,
      mediaFilename: message.documentMessage.fileName,
    };
  }

  return { type: "text", content: "[Mensagem não suportada]" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: UazapiMessage = await req.json();
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    // Handle message events
    if (payload.event === "messages.upsert" && payload.data?.key) {
      const phone = extractPhoneNumber(payload.data.key.remoteJid);
      const messageInfo = extractMessageContent(payload.data.message);
      const isFromMe = payload.data.key.fromMe;

      // Find instance by instanceId
      const { data: instance } = await supabase
        .from("crm_whatsapp_instances")
        .select("id")
        .eq("instance_id", payload.instanceId)
        .single();

      const messageData = {
        lead_phone: phone,
        lead_name: payload.data.pushName || null,
        direction: isFromMe ? "outbound" : "inbound",
        content: messageInfo.content,
        type: messageInfo.type,
        status: "received",
        mode: "manual",
        uza_message_id: payload.data.key.id,
        media_url: messageInfo.mediaUrl || null,
        media_mime_type: messageInfo.mediaMimeType || null,
        media_filename: messageInfo.mediaFilename || null,
        media_duration: messageInfo.mediaDuration || null,
        instance_id: instance?.id || null,
        metadata: {
          raw_event: payload.event,
          timestamp: payload.data.messageTimestamp,
        },
      };

      const { error: insertError } = await supabase
        .from("crm_messages")
        .insert(messageData);

      if (insertError) {
        console.error("Error inserting message:", insertError);
        throw insertError;
      }

      console.log("Message saved successfully:", phone);
    }

    // Handle status updates (delivered, read, played)
    if (payload.event === "messages.update" && payload.data?.status) {
      const statusMap: Record<string, string> = {
        delivered: "delivered_at",
        read: "read_at",
        played: "played_at",
      };

      const column = statusMap[payload.data.status];
      if (column && payload.data.key?.id) {
        await supabase
          .from("crm_messages")
          .update({ [column]: new Date().toISOString() })
          .eq("uza_message_id", payload.data.key.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
