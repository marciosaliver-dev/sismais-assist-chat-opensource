import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { flow_id, conversation_id, trigger_data, jump_depth = 0 } = await req.json()

    // Limite de profundidade de jump_to_flow — previne loops infinitos
    const MAX_JUMP_DEPTH = 5
    if (jump_depth > MAX_JUMP_DEPTH) {
      console.error(JSON.stringify({
        level: 'error', fn: 'flow-engine', step: 'max_depth_exceeded',
        flow_id, conversation_id, jump_depth
      }))
      return new Response(JSON.stringify({ error: 'max_jump_depth_exceeded', jump_depth }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(JSON.stringify({
      level: 'info', fn: 'flow-engine', step: 'start',
      flow_id, conversation_id, jump_depth
    }))

    // Buscar fluxo
    const { data: flow, error: flowError } = await supabase
      .from('flow_automations')
      .select('*')
      .eq('id', flow_id)
      .eq('is_active', true)
      .single()

    if (flowError || !flow) {
      throw new Error('Fluxo não encontrado ou inativo')
    }

    const nodes = (flow.nodes || []) as any[]
    const edges = (flow.edges || []) as any[]

    // Criar registro de execução
    const { data: execution, error: execError } = await supabase
      .from('flow_executions')
      .insert({
        flow_id,
        conversation_id,
        trigger_data,
        status: 'running',
        variables: {},
        executed_nodes: [],
      })
      .select()
      .single()

    if (execError) throw execError

    console.log(`📝 Execução criada: ${execution.id}`)

    // Buscar node trigger
    const triggerNode = nodes.find((n: any) => n.type === 'trigger')

    if (!triggerNode) {
      throw new Error('Fluxo sem node trigger')
    }

    // Encontrar primeiro node após trigger
    const firstEdge = edges.find((e: any) => e.source === triggerNode.id)

    if (!firstEdge) {
      console.log('⚠️ Fluxo sem conexões após trigger')
      await finalizeExecution(supabase, execution.id, 'completed')
      return new Response(JSON.stringify({ success: true, message: 'Fluxo vazio' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Executar fluxo
    const context = {
      conversation_id,
      execution_id: execution.id,
      variables: {} as Record<string, any>,
      trigger_data,
      executed: [] as any[],
      jump_depth,  // propagado para executeJumpToFlow
    }

    await executeNode(supabase, nodes, edges, firstEdge.target, context)

    // Verificar se algum node enviou mensagem (send_message, ai_response, assign_human)
    const messageSentNodeTypes = ['send_message', 'ai_response', 'assign_human']
    const messageSent = context.executed.some(
      (n: any) => messageSentNodeTypes.includes(n.node_type) && n.status === 'success'
    )

    // Salvar nodes executados
    await supabase
      .from('flow_executions')
      .update({ executed_nodes: context.executed })
      .eq('id', execution.id)

    console.log(JSON.stringify({
      level: 'info', fn: 'flow-engine', step: 'completed',
      flow_id, conversation_id, message_sent: messageSent,
      nodes_executed: context.executed.length
    }))

    return new Response(JSON.stringify({ success: true, execution_id: execution.id, message_sent: messageSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('❌ Flow engine error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ========== EXECUTION ENGINE ==========

async function executeNode(
  supabase: any,
  nodes: any[],
  edges: any[],
  nodeId: string,
  context: any
) {
  const node = nodes.find((n: any) => n.id === nodeId)
  if (!node) {
    console.log(`⚠️ Node ${nodeId} não encontrado`)
    return
  }

  console.log(`▶️ Executando node: ${node.type} (${nodeId})`)

  const startTime = Date.now()
  let output: any = {}
  let status = 'success'

  try {
    const config = node.data?.config || {}

    switch (node.type) {
      case 'send_message':
        output = await executeSendMessage(supabase, config, context)
        break
      case 'ai_response':
        output = await executeAIResponse(supabase, config, context)
        break
      case 'assign_human':
        output = await executeAssignHuman(supabase, config, context)
        break
      case 'assign_ai':
        output = await executeAssignAI(supabase, config, context)
        break
      case 'condition':
        output = await executeCondition(supabase, config, context)
        break
      case 'switch':
        output = await executeSwitch(supabase, config, context)
        break
      case 'update_field':
        output = await executeUpdateField(supabase, config, context)
        break
      case 'delay':
        output = await executeDelay(config)
        break
      case 'http_request':
        output = await executeHTTPRequest(config, context)
        break
      case 'add_tag':
        output = await executeAddTag(supabase, config, context)
        break
      case 'set_variable':
        output = executeSetVariable(config, context)
        break
      case 'jump_to_flow':
        output = await executeJumpToFlow(supabase, config, context)
        return // Jump exits current flow
      case 'search_knowledge':
        output = await executeSearchKnowledge(supabase, config, context)
        break
      case 'end':
        await finalizeExecution(supabase, context.execution_id, 'completed')
        context.executed.push({ node_id: nodeId, node_type: node.type, status: 'success', duration_ms: Date.now() - startTime })
        return
      default:
        console.log(`⚠️ Tipo de node desconhecido: ${node.type}`)
    }
  } catch (error: any) {
    console.error(`❌ Erro executando node ${nodeId}:`, error)
    status = 'error'
    output = { error: error.message }
  }

  const duration = Date.now() - startTime
  context.executed.push({ node_id: nodeId, node_type: node.type, status, output, duration_ms: duration })

  // Update current node
  await supabase
    .from('flow_executions')
    .update({ current_node_id: nodeId })
    .eq('id', context.execution_id)

  if (status === 'error') {
    await finalizeExecution(supabase, context.execution_id, 'failed', output.error)
    return
  }

  // Merge variables
  if (output.variables) {
    context.variables = { ...context.variables, ...output.variables }
  }

  // Find next node
  let nextNodeId: string | null = null

  if (node.type === 'condition') {
    const edgeHandle = output.result ? 'true' : 'false'
    const nextEdge = edges.find((e: any) => e.source === nodeId && e.sourceHandle === edgeHandle)
    nextNodeId = nextEdge?.target || null
  } else if (node.type === 'switch') {
    const matchedCase = output.matched_case
    const nextEdge = edges.find((e: any) => e.source === nodeId && e.sourceHandle === matchedCase)
      || edges.find((e: any) => e.source === nodeId && e.sourceHandle === 'default')
    nextNodeId = nextEdge?.target || null
  } else {
    const nextEdge = edges.find((e: any) => e.source === nodeId)
    nextNodeId = nextEdge?.target || null
  }

  if (nextNodeId) {
    await executeNode(supabase, nodes, edges, nextNodeId, context)
  } else {
    console.log('✅ Fluxo concluído')
    await finalizeExecution(supabase, context.execution_id, 'completed')
  }
}

// ========== NODE EXECUTORS ==========

async function executeSendMessage(supabase: any, config: any, context: any) {
  const message = interpolateVariables(config.message || '', context.variables)

  if (context.conversation_id) {
    await supabase.from('ai_messages').insert({
      conversation_id: context.conversation_id,
      role: 'assistant',
      content: message,
      media_url: config.media_url || null,
      media_type: config.media_type || null,
    })
  }

  // If the conversation has a phone, send via WhatsApp
  if (context.conversation_id) {
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('customer_phone')
      .eq('id', context.conversation_id)
      .single()

    if (conv?.customer_phone) {
      try {
        await supabase.functions.invoke('uazapi-proxy', {
          body: {
            action: 'sendMessage',
            phone: conv.customer_phone,
            message,
            ...(config.buttons?.length ? { buttons: config.buttons } : {}),
          },
        })
      } catch (e: any) {
        console.error('Erro enviando WhatsApp:', e.message)
      }
    }
  }

  return { sent: true, message }
}

async function executeAIResponse(supabase: any, config: any, context: any) {
  if (!config.agent_id) {
    throw new Error('Agente IA não configurado')
  }

  try {
    const { data, error } = await supabase.functions.invoke('agent-executor', {
      body: {
        agent_id: config.agent_id,
        conversation_id: context.conversation_id,
        use_rag: config.use_rag ?? true,
      },
    })

    if (error) throw error

    return {
      response: data?.response,
      confidence: data?.confidence,
      variables: { ai_response: data?.response, ai_confidence: data?.confidence },
    }
  } catch (e: any) {
    console.error('AI Response error:', e.message)
    return { error: e.message }
  }
}

async function executeAssignHuman(supabase: any, config: any, context: any) {
  if (!context.conversation_id) return { assigned: false }

  let agentId = config.agent_id

  if (config.assignment_type !== 'specific' || !agentId) {
    // Auto-assign: find agent with least conversations
    const { data: agents } = await supabase
      .from('human_agents')
      .select('id, name, current_conversations_count, max_concurrent_conversations')
      .eq('is_active', true)
      .eq('is_online', true)
      .order('current_conversations_count', { ascending: true })
      .limit(1)

    if (agents?.length) {
      agentId = agents[0].id
    }
  }

  if (agentId) {
    await supabase.from('agent_assignments').insert({
      conversation_id: context.conversation_id,
      agent_type: 'human',
      human_agent_id: agentId,
      reason: 'flow_assignment',
    })

    await supabase
      .from('ai_conversations')
      .update({ handler_type: 'human' })
      .eq('id', context.conversation_id)

    // Create notification for the assigned agent
    const { data: agent } = await supabase
      .from('human_agents')
      .select('user_id')
      .eq('id', agentId)
      .single()

    if (agent?.user_id) {
      await supabase.from('notifications').insert({
        user_id: agent.user_id,
        human_agent_id: agentId,
        type: 'new_assignment',
        title: 'Nova conversa atribuída',
        message: `Você foi atribuído para atender ${context.trigger_data?.customer_name || 'um cliente'}`,
        conversation_id: context.conversation_id,
        priority: 'high',
        action_url: `/kanban/support?ticket=${context.conversation_id}`,
        action_label: 'Abrir conversa'
      })
    }
  }

  return { assigned: !!agentId, agent_id: agentId }
}

async function executeAssignAI(supabase: any, config: any, context: any) {
  if (!context.conversation_id || !config.agent_id) return { assigned: false }

  await supabase.from('agent_assignments').insert({
    conversation_id: context.conversation_id,
    agent_type: 'ai',
    ai_agent_id: config.agent_id,
    reason: 'flow_assignment',
  })

  await supabase
    .from('ai_conversations')
    .update({ current_agent_id: config.agent_id, handler_type: 'ai' })
    .eq('id', context.conversation_id)

  return { assigned: true, agent_id: config.agent_id }
}

async function executeCondition(supabase: any, config: any, context: any) {
  const field = config.field || ''
  const operator = config.operator || 'equals'
  const targetValue = config.value || ''

  // Resolve field value from DB or context
  let actualValue: any = ''

  if ((field === 'sentiment' || field === 'urgency') && context.conversation_id) {
    const { data: msg } = await supabase
      .from('ai_messages')
      .select(field)
      .eq('conversation_id', context.conversation_id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    actualValue = msg?.[field] ?? ''
  } else if (field === 'message_content' && context.conversation_id) {
    const { data: msg } = await supabase
      .from('ai_messages')
      .select('content')
      .eq('conversation_id', context.conversation_id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    actualValue = msg?.content ?? ''
  } else if (field === 'messages_count' && context.conversation_id) {
    const { count } = await supabase
      .from('ai_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', context.conversation_id)
    actualValue = count ?? 0
  } else if (field === 'has_tag' && context.conversation_id) {
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('tags')
      .eq('id', context.conversation_id)
      .maybeSingle()
    const tags: string[] = conv?.tags || []
    actualValue = tags.includes(targetValue) ? targetValue : ''
  } else if (context.variables[field] !== undefined) {
    actualValue = context.variables[field]
  } else if (context.trigger_data?.[field] !== undefined) {
    actualValue = context.trigger_data[field]
  } else if (context.conversation_id) {
    // Fallback: query ai_conversations for the field
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select(field)
      .eq('id', context.conversation_id)
      .maybeSingle()
    actualValue = conv?.[field] ?? ''
  }

  let result = false

  switch (operator) {
    case 'equals':
      result = String(actualValue).toLowerCase() === String(targetValue).toLowerCase()
      break
    case 'not_equals':
      result = String(actualValue).toLowerCase() !== String(targetValue).toLowerCase()
      break
    case 'contains':
      result = String(actualValue).toLowerCase().includes(String(targetValue).toLowerCase())
      break
    case 'not_contains':
      result = !String(actualValue).toLowerCase().includes(String(targetValue).toLowerCase())
      break
    case 'greater_than':
      result = Number(actualValue) > Number(targetValue)
      break
    case 'less_than':
      result = Number(actualValue) < Number(targetValue)
      break
    case 'exists':
      result = actualValue !== '' && actualValue !== null && actualValue !== undefined
      break
    case 'not_exists':
      result = actualValue === '' || actualValue === null || actualValue === undefined
      break
    case 'in_list':
      const list = String(targetValue).split(',').map(s => s.trim().toLowerCase())
      result = list.includes(String(actualValue).toLowerCase())
      break
  }

  console.log(`🔀 Condition: ${field} ${operator} "${targetValue}" → ${result} (actual: ${actualValue})`)
  return { result, field, actual_value: actualValue }
}

async function executeSwitch(supabase: any, config: any, context: any) {
  const field = config.field || ''
  // Reuse condition's field resolution logic
  const condResult = await executeCondition(supabase, { field, operator: 'equals', value: '' }, context)
  const actualValue = String(condResult.actual_value).toLowerCase()

  const cases: Array<{ value: string; label: string }> = config.cases || []
  const matched = cases.find(c => String(c.value).toLowerCase() === actualValue)

  console.log(`🔀 Switch on "${field}": value="${actualValue}", matched="${matched?.label || 'default'}"`)

  return {
    matched_case: matched ? `case_${cases.indexOf(matched)}` : 'default',
    actual_value: actualValue,
  }
}

async function executeUpdateField(supabase: any, config: any, context: any) {
  const entity = config.entity || 'conversation'
  const field = config.field
  const value = interpolateVariables(config.value || '', context.variables)

  if (!field) return { updated: false }

  if (entity === 'conversation' && context.conversation_id) {
    await supabase
      .from('ai_conversations')
      .update({ [field]: value })
      .eq('id', context.conversation_id)
    console.log(`📝 Updated conversation.${field} = ${value}`)
  } else if (entity === 'contact' && context.conversation_id) {
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('customer_phone')
      .eq('id', context.conversation_id)
      .maybeSingle()
    if (conv?.customer_phone) {
      await supabase
        .from('customer_profiles')
        .update({ [field]: value })
        .eq('phone', conv.customer_phone)
      console.log(`📝 Updated contact.${field} = ${value}`)
    }
  }

  return { updated: true, entity, field, value }
}

async function executeDelay(config: any) {
  const value = config.duration || config.value || 5
  const unit = config.unit || 'seconds'
  const multipliers: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 }
  const ms = value * (multipliers[unit] || 1000)

  // Cap at 25s for edge function limits
  const actualMs = Math.min(ms, 25000)
  console.log(`⏰ Delay: ${actualMs}ms (requested ${ms}ms)`)

  await new Promise(resolve => setTimeout(resolve, actualMs))
  return { delayed: true, actual_ms: actualMs }
}

async function executeHTTPRequest(config: any, context: any) {
  const method = config.method || 'POST'
  const url = interpolateVariables(config.url || '', context.variables)
  const body = config.body ? interpolateVariables(config.body, context.variables) : undefined

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (Array.isArray(config.headers)) {
    for (const h of config.headers) {
      if (h.key) headers[h.key] = interpolateVariables(h.value || '', context.variables)
    }
  }

  console.log(`🌐 HTTP ${method} ${url}`)

  const response = await fetch(url, {
    method,
    headers,
    ...(method !== 'GET' && body ? { body } : {}),
  })

  const responseText = await response.text()
  let responseData: any
  try { responseData = JSON.parse(responseText) } catch { responseData = responseText }

  return {
    status: response.status,
    response: responseData,
    variables: { http_response: responseData, http_status: response.status },
  }
}

async function executeAddTag(supabase: any, config: any, context: any) {
  if (!context.conversation_id) return { added: false }

  const tags = config.tags || (config.tag ? [config.tag] : [])
  if (!tags.length) return { added: false }

  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('tags')
    .eq('id', context.conversation_id)
    .single()

  const existingTags = conv?.tags || []
  const newTags = [...new Set([...existingTags, ...tags])]

  await supabase
    .from('ai_conversations')
    .update({ tags: newTags })
    .eq('id', context.conversation_id)

  return { added: true, tags: newTags }
}

function executeSetVariable(config: any, context: any) {
  const name = config.variable_name
  const value = interpolateVariables(config.value || '', context.variables)

  if (name) {
    context.variables[name] = value
  }

  return { variables: { [name]: value } }
}

async function executeJumpToFlow(supabase: any, config: any, context: any) {
  if (!config.flow_id) throw new Error('Fluxo destino não configurado')

  console.log(`➡️ Jumping to flow: ${config.flow_id}`)

  await finalizeExecution(supabase, context.execution_id, 'completed')

  // Invoke this same function for the target flow — passa jump_depth para limitar recursão
  await supabase.functions.invoke('flow-engine', {
    body: {
      flow_id: config.flow_id,
      conversation_id: context.conversation_id,
      trigger_data: { ...context.trigger_data, ...context.variables, jumped_from: context.execution_id },
      jump_depth: (context.jump_depth || 0) + 1,
    },
  })

  return { jumped: true, target_flow_id: config.flow_id }
}

async function executeSearchKnowledge(supabase: any, config: any, context: any) {
  const query = interpolateVariables(config.query || context.variables.message_content || '', context.variables)

  try {
    const { data, error } = await supabase.functions.invoke('rag-search', {
      body: {
        query,
        category: config.category || null,
        top_k: config.top_k || 3,
      },
    })

    if (error) throw error

    return {
      results: data?.results || [],
      variables: { rag_results: JSON.stringify(data?.results || []) },
    }
  } catch (e: any) {
    console.error('RAG search error:', e.message)
    return { results: [], variables: { rag_results: '[]' } }
  }
}

// ========== HELPERS ==========

async function finalizeExecution(supabase: any, executionId: string, status: string, errorMessage?: string) {
  await supabase
    .from('flow_executions')
    .update({
      status,
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId)
}

function interpolateVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}
