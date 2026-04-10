import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { toast } from 'sonner'

export interface TicketNote {
  text: string
  author: string
  author_email: string
  created_at: string
}

export function useTicketNotes(conversationId?: string) {
  const queryClient = useQueryClient()
  const { user } = useSupabaseAuth()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['ticket-notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return []
      const { data } = await supabase
        .from('ai_conversations')
        .select('context')
        .eq('id', conversationId)
        .maybeSingle()

      const ctx = (data?.context as Record<string, unknown>) || {}
      return (ctx.notes as TicketNote[]) || []
    },
    enabled: !!conversationId,
  })

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!conversationId || !user) throw new Error('Missing data')

      // Get current context
      const { data: current } = await supabase
        .from('ai_conversations')
        .select('context')
        .eq('id', conversationId)
        .maybeSingle()

      const ctx = (current?.context as Record<string, unknown>) || {}
      const existingNotes = (ctx.notes as TicketNote[]) || []

      const agentName = user.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Agente'

      const newNote: TicketNote = {
        text,
        author: agentName,
        author_email: user.email || '',
        created_at: new Date().toISOString(),
      }

      const updatedContext = { ...ctx, notes: [...existingNotes, newNote] } as Record<string, unknown>

      const { error } = await supabase
        .from('ai_conversations')
        .update({ context: updatedContext as unknown as import('@/integrations/supabase/types').Json })
        .eq('id', conversationId)

      if (error) throw error
      return newNote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-notes', conversationId] })
      toast.success('Anotação adicionada')
    },
    onError: () => toast.error('Erro ao adicionar anotação'),
  })

  return { notes, isLoading, addNote }
}
