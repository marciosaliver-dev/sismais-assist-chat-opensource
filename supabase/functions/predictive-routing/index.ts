import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface RoutingRequest {
  action: "route" | "analyze" | "rules" | "agents" | "feedback" | "dashboard"
  client_id?: string
  conversation_id?: string
  intent_category?: string
  sentiment_score?: number
  requires_human?: boolean
  priority?: number
  routed_to?: string
  resolution_time_minutes?: number
  customer_satisfied?: boolean
  was_correct?: boolean
  time_range?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: RoutingRequest = await req.json()
    const { action } = body

    switch (action) {
      case "route": {
        const {
          client_id, conversation_id, intent_category,
          sentiment_score, requires_human, priority
        } = body

        if (!conversation_id) {
          return new Response(
            JSON.stringify({ error: "conversation_id e obrigatorio" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data: score, error } = await supabase.rpc("calculate_routing_score", {
          p_client_id: client_id,
          p_intent_category: intent_category || "general",
          p_sentiment_score: sentiment_score || 0.5,
          p_requires_human: requires_human || false,
          p_priority: priority || 1,
        })

        if (error) throw error

        const routingResult = score

        if (routingResult.route_to === "human" || routingResult.route_to === "specialist") {
          const { data: agent } = await supabase.rpc("find_best_agent", {
            p_agent_type: routingResult.route_to,
            p_required_skill: routingResult.recommended_agent_type,
            p_max_load: 5,
          })
          routingResult.best_agent = agent
        }

        return new Response(
          JSON.stringify({ success: true, routing: routingResult }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "rules": {
        const { data: rules, error } = await supabase
          .from("ai_routing_rules")
          .select("*")
          .eq("is_active", true)
          .order("priority", { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, rules }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "agents": {
        const { data: agents, error } = await supabase
          .from("ai_agent_performance_scores")
          .select("*")
          .eq("is_online", true)
          .order("current_load", { ascending: true })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, agents }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "feedback": {
        const { conversation_id, routed_to, resolution_time_minutes, customer_satisfied } = body

        if (!conversation_id || !routed_to) {
          return new Response(
            JSON.stringify({ error: "conversation_id e routed_to sao obrigatorios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("record_routing_outcome", {
          p_conversation_id: conversation_id,
          p_routed_to: routed_to,
          p_routing_confidence: null,
          p_resolution_time_minutes: resolution_time_minutes,
          p_customer_satisfied: customer_satisfied,
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, feedback_id: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "analyze": {
        const intervalMap: Record<string, string> = {
          "1d": "1 day",
          "7d": "7 days",
          "30d": "30 days",
        }

        const { data, error } = await supabase.rpc("analyze_routing_accuracy", {
          p_time_range: intervalMap[body.time_range || "7d"] || "7 days",
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, analysis: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "dashboard": {
        const { data: routingStats } = await supabase
          .from("ai_routing_feedback")
          .select("*")
          .gte("created_at", `NOW() - INTERVAL '30 days'`)

        const { data: agentStats } = await supabase
          .from("ai_agent_performance_scores")
          .select("*")

        const { data: rules } = await supabase
          .from("ai_routing_rules")
          .select("*")
          .eq("is_active", true)
          .order("match_count", { ascending: false })
          .limit(10)

        const total = routingStats?.length || 0
        const byType: Record<string, { total: number; satisfaction: number }> = {}

        routingStats?.forEach(r => {
          if (!byType[r.routed_to]) {
            byType[r.routed_to] = { total: 0, satisfaction: 0 }
          }
          byType[r.routed_to].total++
          if (r.customer_satisfied) byType[r.routed_to].satisfaction++
        })

        Object.keys(byType).forEach(type => {
          byType[type].satisfaction = byType[type].total > 0
            ? Math.round((byType[type].satisfaction / byType[type].total) * 100)
            : 0
        })

        return new Response(
          JSON.stringify({
            success: true,
            dashboard: {
              last_30_days: {
                total_routings: total,
                by_type: byType,
                avg_resolution_time: Math.round(
                  routingStats?.reduce((s, r) => s + (r.resolution_time_minutes || 0), 0) / total || 0
                ),
              },
              agents: {
                online: agentStats?.filter(a => a.is_online).length || 0,
                available: agentStats?.filter(a => a.is_available).length || 0,
                avg_load: Math.round(
                  agentStats?.reduce((s, a) => s + a.current_load, 0) / (agentStats?.length || 1) || 0
                ),
              },
              top_rules: rules,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Acao desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
  } catch (error) {
    console.error("Error in predictive-routing:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
