import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface TicketStage {
  id: string
  name: string
  color: string
  icon: string
  sort_order: number
  slug: string | null
  is_entry: boolean
  is_exit: boolean
  wip_limit: number | null
  active: boolean
  board_id: string | null
  status_type: string | null
  queue_alert_threshold_minutes: number | null
  is_ai_validation: boolean
  created_at: string
  // Legacy compat
  position: number
  is_default: boolean
  is_final: boolean
}

export function useTicketStages(boardId?: string) {
  const queryClient = useQueryClient()

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['ticket-stages', boardId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('kanban_stages')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (boardId) {
        query = query.eq('board_id', boardId)
      }

      const { data, error } = await query
      if (error) throw error
      // Map new fields to legacy compat
      return (data || []).map((s: any) => ({
        ...s,
        position: s.sort_order,
        is_default: s.is_entry,
        is_final: s.is_exit,
      })) as TicketStage[]
    }
  })

  const moveTicket = useMutation({
    mutationFn: async ({ conversationId, toStageId, fromStageId, movedBy = 'user' }: {
      conversationId: string
      toStageId: string
      fromStageId?: string | null
      movedBy?: string
    }) => {
      const { error: updateError } = await supabase
        .from('ai_conversations')
        .update({ stage_id: toStageId } as any)
        .eq('id', conversationId)
      if (updateError) throw updateError

      const { error: historyError } = await supabase
        .from('ticket_stage_history')
        .insert({
          conversation_id: conversationId,
          from_stage_id: fromStageId || null,
          to_stage_id: toStageId,
          moved_by: movedBy
        })
      if (historyError) throw historyError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Ticket movido com sucesso')
    },
    onError: () => toast.error('Erro ao mover ticket')
  })

  const createStage = useMutation({
    mutationFn: async (stage: Partial<TicketStage>) => {
      const { error } = await (supabase as any).from('kanban_stages').insert(stage)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-stages'] })
      toast.success('Etapa criada')
    }
  })

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TicketStage> & { id: string }) => {
      const { error } = await (supabase as any).from('kanban_stages').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-stages'] })
      toast.success('Etapa atualizada')
    }
  })

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('kanban_stages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-stages'] })
      toast.success('Etapa removida')
    }
  })

  return { stages, isLoading, moveTicket, createStage, updateStage, deleteStage }
}
