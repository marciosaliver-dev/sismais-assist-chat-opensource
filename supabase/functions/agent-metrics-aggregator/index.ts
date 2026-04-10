/**
 * Agent Metrics Aggregator
 *
 * Agrega métricas de performance dos agentes IA periodicamente.
 * Calcula: avg_confidence, avg_csat, success_rate, total_conversations
 * por agente e atualiza a tabela ai_agents.
 *
 * Pode ser chamado via cron (pg_cron) ou manualmente.
 *
 * Ações:
 * - aggregate: Agrega métricas de todos os agentes ativos
 * - aggregate_agent: Agrega métricas de um agente específico
 * - health: Health check
 */

import { createServiceClient, corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from '../_shared/supabase-helpers.ts'
import { trackMetric, trackError } from '../_shared/pipeline-metrics.ts'

interface AgentMetrics {
  agent_id: string
  agent_name: string
  avg_confidence: number | null
  avg_csat: number | null
  success_rate: number | null
  total_conversations: number
  conversations_last_24h: number
  avg_response_time_ms: number | null
  escalation_rate: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  const supabase = createServiceClient()
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { action = 'aggregate', agent_id, period_hours = 720 } = body

    if (action === 'health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() })
    }

    if (action === 'aggregate_agent' && !agent_id) {
      return errorResponse('agent_id is required for aggregate_agent action', 400)
    }

    // Buscar agentes para agregar
    let agentQuery = supabase.from('ai_agents').select('id, name').eq('is_active', true)
    if (action === 'aggregate_agent') {
      agentQuery = agentQuery.eq('id', agent_id)
    }
    const { data: agents, error: agentsError } = await agentQuery

    if (agentsError) throw new Error(`Failed to fetch agents: ${agentsError.message}`)
    if (!agents?.length) return jsonResponse({ message: 'No active agents found', updated: 0 })

    const cutoffDate = new Date(Date.now() - period_hours * 60 * 60 * 1000).toISOString()
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const results: AgentMetrics[] = []

    for (const agent of agents) {
      // Total de conversas do agente
      const { count: totalConversations } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('current_agent_id', agent.id)

      // Conversas nas últimas 24h
      const { count: conversations24h } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('current_agent_id', agent.id)
        .gte('created_at', cutoff24h)

      // Média de confiança das mensagens do agente (período)
      const { data: confidenceData } = await supabase
        .from('ai_messages')
        .select('confidence')
        .eq('agent_id', agent.id)
        .eq('role', 'assistant')
        .gte('created_at', cutoffDate)
        .not('confidence', 'is', null)

      const avgConfidence = confidenceData?.length
        ? confidenceData.reduce((sum, m) => sum + (m.confidence ?? 0), 0) / confidenceData.length
        : null

      // Média de CSAT
      const { data: csatData } = await supabase
        .from('ai_conversations')
        .select('csat_score')
        .eq('current_agent_id', agent.id)
        .gte('created_at', cutoffDate)
        .not('csat_score', 'is', null)

      const avgCsat = csatData?.length
        ? csatData.reduce((sum, c) => sum + (c.csat_score ?? 0), 0) / csatData.length
        : null

      // Taxa de sucesso (resolvido sem escalação)
      const { count: resolvedCount } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('current_agent_id', agent.id)
        .eq('status', 'resolved')
        .gte('created_at', cutoffDate)

      const { count: totalPeriod } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('current_agent_id', agent.id)
        .gte('created_at', cutoffDate)
        .in('status', ['resolved', 'closed', 'escalated'])

      const successRate = (totalPeriod ?? 0) > 0
        ? ((resolvedCount ?? 0) / (totalPeriod ?? 1)) * 100
        : null

      // Taxa de escalação
      const { count: escalatedCount } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('current_agent_id', agent.id)
        .eq('status', 'escalated')
        .gte('created_at', cutoffDate)

      const escalationRate = (totalPeriod ?? 0) > 0
        ? ((escalatedCount ?? 0) / (totalPeriod ?? 1)) * 100
        : null

      const metrics: AgentMetrics = {
        agent_id: agent.id,
        agent_name: agent.name,
        avg_confidence: avgConfidence ? Math.round(avgConfidence * 100) / 100 : null,
        avg_csat: avgCsat ? Math.round(avgCsat * 100) / 100 : null,
        success_rate: successRate ? Math.round(successRate * 100) / 100 : null,
        total_conversations: totalConversations ?? 0,
        conversations_last_24h: conversations24h ?? 0,
        avg_response_time_ms: null, // TODO: calcular quando pipeline_metrics estiver mais maduro
        escalation_rate: escalationRate ? Math.round(escalationRate * 100) / 100 : null,
      }

      // Atualizar ai_agents com as métricas agregadas
      await supabase
        .from('ai_agents')
        .update({
          avg_confidence: metrics.avg_confidence,
          avg_csat: metrics.avg_csat,
          success_rate: metrics.success_rate,
          total_conversations: metrics.total_conversations,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agent.id)

      results.push(metrics)
    }

    const latency = Date.now() - startTime

    trackMetric(supabase, {
      edge_function: 'agent-metrics-aggregator',
      event_type: 'aggregation_complete',
      latency_ms: latency,
      metadata: { agents_processed: results.length, period_hours },
    })

    return jsonResponse({
      success: true,
      agents_processed: results.length,
      latency_ms: latency,
      metrics: results,
    })
  } catch (error) {
    const latency = Date.now() - startTime

    trackError(supabase, {
      edge_function: 'agent-metrics-aggregator',
      event_type: 'aggregation_error',
      error_message: error.message,
      latency_ms: latency,
    })

    console.error('[agent-metrics-aggregator] Error:', error.message)
    return errorResponse(error.message)
  }
})
