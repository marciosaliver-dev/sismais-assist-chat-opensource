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
    const { client_id, note, category = "atendimento", agent_id } = body;

    if (!client_id || !note) {
      return new Response(JSON.stringify({ error: "client_id e note sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if helpdesk_client_notes table exists
    const { error: insertError } = await supabase
      .from("helpdesk_client_notes")
      .insert({
        client_id,
        content: note,
        category,
        created_by: agent_id || null,
      });

    if (insertError) {
      // Try alternative table name
      if (insertError.message.includes("does not exist")) {
        const { error: altError } = await supabase
          .from("helpdesk_client_annotations")
          .insert({
            client_id,
            content: note,
            category,
            created_by: agent_id || null,
          });

        if (altError) {
          console.error("[add-client-note] Error:", altError);
          return new Response(JSON.stringify({ error: "Falha ao adicionar anotacao", details: altError }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        console.error("[add-client-note] Error:", insertError);
        return new Response(JSON.stringify({ error: "Falha ao adicionar anotacao", details: insertError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("[add-client-note] Note added for client " + client_id);

    return new Response(
      JSON.stringify({
        success: true,
        client_id,
        note: note.substring(0, 100) + (note.length > 100 ? "..." : ""),
        category,
        created_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[add-client-note] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
