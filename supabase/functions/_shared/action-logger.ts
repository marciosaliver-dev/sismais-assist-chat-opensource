// supabase/functions/_shared/action-logger.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export type ActionType =
  | 'llm_call'
  | 'llm_fallback'
  | 'tool_call'
  | 'orchestrator_decision'
  | 'escalation'
  | 'dead_letter'
  | 'priority_change'
  | 'automation_trigger'
  | 'human_takeover'
  | 'ai_resume'

export interface LogActionParams {
  conversationId?: string
  actionType: ActionType
  agentId?: string
  status: 'success' | 'error' | 'timeout' | 'fallback'
  model?: string
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  errorMessage?: string
  details?: Record<string, unknown>
}

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key)
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const sb = getSupabase()
    if (!sb) return

    await sb.from('ai_action_logs').insert({
      conversation_id: params.conversationId || null,
      action_type: params.actionType,
      agent_id: params.agentId || null,
      status: params.status,
      model: params.model || null,
      duration_ms: params.durationMs || null,
      tokens_in: params.tokensIn || 0,
      tokens_out: params.tokensOut || 0,
      cost_usd: params.costUsd || 0,
      error_message: params.errorMessage || null,
      details: params.details || {},
      notification_sent: params.status === 'error' || params.status === 'timeout',
    })
  } catch (err) {
    console.warn('[action-logger] Failed to log:', (err as Error).message)
  }
}

/** Fire-and-forget convenience wrapper */
export function logActionAsync(params: LogActionParams): void {
  logAction(params).catch(() => {})
}
