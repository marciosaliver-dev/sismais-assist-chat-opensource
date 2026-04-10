import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface TicketAILog {
  id: string
  ticket_id: string
  evento_tipo: string
  prompt_enviado?: string | null
  resposta_recebida?: string | null
  modelo_usado?: string | null
  tokens_input: number
  tokens_output: number
  confianca?: number | null
  agente_id?: string | null
  metadata?: Record<string, unknown> | null
  criado_em: string
}

export function useTicketAILogs(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['ticket-ai-logs', conversationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ticket_ai_logs')
        .select('*')
        .eq('ticket_id', conversationId!)
        .order('criado_em', { ascending: true })
        .limit(100)
      return (data ?? []) as TicketAILog[]
    },
    enabled: !!conversationId,
    refetchInterval: 30000, // poll every 30s to pick up new logs
  })
}
