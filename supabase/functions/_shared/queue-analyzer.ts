// supabase/functions/_shared/queue-analyzer.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface QueueState {
  waitingCount: number
  inProgressCount: number
  availableAgents: number
  totalOnlineAgents: number
  estimatedWaitMinutes: number
  demandLevel: 'low' | 'medium' | 'high'
}

export interface QueueMessage {
  text: string
  demandLevel: QueueState['demandLevel']
}

const AVG_SERVICE_MINUTES = 15

export async function analyzeQueue(supabase: ReturnType<typeof createClient>): Promise<QueueState> {
  const [queueResult, agentsResult] = await Promise.all([
    supabase
      .from('ai_conversations')
      .select('id, status', { count: 'exact', head: false })
      .eq('handler_type', 'human')
      .eq('is_discarded', false)
      .in('status', ['aguardando', 'em_atendimento']),

    supabase
      .from('human_agents')
      .select('id, current_conversations_count, max_concurrent_conversations')
      .eq('is_online', true)
      .eq('is_active', true),
  ])

  const conversations = queueResult.data || []
  const agents = agentsResult.data || []

  const waitingCount = conversations.filter(c => c.status === 'aguardando').length
  const inProgressCount = conversations.filter(c => c.status === 'em_atendimento').length

  const availableAgents = agents.filter(
    a => (a.current_conversations_count || 0) < (a.max_concurrent_conversations || 5)
  ).length

  const totalOnlineAgents = agents.length

  const estimatedWaitMinutes = availableAgents > 0
    ? Math.ceil(waitingCount / availableAgents) * AVG_SERVICE_MINUTES
    : waitingCount * AVG_SERVICE_MINUTES

  let demandLevel: QueueState['demandLevel'] = 'low'
  if (waitingCount >= 6 || availableAgents === 0) demandLevel = 'high'
  else if (waitingCount >= 3) demandLevel = 'medium'

  return {
    waitingCount,
    inProgressCount,
    availableAgents,
    totalOnlineAgents,
    estimatedWaitMinutes,
    demandLevel,
  }
}

export function buildQueueMessage(state: QueueState): QueueMessage {
  if (state.availableAgents === 0 && state.totalOnlineAgents === 0) {
    return {
      text: '🕐 Nosso time está sendo acionado. Enquanto isso, continue comigo que vou te ajudando!',
      demandLevel: 'high',
    }
  }

  if (state.demandLevel === 'low') {
    return {
      text: '✅ Você será atendido em instantes! Enquanto isso, posso te ajudar com algo?',
      demandLevel: 'low',
    }
  }

  if (state.demandLevel === 'medium') {
    return {
      text: `⏳ Nosso time já está ciente do seu chamado. Tempo estimado: ~${state.estimatedWaitMinutes} minutos.`,
      demandLevel: 'medium',
    }
  }

  return {
    text: `⏳ Estamos com volume acima do normal no momento. Tempo estimado: ~${state.estimatedWaitMinutes} minutos. Agradecemos a paciência!`,
    demandLevel: 'high',
  }
}
