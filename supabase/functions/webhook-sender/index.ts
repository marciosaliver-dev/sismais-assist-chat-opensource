import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { queue_id, webhook_id, conversation_id, event_type, test } = body;

    // Test mode
    if (test && webhook_id) {
      const { data: webhook, error: whErr } = await supabase
        .from("outgoing_webhooks")
        .select("*")
        .eq("id", webhook_id)
        .single();

      if (whErr || !webhook) {
        return new Response(JSON.stringify({ error: "Webhook not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const testPayload = buildBody(webhook.body_template, {
        conversation_id: "test-uuid-1234",
        ticket_status: "em_atendimento",
        kanban_stage: "Etapa Exemplo",
        kanban_board: "Board Exemplo",
        client_name: "Cliente Teste",
        client_phone: "5511999999999",
        client_cnpj: "12.345.678/0001-00",
        client_company: "Empresa Teste LTDA",
        subscribed_product: "Produto Teste",
        human_agent_name: "Agente Teste",
        priority: "alta",
        category: "Suporte",
        module: "Financeiro",
        first_response_seconds: "120",
        resolution_seconds: "3600",
        csat_score: "5",
        created_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        custom_payload: "{}",
      });

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(webhook.headers || {}),
        };

        const fetchOpts: RequestInit = {
          method: webhook.method || "POST",
          headers,
        };

        if (webhook.method !== "GET") {
          fetchOpts.body = testPayload;
        }

        const resp = await fetch(webhook.url, fetchOpts);
        const respText = await resp.text();

        return new Response(
          JSON.stringify({
            success: resp.ok,
            status: resp.status,
            response: respText.substring(0, 2000),
            payload_sent: testPayload,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchErr) {
        return new Response(
          JSON.stringify({ success: false, error: String(fetchErr) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Process queue item
    let targetWebhookId = webhook_id;
    let targetConversationId = conversation_id;
    let targetEventType = event_type;

    if (queue_id) {
      const { data: queueItem } = await supabase
        .from("outgoing_webhook_queue")
        .select("*")
        .eq("id", queue_id)
        .eq("processed", false)
        .single();

      if (!queueItem) {
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetWebhookId = queueItem.webhook_id;
      targetConversationId = queueItem.conversation_id;
      targetEventType = queueItem.event_type;

      await supabase
        .from("outgoing_webhook_queue")
        .update({ processed: true })
        .eq("id", queue_id);
    }

    if (!targetWebhookId || !targetConversationId) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch webhook config
    const { data: webhook } = await supabase
      .from("outgoing_webhooks")
      .select("*")
      .eq("id", targetWebhookId)
      .eq("is_active", true)
      .single();

    if (!webhook) {
      return new Response(JSON.stringify({ skipped: true, reason: "inactive or not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch conversation with joins
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select(`
        *,
        helpdesk_clients:helpdesk_client_id (name, phone, cnpj, company_name, subscribed_product),
        human_agents:human_agent_id (name),
        kanban_boards:kanban_board_id (name),
        kanban_stages:kanban_stage_id (name),
        ticket_categories:ticket_category_id (name),
        ticket_modules:ticket_module_id (name)
      `)
      .eq("id", targetConversationId)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply filters
    const filters = webhook.filters || {};
    if (filters.board_id && conversation.kanban_board_id !== filters.board_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "filter_board" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (filters.priority && conversation.priority !== filters.priority) {
      return new Response(JSON.stringify({ skipped: true, reason: "filter_priority" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build variables
    const client = conversation.helpdesk_clients as any;
    const vars: Record<string, string> = {
      conversation_id: conversation.id,
      ticket_status: conversation.status || "",
      kanban_stage: (conversation.kanban_stages as any)?.name || "",
      kanban_board: (conversation.kanban_boards as any)?.name || "",
      client_name: client?.name || conversation.customer_name || "",
      client_phone: client?.phone || conversation.customer_phone || "",
      client_cnpj: client?.cnpj || "",
      client_company: client?.company_name || "",
      subscribed_product: client?.subscribed_product || "",
      human_agent_name: (conversation.human_agents as any)?.name || "",
      priority: conversation.priority || "",
      category: (conversation.ticket_categories as any)?.name || "",
      module: (conversation.ticket_modules as any)?.name || "",
      first_response_seconds: String(conversation.first_human_response_seconds || ""),
      resolution_seconds: String(conversation.resolution_seconds || ""),
      csat_score: String(conversation.csat_score || ""),
      created_at: conversation.started_at || "",
      resolved_at: conversation.resolved_at || "",
      custom_payload: "{}",
    };

    const payload = buildBody(webhook.body_template, vars);

    // Send HTTP request
    const startTime = Date.now();
    let success = false;
    let statusCode = 0;
    let responseText = "";
    let errorMsg = "";

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(webhook.headers || {}),
      };

      const fetchOpts: RequestInit = {
        method: webhook.method || "POST",
        headers,
      };

      if (webhook.method !== "GET") {
        fetchOpts.body = payload;
      }

      const resp = await fetch(webhook.url, fetchOpts);
      responseText = await resp.text();
      statusCode = resp.status;
      success = resp.ok;
    } catch (err) {
      errorMsg = String(err);
    }

    const executionTime = Date.now() - startTime;

    // Log result
    await supabase.from("webhook_logs").insert({
      outgoing_webhook_id: webhook.id,
      payload: { sent: payload, response: responseText.substring(0, 5000) },
      execution_status: success ? "success" : "error",
      error_message: errorMsg || (success ? null : `HTTP ${statusCode}`),
      execution_time_ms: executionTime,
    });

    // Update webhook stats
    await supabase
      .from("outgoing_webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (webhook.trigger_count || 0) + 1,
      })
      .eq("id", webhook.id);

    return new Response(
      JSON.stringify({ success, status: statusCode, event_type: targetEventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildBody(template: string | null, vars: Record<string, string>): string {
  if (!template) {
    // Default body with all variables
    return JSON.stringify(vars);
  }

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value || "");
  }
  return result;
}
