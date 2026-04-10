import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useCallback } from 'react'

export interface OverdueTicket {
  id: string
  ticket_number: number
  customer_name: string | null
  customer_phone: string
  queue_entered_at: string
  wait_minutes: number
  board_id: string
  board_name: string
  threshold_minutes: number
}

export function useQueueAlerts() {
  const { user } = useAuth()
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['queue-alerts', user?.id],
    queryFn: async () => {
      if (!user) return []

      // 1. Buscar boards do líder (ou todos se admin)
      let boardIds: string[] = []

      if (user.role === 'admin') {
        const { data: boards } = await (supabase as any)
          .from('kanban_boards')
          .select('id, name, queue_alert_threshold_minutes')
          .eq('active', true)
          .gt('queue_alert_threshold_minutes', 0)
        boardIds = (boards || []).map((b: any) => b.id)
        if (boardIds.length === 0) return []
        var boardMap = new Map<string, { name: string; threshold: number }>()
        for (const b of boards || []) {
          boardMap.set(b.id, { name: b.name, threshold: b.queue_alert_threshold_minutes })
        }
      } else {
        // Buscar boards onde o user é líder
        const { data: leaderRows } = await (supabase as any)
          .from('board_leaders')
          .select('board_id')
          .eq('user_id', user.id)

        if (!leaderRows || leaderRows.length === 0) return []

        boardIds = leaderRows.map((r: any) => r.board_id)

        // Buscar info dos boards
        const { data: boards } = await (supabase as any)
          .from('kanban_boards')
          .select('id, name, queue_alert_threshold_minutes')
          .in('id', boardIds)
          .eq('active', true)
          .gt('queue_alert_threshold_minutes', 0)

        boardIds = (boards || []).map((b: any) => b.id)
        if (boardIds.length === 0) return []
        var boardMap = new Map<string, { name: string; threshold: number }>()
        for (const b of boards || []) {
          boardMap.set(b.id, { name: b.name, threshold: b.queue_alert_threshold_minutes })
        }
      }

      // 2. Buscar stages desses boards
      const { data: stages } = await supabase
        .from('ticket_stages')
        .select('id, board_id')
        .in('board_id', boardIds)

      if (!stages || stages.length === 0) return []

      const stageIds = stages.map(s => s.id)
      const stageBoardMap = new Map<string, string>()
      for (const s of stages) {
        stageBoardMap.set(s.id, s.board_id)
      }

      // 3. Buscar tickets aguardando nesses stages
      const { data: tickets } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, customer_name, customer_phone, queue_entered_at, started_at, kanban_stage_id')
        .eq('status', 'aguardando')
        .in('kanban_stage_id', stageIds)
        .not('queue_entered_at', 'is', null)

      if (!tickets || tickets.length === 0) return []

      const now = Date.now()
      const overdueTickets: OverdueTicket[] = []

      for (const t of tickets) {
        const enteredAt = t.queue_entered_at || t.started_at
        if (!enteredAt || !t.kanban_stage_id) continue

        const waitMs = now - new Date(enteredAt).getTime()
        const waitMinutes = Math.floor(waitMs / 60000)

        const boardId = stageBoardMap.get(t.kanban_stage_id)
        if (!boardId) continue

        const board = boardMap.get(boardId)
        if (!board || waitMinutes < board.threshold) continue

        overdueTickets.push({
          id: t.id,
          ticket_number: t.ticket_number,
          customer_name: t.customer_name,
          customer_phone: t.customer_phone,
          queue_entered_at: enteredAt,
          wait_minutes: waitMinutes,
          board_id: boardId,
          board_name: board.name,
          threshold_minutes: board.threshold,
        })
      }

      // Ordenar por tempo de espera (mais antigo primeiro)
      overdueTickets.sort((a, b) => b.wait_minutes - a.wait_minutes)

      return overdueTickets
    },
    enabled: !!user && (user.role === 'admin' || user.role === 'lider'),
    refetchInterval: 30000,
  })

  const isDismissed = dismissedUntil !== null && Date.now() < dismissedUntil
  const overdueTickets = data || []
  const hasAlert = overdueTickets.length > 0 && !isDismissed

  const dismissAlert = useCallback((minutes: number) => {
    setDismissedUntil(Date.now() + minutes * 60000)
  }, [])

  return {
    overdueTickets,
    hasAlert,
    isLoading,
    dismissAlert,
  }
}
