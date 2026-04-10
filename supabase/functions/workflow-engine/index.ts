/**
 * workflow-engine — Motor Unificado de Automacoes
 *
 * Substitui gradualmente:
 *   - automation-executor (ai_automations)
 *   - flow-executor (flow_automations)
 *   - flow-engine (flow_automations)
 *   - trigger-flows (flow_automations)
 *
 * Aceita AMBOS os formatos:
 *   1. Legacy: { automation_id, trigger_data }  (ai_automations)
 *   2. Flow:   { flow_id, trigger_data, conversation_id }  (flow_automations)
 *   3. Trigger: { trigger_type, conversation_id, data }  (busca e executa flows matching)
 *
 * Feature flag: FF_UNIFIED_WORKFLOW_ENGINE
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_JUMP_DEPTH = 5
const MAX_NODES_PER_EXECUTION = 100
const MAX_DELAY_MS = 25000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    const startTime = Date.now()

    // Detectar modo de operacao
    if (body.trigger_type) {
      return await handleTriggerMode(supabase, body, startTime)
    } else if (body.automation_id) {
      return await handleLegacyMode(supabase, body, startTime)
    } else if (body.flow_id) {
      return await handleFlowMode(supabase, body, startTime)
    }

    return jsonResponse({ error: 'Provide trigger_type, automation_id, or flow_id' }, 400)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'workflow-engine', error: msg }))
    return jsonResponse({ error: msg }, 500)
  }
})

// ============================================================
// MODE 1: Trigger — busca flows ativos e executa
// ============================================================

async function handleTriggerMode(supabase: any, body: any, startTime: number) {
  const { trigger_type, conversation_id, data } = body

  log('info', 'trigger_start', { trigger_type, conversation_id })

  // Buscar flows ativos para este trigger
  const { data: flows, error } = await supabase
    .from('flow_automations')
    .select('id, name, trigger_config, whatsapp_instances')
    .eq('trigger_type', trigger_type)
    .eq('is_active', true)

  if (error) throw error

  // Tambem buscar automacoes legadas se flag nao desativou
  const disableLegacy = Deno.env.get('FF_DISABLE_LEGACY_AUTO') === 'true'
  let legacyAutomations: any[] = []

  if (!disableLegacy) {
    const { data: legacyData } = await supabase
      .from('ai_automations')
      .select('id, name, trigger_type, trigger_conditions, actions')
      .eq('trigger_type', trigger_type)
      .eq('is_active', true)

    legacyAutomations = legacyData || []
  }

  if ((!flows || flows.length === 0) && legacyAutomations.length === 0) {
    return jsonResponse({ triggered: 0, message_sent: false })
  }

  let triggeredCount = 0
  let messageSentByFlow = false

  // Executar flows
  for (const flow of (flows || [])) {
    if (!matchesTriggerConfig(flow, trigger_type, data)) continue

    log('info', 'flow_trigger', { flow_id: flow.id, flow_name: flow.name })

    try {
      const result = await executeFlow(supabase, flow.id, conversation_id, data, 0)
      if (result.messageSent) messageSentByFlow = true
      triggeredCount++
    } catch (err: any) {
      log('error', 'flow_trigger_failed', { flow_id: flow.id, error: err.message })
    }
  }

  // Executar automacoes legadas (adaptadas ao flow engine)
  for (const auto of legacyAutomations) {
    if (!matchesLegacyConditions(auto.trigger_conditions, data)) continue

    log('info', 'legacy_trigger', { automation_id: auto.id, name: auto.name })

    try {
      await executeLegacyAutomation(supabase, auto, data)
      triggeredCount++
    } catch (err: any) {
      log('error', 'legacy_trigger_failed', { automation_id: auto.id, error: err.message })
    }
  }

  const executionTime = Date.now() - startTime
  log('info', 'trigger_done', { triggered: triggeredCount, message_sent: messageSentByFlow, ms: executionTime })

  return jsonResponse({ success: true, triggered: triggeredCount, message_sent: messageSentByFlow })
}

// ============================================================
// MODE 2: Legacy — executa uma ai_automation por id
// ============================================================

async function handleLegacyMode(supabase: any, body: any, startTime: number) {
  const { automation_id, trigger_data } = body

  const { data: automation, error } = await supabase
    .from('ai_automations')
    .select('*')
    .eq('id', automation_id)
    .eq('is_active', true)
    .single()

  if (error || !automation) throw new Error('Automation not found or inactive')

  const result = await executeLegacyAutomation(supabase, automation, trigger_data)
  const executionTime = Date.now() - startTime

  // Log
  await supabase.from('ai_automation_logs').insert({
    automation_id,
    conversation_id: trigger_data?.conversation_id || null,
    trigger_data,
    actions_executed: result.actionsExecuted,
    status: result.error ? 'failed' : 'success',
    error_message: result.error,
    execution_time_ms: executionTime,
  })

  // Incrementar contador
  await supabase.rpc('increment_counter', {
    table_name: 'ai_automations',
    row_id: automation_id,
    column_name: 'execution_count',
  }).catch(() => {
    // Fallback se RPC nao existe
    supabase.from('ai_automations').update({
      execution_count: (automation.execution_count || 0) + 1,
      last_executed_at: new Date().toISOString(),
    }).eq('id', automation_id)
  })

  return jsonResponse({
    success: !result.error,
    actions_executed: result.actionsExecuted.length,
    execution_time_ms: executionTime,
    error: result.error,
  })
}

// ============================================================
// MODE 3: Flow — executa um flow_automations por id
// ============================================================

async function handleFlowMode(supabase: any, body: any, startTime: number) {
  const { flow_id, conversation_id, trigger_data, jump_depth = 0 } = body

  if (jump_depth > MAX_JUMP_DEPTH) {
    return jsonResponse({ error: 'max_jump_depth_exceeded', jump_depth }, 400)
  }

  const result = await executeFlow(supabase, flow_id, conversation_id, trigger_data || {}, jump_depth)
  const executionTime = Date.now() - startTime

  return jsonResponse({
    execution_id: result.executionId,
    status: result.status,
    executed_nodes: result.nodesExecuted,
    execution_time_ms: executionTime,
    message_sent: result.messageSent,
    error: result.error,
  })
}

// ============================================================
// FLOW EXECUTION ENGINE
// ============================================================

interface FlowResult {
  executionId: string
  status: string
  nodesExecuted: number
  messageSent: boolean
  error: string | null
}

async function executeFlow(
  supabase: any,
  flowId: string,
  conversationId: string | null,
  triggerData: any,
  jumpDepth: number,
): Promise<FlowResult> {
  // Buscar fluxo
  const { data: flow, error: flowError } = await supabase
    .from('flow_automations')
    .select('*')
    .eq('id', flowId)
    .eq('is_active', true)
    .single()

  if (flowError || !flow) throw new Error('Flow not found or inactive')

  const nodes: any[] = flow.nodes || []
  const edges: any[] = flow.edges || []

  // Criar registro de execucao
  const { data: execution, error: execError } = await supabase
    .from('flow_executions')
    .insert({
      flow_id: flowId,
      conversation_id: conversationId,
      trigger_data: triggerData,
      status: 'running',
      variables: {},
      executed_nodes: [],
    })
    .select()
    .single()

  if (execError) throw execError

  // Executar
  const context: ExecutionContext = {
    supabase,
    conversationId,
    executionId: execution.id,
    variables: { ...flow.variables, ...triggerData },
    triggerData,
    executed: [],
    jumpDepth,
    messageSent: false,
    nodesTraversed: 0,
  }

  const triggerNode = nodes.find((n: any) => n.type === 'trigger')
  if (!triggerNode) {
    await finalizeExecution(supabase, execution.id, 'completed')
    return { executionId: execution.id, status: 'completed', nodesExecuted: 0, messageSent: false, error: null }
  }

  const firstEdge = edges.find((e: any) => e.source === triggerNode.id)
  if (!firstEdge) {
    await finalizeExecution(supabase, execution.id, 'completed')
    return { executionId: execution.id, status: 'completed', nodesExecuted: 0, messageSent: false, error: null }
  }

  let status = 'completed'
  let errorMessage: string | null = null

  try {
    await executeNodeChain(context, nodes, edges, firstEdge.target)
  } catch (err: any) {
    status = 'failed'
    errorMessage = err.message
  }

  // Salvar resultado
  await supabase.from('flow_executions').update({
    status,
    error_message: errorMessage,
    executed_nodes: context.executed,
    completed_at: new Date().toISOString(),
    execution_time_ms: Date.now() - Date.parse(execution.created_at || new Date().toISOString()),
    variables: context.variables,
    current_node_id: null,
  }).eq('id', execution.id)

  // Atualizar metricas do flow
  const metricsUpdate: Record<string, any> = {
    execution_count: (flow.execution_count || 0) + 1,
    last_executed_at: new Date().toISOString(),
  }
  if (status === 'completed') metricsUpdate.success_count = (flow.success_count || 0) + 1
  if (status === 'failed') metricsUpdate.error_count = (flow.error_count || 0) + 1
  await supabase.from('flow_automations').update(metricsUpdate).eq('id', flowId)

  return {
    executionId: execution.id,
    status,
    nodesExecuted: context.executed.length,
    messageSent: context.messageSent,
    error: errorMessage,
  }
}

// ============================================================
// NODE CHAIN EXECUTOR (iterativo, nao recursivo)
// ============================================================

interface ExecutionContext {
  supabase: any
  conversationId: string | null
  executionId: string
  variables: Record<string, any>
  triggerData: any
  executed: any[]
  jumpDepth: number
  messageSent: boolean
  nodesTraversed: number
}

async function executeNodeChain(
  ctx: ExecutionContext,
  nodes: any[],
  edges: any[],
  startNodeId: string,
) {
  let currentNodeId: string | null = startNodeId

  while (currentNodeId) {
    if (ctx.nodesTraversed >= MAX_NODES_PER_EXECUTION) {
      throw new Error('max_nodes_exceeded')
    }
    ctx.nodesTraversed++

    const node = nodes.find((n: any) => n.id === currentNodeId)
    if (!node) break

    const nodeStart = Date.now()
    await ctx.supabase.from('flow_executions').update({ current_node_id: currentNodeId }).eq('id', ctx.executionId)

    let output: any = {}
    let status = 'success'
    let handleId: string | undefined

    try {
      const result = await executeNodeAction(ctx, node)
      output = result.output || {}
      handleId = result.handleId
      if (result.variables) ctx.variables = { ...ctx.variables, ...result.variables }
      if (result.messageSent) ctx.messageSent = true

      // Jump to flow: sai do loop atual
      if (result.jumpedToFlow) {
        ctx.executed.push({
          node_id: currentNodeId,
          node_type: node.type,
          status: 'success',
          output,
          duration_ms: Date.now() - nodeStart,
        })
        return
      }
    } catch (err: any) {
      status = 'error'
      output = { error: err.message }
      ctx.executed.push({
        node_id: currentNodeId,
        node_type: node.type,
        status,
        output,
        duration_ms: Date.now() - nodeStart,
      })
      await finalizeExecution(ctx.supabase, ctx.executionId, 'failed', err.message)
      throw err
    }

    ctx.executed.push({
      node_id: currentNodeId,
      node_type: node.type,
      status,
      output,
      duration_ms: Date.now() - nodeStart,
    })

    if (node.type === 'end') break

    // Encontrar proximo node
    currentNodeId = resolveNextNode(currentNodeId, edges, node.type, handleId, output)
  }
}

function resolveNextNode(
  currentId: string,
  edges: any[],
  nodeType: string,
  handleId?: string,
  output?: any,
): string | null {
  if (nodeType === 'condition') {
    const edgeHandle = output?.result ? 'true' : 'false'
    const edge = edges.find((e: any) => e.source === currentId && e.sourceHandle === edgeHandle)
    return edge?.target || null
  }

  if (nodeType === 'switch') {
    const matchedCase = output?.matched_case
    const edge = edges.find((e: any) => e.source === currentId && e.sourceHandle === matchedCase)
      || edges.find((e: any) => e.source === currentId && e.sourceHandle === 'default')
    return edge?.target || null
  }

  if (handleId) {
    const edge = edges.find((e: any) => e.source === currentId && e.sourceHandle === handleId)
    if (edge) return edge.target
  }

  const edge = edges.find((e: any) => e.source === currentId)
  return edge?.target || null
}

// ============================================================
// NODE EXECUTORS
// ============================================================

interface NodeResult {
  output?: any
  variables?: Record<string, any>
  handleId?: string
  messageSent?: boolean
  jumpedToFlow?: boolean
}

async function executeNodeAction(ctx: ExecutionContext, node: any): Promise<NodeResult> {
  const config = node.data?.config || {}
  const { supabase, conversationId, variables } = ctx

  switch (node.type) {
    case 'trigger':
      return { output: { trigger: 'activated' } }

    case 'send_message': {
      const message = interpolate(config.message || '', variables)
      if (conversationId) {
        // Salvar mensagem
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: message,
        })
        // Enviar via WhatsApp
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('customer_phone')
          .eq('id', conversationId)
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
            log('error', 'send_whatsapp_failed', { error: e.message })
          }
        }
      }
      return { output: { sent: true, message }, messageSent: true }
    }

    case 'ai_response': {
      if (!config.agent_id) throw new Error('Agent ID required for ai_response')
      const { data, error } = await supabase.functions.invoke('agent-executor', {
        body: {
          agent_id: config.agent_id,
          conversation_id: conversationId,
          use_rag: config.use_rag ?? true,
        },
      })
      if (error) throw error
      return {
        output: data,
        variables: { ai_response: data?.response, ai_confidence: data?.confidence },
        messageSent: true,
      }
    }

    case 'assign_human': {
      if (!conversationId) return { output: { assigned: false } }
      let agentId = config.agent_id
      if (config.assignment_type !== 'specific' || !agentId) {
        const { data: agents } = await supabase
          .from('human_agents')
          .select('id, user_id')
          .eq('is_active', true)
          .eq('is_online', true)
          .order('current_conversations_count', { ascending: true })
          .limit(1)
        agentId = agents?.[0]?.id
      }
      if (agentId) {
        await supabase.from('ai_conversations')
          .update({ handler_type: 'human' })
          .eq('id', conversationId)
        await supabase.from('agent_assignments').insert({
          conversation_id: conversationId,
          agent_type: 'human',
          human_agent_id: agentId,
          assigned_by: 'workflow-engine',
        })
      }
      return { output: { assigned: !!agentId, agent_id: agentId }, messageSent: true }
    }

    case 'assign_ai': {
      if (!conversationId || !config.agent_id) return { output: { assigned: false } }
      await supabase.from('ai_conversations')
        .update({ current_agent_id: config.agent_id, handler_type: 'ai' })
        .eq('id', conversationId)
      await supabase.from('agent_assignments').insert({
        conversation_id: conversationId,
        agent_type: 'ai',
        ai_agent_id: config.agent_id,
        assigned_by: 'workflow-engine',
      })
      return { output: { assigned: true, agent_id: config.agent_id } }
    }

    case 'condition': {
      const actualValue = await resolveFieldValue(supabase, config.field || '', conversationId, variables, ctx.triggerData)
      const result = evaluateCondition(actualValue, config.operator || 'equals', config.value || '')
      return { output: { result, field: config.field, actual_value: actualValue }, handleId: result ? 'true' : 'false' }
    }

    case 'switch': {
      const actualValue = String(await resolveFieldValue(supabase, config.field || '', conversationId, variables, ctx.triggerData)).toLowerCase()
      const cases: Array<{ value: string; label: string }> = config.cases || []
      const matched = cases.find(c => String(c.value).toLowerCase() === actualValue)
      return {
        output: { matched_case: matched ? `case_${cases.indexOf(matched)}` : 'default', actual_value: actualValue },
        handleId: matched ? `case_${cases.indexOf(matched)}` : 'default',
      }
    }

    case 'delay': {
      const duration = config.duration || config.value || 5
      const unit = config.unit || 'seconds'
      const multipliers: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000 }
      const ms = Math.min(duration * (multipliers[unit] || 1000), MAX_DELAY_MS)
      await new Promise(resolve => setTimeout(resolve, ms))
      return { output: { delayed_ms: ms } }
    }

    case 'http_request': {
      const url = interpolate(config.url || '', variables)
      const method = config.method || 'POST'
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (Array.isArray(config.headers)) {
        for (const h of config.headers) {
          if (h.key) headers[h.key] = interpolate(h.value || '', variables)
        }
      }
      const response = await fetch(url, {
        method,
        headers,
        ...(method !== 'GET' && config.body ? { body: interpolate(config.body, variables) } : {}),
      })
      const responseText = await response.text()
      let responseData: any
      try { responseData = JSON.parse(responseText) } catch { responseData = responseText }
      return {
        output: { status: response.status, response: responseData },
        variables: { http_response: responseData, http_status: response.status },
      }
    }

    case 'add_tag': {
      if (!conversationId) return { output: { added: false } }
      const tags = config.tags || (config.tag ? [config.tag] : [])
      if (!tags.length) return { output: { added: false } }
      const { data: conv } = await supabase
        .from('ai_conversations').select('tags').eq('id', conversationId).single()
      const newTags = [...new Set([...(conv?.tags || []), ...tags])]
      await supabase.from('ai_conversations').update({ tags: newTags }).eq('id', conversationId)
      return { output: { added: true, tags: newTags } }
    }

    case 'remove_tag': {
      if (!conversationId || !config.tag) return { output: { removed: false } }
      const { data: conv } = await supabase
        .from('ai_conversations').select('tags').eq('id', conversationId).single()
      const filtered = (conv?.tags || []).filter((t: string) => t !== config.tag)
      await supabase.from('ai_conversations').update({ tags: filtered }).eq('id', conversationId)
      return { output: { removed: true } }
    }

    case 'set_variable':
      return {
        output: { variable_set: config.variable_name },
        variables: { [config.variable_name || 'unnamed']: interpolate(config.value || '', variables) },
      }

    case 'update_field': {
      if (!conversationId || !config.field) return { output: { updated: false } }
      const value = interpolate(config.value || '', variables)
      const table = config.entity === 'contact' ? 'customer_profiles' : 'ai_conversations'
      if (config.entity === 'contact') {
        const { data: conv } = await supabase
          .from('ai_conversations').select('customer_phone').eq('id', conversationId).single()
        if (conv?.customer_phone) {
          await supabase.from(table).update({ [config.field]: value }).eq('phone', conv.customer_phone)
        }
      } else {
        await supabase.from(table).update({ [config.field]: value }).eq('id', conversationId)
      }
      return { output: { updated: true, entity: config.entity, field: config.field } }
    }

    case 'jump_to_flow': {
      if (!config.flow_id) throw new Error('Target flow_id required')
      await finalizeExecution(supabase, ctx.executionId, 'completed')
      // Invocar recursivamente com jump_depth incrementado
      await supabase.functions.invoke('workflow-engine', {
        body: {
          flow_id: config.flow_id,
          conversation_id: conversationId,
          trigger_data: { ...ctx.triggerData, ...variables, jumped_from: ctx.executionId },
          jump_depth: ctx.jumpDepth + 1,
        },
      })
      return { output: { jumped: true, target_flow_id: config.flow_id }, jumpedToFlow: true }
    }

    case 'search_knowledge': {
      const query = interpolate(config.query || variables.message_content || '', variables)
      try {
        const { data, error } = await supabase.functions.invoke('rag-search', {
          body: { query, category: config.category || null, top_k: config.top_k || 3 },
        })
        if (error) throw error
        return {
          output: { results: data?.results || [] },
          variables: { rag_results: JSON.stringify(data?.results || []) },
        }
      } catch (e: any) {
        return { output: { results: [], error: e.message }, variables: { rag_results: '[]' } }
      }
    }

    case 'check_schedule': {
      const now = new Date()
      // Converter para horario de Brasilia
      const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const hour = brTime.getHours()
      const day = brTime.getDay() // 0=Sun
      const startHour = config.start_hour ?? 8
      const endHour = config.end_hour ?? 18
      const workDays = config.work_days ?? [1, 2, 3, 4, 5]
      const isBusinessHours = workDays.includes(day) && hour >= startHour && hour < endHour
      return {
        output: { is_business_hours: isBusinessHours, hour, day },
        handleId: isBusinessHours ? 'true' : 'false',
        variables: { is_business_hours: isBusinessHours },
      }
    }

    case 'send_internal_message': {
      if (!conversationId) return { output: { sent: false } }
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'system',
        content: interpolate(config.message || '', variables),
      })
      return { output: { sent: true } }
    }

    case 'move_to_stage': {
      if (!conversationId || !config.stage_id) return { output: { moved: false } }
      await supabase.from('ai_conversations')
        .update({ current_stage_id: config.stage_id })
        .eq('id', conversationId)
      return { output: { moved: true, stage_id: config.stage_id } }
    }

    case 'move_to_board': {
      if (!conversationId || !config.board_id) return { output: { moved: false } }
      const updateData: any = { kanban_board_id: config.board_id }
      if (config.stage_id) updateData.current_stage_id = config.stage_id
      await supabase.from('ai_conversations').update(updateData).eq('id', conversationId)
      return { output: { moved: true, board_id: config.board_id } }
    }

    case 'create_conversation': {
      const { data: newConv, error } = await supabase.from('ai_conversations').insert({
        customer_name: interpolate(config.customer_name || '', variables),
        customer_phone: interpolate(config.customer_phone || '', variables),
        communication_channel: config.channel || 'whatsapp',
        status: 'active',
      }).select().single()
      if (error) throw error
      return { output: { created: true, conversation_id: newConv.id }, variables: { new_conversation_id: newConv.id } }
    }

    case 'end':
      await finalizeExecution(supabase, ctx.executionId, 'completed')
      return { output: { flow_ended: true } }

    default:
      log('warn', 'unknown_node_type', { type: node.type })
      return { output: { unknown_type: node.type } }
  }
}

// ============================================================
// LEGACY AUTOMATION EXECUTOR
// ============================================================

async function executeLegacyAutomation(
  supabase: any,
  automation: any,
  triggerData: any,
): Promise<{ actionsExecuted: any[]; error: string | null }> {
  const actions = (automation.actions as any[]) || []
  const actionsExecuted: any[] = []
  let lastError: string | null = null

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    try {
      const result = await executeLegacyAction(action, triggerData, supabase)
      actionsExecuted.push({ index: i, type: action.type, status: 'success', result })
    } catch (error: any) {
      lastError = error.message
      actionsExecuted.push({ index: i, type: action.type, status: 'failed', error: error.message })
      break
    }
  }

  return { actionsExecuted, error: lastError }
}

async function executeLegacyAction(action: any, triggerData: any, supabase: any) {
  const { type, params } = action
  const p = replaceVarsInObject(params || {}, triggerData)

  switch (type) {
    case 'send_message': {
      if (!triggerData.conversation_id) return { skipped: true }
      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('uazapi_chat_id, customer_phone')
        .eq('id', triggerData.conversation_id)
        .single()
      if (!conv?.uazapi_chat_id) return { skipped: true }
      const { data: instances } = await supabase
        .from('uazapi_instances').select('*').eq('is_active', true).limit(1)
      if (!instances?.length) return { skipped: true }
      const inst = instances[0]
      const apiUrl = inst.api_url.replace(/\/$/, '')
      const body: any = { chatId: conv.uazapi_chat_id, message: p.message }
      if (p.buttons?.length) body.buttons = p.buttons
      const res = await fetch(`${apiUrl}/chat/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
        body: JSON.stringify(body),
      })
      return await res.json()
    }
    case 'assign_agent':
      if (!triggerData.conversation_id) return { skipped: true }
      await supabase.from('ai_conversations')
        .update({ current_agent_id: p.agent_id, handler_type: 'ai' })
        .eq('id', triggerData.conversation_id)
      return { assigned: p.agent_id }
    case 'escalate_to_human':
      if (!triggerData.conversation_id) return { skipped: true }
      await supabase.from('ai_conversations')
        .update({ handler_type: 'human' })
        .eq('id', triggerData.conversation_id)
      return { escalated: true }
    case 'ai_respond':
      return (await supabase.functions.invoke('agent-executor', {
        body: {
          conversation_id: triggerData.conversation_id,
          agent_id: p.agent_id,
          message_content: p.context || triggerData.message_content,
        },
      })).data
    case 'http_request': {
      const res = await fetch(p.url, {
        method: p.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(p.headers || {}) },
        body: p.body ? JSON.stringify(p.body) : undefined,
      })
      const text = await res.text()
      try { return JSON.parse(text) } catch { return { status: res.status, body: text.substring(0, 500) } }
    }
    case 'add_tag': {
      if (!triggerData.conversation_id) return { skipped: true }
      const { data: conv } = await supabase
        .from('ai_conversations').select('tags').eq('id', triggerData.conversation_id).single()
      const tags: string[] = conv?.tags || []
      if (!tags.includes(p.tag)) {
        await supabase.from('ai_conversations')
          .update({ tags: [...tags, p.tag] })
          .eq('id', triggerData.conversation_id)
      }
      return { added: p.tag }
    }
    case 'update_conversation':
      if (!triggerData.conversation_id) return { skipped: true }
      await supabase.from('ai_conversations')
        .update({ [p.field]: p.value })
        .eq('id', triggerData.conversation_id)
      return { updated: p.field }
    case 'search_knowledge':
      return (await supabase.functions.invoke('rag-search', {
        body: { query: p.query, top_k: p.top_k || 3 },
      })).data
    case 'wait': {
      const seconds = Math.min(p.duration_seconds || 0, 25)
      await new Promise(resolve => setTimeout(resolve, seconds * 1000))
      return { waited: seconds }
    }
    default:
      throw new Error(`Unknown action type: ${type}`)
  }
}

// ============================================================
// HELPERS
// ============================================================

function matchesTriggerConfig(flow: any, triggerType: string, data: any): boolean {
  const config = flow.trigger_config || {}

  // Filtro por instancia WhatsApp
  if (flow.whatsapp_instances?.length > 0) {
    if (!data?.instance_id || !flow.whatsapp_instances.includes(data.instance_id)) return false
  }

  // Filtro por keywords
  if (triggerType === 'message_received' && config.keywords) {
    const keywords = Array.isArray(config.keywords)
      ? config.keywords.map((k: string) => k.trim().toLowerCase())
      : String(config.keywords).split(',').map((k: string) => k.trim().toLowerCase())
    const content = (data?.message_content || '').toLowerCase()
    if (!keywords.some((kw: string) => content.includes(kw))) return false
  }

  // Filtro por status_changed
  if (triggerType === 'status_changed') {
    if (config.from_status && config.from_status !== data?.from_status) return false
    if (config.to_status && config.to_status !== data?.to_status) return false
  }

  // Filtro por stage_changed
  if (triggerType === 'stage_changed') {
    if (config.from_stage_id && config.from_stage_id !== data?.from_stage_id) return false
    if (config.to_stage_id && config.to_stage_id !== data?.to_stage_id) return false
  }

  // Filtro por agent_assigned
  if (triggerType === 'agent_assigned') {
    if (config.agent_type_filter && config.agent_type_filter !== data?.agent_type) return false
  }

  // Filtro por tag_added
  if (triggerType === 'tag_added') {
    if (config.tag && config.tag !== data?.tag) return false
  }

  // Filtro por priority_changed
  if (triggerType === 'priority_changed') {
    if (config.from_priority && config.from_priority !== data?.from_priority) return false
    if (config.to_priority && config.to_priority !== data?.to_priority) return false
  }

  // Filtro por csat_received
  if (triggerType === 'csat_received') {
    const score = data?.csat_score
    if (config.csat_min && score < config.csat_min) return false
    if (config.csat_max && score > config.csat_max) return false
  }

  return true
}

function matchesLegacyConditions(conditions: any, data: any): boolean {
  if (!conditions) return true

  // Suporta formato { logic: 'AND', conditions: [...] } e array direto
  let condList: any[] = []
  let logic: 'AND' | 'OR' = 'AND'

  if (Array.isArray(conditions)) {
    condList = conditions
  } else if (conditions.conditions) {
    condList = conditions.conditions
    logic = conditions.logic || 'AND'
  }

  if (condList.length === 0) return true

  const evaluator = (c: any) => {
    const val = data?.[c.field]
    switch (c.operator) {
      case 'equals': return String(val) === String(c.value)
      case 'not_equals': return String(val) !== String(c.value)
      case 'contains': return String(val || '').toLowerCase().includes(String(c.value).toLowerCase())
      case 'not_contains': return !String(val || '').toLowerCase().includes(String(c.value).toLowerCase())
      case 'greater_than': return Number(val) > Number(c.value)
      case 'less_than': return Number(val) < Number(c.value)
      case 'exists': return val !== undefined && val !== null
      case 'not_exists': return val === undefined || val === null
      case 'in_list': {
        const list = Array.isArray(c.value) ? c.value : String(c.value).split(',').map((s: string) => s.trim())
        return list.includes(String(val))
      }
      default: return true
    }
  }

  return logic === 'OR' ? condList.some(evaluator) : condList.every(evaluator)
}

async function resolveFieldValue(
  supabase: any,
  field: string,
  conversationId: string | null,
  variables: Record<string, any>,
  triggerData: any,
): Promise<any> {
  // Variaveis locais primeiro
  if (variables[field] !== undefined) return variables[field]
  if (triggerData?.[field] !== undefined) return triggerData[field]

  if (!conversationId) return ''

  // Campos especiais
  if (field === 'message_content') {
    const { data: msg } = await supabase
      .from('ai_messages').select('content')
      .eq('conversation_id', conversationId).eq('role', 'user')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    return msg?.content ?? ''
  }

  if (field === 'sentiment' || field === 'urgency') {
    const { data: msg } = await supabase
      .from('ai_messages').select(field)
      .eq('conversation_id', conversationId).eq('role', 'user')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    return msg?.[field] ?? ''
  }

  if (field === 'messages_count') {
    const { count } = await supabase
      .from('ai_messages').select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
    return count ?? 0
  }

  if (field === 'has_tag') {
    const { data: conv } = await supabase
      .from('ai_conversations').select('tags').eq('id', conversationId).maybeSingle()
    return (conv?.tags || [])
  }

  // Fallback: buscar campo na conversa
  const { data: conv } = await supabase
    .from('ai_conversations').select(field).eq('id', conversationId).maybeSingle()
  return conv?.[field] ?? ''
}

function evaluateCondition(actual: any, operator: string, target: string): boolean {
  const strActual = String(actual || '')
  switch (operator) {
    case 'equals': return strActual.toLowerCase() === target.toLowerCase()
    case 'not_equals': return strActual.toLowerCase() !== target.toLowerCase()
    case 'contains': return strActual.toLowerCase().includes(target.toLowerCase())
    case 'not_contains': return !strActual.toLowerCase().includes(target.toLowerCase())
    case 'greater_than': return Number(actual) > Number(target)
    case 'less_than': return Number(actual) < Number(target)
    case 'exists': return actual !== undefined && actual !== null && actual !== ''
    case 'not_exists': return actual === undefined || actual === null || actual === ''
    case 'in_list': {
      const list = target.split(',').map(s => s.trim().toLowerCase())
      return list.includes(strActual.toLowerCase())
    }
    default: return false
  }
}

function interpolate(text: string, variables: Record<string, any>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

function replaceVarsInObject(params: any, data: any): any {
  const json = JSON.stringify(params)
  const replaced = json.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match
  })
  return JSON.parse(replaced)
}

async function finalizeExecution(supabase: any, executionId: string, status: string, errorMessage?: string) {
  await supabase.from('flow_executions').update({
    status,
    error_message: errorMessage || null,
    completed_at: new Date().toISOString(),
  }).eq('id', executionId)
}

function log(level: string, step: string, data?: any) {
  console.log(JSON.stringify({ level, fn: 'workflow-engine', step, ...data }))
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
