import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export const CANCELLATION_REASONS: Record<string, string> = {
  preco: 'Preço',
  fechamento: 'Fechamento do negócio',
  concorrente: 'Migrou para concorrente',
  falta_uso: 'Falta de uso/não adaptou',
  insatisfacao_suporte: 'Insatisfação com suporte',
  bug_nao_resolvido: 'Bug não resolvido',
  outro: 'Outro',
}

export const RETENTION_OFFERS: Record<string, string> = {
  desconto: 'Desconto temporário',
  pausa: 'Pausa de assinatura',
  suporte_dedicado: 'Suporte dedicado',
  treinamento: 'Treinamento',
  resolucao_bug: 'Resolução de bug',
  outro: 'Outro',
}

export interface CancellationKPIs {
  reversalRate: number | null
  avgFirstContactMinutes: number | null
  mrrSaved: number
  mrrLost: number
  noResponseRate: number | null
  totalTickets: number
  openTickets: number
  reasonRanking: Array<{ reason: string; count: number }>
  offerEffectiveness: Array<{ offer: string; total: number; reversed: number; rate: number }>
}

const DEFAULT_MRR = 69.90

function parseContext(context: unknown): Record<string, unknown> {
  if (!context) return {}
  if (typeof context === 'string') {
    try { return JSON.parse(context) } catch { return {} }
  }
  if (typeof context === 'object') return context as Record<string, unknown>
  return {}
}

export function useCancellationKPIs(boardId?: string, periodDays = 30) {
  return useQuery({
    queryKey: ['cancellation-kpis', boardId, periodDays],
    queryFn: async (): Promise<CancellationKPIs | null> => {
      if (!boardId) return null

      const db = supabase as any
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

      // Fetch stages for the board
      const { data: stages } = await db
        .from('kanban_stages')
        .select('id, slug, is_final')
        .eq('board_id', boardId)

      const stageMap = new Map<string, { id: string; slug: string; is_final: boolean }>(
        (stages || []).map((s: any) => [s.id, s])
      )
      const noResponseStageIds = new Set(
        (stages || []).filter((s: any) => s.slug === 'sem-resposta').map((s: any) => s.id)
      )
      const finalStageIds = new Set(
        (stages || []).filter((s: any) => s.is_final).map((s: any) => s.id)
      )

      // Fetch tickets within period
      const { data: tickets, error } = await db
        .from('ai_conversations')
        .select('id, status, started_at, resolved_at, context, stage_id')
        .eq('kanban_board_id', boardId)
        .gte('started_at', since)

      if (error) throw error

      if (!tickets || tickets.length === 0) {
        return {
          reversalRate: null,
          avgFirstContactMinutes: null,
          mrrSaved: 0,
          mrrLost: 0,
          noResponseRate: null,
          totalTickets: 0,
          openTickets: 0,
          reasonRanking: [],
          offerEffectiveness: [],
        }
      }

      const rows = tickets as Array<{
        id: string
        status: string | null
        started_at: string | null
        resolved_at: string | null
        context: unknown
        stage_id: string | null
      }>

      // Fetch stage history for first contact time and no-response detection
      const ticketIds = rows.map(t => t.id)
      const { data: history } = await db
        .from('ticket_stage_history')
        .select('conversation_id, to_stage_id, moved_at')
        .in('conversation_id', ticketIds)
        .order('moved_at', { ascending: true })

      const historyRows = (history || []) as Array<{
        conversation_id: string
        to_stage_id: string
        moved_at: string
      }>

      // Group history by conversation
      const historyByTicket = new Map<string, typeof historyRows>()
      for (const h of historyRows) {
        const list = historyByTicket.get(h.conversation_id) || []
        list.push(h)
        historyByTicket.set(h.conversation_id, list)
      }

      // Track tickets that passed through sem-resposta
      const ticketsWithNoResponse = new Set<string>()
      for (const h of historyRows) {
        if (noResponseStageIds.has(h.to_stage_id)) {
          ticketsWithNoResponse.add(h.conversation_id)
        }
      }
      // Also check current stage
      for (const t of rows) {
        if (t.stage_id && noResponseStageIds.has(t.stage_id)) {
          ticketsWithNoResponse.add(t.id)
        }
      }

      // Parse contexts
      const parsed = rows.map(t => ({
        ...t,
        ctx: parseContext(t.context),
      }))

      // --- KPI Calculations ---

      // 1. reversalRate
      const finalized = parsed.filter(t => {
        const result = t.ctx.final_result as string | undefined
        return result === 'revertido' || result === 'cancelado'
      })
      const reversed = finalized.filter(t => t.ctx.final_result === 'revertido')
      const reversalRate = finalized.length > 0
        ? Math.round((reversed.length / finalized.length) * 1000) / 10
        : null

      // 2. avgFirstContactMinutes
      const firstContactTimes: number[] = []
      for (const t of rows) {
        if (!t.started_at) continue
        const moves = historyByTicket.get(t.id)
        if (moves && moves.length > 0) {
          const firstMove = moves[0]
          const diffMs = new Date(firstMove.moved_at).getTime() - new Date(t.started_at).getTime()
          if (diffMs >= 0) {
            firstContactTimes.push(diffMs / 60000)
          }
        }
      }
      const avgFirstContactMinutes = firstContactTimes.length > 0
        ? Math.round(firstContactTimes.reduce((a, b) => a + b, 0) / firstContactTimes.length)
        : null

      // 3. mrrSaved
      const mrrSaved = reversed.reduce((sum, t) => {
        const val = typeof t.ctx.mrr_value === 'number' ? t.ctx.mrr_value : DEFAULT_MRR
        return sum + val
      }, 0)

      // 4. mrrLost
      const cancelled = finalized.filter(t => t.ctx.final_result === 'cancelado')
      const mrrLost = cancelled.reduce((sum, t) => {
        const val = typeof t.ctx.mrr_value === 'number' ? t.ctx.mrr_value : 0
        return sum + val
      }, 0)

      // 5. noResponseRate
      const noResponseRate = rows.length > 0
        ? Math.round((ticketsWithNoResponse.size / rows.length) * 1000) / 10
        : null

      // 6. reasonRanking
      const reasonCounts = new Map<string, number>()
      for (const t of parsed) {
        const reason = (t.ctx.cancellation_reason as string) || 'outro'
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1)
      }
      const reasonRanking = Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)

      // 7. offerEffectiveness
      const offerStats = new Map<string, { total: number; reversed: number }>()
      for (const t of parsed) {
        const offer = t.ctx.retention_offer as string | undefined
        if (!offer) continue
        const stats = offerStats.get(offer) || { total: 0, reversed: 0 }
        stats.total++
        if (t.ctx.final_result === 'revertido') stats.reversed++
        offerStats.set(offer, stats)
      }
      const offerEffectiveness = Array.from(offerStats.entries())
        .map(([offer, stats]) => ({
          offer,
          total: stats.total,
          reversed: stats.reversed,
          rate: stats.total > 0 ? Math.round((stats.reversed / stats.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.rate - a.rate)

      // 8. openTickets
      const openTickets = rows.filter(t => {
        if (!t.stage_id) return true
        return !finalStageIds.has(t.stage_id)
      }).length

      return {
        reversalRate,
        avgFirstContactMinutes,
        mrrSaved: Math.round(mrrSaved * 100) / 100,
        mrrLost: Math.round(mrrLost * 100) / 100,
        noResponseRate,
        totalTickets: rows.length,
        openTickets,
        reasonRanking,
        offerEffectiveness,
      }
    },
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
    enabled: !!boardId,
  })
}
