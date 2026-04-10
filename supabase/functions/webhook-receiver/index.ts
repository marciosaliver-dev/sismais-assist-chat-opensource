import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const token = pathParts[pathParts.length - 1];

  if (!token || token === "webhook-receiver") {
    return new Response(JSON.stringify({ error: "Token required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Look up webhook by token
  const { data: webhook, error: webhookError } = await supabase
    .from("incoming_webhooks")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (webhookError || !webhook) {
    return new Response(JSON.stringify({ error: "Webhook not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    const rawText = await req.text();
    // Limit payload size to 100KB
    if (rawText.length > 102400) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    payload = rawText ? JSON.parse(rawText) : {};
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      payload = {};
    }
  } catch {
    payload = {};
  }

  // Create log entry
  const { data: logEntry } = await supabase
    .from("webhook_logs")
    .insert({
      webhook_id: webhook.id,
      payload,
      execution_status: "received",
    })
    .select()
    .single();

  const logId = logEntry?.id;

  try {
    if (webhook.template_type === "billing") {
      // Route billing webhooks to specialized webhook-billing function
      const billingResponse = await fetch(`${supabaseUrl}/functions/v1/webhook-billing`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!billingResponse.ok) {
        throw new Error(`webhook-billing returned ${billingResponse.status}`);
      }
    } else if (webhook.action_mode === "flow" && webhook.flow_automation_id) {
      // Invoke flow-executor
      await supabase.functions.invoke("flow-executor", {
        body: {
          flow_id: webhook.flow_automation_id,
          trigger_data: { webhook_payload: payload, field_mapping: webhook.field_mapping },
        },
      });
    } else if (webhook.action_mode === "direct") {
      const actions = webhook.actions || [];
      const fieldMapping = webhook.field_mapping || {};

      for (const action of actions) {
        await executeAction(supabase, action, payload, fieldMapping, supabaseUrl, supabaseKey);
      }
    }

    const executionTime = Date.now() - startTime;

    // Update log status
    if (logId) {
      await supabase
        .from("webhook_logs")
        .update({ execution_status: "success", execution_time_ms: executionTime })
        .eq("id", logId);
    }

    // Update webhook stats
    await supabase
      .from("incoming_webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (webhook.trigger_count || 0) + 1,
      })
      .eq("id", webhook.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const executionTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (logId) {
      await supabase
        .from("webhook_logs")
        .update({
          execution_status: "error",
          error_message: errorMessage,
          execution_time_ms: executionTime,
        })
        .eq("id", logId);
    }

    return new Response(JSON.stringify({ received: true, warning: "Execution had errors" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function mapPayloadFields(
  payload: Record<string, unknown>,
  fieldMapping: Record<string, string>
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [payloadPath, systemField] of Object.entries(fieldMapping)) {
    const value = getNestedValue(payload, payloadPath);
    if (value !== undefined) {
      mapped[systemField] = value;
    }
  }
  return mapped;
}

async function executeAction(
  supabase: any,
  action: Record<string, unknown>,
  payload: Record<string, unknown>,
  fieldMapping: Record<string, string>,
  supabaseUrl: string,
  supabaseKey: string
) {
  const actionType = action.action_type as string;
  const config = (action.config || {}) as Record<string, unknown>;

  switch (actionType) {
    case "map_client_fields": {
      const mappedFields = mapPayloadFields(payload, fieldMapping);
      const clientData: Record<string, unknown> = {};

      for (const [systemField, value] of Object.entries(mappedFields)) {
        if (systemField.startsWith("helpdesk_clients.")) {
          clientData[systemField.replace("helpdesk_clients.", "")] = value;
        }
      }

      if (clientData.phone || clientData.cnpj) {
        // Try to find existing client
        let query = supabase.from("helpdesk_clients").select("id");
        if (clientData.cnpj) {
          query = query.eq("cnpj", clientData.cnpj as string);
        } else if (clientData.phone) {
          query = query.eq("phone", clientData.phone as string);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
          await supabase
            .from("helpdesk_clients")
            .update(clientData)
            .eq("id", existing.id);
          // Store client id for later actions
          (payload as Record<string, unknown>)._mapped_client_id = existing.id;
        } else if (clientData.name) {
          const { data: newClient } = await supabase
            .from("helpdesk_clients")
            .insert(clientData)
            .select("id")
            .single();
          if (newClient) {
            (payload as Record<string, unknown>)._mapped_client_id = newClient.id;
          }
        }
      }
      break;
    }

    case "create_conversation": {
      const convData: Record<string, unknown> = {
        customer_phone: (payload.phone as string) || (payload.telefone as string) || "unknown",
        customer_name: (payload.name as string) || (payload.nome as string) || null,
        status: "active",
      };

      if (config.board_id) convData.kanban_board_id = config.board_id;
      if (config.stage_id) convData.kanban_stage_id = config.stage_id;
      if (config.agent_id) convData.human_agent_id = config.agent_id;
      if (config.ai_agent_id) convData.current_agent_id = config.ai_agent_id;
      if ((payload as Record<string, unknown>)._mapped_client_id) {
        convData.helpdesk_client_id = (payload as Record<string, unknown>)._mapped_client_id;
      }

      const { data: conv } = await supabase
        .from("ai_conversations")
        .insert(convData)
        .select("id")
        .single();

      if (conv) {
        (payload as Record<string, unknown>)._created_conversation_id = conv.id;
      }
      break;
    }

    case "assign_board_stage": {
      const conversationId = (payload as Record<string, unknown>)._created_conversation_id;
      if (conversationId) {
        const updates: Record<string, unknown> = {};
        if (config.board_id) updates.kanban_board_id = config.board_id;
        if (config.stage_id) updates.kanban_stage_id = config.stage_id;
        await supabase
          .from("ai_conversations")
          .update(updates)
          .eq("id", conversationId);
      }
      break;
    }

    case "assign_agent": {
      const conversationId = (payload as Record<string, unknown>)._created_conversation_id;
      if (conversationId) {
        const updates: Record<string, unknown> = {};
        if (config.human_agent_id) updates.human_agent_id = config.human_agent_id;
        if (config.ai_agent_id) updates.current_agent_id = config.ai_agent_id;
        if (config.handler_type) updates.handler_type = config.handler_type;
        await supabase
          .from("ai_conversations")
          .update(updates)
          .eq("id", conversationId);
      }
      break;
    }

    case "send_welcome_message": {
      const message = config.message as string;
      const instanceId = config.instance_id as string;
      const phone = (payload.phone as string) || (payload.telefone as string);

      if (message && phone) {
        try {
          await supabase.functions.invoke("whatsapp-send", {
            body: {
              instance_id: instanceId,
              phone,
              message,
            },
          });
        } catch (e) {
          console.error("Failed to send welcome message:", e);
        }
      }
      break;
    }
  }
}
