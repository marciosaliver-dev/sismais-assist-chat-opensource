/**
 * TV Dashboard Data — Edge Function consolidada
 *
 * Retorna TODOS os dados do TV Dashboard em uma unica resposta JSON,
 * reduzindo ~33 round-trips do frontend para 1 chamada.
 *
 * Executa 4 queries paralelas via Supabase client e computa todas as
 * metricas em TypeScript server-side.
 *
 * Aceita filtro opcional por board_id (query param ou body).
 */

import {
  createServiceClient,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/supabase-helpers.ts'
import { cachedQuery } from '../_shared/cache.ts'

const SLA_DEFAULT_MINUTES = 60
const STALE_THRESHOLD_MINUTES = 30
const CACHE_TTL_MS = 10_000 // 10s in-memory cache

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Aceita filtro por board via body ou query param
    let boardId: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        boardId = body?.boardId ?? null
      } catch { /* sem body */ }
    }
    const url = new URL(req.url)
    boardId = boardId || url.searchParams.get('board_id')

    const cacheKey = boardId ? `tv-dashboard-data:${boardId}` : 'tv-dashboard-data'
    const data = await cachedQuery(cacheKey, CACHE_TTL_MS, () => fetchAllData(boardId))

    return jsonResponse(data, 200, {
      'Cache-Control': 'public, max-age=10',
    })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', module: 'tv-dashboard-data', error: String(err) }))
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500)
  }
})

async function fetchAllData(boardId: string | null = null) {
  const supabase = createServiceClient()
  const now = Date.now()

  // Calcula meia-noite em BRT (UTC-3) para queries "hoje"
  const BRT_OFFSET_MS = -3 * 60 * 60 * 1000
  const brtNow = new Date(now + BRT_OFFSET_MS)
  const todayISO = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate())).toISOString()

  // ── 4 parallel queries ──

  // Helper: aplica filtro de board se presente
  const withBoardFilter = (query: any) => {
    if (boardId) return query.eq('kanban_board_id', boardId)
    return query
  }

  const [activeResult, resolvedResult, agentsResult, stagesResult, boardsResult] = await Promise.all([
    // 1. Active conversations (aguardando + em_atendimento) with joins
    withBoardFilter(
      supabase
        .from('ai_conversations')
        .select(`
          id, ticket_number, customer_name, customer_phone, ticket_subject,
          status, started_at, handler_type, csat_score,
          kanban_board_id, kanban_stage_id, human_agent_id, current_agent_id,
          kanban_boards(name, color),
          human_agents(name),
          ai_agents(name)
        `)
        .in('status', ['aguardando', 'em_atendimento'])
        .or('is_discarded.is.null,is_discarded.eq.false')
    )
      .order('started_at', { ascending: true })
      .limit(500),

    // 2. Resolved today
    withBoardFilter(
      supabase
        .from('ai_conversations')
        .select(`
          id, human_agent_id, ai_resolved, csat_rating, resolved_at, started_at,
          last_reopened_at, handler_type, human_started_at, ai_messages_count,
          kanban_board_id
        `)
        .gte('resolved_at', todayISO)
        .eq('status', 'finalizado')
        .or('is_discarded.is.null,is_discarded.eq.false')
    ),

    // 3. Human agents (active)
    supabase
      .from('human_agents')
      .select('id, name, is_online')
      .eq('is_active', true),

    // 4. Kanban stages (active)
    supabase
      .from('kanban_stages')
      .select('id, name, color, sort_order, queue_alert_threshold_minutes, board_id')
      .eq('active', true)
      .order('sort_order', { ascending: true }),

    // 5. Kanban boards (para abas no frontend)
    supabase
      .from('kanban_boards')
      .select('id, name, color, slug')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (activeResult.error) throw activeResult.error
  if (resolvedResult.error) throw resolvedResult.error
  if (agentsResult.error) throw agentsResult.error
  if (stagesResult.error) throw stagesResult.error

  const activeConvs = activeResult.data || []
  const resolvedToday = resolvedResult.data || []
  const humanAgents = agentsResult.data || []
  const stages = stagesResult.data || []
  const allBoards = boardsResult?.data || []

  // Build stage threshold map
  const stageThresholdMap = new Map<string, number>()
  for (const s of stages) {
    if (s.queue_alert_threshold_minutes) {
      stageThresholdMap.set(s.id, s.queue_alert_threshold_minutes)
    }
  }

  // ── Additional queries for stale tickets + backlog (parallel) ──

  const thirtyMinAgo = new Date(now - STALE_THRESHOLD_MINUTES * 60000).toISOString()

  const [staleResult, backlogResult, staleHistoryResult] = await Promise.all([
    // Open conversations older than 30min (candidates for stale)
    withBoardFilter(
      supabase
        .from('ai_conversations')
        .select(`
          id, ticket_number, customer_name, ticket_subject, status,
          started_at, handler_type, kanban_board_id, human_agent_id, current_agent_id,
          kanban_boards(name),
          human_agents(name),
          ai_agents(name)
        `)
        .not('status', 'in', '(finalizado,resolvido,cancelado)')
        .or('is_discarded.is.null,is_discarded.eq.false')
        .lte('started_at', thirtyMinAgo)
    )
      .limit(100),

    // Backlog count
    withBoardFilter(
      supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '(finalizado,resolvido,cancelado)')
        .or('is_discarded.is.null,is_discarded.eq.false')
    ),

    // Stale history — get latest status change per conversation
    supabase
      .from('ticket_status_history')
      .select('conversation_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (staleResult.error) throw staleResult.error
  // backlogResult.error is non-fatal
  if (staleHistoryResult.error) throw staleHistoryResult.error

  const staleConvs = staleResult.data || []
  const backlogCount = backlogResult.count || 0

  // Build last-change map (dedupe to latest per conversation)
  const lastChangeMap = new Map<string, string>()
  for (const h of staleHistoryResult.data || []) {
    if (!lastChangeMap.has(h.conversation_id)) {
      lastChangeMap.set(h.conversation_id, h.created_at)
    }
  }

  // ── Compute KPIs ──

  const waitingConvs = activeConvs.filter(c => c.status === 'aguardando')
  const inProgressConvs = activeConvs.filter(c => c.status === 'em_atendimento')
  const totalWaiting = waitingConvs.length
  const totalInProgress = inProgressConvs.length

  // Waiting times
  let totalWaitMinutes = 0
  let maxWaitMinutes = 0
  for (const c of waitingConvs) {
    if (c.started_at) {
      const mins = Math.round((now - new Date(c.started_at).getTime()) / 60000)
      totalWaitMinutes += mins
      if (mins > maxWaitMinutes) maxWaitMinutes = mins
    }
  }

  // Resolved metrics
  const resolvedCount = resolvedToday.length
  const aiResolvedCount = resolvedToday.filter(c => c.ai_resolved === true).length

  const withCsat = resolvedToday.filter(c => c.csat_rating != null)
  const aiWithCsat = resolvedToday.filter(c => c.ai_resolved === true && c.csat_rating != null)
  const humanWithCsat = resolvedToday.filter(c => c.ai_resolved !== true && c.csat_rating != null)

  const avgCsat = (arr: typeof withCsat) =>
    arr.length > 0
      ? Math.round((arr.reduce((s, c) => s + (c.csat_rating || 0), 0) / arr.length) * 10) / 10
      : 0

  // Resolution seconds
  let totalResSec = 0, resSecCount = 0
  let aiResSec = 0, aiResSecCount = 0
  let humanResSec = 0, humanResSecCount = 0
  for (const c of resolvedToday) {
    if (c.started_at && c.resolved_at) {
      const secs = (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
      totalResSec += secs; resSecCount++
      if (c.ai_resolved === true) { aiResSec += secs; aiResSecCount++ }
      else { humanResSec += secs; humanResSecCount++ }
    }
  }

  const hoursElapsed = Math.max(1, (now - new Date(todayISO).getTime()) / 3600000)
  const notReopened = resolvedToday.filter(c => !c.last_reopened_at).length
  const escalated = resolvedToday.filter(c =>
    c.handler_type === 'hybrid' || (c.human_started_at && c.ai_resolved === false)
  ).length

  // Oldest open ticket
  const allOpenStarted = activeConvs.filter(c => c.started_at).map(c => new Date(c.started_at!).getTime())
  const oldestOpenMs = allOpenStarted.length > 0 ? Math.min(...allOpenStarted) : now

  // Avg messages
  const withMsgCount = resolvedToday.filter(c => c.ai_messages_count && c.ai_messages_count > 0)

  const kpis = {
    totalWaiting,
    totalInProgress,
    totalOpen: totalWaiting + totalInProgress,
    resolvedToday: resolvedCount,
    aiResolvedToday: aiResolvedCount,
    humanResolvedToday: resolvedCount - aiResolvedCount,
    avgCsatToday: avgCsat(withCsat),
    aiCsatToday: avgCsat(aiWithCsat),
    humanCsatToday: avgCsat(humanWithCsat),
    avgWaitingMinutes: totalWaiting > 0 ? Math.round(totalWaitMinutes / totalWaiting) : 0,
    oldestWaitingMinutes: maxWaitMinutes,
    avgResolutionSecondsToday: resSecCount > 0 ? Math.round(totalResSec / resSecCount) : 0,
    aiAvgResolutionSeconds: aiResSecCount > 0 ? Math.round(aiResSec / aiResSecCount) : 0,
    humanAvgResolutionSeconds: humanResSecCount > 0 ? Math.round(humanResSec / humanResSecCount) : 0,
    resolvedPerHour: resolvedCount > 0 ? Math.round((resolvedCount / hoursElapsed) * 10) / 10 : 0,
    fcrRate: resolvedCount > 0 ? Math.round((notReopened / resolvedCount) * 100) : 0,
    escalationRate: resolvedCount > 0 ? Math.round((escalated / resolvedCount) * 100) : 0,
    backlog: backlogCount,
    oldestTicketMinutes: Math.round((now - oldestOpenMs) / 60000),
    avgMessagesPerConversation: withMsgCount.length > 0
      ? Math.round(withMsgCount.reduce((s, c) => s + (c.ai_messages_count || 0), 0) / withMsgCount.length * 10) / 10
      : 0,
  }

  // ── Queue (aguardando, limit 60) ──

  const queue = waitingConvs.slice(0, 60).map(conv => {
    const board = conv.kanban_boards as any
    const humanAgent = conv.human_agents as any
    const aiAgent = conv.ai_agents as any
    const stageId = conv.kanban_stage_id as string | null
    return {
      id: conv.id,
      ticketNumber: conv.ticket_number,
      customerName: conv.customer_name,
      customerPhone: conv.customer_phone,
      subject: conv.ticket_subject,
      status: conv.status,
      startedAt: conv.started_at,
      handlerType: conv.handler_type,
      satisfactionScore: conv.csat_score,
      boardName: board?.name ?? null,
      boardColor: board?.color ?? '#45E5E5',
      agentName: humanAgent?.name ?? aiAgent?.name ?? null,
      slaThresholdMinutes: (stageId && stageThresholdMap.get(stageId)) || SLA_DEFAULT_MINUTES,
      elapsedMinutes: conv.started_at
        ? Math.round((now - new Date(conv.started_at).getTime()) / 60000)
        : 0,
    }
  })

  // ── Agents workload ──

  const agentResolvedMap = new Map<string, typeof resolvedToday>()
  for (const c of resolvedToday) {
    if (c.human_agent_id) {
      if (!agentResolvedMap.has(c.human_agent_id)) agentResolvedMap.set(c.human_agent_id, [])
      agentResolvedMap.get(c.human_agent_id)!.push(c)
    }
  }

  const agents = humanAgents.map(agent => {
    const myActive = activeConvs.filter(c => c.human_agent_id === agent.id)
    const myResolved = agentResolvedMap.get(agent.id) || []

    let slaViolated = 0, slaAtRisk = 0
    for (const c of myActive) {
      if (c.started_at) {
        const elapsed = Math.round((now - new Date(c.started_at).getTime()) / 60000)
        const threshold = (c.kanban_stage_id && stageThresholdMap.get(c.kanban_stage_id)) || SLA_DEFAULT_MINUTES
        if (elapsed > threshold) slaViolated++
        else if (elapsed > threshold * 0.7) slaAtRisk++
      }
    }

    let totalSecs = 0, secCount = 0, csatSum = 0, csatCount = 0
    for (const c of myResolved) {
      if (c.started_at && c.resolved_at) {
        totalSecs += (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
        secCount++
      }
      if (c.csat_rating != null) { csatSum += c.csat_rating; csatCount++ }
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      isOnline: agent.is_online ?? false,
      activeTickets: myActive.length,
      waitingTickets: myActive.filter(c => c.status === 'aguardando').length,
      inProgressTickets: myActive.filter(c => c.status === 'em_atendimento').length,
      slaViolated,
      slaAtRisk,
      resolvedToday: myResolved.length,
      avgResolutionSeconds: secCount > 0 ? Math.round(totalSecs / secCount) : 0,
      avgCsat: csatCount > 0 ? Math.round((csatSum / csatCount) * 10) / 10 : 0,
    }
  }).sort((a, b) => b.activeTickets - a.activeTickets || b.resolvedToday - a.resolvedToday)

  // ── Ranking ──

  const ranking = humanAgents
    .map(agent => {
      const myResolved = agentResolvedMap.get(agent.id) || []
      if (myResolved.length === 0) return null

      let totalSecs = 0, secCount = 0, csatSum = 0, csatCount = 0
      for (const c of myResolved) {
        if (c.started_at && c.resolved_at) {
          totalSecs += (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
          secCount++
        }
        if (c.csat_rating != null) { csatSum += c.csat_rating; csatCount++ }
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        resolved: myResolved.length,
        avgResolutionSeconds: secCount > 0 ? Math.round(totalSecs / secCount) : 0,
        avgCsat: csatCount > 0 ? Math.round((csatSum / csatCount) * 10) / 10 : 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b!.resolved - a!.resolved)

  // ── Stale tickets ──

  const staleTickets = staleConvs
    .map(conv => {
      const lastChange = lastChangeMap.get(conv.id) || conv.started_at
      if (!lastChange) return null

      const staleMinutes = Math.round((now - new Date(lastChange).getTime()) / 60000)
      if (staleMinutes <= STALE_THRESHOLD_MINUTES) return null

      const board = conv.kanban_boards as any
      const humanAgent = conv.human_agents as any
      const aiAgent = conv.ai_agents as any

      return {
        id: conv.id,
        ticketNumber: conv.ticket_number,
        customerName: conv.customer_name,
        subject: conv.ticket_subject,
        boardName: board?.name ?? null,
        agentName: humanAgent?.name ?? aiAgent?.name ?? null,
        handlerType: conv.handler_type,
        status: conv.status,
        staleMinutes,
        lastStageChange: lastChange,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b!.staleMinutes - a!.staleMinutes)

  // ── Stage breakdown ──

  const allOpenConvs = new Map<string, { kanban_stage_id: string | null; started_at: string | null }>()
  for (const c of activeConvs) allOpenConvs.set(c.id, { kanban_stage_id: c.kanban_stage_id, started_at: c.started_at })
  for (const c of staleConvs) allOpenConvs.set(c.id, { kanban_stage_id: (c as any).kanban_stage_id ?? null, started_at: c.started_at })

  const stageBreakdown = stages.map(stage => {
    const stageConvs = [...allOpenConvs.values()].filter(c => c.kanban_stage_id === stage.id)
    const threshold = stage.queue_alert_threshold_minutes || SLA_DEFAULT_MINUTES

    let violatedCount = 0, atRiskCount = 0
    for (const c of stageConvs) {
      if (c.started_at) {
        const elapsed = Math.round((now - new Date(c.started_at).getTime()) / 60000)
        if (elapsed > threshold) violatedCount++
        else if (elapsed > threshold * 0.7) atRiskCount++
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color || '#45E5E5',
      sortOrder: stage.sort_order,
      count: stageConvs.length,
      slaThresholdMinutes: stage.queue_alert_threshold_minutes,
      violatedCount,
      atRiskCount,
    }
  }).filter(s => s.count > 0)

  // ── Boards com contagem de tickets ativos ──

  const boardCounts = new Map<string, number>()
  for (const c of activeConvs) {
    if (c.kanban_board_id) {
      boardCounts.set(c.kanban_board_id, (boardCounts.get(c.kanban_board_id) || 0) + 1)
    }
  }

  const boards = allBoards.map((b: any) => ({
    id: b.id,
    name: b.name,
    color: b.color || '#45E5E5',
    slug: b.slug,
    activeCount: boardCounts.get(b.id) || 0,
  }))

  // ── Business hours check (BRT = UTC-3) ──

  const brtHour = new Date(now).getUTCHours() - 3
  const adjustedHour = brtHour < 0 ? brtHour + 24 : brtHour
  const isBusinessHours = adjustedHour >= 8 && adjustedHour < 18

  return {
    kpis,
    queue,
    agents,
    ranking,
    staleTickets,
    stageBreakdown,
    boards,
    generatedAt: new Date(now).toISOString(),
    nextRefreshMs: isBusinessHours ? 30_000 : 120_000,
  }
}
