import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface TVKPIs {
  totalWaiting: number
  totalInProgress: number
  totalOpen: number
  resolvedToday: number
  aiResolvedToday: number
  humanResolvedToday: number
  avgCsatToday: number
  aiCsatToday: number
  humanCsatToday: number
  avgWaitingMinutes: number
  oldestWaitingMinutes: number
  avgResolutionSecondsToday: number
  aiAvgResolutionSeconds: number
  humanAvgResolutionSeconds: number
  resolvedPerHour: number
  fcrRate: number
  escalationRate: number
  backlog: number
  oldestTicketMinutes: number
  avgMessagesPerConversation: number
}

export interface TVQueueItem {
  id: string
  ticketNumber: string | null
  customerName: string | null
  customerPhone: string | null
  subject: string | null
  status: string
  startedAt: string | null
  boardName: string | null
  boardColor: string
  agentName: string | null
  handlerType: string | null
  satisfactionScore: number | null
  slaThresholdMinutes: number
}

export interface TVAgentWorkload {
  agentId: string
  agentName: string
  isOnline: boolean
  activeTickets: number
  waitingTickets: number
  inProgressTickets: number
  slaViolated: number
  slaAtRisk: number
  resolvedToday: number
  avgResolutionSeconds: number
  avgCsat: number
}

export interface TVAgentRank {
  agentId: string
  agentName: string
  resolved: number
  avgResolutionSeconds: number
  avgCsat: number
}

export interface TVStaleTicket {
  id: string
  ticketNumber: string | null
  customerName: string | null
  subject: string | null
  boardName: string | null
  agentName: string | null
  handlerType: string | null
  status: string | null
  staleMinutes: number
}

export interface TVStageCount {
  stageId: string
  stageName: string
  stageColor: string
  sortOrder: number
  count: number
  slaThresholdMinutes: number | null
  violatedCount: number
  atRiskCount: number
}

export interface TVBoard {
  id: string
  name: string
  color: string
  slug: string | null
  activeCount: number
}

export interface TVDashboardResponse {
  generatedAt: string
  nextRefreshMs: number
  kpis: TVKPIs
  queue: TVQueueItem[]
  agents: TVAgentWorkload[]
  ranking: TVAgentRank[]
  staleTickets: TVStaleTicket[]
  stageBreakdown: TVStageCount[]
  boards: TVBoard[]
}

// ─── Realtime merge helper ─────────────────────────────────────────────────────

/**
 * Aplica um evento Realtime da tabela ai_conversations ao snapshot atual.
 * Atualiza apenas queue e contadores básicos de KPIs — não recalcula métricas pesadas.
 */
export function mergeRealtimeEvent(
  current: TVDashboardResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }
): TVDashboardResponse {
  const { eventType, new: newRow, old: oldRow } = payload

  let queue = [...current.queue]
  let kpis = { ...current.kpis }

  if (eventType === 'INSERT') {
    // Adiciona novo item à fila se status relevante
    if (newRow.status === 'aguardando' || newRow.status === 'em_atendimento') {
      const item: TVQueueItem = {
        id: newRow.id,
        ticketNumber: newRow.ticket_number ?? null,
        customerName: newRow.customer_name ?? null,
        customerPhone: newRow.customer_phone ?? null,
        subject: newRow.ticket_subject ?? null,
        status: newRow.status,
        startedAt: newRow.started_at ?? null,
        boardName: null,
        boardColor: '#45E5E5',
        agentName: null,
        handlerType: newRow.handler_type ?? null,
        satisfactionScore: null,
        slaThresholdMinutes: 60,
      }
      queue = [item, ...queue]
      if (newRow.status === 'aguardando') {
        kpis = { ...kpis, totalWaiting: kpis.totalWaiting + 1, totalOpen: kpis.totalOpen + 1 }
      } else {
        kpis = { ...kpis, totalInProgress: kpis.totalInProgress + 1, totalOpen: kpis.totalOpen + 1 }
      }
    }
  } else if (eventType === 'UPDATE') {
    const idx = queue.findIndex(q => q.id === newRow.id)
    const wasInQueue = idx !== -1
    const isInQueue = newRow.status === 'aguardando' || newRow.status === 'em_atendimento'

    if (wasInQueue && isInQueue) {
      // Atualiza o item existente
      const oldStatus = queue[idx].status
      queue = queue.map(q =>
        q.id === newRow.id
          ? {
              ...q,
              status: newRow.status,
              handlerType: newRow.handler_type ?? q.handlerType,
            }
          : q
      )
      // Ajusta contadores se mudou de status
      if (oldStatus !== newRow.status) {
        if (newRow.status === 'aguardando') {
          kpis = { ...kpis, totalWaiting: kpis.totalWaiting + 1, totalInProgress: Math.max(0, kpis.totalInProgress - 1) }
        } else if (newRow.status === 'em_atendimento') {
          kpis = { ...kpis, totalInProgress: kpis.totalInProgress + 1, totalWaiting: Math.max(0, kpis.totalWaiting - 1) }
        }
      }
    } else if (wasInQueue && !isInQueue) {
      // Saiu da fila (resolvido/cancelado)
      const removedStatus = queue[idx].status
      queue = queue.filter(q => q.id !== newRow.id)
      if (removedStatus === 'aguardando') {
        kpis = { ...kpis, totalWaiting: Math.max(0, kpis.totalWaiting - 1), totalOpen: Math.max(0, kpis.totalOpen - 1) }
      } else {
        kpis = { ...kpis, totalInProgress: Math.max(0, kpis.totalInProgress - 1), totalOpen: Math.max(0, kpis.totalOpen - 1) }
      }
    } else if (!wasInQueue && isInQueue) {
      // Entrou na fila por mudança de status
      const item: TVQueueItem = {
        id: newRow.id,
        ticketNumber: newRow.ticket_number ?? null,
        customerName: newRow.customer_name ?? null,
        customerPhone: newRow.customer_phone ?? null,
        subject: newRow.ticket_subject ?? null,
        status: newRow.status,
        startedAt: newRow.started_at ?? null,
        boardName: null,
        boardColor: '#45E5E5',
        agentName: null,
        handlerType: newRow.handler_type ?? null,
        satisfactionScore: null,
        slaThresholdMinutes: 60,
      }
      queue = [item, ...queue]
      if (newRow.status === 'aguardando') {
        kpis = { ...kpis, totalWaiting: kpis.totalWaiting + 1, totalOpen: kpis.totalOpen + 1 }
      } else {
        kpis = { ...kpis, totalInProgress: kpis.totalInProgress + 1, totalOpen: kpis.totalOpen + 1 }
      }
    }
  } else if (eventType === 'DELETE') {
    const idx = queue.findIndex(q => q.id === oldRow.id)
    if (idx !== -1) {
      const removedStatus = queue[idx].status
      queue = queue.filter(q => q.id !== oldRow.id)
      if (removedStatus === 'aguardando') {
        kpis = { ...kpis, totalWaiting: Math.max(0, kpis.totalWaiting - 1), totalOpen: Math.max(0, kpis.totalOpen - 1) }
      } else {
        kpis = { ...kpis, totalInProgress: Math.max(0, kpis.totalInProgress - 1), totalOpen: Math.max(0, kpis.totalOpen - 1) }
      }
    }
  }

  return { ...current, queue, kpis }
}

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useTVDashboardData(boardId?: string | null): {
  data: TVDashboardResponse | undefined
  isLoading: boolean
  isRealtime: boolean
} {
  const queryKey = ['tv-dashboard-v3', boardId ?? 'all']
  const qc = useQueryClient()
  const [isRealtime, setIsRealtime] = useState(false)
  // Ref para evitar closure stale no handler Realtime
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── 1. Polling via edge function ─────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const body = boardId ? { boardId } : undefined
      const { data, error } = await supabase.functions.invoke('tv-dashboard-data', { body })
      if (error) throw error
      return data as TVDashboardResponse
    },
    refetchInterval: (query) => query.state.data?.nextRefreshMs ?? 30000,
    placeholderData: keepPreviousData,
    retry: 3,
  })

  // ── 2. Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('tv-dashboard-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_conversations',
          filter: 'status=in.(aguardando,em_atendimento)',
        },
        (payload) => {
          qc.setQueryData<TVDashboardResponse>(queryKey, (current) => {
            if (!current) return current
            return mergeRealtimeEvent(current, payload as Parameters<typeof mergeRealtimeEvent>[1])
          })
        }
      )
      .subscribe((status) => {
        setIsRealtime(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      setIsRealtime(false)
    }
  }, [qc])

  return { data, isLoading, isRealtime }
}
