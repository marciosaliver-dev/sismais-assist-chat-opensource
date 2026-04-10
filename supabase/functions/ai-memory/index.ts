import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface MemoryRequest {
  action: "store" | "retrieve" | "summarize" | "update_session" | "get_customer" | "store_customer"
  conversation_id?: string
  client_id?: string
  memory_type?: string
  content?: string
  importance_score?: number
  metadata?: Record<string, any>
  session_id?: string
  agent_id?: string
  intent?: string
  sentiment?: string
  memory_types?: string[]
  min_importance?: number
  min_confidence?: number
  limit?: number
  context_data?: Record<string, any>
  source?: string
  confidence_score?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: MemoryRequest = await req.json()
    const { action } = body

    switch (action) {
      case "store": {
        const { conversation_id, agent_id, memory_type, content, importance_score, metadata } = body
        
        if (!conversation_id || !memory_type || !content) {
          return new Response(
            JSON.stringify({ error: "conversation_id, memory_type e content são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("store_conversation_memory", {
          p_conversation_id: conversation_id,
          p_agent_id: agent_id,
          p_memory_type: memory_type,
          p_content: content,
          p_importance_score: importance_score ?? 0.5,
          p_metadata: metadata ?? {},
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, memory_id: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "retrieve": {
        const { conversation_id, memory_types, min_importance, limit } = body
        
        if (!conversation_id) {
          return new Response(
            JSON.stringify({ error: "conversation_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("get_conversation_memory", {
          p_conversation_id: conversation_id,
          p_memory_types: memory_types ?? null,
          p_min_importance: min_importance ?? 0,
          p_limit: limit ?? 50,
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, memories: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "summarize": {
        const { conversation_id } = body
        
        if (!conversation_id) {
          return new Response(
            JSON.stringify({ error: "conversation_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("generate_conversation_summary", {
          p_conversation_id: conversation_id,
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, summary: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "update_session": {
        const { session_id, conversation_id, agent_id, context_data, intent, sentiment } = body
        
        if (!session_id) {
          return new Response(
            JSON.stringify({ error: "session_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("update_session_context", {
          p_session_id: session_id,
          p_conversation_id: conversation_id,
          p_agent_id: agent_id,
          p_context_data: context_data ?? null,
          p_intent: intent,
          p_sentiment: sentiment,
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, context_id: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "get_customer": {
        const { client_id, memory_types, min_confidence, limit } = body
        
        if (!client_id) {
          return new Response(
            JSON.stringify({ error: "client_id é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("get_customer_memory", {
          p_client_id: client_id,
          p_memory_types: memory_types ?? null,
          p_min_confidence: min_confidence ?? 0,
          p_limit: limit ?? 20,
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, memories: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "store_customer": {
        const { client_id, memory_type, content, source, confidence_score, metadata } = body
        
        if (!client_id || !memory_type || !content) {
          return new Response(
            JSON.stringify({ error: "client_id, memory_type e content são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("store_customer_memory", {
          p_client_id: client_id,
          p_memory_type: memory_type,
          p_content: content,
          p_source: source ?? null,
          p_confidence_score: confidence_score ?? 0.5,
          p_metadata: metadata ?? {},
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, memory_id: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
  } catch (error) {
    console.error("Error in ai-memory:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
