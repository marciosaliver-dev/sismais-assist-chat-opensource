/**
 * Shared helper to log AI usage costs to the ai_usage_log table.
 * All AI calls (chat, embedding, TTS) should log costs through this helper.
 */

export interface AICostParams {
  model: string
  feature: string // 'chat' | 'embedding' | 'tts' | 'ocr' | 'transcription' | 'copilot' | 'summarization'
  input_tokens: number
  output_tokens: number
  cost_usd: number
  conversation_id?: string
}

export async function logAICost(
  supabase: any,
  params: AICostParams
): Promise<void> {
  try {
    await supabase.from("ai_usage_log").insert({
      model: params.model,
      feature: params.feature,
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      cost_usd: params.cost_usd,
      conversation_id: params.conversation_id || null,
    })
  } catch (err) {
    // Never fail the main operation due to cost logging
    console.warn(`[log-ai-cost] Failed to log cost: ${(err as Error).message}`)
  }
}
