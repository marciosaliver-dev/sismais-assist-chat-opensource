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
    const { ticket_id, stage, notes, priority, assigned_to } = body;

    if (!ticket_id || !stage) {
      return new Response(JSON.stringify({ error: "ticket_id e stage sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the card
    const { data: card, error: cardError } = await supabase
      .from("kanban_cards")
      .select("id, board_id, stage_id, ticket_number")
      .eq("id", ticket_id)
      .single();

    if (cardError || !card) {
      return new Response(JSON.stringify({ error: "Ticket nao encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the new stage
    const stageMap = {
      novo: "Novo",
      em_atendimento: "Em Atendimento",
      aguardando: "Aguardando",
      resolvido: "Resolvido",
      fechado: "Fechado",
    };

    const { data: newStage } = await supabase
      .from("kanban_stages")
      .select("id, name")
      .eq("board_id", card.board_id)
      .ilike("name", stageMap[stage] || stage)
      .single();

    if (!newStage) {
      return new Response(JSON.stringify({ error: "Estagio nao encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update object
    const updateData: any = {
      stage_id: newStage.id,
    };

    if (priority) {
      updateData.priority = priority;
    }

    if (assigned_to) {
      updateData.assigned_to = assigned_to;
    }

    // Add notes to metadata
    if (notes) {
      const { data: existingCard } = await supabase
        .from("kanban_cards")
        .select("metadata")
        .eq("id", ticket_id)
        .single();

      const existingNotes = existingCard?.metadata?.notes || [];
      updateData.metadata = {
        ...(existingCard?.metadata || {}),
        notes: [...existingNotes, { text: notes, at: new Date().toISOString() }],
      };
    }

    // Update the card
    const { data: updatedCard, error: updateError } = await supabase
      .from("kanban_cards")
      .update(updateData)
      .eq("id", ticket_id)
      .select()
      .single();

    if (updateError) {
      console.error("[kanban-update-ticket] Error:", updateError);
      return new Response(JSON.stringify({ error: "Falha ao atualizar ticket", details: updateError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[kanban-update-ticket] Updated " + card.ticket_number + " to " + newStage.name);

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: updatedCard.id,
        ticket_number: card.ticket_number,
        new_stage: newStage.name,
        updated_at: updatedCard.updated_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[kanban-update-ticket] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
