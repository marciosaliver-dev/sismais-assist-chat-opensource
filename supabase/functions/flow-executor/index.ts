import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { flow_id, trigger_data, conversation_id } = await req.json()

    if (!flow_id) {
      return new Response(JSON.stringify({ error: 'flow_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Load flow
    const { data: flow, error: flowError } = await supabase
      .from('flow_automations')
      .select('*')
      .eq('id', flow_id)
      .single()

    if (flowError || !flow) {
      return new Response(JSON.stringify({ error: 'Flow not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const nodes: any[] = flow.nodes || []
    const edges: any[] = flow.edges || []
    const startTime = Date.now()

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('flow_executions')
      .insert({
        flow_id,
        conversation_id: conversation_id || null,
        trigger_data: trigger_data || {},
        status: 'running',
        variables: flow.variables || {},
      })
      .select()
      .single()

    if (execError) {
      return new Response(JSON.stringify({ error: execError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const executedNodes: any[] = []
    let variables: Record<string, any> = { ...flow.variables, ...trigger_data }
    let currentNodeId = findTriggerNode(nodes)
    let status = 'completed'
    let errorMessage: string | null = null

    // Execute nodes
    try {
      while (currentNodeId) {
        const node = nodes.find((n: any) => n.id === currentNodeId)
        if (!node) break

        const nodeStart = Date.now()

        await supabase.from('flow_executions').update({ current_node_id: currentNodeId }).eq('id', execution.id)

        const result = await executeNode(node, variables, supabase, edges, trigger_data)

        executedNodes.push({
          node_id: currentNodeId,
          type: node.type,
          status: result.status,
          output: result.output,
          duration_ms: Date.now() - nodeStart,
        })

        if (result.variables) {
          variables = { ...variables, ...result.variables }
        }

        if (result.status === 'error') {
          status = 'failed'
          errorMessage = result.error || 'Unknown error'
          break
        }

        currentNodeId = result.nextNodeId || getNextNode(currentNodeId, edges, result.handleId)

        if (node.type === 'end') break
      }
    } catch (err: any) {
      status = 'failed'
      errorMessage = err.message
    }

    const executionTime = Date.now() - startTime

    // Update execution record
    await supabase.from('flow_executions').update({
      status,
      error_message: errorMessage,
      executed_nodes: executedNodes,
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      variables,
      current_node_id: null,
    }).eq('id', execution.id)

    // Update flow metrics
    const metricsUpdate: Record<string, any> = {
      execution_count: (flow.execution_count || 0) + 1,
      last_executed_at: new Date().toISOString(),
    }
    if (status === 'completed') metricsUpdate.success_count = (flow.success_count || 0) + 1
    if (status === 'failed') metricsUpdate.error_count = (flow.error_count || 0) + 1

    await supabase.from('flow_automations').update(metricsUpdate).eq('id', flow_id)

    return new Response(JSON.stringify({
      execution_id: execution.id,
      status,
      executed_nodes: executedNodes.length,
      execution_time_ms: executionTime,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function findTriggerNode(nodes: any[]): string | null {
  const trigger = nodes.find((n: any) => n.type === 'trigger')
  return trigger?.id || null
}

function getNextNode(currentId: string, edges: any[], handleId?: string): string | null {
  const edge = edges.find((e: any) => {
    if (e.source !== currentId) return false
    if (handleId && e.sourceHandle) return e.sourceHandle === handleId
    return true
  })
  return edge?.target || null
}

async function executeNode(
  node: any,
  variables: Record<string, any>,
  supabase: any,
  edges: any[],
  triggerData: any
): Promise<{ status: string; output?: any; variables?: Record<string, any>; nextNodeId?: string; handleId?: string; error?: string }> {
  const config = node.data?.config || {}

  switch (node.type) {
    case 'trigger':
      return { status: 'success', output: { trigger: 'activated' } }

    case 'send_message': {
      const message = replaceVariables(config.message || '', variables)
      // In production, this would call UAZAPI/whatsapp-send
      return { status: 'success', output: { message_sent: message } }
    }

    case 'ai_response': {
      if (config.agent_id) {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-executor`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              agent_id: config.agent_id,
              message: variables.message_content || '',
              conversation_id: variables.conversation_id,
              context: config.context || '',
            }),
          })
          const result = await response.json()
          return { status: 'success', output: result, variables: { ai_response: result.response } }
        } catch (err: any) {
          return { status: 'error', error: err.message }
        }
      }
      return { status: 'success', output: { skipped: 'no agent configured' } }
    }

    case 'assign_human': {
      const conversationId = variables.conversation_id
      if (conversationId) {
        let agentId = config.agent_id
        if (config.strategy === 'least_busy') {
          const { data } = await supabase
            .from('human_agents')
            .select('id')
            .eq('is_online', true)
            .eq('is_active', true)
            .order('current_conversations_count', { ascending: true })
            .limit(1)
            .single()
          agentId = data?.id
        } else if (config.strategy === 'round_robin') {
          const { data } = await supabase
            .from('human_agents')
            .select('id')
            .eq('is_online', true)
            .eq('is_active', true)
            .order('total_conversations', { ascending: true })
            .limit(1)
            .single()
          agentId = data?.id
        }

        if (agentId) {
          await supabase.from('ai_conversations')
            .update({ handler_type: 'human' })
            .eq('id', conversationId)

          await supabase.from('agent_assignments').insert({
            conversation_id: conversationId,
            agent_type: 'human',
            human_agent_id: agentId,
            assigned_by: 'flow',
          })
        }
      }
      return { status: 'success', output: { assigned: true } }
    }

    case 'assign_ai': {
      const conversationId = variables.conversation_id
      if (conversationId && config.agent_id) {
        await supabase.from('ai_conversations')
          .update({ handler_type: 'ai', current_agent_id: config.agent_id })
          .eq('id', conversationId)

        await supabase.from('agent_assignments').insert({
          conversation_id: conversationId,
          agent_type: 'ai',
          ai_agent_id: config.agent_id,
          assigned_by: 'flow',
        })
      }
      return { status: 'success', output: { assigned: true } }
    }

    case 'condition': {
      const fieldValue = getNestedValue(variables, config.field || '')
      const conditionMet = evaluateCondition(fieldValue, config.operator || 'equals', config.value || '')
      return { status: 'success', output: { result: conditionMet }, handleId: conditionMet ? 'true' : 'false' }
    }

    case 'switch': {
      const fieldValue = String(getNestedValue(variables, config.field || ''))
      const matchedCase = (config.cases || []).find((c: any) => c.value === fieldValue)
      return { status: 'success', output: { matched: matchedCase?.value }, handleId: matchedCase?.value || 'default' }
    }

    case 'delay': {
      const ms = convertToMs(config.duration || 0, config.unit || 'seconds')
      if (ms > 0 && ms <= 30000) {
        await new Promise(resolve => setTimeout(resolve, ms))
      }
      return { status: 'success', output: { delayed_ms: ms } }
    }

    case 'http_request': {
      try {
        const url = replaceVariables(config.url || '', variables)
        const response = await fetch(url, {
          method: config.method || 'GET',
          headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
          ...(config.body && config.method !== 'GET' ? { body: replaceVariables(config.body, variables) } : {}),
        })
        const result = await response.json().catch(() => response.text())
        return { status: 'success', output: result, variables: { http_response: result } }
      } catch (err: any) {
        return { status: 'error', error: err.message }
      }
    }

    case 'add_tag': {
      const conversationId = variables.conversation_id
      if (conversationId && config.tag) {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('tags')
          .eq('id', conversationId)
          .single()

        const tags = [...(conv?.tags || []), config.tag]
        await supabase.from('ai_conversations').update({ tags }).eq('id', conversationId)
      }
      return { status: 'success', output: { tag_added: config.tag } }
    }

    case 'set_variable':
      return {
        status: 'success',
        output: { variable_set: config.variable_name },
        variables: { [config.variable_name || 'unnamed']: replaceVariables(config.value || '', variables) },
      }

    case 'update_field': {
      const conversationId = variables.conversation_id
      if (conversationId && config.field) {
        const table = config.entity === 'contact' ? 'customer_profiles' : 'ai_conversations'
        const updateData: Record<string, any> = { [config.field]: replaceVariables(config.value || '', variables) }

        if (config.entity === 'contact') {
          await supabase.from(table).update(updateData).eq('phone', variables.customer_phone)
        } else {
          await supabase.from(table).update(updateData).eq('id', conversationId)
        }
      }
      return { status: 'success', output: { field_updated: config.field } }
    }

    case 'jump_to_flow': {
      if (config.flow_id) {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/flow-executor`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ flow_id: config.flow_id, trigger_data: variables }),
          })
          const result = await response.json()
          return { status: 'success', output: result }
        } catch (err: any) {
          return { status: 'error', error: err.message }
        }
      }
      return { status: 'success', output: { skipped: 'no flow_id' } }
    }

    case 'search_knowledge': {
      try {
        const query = replaceVariables(config.query || '', variables)
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/rag-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ query, top_k: config.top_k || 5, category: config.category }),
        })
        const result = await response.json()
        return { status: 'success', output: result, variables: { knowledge_results: result } }
      } catch (err: any) {
        return { status: 'error', error: err.message }
      }
    }

    case 'end':
      return { status: 'success', output: { flow_ended: true } }

    default:
      return { status: 'success', output: { unknown_type: node.type } }
  }
}

function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{${key}}`
  })
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

function evaluateCondition(fieldValue: any, operator: string, value: string): boolean {
  const strField = String(fieldValue || '')
  switch (operator) {
    case 'equals': return strField === value
    case 'not_equals': return strField !== value
    case 'contains': return strField.includes(value)
    case 'not_contains': return !strField.includes(value)
    case 'greater_than': return Number(fieldValue) > Number(value)
    case 'less_than': return Number(fieldValue) < Number(value)
    case 'exists': return fieldValue !== undefined && fieldValue !== null
    case 'not_exists': return fieldValue === undefined || fieldValue === null
    default: return false
  }
}

function convertToMs(duration: number, unit: string): number {
  switch (unit) {
    case 'minutes': return duration * 60 * 1000
    case 'hours': return duration * 3600 * 1000
    default: return duration * 1000
  }
}
