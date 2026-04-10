import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useHandoff() {
  const queryClient = useQueryClient()

  const takeOverConversation = useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ handler_type: 'human', status: 'em_atendimento' })
        .eq('id', conversationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Você assumiu a conversa!')
    },
  })

  const returnToAI = useMutation({
    mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId?: string }) => {
      const updates: Record<string, unknown> = { handler_type: 'ai' }
      if (agentId) updates.current_agent_id = agentId

      const { error } = await supabase
        .from('ai_conversations')
        .update(updates)
        .eq('id', conversationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversa devolvida para IA')
    },
  })

  const activateAIAgent = useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      let agentId: string | null = null

      const { data: convData, error: convError } = await supabase
        .from('ai_conversations')
        .select('current_agent_id, uazapi_chat_id, customer_phone, customer_name, whatsapp_instance_id')
        .eq('id', conversationId)
        .single()

      if (convError) throw convError

      agentId = convData?.current_agent_id

      if (!agentId) {
        const { data: orchResult } = await supabase.functions.invoke('orchestrator', {
          body: {
            conversation_id: conversationId,
            message_content: '',
            analysis: { trigger: 'ai_activation' },
          },
        })
        if (orchResult?.agent_id) {
          agentId = orchResult.agent_id
        }
      }

      if (agentId) {
        await supabase.functions.invoke('agent-executor', {
          body: { conversation_id: conversationId, agent_id: agentId },
        })
      } else {
        const { error: updateError } = await supabase
          .from('ai_conversations')
          .update({ handler_type: 'ai', status: 'em_atendimento' })
          .eq('id', conversationId)
        if (updateError) throw updateError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('IA ativada e respondendo o cliente!')
    },
    onError: () => {
      toast.error('Erro ao ativar IA')
    },
  })

  return { takeOverConversation, returnToAI, activateAIAgent }
}
