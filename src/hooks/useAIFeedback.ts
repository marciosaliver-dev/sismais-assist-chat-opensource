import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface FeedbackParams {
  messageId: string
  agentId: string
  conversationId: string
  content: string
  helpful: boolean
}

interface CorrectionParams {
  messageId: string
  agentId: string
  conversationId: string
  originalResponse: string
  correctedResponse: string
}

export function useAIFeedback() {
  const quickFeedback = useMutation({
    mutationFn: async ({ messageId, agentId, conversationId, content, helpful }: FeedbackParams) => {
      // Update was_helpful on the message
      await supabase
        .from('ai_messages')
        .update({ was_helpful: helpful } as any)
        .eq('id', messageId)

      // Record in learning feedback
      await supabase
        .from('ai_learning_feedback')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          agent_id: agentId,
          feedback_type: helpful ? 'helpful' : 'not_helpful',
          feedback_source: 'human_review',
          original_response: content,
        } as any)
    },
    onSuccess: (_, vars) => {
      toast.success(vars.helpful ? 'Feedback positivo registrado!' : 'Feedback negativo registrado!')
    },
    onError: () => {
      toast.error('Erro ao registrar feedback')
    },
  })

  const submitCorrection = useMutation({
    mutationFn: async ({ messageId, agentId, conversationId, originalResponse, correctedResponse }: CorrectionParams) => {
      // Record correction in learning feedback
      await supabase
        .from('ai_learning_feedback')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          agent_id: agentId,
          feedback_type: 'not_helpful',
          feedback_source: 'human_review',
          original_response: originalResponse,
          corrected_response: correctedResponse,
          learning_action: 'add_qa_pair',
        } as any)

      // Mark message as not helpful
      await supabase
        .from('ai_messages')
        .update({ was_helpful: false } as any)
        .eq('id', messageId)

      // Create Q&A pair in knowledge base
      const questionText = originalResponse.length > 200
        ? originalResponse.substring(0, 200) + '...'
        : originalResponse
      const content = `Pergunta: ${questionText}\n\nResposta: ${correctedResponse}`

      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .insert({
          title: questionText,
          content,
          content_type: 'text',
          category: 'qa',
          source: 'agent_training',
          agent_filter: [agentId],
          tags: ['qa', 'feedback-correction'],
        })
        .select('id')
        .single()

      if (error) throw error

      // Fire-and-forget embedding generation
      supabase.functions.invoke('generate-embedding', {
        body: { document_id: data.id, content, title: questionText },
      }).catch(e => console.error('Embedding error:', e))
    },
    onSuccess: () => {
      toast.success('Correção salva e agente treinado!')
    },
    onError: () => {
      toast.error('Erro ao salvar correção')
    },
  })

  return { quickFeedback, submitCorrection }
}
