import { supabase } from '@/integrations/supabase/client'
import { isTransitionAllowed, getTransitionError } from '@/utils/statusTransitions'
import { calculateBusinessSeconds, type BusinessHourEntry } from '@/utils/calculateBusinessMinutes'

/**
 * Invoca edge function com retry automático (max 2 tentativas).
 * Loga erro no console se todas falharem.
 */
async function invokeWithRetry(
  fnName: string,
  body: Record<string, unknown>,
  maxRetries = 2
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase.functions.invoke(fnName, { body })
      if (!error) return
      console.warn(`[${fnName}] attempt ${attempt} error:`, error)
    } catch (err) {
      console.warn(`[${fnName}] attempt ${attempt} exception:`, err)
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  console.error(`[${fnName}] all ${maxRetries} attempts failed for:`, body)
}

export interface CloseConversationParams {
  conversationId: string
  currentStatus: string
  startedAt: string | null
  humanStartedAt: string | null
  resolutionSummary: string
  sendCsat?: boolean
  isWhatsApp?: boolean
  helpdeskClientId?: string | null
  aiCloseReviewNote?: string
  businessHours?: BusinessHourEntry[]
}

export interface CloseConversationResult {
  success: boolean
  error?: string
}

export async function closeConversation(params: CloseConversationParams): Promise<CloseConversationResult> {
  const {
    conversationId,
    currentStatus,
    startedAt,
    humanStartedAt,
    resolutionSummary,
    sendCsat = false,
    isWhatsApp = false,
    helpdeskClientId,
    aiCloseReviewNote,
    businessHours,
  } = params

  // Check board-level CSAT config — auto-send quando board tem CSAT habilitado
  let csatConfigId: string | null = null;
  let boardHasCsatOnClose = false;
  if (isWhatsApp) {
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('kanban_board_id')
      .eq('id', conversationId)
      .single();

    if (conv?.kanban_board_id) {
      const { data: csatConfig } = await supabase
        .from('csat_board_configs')
        .select('id, enabled, send_on_close')
        .eq('board_id', conv.kanban_board_id)
        .eq('enabled', true)
        .maybeSingle();

      if (csatConfig?.send_on_close) {
        csatConfigId = csatConfig.id;
        boardHasCsatOnClose = true;
      }
    }
  }

  // Envia CSAT se: toggle manual ativo OU board config força envio automático
  const shouldSendCsat = isWhatsApp && (sendCsat || boardHasCsatOnClose);
  const targetStatus = shouldSendCsat ? 'aguardando_cliente' : 'finalizado'

  // Validate status transition
  const transitionError = getTransitionError(currentStatus, targetStatus)
  if (transitionError) {
    return { success: false, error: transitionError }
  }

  // Validate required fields
  if (!resolutionSummary?.trim()) {
    return { success: false, error: 'Motivo de encerramento é obrigatório.' }
  }

  const now = new Date()
  const nowISO = now.toISOString()
  const nowMs = now.getTime()

  // resolution_time_seconds = total time from creation (includes queue wait)
  // Uses business hours if configured, otherwise wall-clock
  const resolutionTimeSeconds = startedAt
    ? (businessHours && businessHours.length > 0
      ? calculateBusinessSeconds(new Date(startedAt), now, businessHours)
      : Math.round((nowMs - new Date(startedAt).getTime()) / 1000))
    : null

  // resolution_seconds = actual attendance time (from human takeover, or from start if AI-only)
  const resolutionSeconds = humanStartedAt
    ? (businessHours && businessHours.length > 0
      ? calculateBusinessSeconds(new Date(humanStartedAt), now, businessHours)
      : Math.round((nowMs - new Date(humanStartedAt).getTime()) / 1000))
    : resolutionTimeSeconds

  const isFinalizing = targetStatus === 'finalizado'

  const updateData: Record<string, unknown> = {
    status: targetStatus,
    resolution_time_seconds: resolutionTimeSeconds,
    resolution_seconds: resolutionSeconds,
    resolution_summary: resolutionSummary,
  }

  if (isFinalizing) {
    updateData.resolved_at = nowISO
  }

  if (shouldSendCsat) {
    updateData.csat_sent_at = nowISO
  }

  const { error } = await supabase
    .from('ai_conversations')
    .update(updateData)
    .eq('id', conversationId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Fire-and-forget: summarize conversation
  supabase.functions.invoke('summarize-conversation', {
    body: { conversation_id: conversationId },
  }).catch(() => {})

  // Evaluate service com retry (sempre que encerrar, com ou sem CSAT)
  invokeWithRetry('evaluate-service', { conversation_id: conversationId })

  // Fire-and-forget: gera solution_summary via IA
  if (isFinalizing && resolutionSummary?.trim()) {
    invokeWithRetry('ticket-solution-classifier', {
      conversation_id: conversationId,
      resolution_summary: resolutionSummary,
    })
  }

  // CSAT com retry — não fire-and-forget
  if (shouldSendCsat && csatConfigId) {
    invokeWithRetry('csat-processor', {
      action: 'send',
      conversationId,
      configId: csatConfigId,
      trigger_source: 'close',
    })
  }

  // Fire-and-forget: save AI close review annotation
  if (aiCloseReviewNote && helpdeskClientId) {
    supabase.from('helpdesk_client_annotations').insert({
      client_id: helpdeskClientId,
      content: aiCloseReviewNote,
      author: 'IA - Nota de Encerramento',
    }).then(() => {}, (err) => console.error('Failed to save close review annotation:', err))
  }

  return { success: true }
}

/**
 * Calculate resolution times for edge function use (Kanban moves, etc.)
 */
export function calculateResolutionTimes(
  startedAt: string | null,
  humanStartedAt: string | null,
  businessHours?: BusinessHourEntry[]
) {
  const now = new Date()
  const nowMs = now.getTime()

  const resolutionTimeSeconds = startedAt
    ? (businessHours && businessHours.length > 0
      ? calculateBusinessSeconds(new Date(startedAt), now, businessHours)
      : Math.round((nowMs - new Date(startedAt).getTime()) / 1000))
    : null

  const resolutionSeconds = humanStartedAt
    ? (businessHours && businessHours.length > 0
      ? calculateBusinessSeconds(new Date(humanStartedAt), now, businessHours)
      : Math.round((nowMs - new Date(humanStartedAt).getTime()) / 1000))
    : resolutionTimeSeconds

  return { resolutionTimeSeconds, resolutionSeconds }
}
