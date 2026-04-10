import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface HealthRequest {
  action: "health" | "history" | "components" | "predictions" | "churn" | "staffing" | "dashboard"
  days_ahead?: number
  client_id?: string
  date?: string
  hours?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: HealthRequest = await req.json()
    const { action } = body

    switch (action) {
      case "health": {
        const { data, error } = await supabase.rpc("calculate_system_health_score")
        if (error) throw error
        return new Response(
          JSON.stringify({ success: true, health: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "history": {
        const { hours = 24 } = body
        const { data, error } = await supabase
          .from("ai_health_scores")
          .select("*")
          .gte("created_at", `NOW() - INTERVAL '${hours} hours'`)
          .order("created_at", { ascending: false })

        if (error) throw error

        const history = data || []
        const avgScore = history.length > 0
          ? history.reduce((s, h) => s + (h.overall_score || 0), 0) / history.length
          : 100

        return new Response(
          JSON.stringify({
            success: true,
            history,
            summary: {
              avg_score: Math.round(avgScore * 100) / 100,
              min_score: Math.min(...history.map((h: any) => h.overall_score || 100)),
              max_score: Math.max(...history.map((h: any) => h.overall_score || 100)),
              total_records: history.length,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "components": {
        const { data, error } = await supabase
          .from("ai_component_health")
          .select("*")
          .order("is_critical", { ascending: false })
          .order("component_name")

        if (error) throw error

        const healthy = data?.filter(c => c.status === "healthy").length || 0
        const warning = data?.filter(c => c.status === "warning").length || 0
        const down = data?.filter(c => c.status === "down").length || 0

        return new Response(
          JSON.stringify({
            success: true,
            components: data,
            summary: { healthy, warning, down, total: data?.length || 0 },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "predictions": {
        const { days_ahead = 7 } = body
        const predictions = []

        for (let i = 1; i <= days_ahead; i++) {
          const { data, error } = await supabase.rpc("predict_ticket_volume", {
            p_days_ahead: i,
          })
          if (!error && data) {
            predictions.push(data)
          }
        }

        return new Response(
          JSON.stringify({ success: true, predictions }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "churn": {
        const { client_id } = body

        if (!client_id) {
          return new Response(
            JSON.stringify({ error: "client_id e obrigatorio" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data, error } = await supabase.rpc("calculate_churn_risk", {
          p_client_id: client_id,
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, churn_risk: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "staffing": {
        const { date } = body
        const targetDate = date ? new Date(date) : new Date()

        const { data, error } = await supabase.rpc("predict_staffing_needs", {
          p_date: targetDate.toISOString().split("T")[0],
        })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, staffing: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "dashboard": {
        const [healthResult, historyResult, componentsResult, predictionsResult] = await Promise.all([
          supabase.rpc("calculate_system_health_score"),
          supabase.from("ai_health_scores").select("*").gte("created_at", "NOW() - INTERVAL '24 hours'").order("created_at", { ascending: false }),
          supabase.from("ai_component_health").select("*"),
          supabase.rpc("predict_ticket_volume", { p_days_ahead: 7 }),
        ])

        const health = healthResult.data
        const history = historyResult.data || []
        const components = componentsResult.data || []
        const predictions = predictionsResult.data

        const statusCounts = components.reduce((acc: any, c: any) => {
          acc[c.status] = (acc[c.status] || 0) + 1
          return acc
        }, {})

        return new Response(
          JSON.stringify({
            success: true,
            dashboard: {
              current_health: {
                overall_score: health?.overall_score || 0,
                status: health?.status || "unknown",
                scores: health?.scores || {},
                alerts: health?.alerts || [],
              },
              trends: {
                last_24h: {
                  avg_score: history.length > 0
                    ? Math.round(history.reduce((s: number, h: any) => s + (h.overall_score || 0), 0) / history.length)
                    : 0,
                  min_score: Math.min(...history.map((h: any) => h.overall_score || 100)),
                  records: history.length,
                },
              },
              components: {
                healthy: statusCounts.healthy || 0,
                warning: statusCounts.warning || 0,
                down: statusCounts.down || 0,
                list: components,
              },
              predictions: predictions || {},
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
    console.error("Error in system-health-monitor:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
