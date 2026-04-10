import { supabase } from '@/integrations/supabase/client'

interface CreateNotificationParams {
  user_id?: string
  human_agent_id?: string
  type: 'new_assignment' | 'message_urgent' | 'escalation' | 'mention' | 'system'
  title: string
  message?: string
  conversation_id?: string
  flow_execution_id?: string
  data?: any
  priority?: 'low' | 'normal' | 'high' | 'critical'
  action_url?: string
  action_label?: string
  expires_in_hours?: number
}

export async function createNotification(params: CreateNotificationParams) {
  const {
    user_id, human_agent_id, type, title, message, conversation_id,
    flow_execution_id, data, priority = 'normal', action_url, action_label,
    expires_in_hours
  } = params

  let expires_at: string | null = null
  if (expires_in_hours) {
    const d = new Date()
    d.setHours(d.getHours() + expires_in_hours)
    expires_at = d.toISOString()
  }

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id, human_agent_id, type, title, message, conversation_id,
      flow_execution_id, data, priority, action_url, action_label, expires_at
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar notificação:', error)
    return null
  }
  return notification
}

export async function notifyNewAssignment(agentId: string, conversationId: string, customerName: string) {
  const { data: agent } = await supabase
    .from('human_agents')
    .select('user_id, name')
    .eq('id', agentId)
    .single()

  if (!agent?.user_id) return

  return createNotification({
    user_id: agent.user_id,
    human_agent_id: agentId,
    type: 'new_assignment',
    title: 'Nova conversa atribuída',
    message: `Você foi atribuído para atender ${customerName}`,
    conversation_id: conversationId,
    priority: 'high',
    action_url: `/kanban/support?ticket=${conversationId}`,
    action_label: 'Abrir conversa'
  })
}

export async function notifyUrgentMessage(agentId: string, conversationId: string, messagePreview: string) {
  const { data: agent } = await supabase
    .from('human_agents')
    .select('user_id')
    .eq('id', agentId)
    .single()

  if (!agent?.user_id) return

  return createNotification({
    user_id: agent.user_id,
    human_agent_id: agentId,
    type: 'message_urgent',
    title: 'Mensagem urgente!',
    message: messagePreview.substring(0, 100),
    conversation_id: conversationId,
    priority: 'critical',
    action_url: `/kanban/support?ticket=${conversationId}`,
    action_label: 'Ver mensagem',
    expires_in_hours: 1
  })
}

export async function notifyEscalation(agentId: string, conversationId: string, reason: string) {
  const { data: agent } = await supabase
    .from('human_agents')
    .select('user_id')
    .eq('id', agentId)
    .single()

  if (!agent?.user_id) return

  return createNotification({
    user_id: agent.user_id,
    human_agent_id: agentId,
    type: 'escalation',
    title: 'Conversa escalada para você',
    message: `Motivo: ${reason}`,
    conversation_id: conversationId,
    priority: 'high',
    action_url: `/kanban/support?ticket=${conversationId}`,
    action_label: 'Assumir conversa'
  })
}
