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
    const {
      title,
      description,
      priority = "media",
      customer_phone,
      customer_name,
      customer_email,
      tags = [],
      stage,
      board_slug,
      conversation_id,
    } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "title obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create the board
    let boardId: string | null = null;
    let stageId: string | null = null;

    if (board_slug) {
      const { data: board } = await supabase
        .from("kanban_boards")
        .select("id")
        .eq("slug", board_slug)
        .single();

      if (board) {
        boardId = board.id;

        // Find the stage
        if (stage) {
          const stageMap: Record<string, string> = {
            novo: "Novo",
            em_atendimento: "Em Atendimento",
            aguardando: "Aguardando Cliente",
            resolvido: "Resolvido",
            fechado: "Fechado",
          };

          const { data: stageData } = await supabase
            .from("kanban_stages")
            .select("id")
            .eq("board_id", board.id)
            .ilike("name", stageMap[stage] || stage)
            .single();

          if (stageData) {
            stageId = stageData.id;
          }
        }
      }
    }

    // Generate ticket number
    const { count } = await supabase
      .from("ai_conversations")
      .select("*", { count: "exact", head: true });

    const ticketNumber = (count || 0) + 1;

    // Create the conversation/ticket
    const convData: any = {
      ticket_subject: title,
      ticket_description: description ? { text: description } : null,
      priority: priority === "critica" ? "alta" : priority,
      customer_phone: customer_phone || null,
      customer_name: customer_name || null,
      customer_email: customer_email || null,
      tags: tags.length > 0 ? tags : null,
      status: "novo",
      handler_type: "ai",
      ticket_number: ticketNumber,
      started_at: new Date().toISOString(),
    };

    if (boardId) {
      convData.kanban_board_id = boardId;
    }

    if (stageId) {
      convData.kanban_stage_id = stageId;
    }

    if (conversation_id) {
      convData.related_conversation_id = conversation_id;
    }

    const { data: conv, error: convError } = await supabase
      .from("ai_conversations")
      .insert(convData)
      .select()
      .single();

    if (convError) {
      console.error("[kanban-create-ticket] Error:", convError);
      return new Response(JSON.stringify({ error: "Falha ao criar ticket", details: convError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[kanban-create-ticket] Created ticket #" + ticketNumber + ": " + title);

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: conv.id,
        ticket_number: ticketNumber,
        title: conv.ticket_subject,
        board: board_slug || null,
        stage: stage || "novo",
        priority: conv.priority,
        status: conv.status,
        url: "/inbox?ticket=" + conv.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[kanban-create-ticket] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
