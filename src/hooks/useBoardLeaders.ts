import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface BoardLeader {
  id: string
  board_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
}

export function useBoardLeaders(boardId?: string) {
  const queryClient = useQueryClient()

  const { data: leaders, isLoading } = useQuery({
    queryKey: ['board-leaders', boardId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('board_leaders')
        .select('id, board_id, user_id')

      if (boardId) {
        query = query.eq('board_id', boardId)
      }

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) return [] as BoardLeader[]

      // Buscar nomes dos usuários via human_agents
      const userIds = [...new Set((data as any[]).map((d: any) => d.user_id))]
      const { data: agents } = await supabase
        .from('human_agents')
        .select('user_id, name, email')
        .in('user_id', userIds)

      const agentMap = new Map<string, { name: string | null; email: string | null }>()
      for (const a of agents || []) {
        agentMap.set(a.user_id, { name: a.name, email: a.email })
      }

      return (data as any[]).map((d: any) => ({
        id: d.id,
        board_id: d.board_id,
        user_id: d.user_id,
        user_name: agentMap.get(d.user_id)?.name || null,
        user_email: agentMap.get(d.user_id)?.email || null,
      })) as BoardLeader[]
    },
    enabled: boardId !== '',
  })

  const addLeader = useMutation({
    mutationFn: async ({ boardId, userId }: { boardId: string; userId: string }) => {
      const { error } = await (supabase as any)
        .from('board_leaders')
        .insert({ board_id: boardId, user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-leaders'] })
      toast.success('Líder adicionado ao board')
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate')) {
        toast.error('Este líder já está associado a este board')
      } else {
        toast.error('Erro ao adicionar líder')
      }
    },
  })

  const removeLeader = useMutation({
    mutationFn: async (leaderId: string) => {
      const { error } = await (supabase as any)
        .from('board_leaders')
        .delete()
        .eq('id', leaderId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-leaders'] })
      toast.success('Líder removido do board')
    },
    onError: () => toast.error('Erro ao remover líder'),
  })

  return {
    leaders: leaders || [],
    isLoading,
    addLeader,
    removeLeader,
  }
}
