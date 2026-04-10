// supabase/functions/_shared/dead-letter.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { logAction } from "./action-logger.ts"

const DEAD_LETTER_MESSAGE =
  'Recebi sua mensagem! 😊 Estou verificando internamente e já retorno com a resposta. Um momento, por favor!'

/**
 * Called when the entire LLM pipeline fails.
 * Ensures the client ALWAYS gets a response, even on total failure.
 */
export async function handleDeadLetter(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  customerPhone: string,
  chatId: string | null,
  instanceId: string | null,
  channel: string | null,
  channelInstanceId: string | null,
  errors: string[],
  agentId?: string,
): Promise<void> {
  console.error(`[dead-letter] Pipeline failed for conversation ${conversationId}. Errors:`, errors)

  // 1. Log to monitoring as CRITICAL
  await logAction({
    conversationId,
    actionType: 'dead_letter',
    agentId,
    status: 'error',
    errorMessage: errors.join(' | '),
    details: { errors, timestamp: new Date().toISOString() },
  })

  // 2. Save a system message so the conversation isn't empty
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: DEAD_LETTER_MESSAGE,
    intent: 'dead_letter',
  }).catch(err => console.error('[dead-letter] Failed to save message:', err))

  // 3. Send message to client via WhatsApp
  try {
    const { sendTextViaWhatsApp } = await import("./channel-router.ts")
    await sendTextViaWhatsApp(
      supabase,
      customerPhone,
      chatId,
      DEAD_LETTER_MESSAGE,
      'dead-letter',
      instanceId,
      channel,
      channelInstanceId,
      conversationId,
    )
  } catch (err) {
    console.error('[dead-letter] Failed to send WhatsApp message:', err)
  }
}
