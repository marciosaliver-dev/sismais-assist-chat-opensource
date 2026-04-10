import { useState, useCallback, useRef } from 'react'

export interface SimulationStep {
  id: string
  name: string
  type: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  duration_ms: number
  input: Record<string, any>
  output: Record<string, any> | null
  error?: string
}

export interface SimulationConfig {
  trigger_type: string
  customer: { name: string; phone: string; email: string }
  message: string
  sentiment: string
  urgency: string
  custom_variables: Record<string, string>
}

interface SimulationMetrics {
  total: number
  success: number
  error: number
  skipped: number
  total_time_ms: number
}

interface ResolvedVariable {
  key: string
  value: string
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const randomDelay = () => 300 + Math.random() * 500

function replaceVariables(text: string, vars: Record<string, string>): string {
  if (!text || typeof text !== 'string') return text || ''
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    text
  )
}

function buildBuiltinVars(config: SimulationConfig): Record<string, string> {
  return {
    customer_name: config.customer.name,
    customer_phone: config.customer.phone,
    customer_email: config.customer.email,
    message_content: config.message,
    sentiment: config.sentiment,
    urgency: config.urgency,
    timestamp: new Date().toISOString(),
    ...config.custom_variables,
  }
}

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Enviar Mensagem',
  wait: 'Aguardar',
  add_tag: 'Adicionar Tag',
  assign_agent: 'Atribuir Agente',
  http_request: 'Requisição HTTP',
  escalate_to_human: 'Escalar p/ Humano',
  ai_respond: 'Resposta IA',
  search_knowledge: 'Buscar Conhecimento',
}

const NODE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  send_message: 'Enviar Mensagem',
  condition: 'Condição',
  switch: 'Switch',
  delay: 'Aguardar',
  end: 'Fim',
  ai_response: 'Resposta IA',
  assign_human: 'Atribuir Humano',
  assign_ai: 'Atribuir IA',
  add_tag: 'Adicionar Tag',
  set_variable: 'Definir Variável',
  update_field: 'Atualizar Campo',
  http_request: 'Requisição HTTP',
  search_knowledge: 'Buscar Conhecimento',
  jump_to_flow: 'Ir para Fluxo',
}

export function useAutomationPlayground() {
  const [steps, setSteps] = useState<SimulationStep[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [metrics, setMetrics] = useState<SimulationMetrics>({ total: 0, success: 0, error: 0, skipped: 0, total_time_ms: 0 })
  const [resolvedVars, setResolvedVars] = useState<ResolvedVariable[]>([])
  const cancelRef = useRef(false)

  const addStep = (step: SimulationStep) => {
    setSteps(prev => [...prev, step])
  }

  const updateStep = (id: string, updates: Partial<SimulationStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const resetSimulation = useCallback(() => {
    cancelRef.current = true
    setSteps([])
    setIsRunning(false)
    setMetrics({ total: 0, success: 0, error: 0, skipped: 0, total_time_ms: 0 })
    setResolvedVars([])
  }, [])

  const simulateNoCode = useCallback(async (automation: any, config: SimulationConfig) => {
    cancelRef.current = false
    setSteps([])
    setIsRunning(true)
    setResolvedVars([])

    const vars = buildBuiltinVars(config)
    const allSteps: SimulationStep[] = []
    const startTime = Date.now()

    // Step 1: Trigger
    const triggerId = 'step-trigger'
    const triggerStep: SimulationStep = {
      id: triggerId, name: 'Verificar Trigger', type: 'trigger', status: 'running',
      duration_ms: 0, input: { configured: config.trigger_type, expected: automation.trigger_type }, output: null
    }
    addStep(triggerStep)
    await delay(randomDelay())
    if (cancelRef.current) return

    const triggerMatch = config.trigger_type === automation.trigger_type
    updateStep(triggerId, {
      status: 'success',
      duration_ms: Math.round(randomDelay()),
      output: triggerMatch
        ? { result: 'Trigger compatível' }
        : { result: 'Trigger diferente do configurado — simulação continua mesmo assim', warning: true }
    })
    allSteps.push({ ...triggerStep, status: 'success' })

    // Step 2: Conditions
    const conditions = (automation.trigger_conditions as any[]) || []
    for (let i = 0; i < conditions.length; i++) {
      if (cancelRef.current) return
      const cond = conditions[i]
      const condId = `step-cond-${i}`
      const condStep: SimulationStep = {
        id: condId, name: `Condição: ${cond.field || cond.type || 'Regra ' + (i + 1)}`,
        type: 'condition', status: 'running', duration_ms: 0,
        input: { condition: cond, context: { sentiment: config.sentiment, urgency: config.urgency } },
        output: null
      }
      addStep(condStep)
      await delay(randomDelay())
      if (cancelRef.current) return
      updateStep(condId, { status: 'success', duration_ms: Math.round(randomDelay()), output: { result: 'Condição avaliada como verdadeira (simulado)' } })
      allSteps.push({ ...condStep, status: 'success' })
    }

    // Step 3: Actions
    const actions = (automation.actions as any[]) || []
    for (let i = 0; i < actions.length; i++) {
      if (cancelRef.current) return
      const action = actions[i]
      const actionId = `step-action-${i}`
      const label = ACTION_LABELS[action.type] || action.type
      const actionStep: SimulationStep = {
        id: actionId, name: label, type: action.type, status: 'running',
        duration_ms: 0, input: { ...action }, output: null
      }
      addStep(actionStep)
      await delay(randomDelay())
      if (cancelRef.current) return

      let output: Record<string, any> = {}
      switch (action.type) {
        case 'send_message':
          output = { message: replaceVariables(action.message || action.content || '', vars) }
          break
        case 'wait':
          output = { simulated: `Aguardaria ${action.seconds || action.duration || '?'} segundos (não esperou)` }
          break
        case 'add_tag':
          output = { tag: action.tag || action.value || 'N/A' }
          break
        case 'assign_agent':
          output = { agent: action.agent_id || action.agent || 'Auto' }
          break
        case 'http_request':
          output = { method: action.method || 'GET', url: action.url || 'N/A', simulated: true }
          break
        case 'escalate_to_human':
          output = { reason: action.reason || 'Escalonamento solicitado' }
          break
        case 'ai_respond':
          output = { simulated: 'IA geraria uma resposta baseada no contexto' }
          break
        case 'search_knowledge':
          output = { query: replaceVariables(action.query || config.message, vars) }
          break
        default:
          output = { simulated: true, type: action.type }
      }
      updateStep(actionId, { status: 'success', duration_ms: Math.round(randomDelay()), output })
      allSteps.push({ ...actionStep, status: 'success' })
    }

    // Final step
    if (!cancelRef.current) {
      const finalId = 'step-final'
      addStep({ id: finalId, name: 'Conclusão', type: 'conclusion', status: 'running', duration_ms: 0, input: {}, output: null })
      await delay(300)
      updateStep(finalId, {
        status: 'success', duration_ms: 0,
        output: { total_steps: allSteps.length + 1, result: 'Simulação concluída com sucesso' }
      })
    }

    const totalTime = Date.now() - startTime
    const successCount = allSteps.length + 1
    setMetrics({ total: successCount, success: successCount, error: 0, skipped: 0, total_time_ms: totalTime })
    setResolvedVars(Object.entries(vars).map(([key, value]) => ({ key, value })))
    setIsRunning(false)
  }, [])

  const simulateFlow = useCallback(async (flow: any, config: SimulationConfig) => {
    cancelRef.current = false
    setSteps([])
    setIsRunning(true)
    setResolvedVars([])

    const vars = buildBuiltinVars(config)
    const nodes: any[] = (flow.nodes as any[]) || []
    const edges: any[] = (flow.edges as any[]) || []
    const startTime = Date.now()
    let successCount = 0
    const errorCount = 0

    // Find trigger node
    const triggerNode = nodes.find((n: any) => n.type === 'trigger')
    if (!triggerNode) {
      const errId = 'step-err'
      addStep({ id: errId, name: 'Erro', type: 'error', status: 'error', duration_ms: 0, input: {}, output: null, error: 'Nenhum nó de trigger encontrado no fluxo' })
      setMetrics({ total: 1, success: 0, error: 1, skipped: 0, total_time_ms: Date.now() - startTime })
      setIsRunning(false)
      return
    }

    const visited = new Set<string>()
    const queue = [triggerNode]

    while (queue.length > 0 && !cancelRef.current) {
      const node = queue.shift()!
      if (visited.has(node.id)) continue
      visited.add(node.id)

      const nodeType = node.type || 'unknown'
      const label = NODE_LABELS[nodeType] || nodeType
      const nodeName = node.data?.label || node.data?.name || label
      const stepId = `step-node-${node.id}`

      const step: SimulationStep = {
        id: stepId, name: nodeName, type: nodeType, status: 'running',
        duration_ms: 0, input: { nodeId: node.id, config: node.data || {} }, output: null
      }
      addStep(step)
      await delay(randomDelay())
      if (cancelRef.current) return

      let output: Record<string, any> = {}
      if (nodeType === 'trigger') {
        output = { trigger_type: flow.trigger_type, simulated: true }
      } else if (nodeType === 'send_message') {
        output = { message: replaceVariables(node.data?.message || node.data?.content || '', vars) }
      } else if (nodeType === 'condition') {
        output = { evaluated: 'true (simulado)', field: node.data?.field || 'N/A' }
      } else if (nodeType === 'delay') {
        output = { simulated: `Aguardaria ${node.data?.seconds || node.data?.duration || '?'}s` }
      } else if (nodeType === 'end') {
        output = { result: 'Fluxo finalizado' }
      } else if (nodeType === 'ai_response') {
        output = { simulated: 'IA geraria resposta' }
      } else if (nodeType === 'http_request') {
        output = { method: node.data?.method || 'GET', url: node.data?.url || 'N/A', simulated: true }
      } else if (nodeType === 'set_variable') {
        output = { variable: node.data?.variable || 'N/A', value: replaceVariables(node.data?.value || '', vars) }
      } else if (nodeType === 'add_tag') {
        output = { tag: node.data?.tag || 'N/A' }
      } else {
        output = { simulated: true, type: nodeType }
      }

      updateStep(stepId, { status: 'success', duration_ms: Math.round(randomDelay()), output })
      successCount++

      if (nodeType === 'end') break

      // Follow edges
      const outEdges = edges.filter((e: any) => e.source === node.id)
      for (const edge of outEdges) {
        const target = nodes.find((n: any) => n.id === edge.target)
        if (target && !visited.has(target.id)) queue.push(target)
      }
    }

    const totalTime = Date.now() - startTime
    setMetrics({ total: successCount, success: successCount, error: errorCount, skipped: 0, total_time_ms: totalTime })
    setResolvedVars(Object.entries(vars).map(([key, value]) => ({ key, value })))
    setIsRunning(false)
  }, [])

  return {
    steps,
    isRunning,
    metrics,
    resolvedVars,
    simulateNoCode,
    simulateFlow,
    resetSimulation,
  }
}
