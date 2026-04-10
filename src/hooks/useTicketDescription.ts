import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface TicketDescription {
  sistema: string
  modulo: string
  resumo: string
  detalhe: string
  passos_reproducao: string
  impacto: string
  tentativas: string
}

export function useTicketDescription(conversationId: string | undefined) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['ticket-description', conversationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ai_conversations')
        .select('ticket_description')
        .eq('id', conversationId!)
        .maybeSingle()
      return (data?.ticket_description ?? null) as TicketDescription | null
    },
    enabled: !!conversationId,
  })

  const mutation = useMutation({
    mutationFn: async (description: TicketDescription) => {
      const { error } = await (supabase as any)
        .from('ai_conversations')
        .update({ ticket_description: description })
        .eq('id', conversationId!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-description', conversationId] })
      toast.success('Descrição salva com sucesso')
    },
    onError: () => toast.error('Erro ao salvar descrição'),
  })

  return {
    description: query.data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  }
}
