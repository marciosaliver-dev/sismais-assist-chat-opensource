import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { automation_id, trigger_data } = await req.json()
    const startTime = Date.now()

    console.log(`[automation-executor] Starting automation ${automation_id}`)

    // 1. Buscar automação
    const { data: automation, error: fetchError } = await supabase
      .from('ai_automations')
      .select('*')
      .eq('id', automation_id)
      .eq('is_active', true)
      .single()

    if (fetchError || !automation) {
      throw new Error('Automation not found or inactive')
    }

    // 2. Verificar condições
    const conditions = (automation.trigger_conditions as any[]) || []

    if (conditions.length > 0) {
      const passed = conditions.every((c: any) => {
        const val = trigger_data[c.field]
        switch (c.operator) {
          case 'equals': return String(val) === String(c.value)
          case 'not_equals': return String(val) !== String(c.value)
          case 'contains': return String(val).toLowerCase().includes(String(c.value).toLowerCase())
          case 'greater_than': return Number(val) > Number(c.value)
          case 'less_than': return Number(val) < Number(c.value)
          case 'in_list': return Array.isArray(c.value) ? c.value.includes(val) : String(c.value).split(',').map((s: string) => s.trim()).includes(String(val))
          default: return true
        }
      })

      if (!passed) {
        console.log(`[automation-executor] Conditions not met, skipping`)
        return new Response(JSON.stringify({ skipped: true, reason: 'Conditions not met' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 3. Executar ações sequencialmente
    const actions = (automation.actions as any[]) || []
    const actionsExecuted: any[] = []
    let lastError: string | null = null

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      try {
        const result = await executeAction(action, trigger_data, supabase)
        actionsExecuted.push({ index: i, type: action.type, status: 'success', result })
        console.log(`[automation-executor] Action ${i} (${action.type}) succeeded`)
      } catch (error: any) {
        lastError = error.message
        actionsExecuted.push({ index: i, type: action.type, status: 'failed', error: error.message })
        console.error(`[automation-executor] Action ${i} (${action.type}) failed:`, error.message)
        break
      }
    }

    const executionTime = Date.now() - startTime
    const status = lastError ? 'failed' : 'success'

    // 4. Salvar log
    await supabase.from('ai_automation_logs').insert({
      automation_id,
      conversation_id: trigger_data.conversation_id || null,
      trigger_data,
      actions_executed: actionsExecuted,
      status,
      error_message: lastError,
      execution_time_ms: executionTime
    })

    // 5. Atualizar contador
    const { data: current } = await supabase
      .from('ai_automations')
      .select('execution_count')
      .eq('id', automation_id)
      .single()

    await supabase
      .from('ai_automations')
      .update({
        execution_count: (current?.execution_count || 0) + 1,
        last_executed_at: new Date().toISOString()
      })
      .eq('id', automation_id)

    console.log(`[automation-executor] Completed in ${executionTime}ms, status: ${status}`)

    return new Response(JSON.stringify({
      success: !lastError,
      actions_executed: actionsExecuted.length,
      execution_time_ms: executionTime,
      error: lastError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[automation-executor] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function replaceVariables(params: any, data: any): any {
  const json = JSON.stringify(params)
  const replaced = json.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match
  })
  return JSON.parse(replaced)
}

async function executeAction(action: any, triggerData: any, supabase: any) {
  const { type, params } = action
  const p = replaceVariables(params || {}, triggerData)

  switch (type) {
    case 'send_message': {
      // Buscar chat_id da conversa
      if (!triggerData.conversation_id) return { skipped: true, reason: 'no conversation_id' }

      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('uazapi_chat_id, customer_phone')
        .eq('id', triggerData.conversation_id)
        .single()

      if (!conv?.uazapi_chat_id) return { skipped: true, reason: 'no uazapi_chat_id' }

      const { data: instances } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('is_active', true)
        .limit(1)

      if (!instances?.length) return { skipped: true, reason: 'no active instance' }

      const inst = instances[0]
      const apiUrl = inst.api_url.replace(/\/$/, '')

      const body: any = { chatId: conv.uazapi_chat_id, message: p.message }

      // Suporte a botões
      if (p.buttons && Array.isArray(p.buttons) && p.buttons.length > 0) {
        body.buttons = p.buttons
      }

      const res = await fetch(`${apiUrl}/chat/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
        body: JSON.stringify(body)
      })

      const result = await res.json()

      // Salvar em ai_messages para aparecer no inbox
      const whatsappMsgId = result?.key?.id || result?.id || null
      await supabase.from('ai_messages').insert({
        conversation_id: triggerData.conversation_id,
        role: 'assistant',
        content: p.message,
        uazapi_message_id: whatsappMsgId,
        delivery_status: res.ok ? 'sent' : 'failed',
        whatsapp_instance_id: inst?.id || null,
      }).catch((e: any) => console.error('[automation-executor] Failed to save to ai_messages:', e?.message))

      return { sent: true, message_id: whatsappMsgId }
    }

    case 'assign_agent': {
      if (!triggerData.conversation_id) return { skipped: true }
      const { error } = await supabase
        .from('ai_conversations')
        .update({ current_agent_id: p.agent_id, handler_type: 'ai' })
        .eq('id', triggerData.conversation_id)
      if (error) throw error
      return { assigned: p.agent_id }
    }

    case 'escalate_to_human': {
      if (!triggerData.conversation_id) return { skipped: true }
      const { error } = await supabase
        .from('ai_conversations')
        .update({ handler_type: 'human' })
        .eq('id', triggerData.conversation_id)
      if (error) throw error
      return { escalated: true, reason: p.reason }
    }

    case 'wait': {
      const seconds = Math.min(p.duration_seconds || 0, 30) // Max 30s in edge function
      await new Promise(resolve => setTimeout(resolve, seconds * 1000))
      return { waited: seconds }
    }

    case 'ai_respond': {
      const { data, error } = await supabase.functions.invoke('agent-executor', {
        body: {
          conversation_id: triggerData.conversation_id,
          agent_id: p.agent_id,
          message_content: p.context || triggerData.message_content
        }
      })
      if (error) throw error
      return data
    }

    case 'http_request': {
      const res = await fetch(p.url, {
        method: p.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(p.headers || {}) },
        body: p.body ? JSON.stringify(p.body) : undefined
      })
      const text = await res.text()
      try { return JSON.parse(text) } catch { return { status: res.status, body: text.substring(0, 500) } }
    }

    case 'add_tag': {
      if (!triggerData.conversation_id) return { skipped: true }
      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('tags')
        .eq('id', triggerData.conversation_id)
        .single()

      const currentTags: string[] = conv?.tags || []
      if (!currentTags.includes(p.tag)) {
        await supabase
          .from('ai_conversations')
          .update({ tags: [...currentTags, p.tag] })
          .eq('id', triggerData.conversation_id)
        return { added: p.tag }
      }
      return { tag_exists: true }
    }

    case 'update_conversation': {
      if (!triggerData.conversation_id) return { skipped: true }
      const { error } = await supabase
        .from('ai_conversations')
        .update({ [p.field]: p.value })
        .eq('id', triggerData.conversation_id)
      if (error) throw error
      return { updated: p.field }
    }

    case 'search_knowledge': {
      const { data, error } = await supabase.functions.invoke('rag-search', {
        body: { query: p.query, top_k: p.top_k || 3 }
      })
      if (error) throw error
      return data
    }

    case 'create_cancellation_ticket': {
      // Cross-board trigger: creates a ticket on the cancellation board
      // when tag "cancelamento" is added on any other board
      if (!triggerData.conversation_id) return { skipped: true }

      // Fetch source conversation
      const { data: sourceConv } = await supabase
        .from('ai_conversations')
        .select('id, customer_name, customer_phone, helpdesk_client_id, kanban_board_id, context')
        .eq('id', triggerData.conversation_id)
        .single()
      if (!sourceConv) return { skipped: true, reason: 'source_not_found' }

      // Find the cancellation board
      const { data: cancBoard } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('board_type', 'cancellation')
        .eq('active', true)
        .single()
      if (!cancBoard) return { skipped: true, reason: 'cancellation_board_not_found' }

      // Skip if source is already the cancellation board
      if (sourceConv.kanban_board_id === cancBoard.id) return { skipped: true, reason: 'already_on_cancellation_board' }

      // Find entry stage
      const { data: entryStage } = await supabase
        .from('kanban_stages')
        .select('id')
        .eq('board_id', cancBoard.id)
        .eq('is_entry', true)
        .single()
      if (!entryStage) return { skipped: true, reason: 'entry_stage_not_found' }

      // Calculate months_active from helpdesk_client
      let monthsActive: number | null = null
      let mrrValue = 69.90
      if (sourceConv.helpdesk_client_id) {
        const { data: client } = await supabase
          .from('helpdesk_clients')
          .select('customer_since, mrr')
          .eq('id', sourceConv.helpdesk_client_id)
          .single()
        if (client?.customer_since) {
          const since = new Date(client.customer_since)
          monthsActive = Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24 * 30))
        }
        if (client?.mrr) mrrValue = Number(client.mrr)
      }

      // Create the cancellation ticket
      const { data: newConv, error: insertErr } = await supabase
        .from('ai_conversations')
        .insert({
          customer_name: sourceConv.customer_name,
          customer_phone: sourceConv.customer_phone,
          helpdesk_client_id: sourceConv.helpdesk_client_id,
          kanban_board_id: cancBoard.id,
          stage_id: entryStage.id,
          status: 'aguardando',
          handler_type: 'human',
          communication_channel: 'internal',
          ticket_subject: `Pedido de Cancelamento - ${sourceConv.customer_name || 'Cliente'}`,
          context: {
            source_ticket_id: sourceConv.id,
            cancellation_channel: 'suporte',
            months_active: monthsActive,
            mrr_value: mrrValue,
            contact_attempts: 0,
          },
        })
        .select('id, ticket_number')
        .single()

      if (insertErr) throw insertErr
      console.log(`[automation-executor] Created cancellation ticket ${newConv?.ticket_number} from source ${sourceConv.id}`)
      return { created: true, ticket_id: newConv?.id, ticket_number: newConv?.ticket_number }
    }

    default:
      throw new Error(`Unknown action type: ${type}`)
  }
}
