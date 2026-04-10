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
    const { title, description, due_date, assign_to, client_id, conversation_id } = body;

    if (!title || !due_date) {
      return new Response(JSON.stringify({ error: "title e due_date sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to use ai_reminders table first
    const { data: reminder, error: insertError } = await supabase
      .from("ai_reminders")
      .insert({
        title: title,
        description: description || null,
        due_date: due_date,
        client_id: client_id || null,
        conversation_id: conversation_id || null,
        assigned_to: assign_to || null,
        created_by: "ai_agent",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[create-reminder] Table error:", insertError);
      
      // Fallback: Create as a conversation with special metadata
      const { data: fallbackReminder, error: fallbackError } = await supabase
        .from("ai_conversations")
        .insert({
          ticket_subject: "[Lembrete] " + title,
          ticket_description: description ? { text: description } : null,
          customer_phone: "00000000000",
          status: "novo",
          handler_type: "ai",
          priority: "media",
          tags: ["reminder", "scheduled"],
          context: {
            type: "reminder",
            due_date,
            client_id,
            conversation_id,
            assigned_to: assign_to,
            created_by: "ai_agent",
          } as any,
          started_at: due_date,
        })
        .select()
        .single();

      if (fallbackError) {
        console.error("[create-reminder] Fallback error:", fallbackError);
        return new Response(JSON.stringify({ error: "Falha ao criar lembrete", details: fallbackError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[create-reminder] Reminder created (fallback): " + fallbackReminder.id);

      return new Response(
        JSON.stringify({
          success: true,
          reminder_id: fallbackReminder.id,
          title: fallbackReminder.ticket_subject,
          due_date: due_date,
          assigned_to: assign_to || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-reminder] Reminder created: " + reminder.id);

    return new Response(
      JSON.stringify({
        success: true,
        reminder_id: reminder.id,
        title: reminder.title,
        due_date: due_date,
        assigned_to: assign_to || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-reminder] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
