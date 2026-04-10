import { supabase } from '@/integrations/supabase/client'
import { validateConversationForClose, isFinalStage } from '@/utils/validateTicketClose'

// Guard against recursive loops
const executionGuard = new Set<string>()

interface ActionCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'exists'
  value?: string
}

async function evaluateCondition(condition: ActionCondition, conversationId: string): Promise<boolean> {
  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('priority, tags, handler_type, status, helpdesk_client_id, human_agent_id, current_agent_id')
    .eq('id', conversationId)
    .single()
  if (!conv) return false

  const fieldValue = (conv as any)[condition.field]

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condition.value)
    case 'not_equals':
      return String(fieldValue) !== String(condition.value)
    case 'contains':
      if (Array.isArray(fieldValue)) return fieldValue.includes(condition.value)
      return String(fieldValue || '').includes(String(condition.value || ''))
    case 'exists':
      return fieldValue != null && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0)
    default:
      return true
  }
}

export async function triggerStageAutomations(conversationId: string, fromStageId: string, toStageId: string) {
  const guardKey = `${conversationId}:${toStageId}`
  if (executionGuard.has(guardKey)) return
  executionGuard.add(guardKey)
  try {
    const conditions = [fromStageId, toStageId]

    const { data: automations } = await (supabase as any)
      .from('kanban_stage_automations')
      .select('flow_automation_id, trigger_type, kanban_stage_id, action_type, action_config')
      .eq('active', true)
      .in('kanban_stage_id', conditions)
      .order('sort_order')

    const exitActions = ((automations || []) as any[]).filter(
      a => a.trigger_type === 'on_exit' && a.kanban_stage_id === fromStageId
    )
    const enterActions = ((automations || []) as any[]).filter(
      a => a.trigger_type === 'on_enter' && a.kanban_stage_id === toStageId
    )

    for (const auto of [...exitActions, ...enterActions]) {
      try {
        const config = auto.action_config || {}

        // Check condition
        if (config.condition && config.condition.field) {
          const pass = await evaluateCondition(config.condition, conversationId)
          if (!pass) continue
        }

        // Handle delay
        if (config.delay_minutes && config.delay_minutes > 0) {
          setTimeout(() => {
            executeStageAction(auto, conversationId, fromStageId, toStageId).catch(() => {})
          }, config.delay_minutes * 60 * 1000)
        } else {
          await executeStageAction(auto, conversationId, fromStageId, toStageId)
        }
      } catch {
        // continue on error
      }
    }
  } finally {
    executionGuard.delete(guardKey)
  }
}

async function executeStageAction(auto: any, conversationId: string, fromStageId: string, toStageId: string) {
  const config = auto.action_config || {}

  switch (auto.action_type) {
    case 'run_flow':
      if (auto.flow_automation_id) {
        await supabase.functions.invoke('flow-executor', {
          body: {
            flow_id: auto.flow_automation_id,
            conversation_id: conversationId,
            trigger_data: { conversation_id: conversationId, from_stage_id: fromStageId, to_stage_id: toStageId },
          },
        })
      }
      break

    case 'change_ticket_status': {
      const validSlugs = ['aguardando', 'em_atendimento', 'finalizado']
      const slug = config.slug || config.status
      if (slug && validSlugs.includes(slug)) {
        if (slug === 'em_atendimento') {
          const { data: conv } = await supabase
            .from('ai_conversations')
            .select('human_agent_id')
            .eq('id', conversationId)
            .single()
          if (!conv?.human_agent_id) break
        }
        // Validate required fields before closing
        if (slug === 'finalizado') {
          const validation = await validateConversationForClose(conversationId)
          if (!validation.canClose) {
            console.warn(`[stageAutomation] Blocked close for ${conversationId}: missing fields`, validation.missingFields)
            // Create notification for the assigned agent
            try {
              const { data: conv } = await supabase
                .from('ai_conversations')
                .select('human_agent_id, ticket_number')
                .eq('id', conversationId)
                .single()
              const fieldNames = validation.missingFields.map(f => f.field_label).join(', ')
              await (supabase as any).from('notifications').insert({
                type: 'close_validation_blocked',
                title: 'Fechamento bloqueado por automação',
                message: `Ticket #${conv?.ticket_number || '?'} não pode ser fechado automaticamente. Campos pendentes: ${fieldNames}`,
                target: 'assigned_agent',
                conversation_id: conversationId,
              })
            } catch { /* notifications table may not exist */ }
            break
          }
        }
        await supabase
          .from('ai_conversations')
          .update({ status: slug })
          .eq('id', conversationId)
      }
      break
    }

    case 'assign_agent': {
      if (config.only_if_unassigned) {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('human_agent_id')
          .eq('id', conversationId)
          .single()
        if (conv?.human_agent_id) break
      }

      let agentId = config.agent_id
      if (agentId === 'round_robin') {
        const { data: availableAgents } = await supabase
          .from('human_agents')
          .select('id, current_conversations_count')
          .neq('is_active', false)
          .eq('is_online', true)
          .order('current_conversations_count', { ascending: true })
          .limit(1)
        agentId = availableAgents?.[0]?.id || null
      }

      if (agentId) {
        await supabase.from('agent_assignments').insert({
          conversation_id: conversationId,
          agent_type: 'human',
          human_agent_id: agentId,
          assigned_by: 'stage_automation',
        })
        await supabase
          .from('ai_conversations')
          .update({ human_agent_id: agentId, handler_type: 'human' })
          .eq('id', conversationId)

        // Notify agent
        try {
          await (supabase as any).from('notifications').insert({
            type: 'assignment',
            title: 'Nova conversa atribuída',
            message: config.agent_name ? `Conversa atribuída a ${config.agent_name}` : 'Uma conversa foi atribuída a você',
            target: 'assigned_agent',
            conversation_id: conversationId,
          })
        } catch { /* notifications table may not exist */ }
      }
      break
    }

    case 'send_message':
      if (config.message) {
        const sendMsg = async () => {
          await supabase.from('ai_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: config.message,
          })
        }
        await sendMsg()
      }
      break

    case 'add_tag':
      if (config.tag) {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('tags')
          .eq('id', conversationId)
          .single()
        const currentTags = (conv?.tags || []) as string[]
        if (!currentTags.includes(config.tag)) {
          await supabase
            .from('ai_conversations')
            .update({ tags: [...currentTags, config.tag] })
            .eq('id', conversationId)
        }
      }
      break

    case 'change_priority':
      if (config.priority) {
        await supabase
          .from('ai_conversations')
          .update({ priority: config.priority })
          .eq('id', conversationId)
      }
      break

    case 'notify':
      try {
        await (supabase as any).from('notifications').insert({
          type: 'stage_automation',
          title: 'Automação de Etapa',
          message: config.message || '',
          target: config.target || 'assigned_agent',
          conversation_id: conversationId,
        })
      } catch { /* notifications table may not exist yet */ }
      break

    // ── New action types ──

    case 'move_to_stage': {
      if (config.stage_id) {
        // Validate close requirements if moving to a final stage
        const destIsFinal = await isFinalStage(config.stage_id)
        if (destIsFinal) {
          const validation = await validateConversationForClose(conversationId)
          if (!validation.canClose) {
            console.warn(`[stageAutomation] Blocked move_to_stage (final) for ${conversationId}: missing fields`, validation.missingFields)
            try {
              const { data: conv } = await supabase
                .from('ai_conversations')
                .select('human_agent_id, ticket_number')
                .eq('id', conversationId)
                .single()
              const fieldNames = validation.missingFields.map(f => f.field_label).join(', ')
              await (supabase as any).from('notifications').insert({
                type: 'close_validation_blocked',
                title: 'Movimentação para etapa final bloqueada',
                message: `Ticket #${conv?.ticket_number || '?'} não pode ser movido para etapa final. Campos pendentes: ${fieldNames}`,
                target: 'assigned_agent',
                conversation_id: conversationId,
              })
            } catch { /* notifications table may not exist */ }
            break
          }
        }

        await supabase
          .from('ai_conversations')
          .update({ kanban_stage_id: config.stage_id })
          .eq('id', conversationId)

        if (config.run_enter_automations) {
          await triggerStageAutomations(conversationId, toStageId, config.stage_id)
        }
      }
      break
    }

    case 'move_to_board': {
      if (config.board_id) {
        const updates: Record<string, any> = { kanban_board_id: config.board_id }
        if (config.stage_id) {
          updates.kanban_stage_id = config.stage_id
        } else {
          const { data: firstStage } = await (supabase as any)
            .from('kanban_stages')
            .select('id')
            .eq('board_id', config.board_id)
            .eq('active', true)
            .order('sort_order')
            .limit(1)
          if (firstStage?.[0]) updates.kanban_stage_id = firstStage[0].id
        }
        await supabase
          .from('ai_conversations')
          .update(updates)
          .eq('id', conversationId)
      }
      break
    }

    case 'assign_ai': {
      if (config.agent_id) {
        const updates: Record<string, any> = { current_agent_id: config.agent_id }
        if (config.activate_ai) updates.handler_type = 'ai'
        await supabase
          .from('ai_conversations')
          .update(updates)
          .eq('id', conversationId)
      }
      break
    }

    case 'send_internal_message': {
      if (config.message) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'system',
          content: config.message,
        })
      }
      break
    }

    case 'remove_tag': {
      if (config.tag) {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('tags')
          .eq('id', conversationId)
          .single()
        const currentTags = (conv?.tags || []) as string[]
        const newTags = currentTags.filter(t => t !== config.tag)
        if (newTags.length !== currentTags.length) {
          await supabase
            .from('ai_conversations')
            .update({ tags: newTags })
            .eq('id', conversationId)
        }
      }
      break
    }

    case 'change_category': {
      if (config.category_id) {
        await supabase
          .from('ai_conversations')
          .update({ ticket_category_id: config.category_id })
          .eq('id', conversationId)
      }
      break
    }

    case 'change_module': {
      if (config.module_id) {
        await supabase
          .from('ai_conversations')
          .update({ ticket_module_id: config.module_id })
          .eq('id', conversationId)
      }
      break
    }

    case 'create_conversation': {
      const newConv: Record<string, any> = {
        customer_phone: config.customer_phone || 'unknown',
        status: 'aguardando',
      }
      if (config.board_id) newConv.kanban_board_id = config.board_id
      if (config.stage_id) newConv.kanban_stage_id = config.stage_id
      if (config.link_same_client) {
        const { data: orig } = await supabase
          .from('ai_conversations')
          .select('customer_phone, customer_name, customer_email, helpdesk_client_id')
          .eq('id', conversationId)
          .single()
        if (orig) {
          newConv.customer_phone = orig.customer_phone
          newConv.customer_name = orig.customer_name
          newConv.customer_email = orig.customer_email
          newConv.helpdesk_client_id = orig.helpdesk_client_id
        }
      }
      await supabase.from('ai_conversations').insert(newConv as any)
      break
    }

    case 'send_webhook': {
      if (config.url) {
        try {
          const method = config.method || 'POST'
          let headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (config.headers) {
            try { headers = { ...headers, ...JSON.parse(config.headers) } } catch {}
          }
          const fetchOpts: RequestInit = { method, headers }
          if (method !== 'GET' && config.body) {
            fetchOpts.body = config.body
          }
          await fetch(config.url, fetchOpts)
        } catch { /* webhook error */ }
      }
      break
    }

    case 'run_automation': {
      if (config.automation_id) {
        await supabase.functions.invoke('automation-executor', {
          body: {
            automation_id: config.automation_id,
            trigger_data: {
              conversation_id: conversationId,
              from_stage_id: fromStageId,
              to_stage_id: toStageId,
              source: 'stage_automation',
            },
          },
        })
      }
      break
    }
  }
}
