import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { trigger_id, conversation_id, action_type, action_config, trigger_type } = body;

    if (!conversation_id || !action_type) {
      return new Response(JSON.stringify({ error: "conversation_id e action_type sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select("id, customer_phone, customer_name, status, handler_type, ticket_subject")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: "Conversa nao encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = { success: true };

    // Execute action based on type
    switch (action_type) {
      case "send_message":
        // Send proactive message via WhatsApp
        const template = action_config?.template || "Olá! Como posso ajudá-lo?";
        const messageText = template
          .replace("{cliente}", conversation.customer_name || "Cliente")
          .replace("{assunto}", conversation.ticket_subject || "");

        // Find instance
        const { data: instance } = await supabase
          .from("uazapi_instances")
          .select("id")
          .eq("is_active", true)
          .limit(1)
          .single();

        if (instance && conversation.customer_phone) {
          const chatJid = `${conversation.customer_phone}@s.whatsapp.net`;

          const { error: sendError } = await supabase.functions.invoke("uazapi-proxy", {
            body: {
              action: "sendMessage",
              instanceId: instance.id,
              chatJid: chatJid,
              text: messageText,
            },
          });

          if (sendError) {
            console.error("[process-proactive-trigger] Send error:", sendError);
            result = { success: false, error: sendError };
          }

          // Log the action
          await supabase.from("ai_actions_log").insert({
            action_type: "proactive_message_sent",
            conversation_id,
            tool_name: "uazapi-proxy",
            parameters: { trigger_id, message: messageText },
            result: sendError ? null : { sent: true },
            success: !sendError,
          });
        }
        break;

      case "escalate":
        // Escalate conversation to human
        await supabase
          .from("ai_conversations")
          .update({
            handler_type: "human",
            status: "aguardando",
            priority: action_config?.priority === "high" ? "alta" : "media",
          })
          .eq("id", conversation_id);

        await supabase.from("ai_actions_log").insert({
          action_type: "proactive_escalation",
          conversation_id,
          tool_name: "escalate",
          parameters: { trigger_id, reason: action_config?.reason },
          result: { escalated: true },
          success: true,
        });
        break;

      case "add_tag":
        // Add tag to conversation
        const currentTags = (conversation as any).tags || [];
        const newTag = action_config?.tag || `proactive:${trigger_type}`;

        await supabase
          .from("ai_conversations")
          .update({
            tags: [...new Set([...currentTags, newTag])],
          })
          .eq("id", conversation_id);

        await supabase.from("ai_actions_log").insert({
          action_type: "proactive_tag_added",
          conversation_id,
          parameters: { trigger_id, tag: newTag },
          result: { tagged: true },
          success: true,
        });
        break;

      case "update_priority":
        // Update conversation priority
        await supabase
          .from("ai_conversations")
          .update({
            priority: action_config?.priority || "alta",
          })
          .eq("id", conversation_id);

        await supabase.from("ai_actions_log").insert({
          action_type: "proactive_priority_update",
          conversation_id,
          parameters: { trigger_id, priority: action_config?.priority },
          result: { updated: true },
          success: true,
        });
        break;

      case "create_reminder":
        // Create reminder for follow-up
        const { data: reminder, error: reminderError } = await supabase
          .from("ai_reminders")
          .insert({
            title: action_config?.title || `Follow-up: ${conversation.ticket_subject}`,
            description: action_config?.reason || "Lembrete criado automaticamente",
            due_date: action_config?.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            conversation_id,
            created_by: "ai_agent",
          })
          .select()
          .single();

        await supabase.from("ai_actions_log").insert({
          action_type: "proactive_reminder_created",
          conversation_id,
          tool_name: "create_reminder",
          parameters: { trigger_id, title: action_config?.title },
          result: reminder,
          success: !reminderError,
        });
        break;

      default:
        result = { success: false, error: `Unknown action type: ${action_type}` };
    }

    console.log(`[process-proactive-trigger] Executed ${action_type} for conversation ${conversation_id}`);

    return new Response(
      JSON.stringify({
        success: result.success,
        action_type,
        conversation_id,
        trigger_id,
        result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-proactive-trigger] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
