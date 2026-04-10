// SHIM: esta função foi consolidada em rag-search (mode='quality') a partir de v2.73.3.
// Mantida aqui apenas para backward compat de consumers legacy.
// Após 14 dias de zero chamadas, pode ser deletada (Onda 2B).
//
// Adapta o shape de request/response antigo e delega para rag-search.

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
    const body = await req.json();
    const { query, top_k = 5, category, product_id, agent_id } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: "query e obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delega para rag-search em mode=quality
    const { data, error } = await supabase.functions.invoke("rag-search", {
      body: {
        query,
        mode: "quality",
        top_k,
        category_filter: category || null,
        product_id: product_id || null,
        agent_id,
      },
    });

    if (error) {
      console.error("[knowledge-search shim] rag-search error:", error);
      return new Response(
        JSON.stringify({ error: "Falha na busca", details: String(error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log para analytics (mantido do comportamento original)
    if (agent_id) {
      supabase
        .from("ai_audit_log")
        .insert({
          conversation_id: null,
          action: "knowledge_search",
          agent_id,
          details: { query, results_count: (data?.results || []).length, via: "shim" },
        })
        .then(() => {}, () => {}); // fire-and-forget
    }

    // Adapta para shape legado de knowledge-search
    return new Response(
      JSON.stringify({
        query,
        results: data?.results || [],
        total: data?.count || 0,
        searched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[knowledge-search shim] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
