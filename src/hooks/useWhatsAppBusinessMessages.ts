import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'
import { useEffect } from 'react'

type WhatsAppMessage = Tables<'whatsapp_messages'>

export function useWhatsAppBusinessMessages() {
  const queryClient = useQueryClient()

  const { data: recentMessages, isLoading } = useQuery({
    queryKey: ['whatsapp-messages', 'recent'],
    queryFn: async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as WhatsAppMessage[]
    },
    refetchInterval: 10000
  })

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const sendMessage = useMutation({
    mutationFn: async (payload: {
      to: string
      message: string
      type?: 'text' | 'template'
      buttons?: Array<{ id: string; title: string }>
      media?: { type: 'image' | 'video' | 'document'; url: string }
    }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: payload
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      toast.success('Mensagem enviada!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar: ${error.message}`)
    }
  })

  return { recentMessages, isLoading, sendMessage }
}
