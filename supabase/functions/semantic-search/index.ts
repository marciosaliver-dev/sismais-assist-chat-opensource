// SHIM: esta função foi consolidada em rag-search (mode='vector') a partir de v2.73.3.
// Mantida aqui apenas para backward compat de consumers legacy.
// Após 14 dias de zero chamadas, pode ser deletada (Onda 2B).
//
// Adapta o shape de request/response antigo e delega para rag-search.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, category, tags, match_count, match_threshold, product_id } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delega para rag-search em mode=vector (comportamento idêntico ao antigo semantic-search)
    const { data, error } = await supabase.functions.invoke("rag-search", {
      body: {
        query: query.trim(),
        mode: "vector",
        top_k: match_count ?? 20,
        similarity_threshold: match_threshold ?? 0.5,
        category_filter: category || null,
        tags_filter: tags?.length ? tags : null,
        product_id: product_id || null,
      },
    });

    if (error) {
      console.error("[semantic-search shim] rag-search error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Search error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Shape legado: { results }
    return new Response(
      JSON.stringify({ results: data?.results || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[semantic-search shim] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
