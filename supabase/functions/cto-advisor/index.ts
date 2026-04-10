import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface CTORequest {
  action: "analyze" | "suggest" | "forecast" | "diagnose" | "compare"
  scope?: "system" | "agents" | "performance" | "costs" | "customer"
  time_range?: "1h" | "24h" | "7d" | "30d"
  specific_entity_id?: string
  focus_areas?: string[]
}

interface AnalysisResult {
  score: number
  status: "healthy" | "warning" | "critical"
  findings: Array<{
    area: string
    issue: string
    impact: "low" | "medium" | "high" | "critical"
    recommendation: string
    metrics?: Record<string, number>
  }>
  summary: string
  next_actions: Array<{
    priority: number
    action: string
    expected_impact: string
  }>
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: CTORequest = await req.json()
    const { action, scope, time_range, specific_entity_id, focus_areas } = body

    const timeRangeMap = {
      "1h": "1 hour",
      "24h": "24 hours",
      "7d": "7 days",
      "30d": "30 days",
    }
    const interval = timeRangeMap[time_range || "24h"]

    switch (action) {
      case "analyze": {
        const result = await performSystemAnalysis(supabase, scope || "system", interval)
        return new Response(JSON.stringify({ success: true, analysis: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      case "suggest": {
        const suggestions = await generateSuggestions(supabase, scope || "system", interval)
        return new Response(JSON.stringify({ success: true, suggestions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      case "forecast": {
        const forecast = await generateForecast(supabase, interval)
        return new Response(JSON.stringify({ success: true, forecast }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      case "diagnose": {
        const diagnosis = await diagnoseIssue(supabase, specific_entity_id || "")
        return new Response(JSON.stringify({ success: true, diagnosis }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      case "compare": {
        const comparison = await comparePerformance(supabase, interval)
        return new Response(JSON.stringify({ success: true, comparison }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }
  } catch (error) {
    console.error("Error in cto-advisor:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

async function performSystemAnalysis(
  supabase: any,
  scope: string,
  interval: string
): Promise<AnalysisResult> {
  const findings: AnalysisResult["findings"] = []
  let overallScore = 100
  let status: AnalysisResult["status"] = "healthy"

  if (scope === "system" || scope === "performance") {
    const { data: metrics } = await supabase.rpc("ai_crm_metrics").select("*").gte("date", `NOW() - INTERVAL '${interval}'`)

    const totalActions = metrics?.reduce((s: number, m: any) => s + (m.total_actions || 0), 0) || 0
    const errors = metrics?.reduce((s: number, m: any) => s + (m.errors || 0), 0) || 0
    const errorRate = totalActions > 0 ? (errors / totalActions) * 100 : 0

    if (errorRate > 5) {
      findings.push({
        area: "Error Rate",
        issue: `Taxa de erro está em ${errorRate.toFixed(1)}% (limite: 5%)`,
        impact: errorRate > 10 ? "critical" : "high",
        recommendation: "Revisar logs de erro e identificar padrões de falha",
        metrics: { errorRate, totalActions, errors },
      })
      overallScore -= 20
      status = errorRate > 10 ? "critical" : "warning"
    }

    const avgLatency = metrics?.reduce((s: number, m: any) => s + (m.avg_execution_ms || 0), 0) / (metrics?.length || 1) || 0
    if (avgLatency > 2000) {
      findings.push({
        area: "Latency",
        issue: `Latência média está em ${avgLatency.toFixed(0)}ms (meta: <2000ms)`,
        impact: avgLatency > 5000 ? "high" : "medium",
        recommendation: "Otimizar queries e adicionar cache onde possível",
        metrics: { avgLatencyMs: avgLatency },
      })
      overallScore -= 10
    }
  }

  if (scope === "system" || scope === "costs") {
    const { data: apiLogs } = await supabase
      .from("ai_api_logs")
      .select("cost_usd, latency_ms, status")
      .gte("created_at", `NOW() - INTERVAL '${interval}'`)

    const totalCost = apiLogs?.reduce((s: number, l: any) => s + (l.cost_usd || 0), 0) || 0
    const avgLatency = apiLogs?.reduce((s: number, l: any) => s + (l.latency_ms || 0), 0) / (apiLogs?.length || 1) || 0

    if (totalCost > 100) {
      findings.push({
        area: "Cost Optimization",
        issue: `Custo em ${interval}: $${totalCost.toFixed(2)}`,
        impact: totalCost > 500 ? "high" : "medium",
        recommendation: "Considerar uso de modelos mais econômicos para queries simples",
        metrics: { totalCostUsd: totalCost, requestCount: apiLogs?.length || 0 },
      })
    }
  }

  if (scope === "system" || scope === "customer") {
    const { data: conversations } = await supabase
      .from("ai_conversations")
      .select("status, handler_type, resolved_at")
      .gte("created_at", `NOW() - INTERVAL '${interval}'`)

    const total = conversations?.length || 0
    const resolved = conversations?.filter((c: any) => c.resolved_at).length || 0
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0

    if (resolutionRate < 60) {
      findings.push({
        area: "Resolution Rate",
        issue: `Taxa de resolução está em ${resolutionRate.toFixed(1)}% (meta: >60%)`,
        impact: resolutionRate < 40 ? "critical" : "high",
        recommendation: "Melhorar fluxos de triagem e aumentar cobertura da base de conhecimento",
        metrics: { resolutionRate, total, resolved },
      })
      overallScore -= 15
      if (resolutionRate < 40) status = "critical"
      else if (status !== "critical") status = "warning"
    }

    const escalated = conversations?.filter((c: any) => c.handler_type === "human").length || 0
    const escalationRate = total > 0 ? (escalated / total) * 100 : 0

    if (escalationRate > 30) {
      findings.push({
        area: "Escalation Rate",
        issue: `Taxa de escalação para humanos: ${escalationRate.toFixed(1)}% (ideal: <20%)`,
        impact: escalationRate > 50 ? "high" : "medium",
        recommendation: "Treinar agentes com mais exemplos e expandir base de conhecimento",
        metrics: { escalationRate, escalated, total },
      })
      overallScore -= 10
    }
  }

  if (scope === "system" || scope === "agents") {
    const { data: agents } = await supabase
      .from("ai_agents")
      .select("id, name, specialty, is_active")

    const { data: performance } = await supabase.from("ai_agent_performance").select("*")

    const inactiveAgents = agents?.filter((a: any) => !a.is_active).length || 0
    const totalAgents = agents?.length || 0

    if (inactiveAgents > totalAgents * 0.3) {
      findings.push({
        area: "Agent Utilization",
        issue: `${inactiveAgents} de ${totalAgents} agentes estão inativos`,
        impact: "medium",
        recommendation: "Ativar agentes não utilizados ou revisar estratégia de roteamento",
        metrics: { inactiveAgents, totalAgents },
      })
      overallScore -= 5
    }
  }

  const nextActions = findings
    .sort((a, b) => {
      const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return impactOrder[a.impact] - impactOrder[b.impact]
    })
    .slice(0, 5)
    .map((f, i) => ({
      priority: i + 1,
      action: f.recommendation,
      expected_impact: `Reduzir impacto de ${f.impact}`,
    }))

  const summary = status === "healthy"
    ? "Sistema operando dentro dos parâmetros esperados"
    : status === "warning"
    ? "Sistema apresenta áreas de melhoria que devem ser tratadas"
    : "Sistema requer atenção imediata em áreas críticas"

  return {
    score: Math.max(0, overallScore),
    status,
    findings,
    summary,
    next_actions: nextActions,
  }
}

async function generateSuggestions(
  supabase: any,
  scope: string,
  interval: string
): Promise<Array<{category: string; priority: string; suggestion: string; details: string; action: string}>> {
  const suggestions: Array<{category: string; priority: string; suggestion: string; details: string; action: string}> = []

  const { data: kbDocs } = await supabase
    .from("ai_knowledge_base")
    .select("id, usage_count")
    .order("usage_count", { ascending: true })
    .limit(10)

  if (kbDocs && kbDocs.length > 0) {
    suggestions.push({
      category: "Knowledge Base",
      priority: "medium",
      suggestion: "Documentos com baixo uso estão ocupando espaço sem contribuir",
      details: `${kbDocs.length} documentos foram usados menos de 10 vezes`,
      action: "Revisar e potencialmente arquivar documentos de baixa utilidade",
    })
  }

  const { data: unresolved } = await supabase
    .from("ai_conversations")
    .select("id")
    .is("resolved_at", null)
    .gte("created_at", `NOW() - INTERVAL '${interval}'`)

  if (unresolved && unresolved.length > 20) {
    suggestions.push({
      category: "Customer Experience",
      priority: "high",
      suggestion: "Alto volume de conversas não resolvidas",
      details: `${unresolved.length} conversas pendentes`,
      action: "Priorizar análise de padrões de não resolução",
    })
  }

  const { data: slaConfig } = await supabase.from("ticket_sla_config").select("*")

  if (!slaConfig || slaConfig.length === 0) {
    suggestions.push({
      category: "SLA",
      priority: "critical",
      suggestion: "SLA não configurado",
      details: "Sem configuração de SLA, não há monitoramento de prazos",
      action: "Configurar SLAs para cada prioridade de ticket",
    })
  }

  return suggestions
}

async function generateForecast(supabase: any, interval: string): Promise<any> {
  const { data: currentMetrics } = await supabase.rpc("ai_crm_metrics")
    .select("*")
    .gte("date", `NOW() - INTERVAL '${interval}'`)

  const avgDailyVolume = currentMetrics?.length || 1
  const avgTicketsPerDay = currentMetrics?.reduce((s: number, m: any) => s + (m.tickets_created || 0), 0) / avgDailyVolume || 0
  const avgResolutionRate = currentMetrics?.reduce((s: number, m: any) => {
    const total = m.tickets_created || 0
    const resolved = m.tickets_resolved || 0
    return s + (total > 0 ? resolved / total : 0)
  }, 0) / avgDailyVolume || 0

  return {
    projected_daily_volume: Math.round(avgTicketsPerDay * 1.1),
    projected_resolution_rate: Math.round(avgResolutionRate * 100),
    recommendations: [
      "Manter equipe atual se volume não aumentar mais que 10%",
      "Considerar scale-up se volume aumentar mais que 20%",
    ],
    confidence: 0.75,
    factors: ["historico de 7 dias", "tendencia de uso"],
  }
}

async function diagnoseIssue(supabase: any, entityId: string): Promise<any> {
  if (!entityId) {
    return { error: "entity_id é obrigatório para diagnóstico" }
  }

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", entityId)
    .single()

  if (!conversation) {
    return { error: "Conversa não encontrada" }
  }

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", entityId)
    .order("created_at", { ascending: true })

  const issues: Array<{type: string; severity: string; description: string}> = []

  const messageCount = messages?.length || 0
  if (messageCount > 20) {
    issues.push({
      type: "high_message_volume",
      severity: "medium",
      description: `Conversa com ${messageCount} mensagens - pode indicar confusao ou falta de contexto`,
    })
  }

  const aiMessages = messages?.filter((m: any) => m.role === "assistant") || []
  const humanMessages = messages?.filter((m: any) => m.role === "human") || []

  if (aiMessages.length > humanMessages.length * 3) {
    issues.push({
      type: "agent_talking_too_much",
      severity: "low",
      description: "Agente enviou mais de 3x mensagens do que cliente",
    })
  }

  if (!conversation.resolved_at) {
    const age = new Date().getTime() - new Date(conversation.created_at).getTime()
    const hoursOld = age / (1000 * 60 * 60)

    if (hoursOld > 24) {
      issues.push({
        type: "unresolved_old_conversation",
        severity: "high",
        description: `Conversa sem resolucao ha ${Math.round(hoursOld)} horas`,
      })
    }
  }

  return {
    conversation_id: entityId,
    status: conversation.status,
    handler_type: conversation.handler_type,
    issues_found: issues.length,
    issues,
    recommendations: issues.map((i: any) => {
      switch (i.type) {
        case "high_message_volume": return "Considerar gerar resumo e transferir para agente humano"
        case "agent_talking_too_much": return "Revisar prompt para respostas mais concisas"
        case "unresolved_old_conversation": return "Priorizar resolucao ou escalacao"
        default: return "Revisar contexto da conversa"
      }
    }),
  }
}

async function comparePerformance(supabase: any, interval: string): Promise<any> {
  const { data: currentPeriod } = await supabase.rpc("ai_crm_metrics")
    .select("*")
    .gte("date", `NOW() - INTERVAL '${interval}'`)

  let previousInterval = interval
  if (interval === "24 hours") previousInterval = "48 hours"
  else if (interval === "7 days") previousInterval = "14 days"
  else if (interval === "30 days") previousInterval = "60 days"

  const { data: previousPeriod } = await supabase.rpc("ai_crm_metrics")
    .select("*")
    .gte("date", `NOW() - INTERVAL '${previousInterval}'`)
    .lt("date", `NOW() - INTERVAL '${interval}'`)

  const currentTotal = currentPeriod?.reduce((s: number, m: any) => s + (m.total_actions || 0), 0) || 0
  const previousTotal = previousPeriod?.reduce((s: number, m: any) => s + (m.total_actions || 0), 0) || 0

  const currentErrors = currentPeriod?.reduce((s: number, m: any) => s + (m.errors || 0), 0) || 0
  const previousErrors = previousPeriod?.reduce((s: number, m: any) => s + (m.errors || 0), 0) || 0

  const volumeChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0
  const errorRateChange = previousTotal > 0 ? ((currentErrors / currentTotal) - (previousErrors / previousTotal)) * 100 : 0

  return {
    volume_change_percent: Math.round(volumeChange * 10) / 10,
    error_rate_change: Math.round(errorRateChange * 10) / 10,
    trend: volumeChange > 10 ? "increasing" : volumeChange < -10 ? "decreasing" : "stable",
    verdict: volumeChange > 0 && errorRateChange < 0
      ? "Melhorando: mais volume com menos erros"
      : volumeChange > 0 && errorRateChange > 0
      ? "Atencao: mais volume com mais erros"
      : volumeChange < 0
      ? "Volume diminuindo - verificar satisfacao"
      : "Performance estavel",
    period: { current: interval, previous: previousInterval },
  }
}
