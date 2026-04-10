import { supabase } from '@/integrations/supabase/client'

export interface CloseRequirement {
  id: string
  field_name: string
  is_required: boolean
}

export interface MissingField {
  field_name: string
  field_label: string
}

export interface CloseValidationResult {
  canClose: boolean
  missingFields: MissingField[]
  aiValidationsNeeded: string[]
}

const FIELD_LABELS: Record<string, string> = {
  helpdesk_client_id: 'Cliente vinculado',
  ticket_category_id: 'Categoria do ticket',
  ticket_module_id: 'Módulo / Procedimento',
  ticket_subject: 'Assunto do ticket',
  resolution_note: 'Nota de resolução',
  ai_name_validation: 'Validação IA do nome do contato',
  ai_close_review: 'Nota de encerramento pela IA',
}

const AI_FIELDS = ['ai_name_validation', 'ai_close_review']

const SYNC_FIELD_CHECKS: Record<string, (conv: any) => boolean> = {
  helpdesk_client_id: (conv) => !!conv.helpdesk_client_id,
  ticket_category_id: (conv) => !!conv.ticket_category_id,
  ticket_module_id: (conv) => !!conv.ticket_module_id,
  ticket_subject: (conv) => !!conv.ticket_subject && conv.ticket_subject.trim().length > 0,
}

/**
 * Validate a conversation against close requirements.
 * Pure function — does not depend on React hooks.
 */
export function validateTicketClose(
  conversation: any,
  closeRequirements: CloseRequirement[]
): CloseValidationResult {
  const missingFields: MissingField[] = []
  const aiValidationsNeeded: string[] = []

  for (const req of closeRequirements) {
    if (!req.is_required) continue

    if (AI_FIELDS.includes(req.field_name)) {
      aiValidationsNeeded.push(req.field_name)
      continue
    }

    // resolution_note is validated in CloseConversationDialog, skip here
    if (req.field_name === 'resolution_note') continue

    const check = SYNC_FIELD_CHECKS[req.field_name]
    if (check && !check(conversation)) {
      missingFields.push({
        field_name: req.field_name,
        field_label: FIELD_LABELS[req.field_name] || req.field_name,
      })
    }
  }

  return {
    canClose: missingFields.length === 0,
    missingFields,
    aiValidationsNeeded,
  }
}

/**
 * Fetch close requirements from the database.
 * For use outside React components (automations, utilities).
 */
export async function fetchCloseRequirements(): Promise<CloseRequirement[]> {
  const { data, error } = await supabase
    .from('ticket_close_requirements')
    .select('*')
    .eq('is_required', true)
  if (error) {
    console.error('Failed to fetch close requirements:', error)
    return []
  }
  return (data || []) as CloseRequirement[]
}

/**
 * Check if a stage is a final stage by its ID.
 */
export async function isFinalStage(stageId: string): Promise<boolean> {
  const { data } = await (supabase as any)
    .from('kanban_stages')
    .select('is_final')
    .eq('id', stageId)
    .single()
  return data?.is_final === true
}

/**
 * Server-side validation: fetch conversation + requirements, validate, return result.
 * Used by automations and bulk operations.
 */
export async function validateConversationForClose(conversationId: string): Promise<CloseValidationResult> {
  const [requirements, convResult] = await Promise.all([
    fetchCloseRequirements(),
    supabase
      .from('ai_conversations')
      .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
      .eq('id', conversationId)
      .single(),
  ])

  if (!convResult.data) {
    return { canClose: false, missingFields: [{ field_name: 'conversation', field_label: 'Conversa não encontrada' }], aiValidationsNeeded: [] }
  }

  return validateTicketClose(convResult.data, requirements)
}
