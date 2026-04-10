import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useCallback } from 'react'
import {
  validateTicketClose,
  type CloseRequirement,
  type MissingField,
  type CloseValidationResult,
} from '@/utils/validateTicketClose'

// Re-export types for backwards compatibility
export type { CloseRequirement, MissingField, CloseValidationResult }

export function useCloseValidation() {
  const { data: closeRequirements = [], isLoading } = useQuery({
    queryKey: ['ticket-close-requirements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_close_requirements')
        .select('*')
        .eq('is_required', true)
      if (error) throw error
      return (data || []) as CloseRequirement[]
    },
  })

  const validateForClose = useCallback(
    (conversation: any): CloseValidationResult => {
      return validateTicketClose(conversation, closeRequirements)
    },
    [closeRequirements]
  )

  const runAINameValidation = useCallback(
    async (customerName: string): Promise<{ valid: boolean; reason?: string }> => {
      try {
        const { data, error } = await supabase.functions.invoke('validate-contact-name', {
          body: { customer_name: customerName },
        })
        if (error) {
          console.error('AI name validation error:', error)
          return { valid: true, reason: 'Erro na validação IA' }
        }
        return data as { valid: boolean; reason?: string }
      } catch (err) {
        console.error('AI name validation error:', err)
        return { valid: true, reason: 'Erro na validação IA' }
      }
    },
    []
  )

  const runAICloseReview = useCallback(
    async (conversationId: string): Promise<{ note: string; tokens_used: number }> => {
      try {
        const { data, error } = await supabase.functions.invoke('generate-close-review', {
          body: { conversation_id: conversationId },
        })
        if (error) {
          console.error('AI close review error:', error)
          return { note: '', tokens_used: 0 }
        }
        return data as { note: string; tokens_used: number }
      } catch (err) {
        console.error('AI close review error:', err)
        return { note: '', tokens_used: 0 }
      }
    },
    []
  )

  return {
    closeRequirements,
    isLoading,
    validateForClose,
    runAINameValidation,
    runAICloseReview,
  }
}
