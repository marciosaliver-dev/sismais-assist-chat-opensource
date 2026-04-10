/**
 * validate-flow-conflicts
 *
 * Valida um flow antes de ativá-lo, detectando:
 * 1. Dois flows com o mesmo trigger_type sem condição diferenciadora
 * 2. Flow com send_message sem nó 'end' (pode sobrepor com agente IA)
 * 3. Loop infinito via jump_to_flow
 * 4. Ações duplicadas no mesmo flow (ex: 2x assign_human)
 *
 * Entrada:
 *   { flow_id: string }
 *
 * Saída:
 *   { valid: boolean, warnings: ConflictWarning[], errors: ConflictError[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConflictWarning {
  code: string
  message: string
  severity: 'warning' | 'error'
  details?: Record<string, unknown>
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
    const { flow_id } = await req.json()
    if (!flow_id) {
      return new Response(JSON.stringify({ error: 'flow_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar o flow a ser validado
    const { data: flow, error: flowErr } = await supabase
      .from('flow_automations')
      .select('*')
      .eq('id', flow_id)
      .single()

    if (flowErr || !flow) {
      return new Response(JSON.stringify({ error: 'Flow not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar todos os outros flows ativos
    const { data: activeFlows } = await supabase
      .from('flow_automations')
      .select('id, name, trigger_type, trigger_config, nodes')
      .eq('is_active', true)
      .neq('id', flow_id)

    const nodes: any[] = flow.nodes || []
    const warnings: ConflictWarning[] = []

    // ── CONFLITO 1: Trigger duplicado sem condição diferenciadora ──────
    const duplicateTriggers = (activeFlows || []).filter(
      (f: any) => f.trigger_type === flow.trigger_type
    )
    if (duplicateTriggers.length > 0) {
      const flowHasCondition = flow.trigger_config?.keywords?.length > 0 ||
        flow.trigger_config?.from_status || flow.trigger_config?.to_status
      const conflictingNames = duplicateTriggers
        .filter((f: any) => {
          const hasCondition = f.trigger_config?.keywords?.length > 0 ||
            f.trigger_config?.from_status || f.trigger_config?.to_status
          return !flowHasCondition || !hasCondition
        })
        .map((f: any) => f.name)

      if (conflictingNames.length > 0) {
        warnings.push({
          code: 'DUPLICATE_TRIGGER',
          severity: 'warning',
          message: `Este flow usa o trigger "${flow.trigger_type}" — o(s) flow(s) já ativo(s) "${conflictingNames.join('", "')}" usam o mesmo trigger sem condições diferentes. Ambos podem disparar para a mesma conversa, gerando respostas duplicadas.`,
          details: { conflicting_flows: conflictingNames },
        })
      }
    }

    // ── CONFLITO 2: send_message sem nó 'end' claro ────────────────────
    const hasSendMessage = nodes.some(
      (n: any) => n.type === 'send_message' || n.type === 'ai_response'
    )
    const hasEndNode = nodes.some((n: any) => n.type === 'end')
    if (hasSendMessage && !hasEndNode && flow.trigger_type === 'message_received') {
      warnings.push({
        code: 'MISSING_END_NODE',
        severity: 'warning',
        message: 'Este flow envia mensagens mas não tem um nó "Fim" explícito. O agente IA pode responder adicionalmente após o flow, enviando 2 mensagens ao cliente. Adicione um nó "Fim" ao final do flow.',
      })
    }

    // ── CONFLITO 3: Loop infinito via jump_to_flow ─────────────────────
    const jumpNodes = nodes.filter((n: any) => n.type === 'jump_to_flow')
    for (const jNode of jumpNodes) {
      const targetFlowId = jNode.data?.config?.flow_id
      if (!targetFlowId) {
        warnings.push({
          code: 'JUMP_NO_TARGET',
          severity: 'error',
          message: `Nó "jump_to_flow" sem flow de destino configurado. O flow vai falhar ao executar este nó.`,
        })
        continue
      }
      // Auto-referência direta (flow saltando para si mesmo)
      if (targetFlowId === flow_id) {
        warnings.push({
          code: 'JUMP_SELF_REFERENCE',
          severity: 'error',
          message: 'Nó "jump_to_flow" aponta para o próprio flow — criaria um loop infinito. O sistema tem um limite de 5 saltos mas o comportamento é imprevisível.',
          details: { target_flow_id: targetFlowId },
        })
      }
    }

    // ── CONFLITO 4: Ações duplicadas ───────────────────────────────────
    const assignHumanCount = nodes.filter((n: any) => n.type === 'assign_human').length
    if (assignHumanCount > 1) {
      warnings.push({
        code: 'DUPLICATE_ASSIGN_HUMAN',
        severity: 'warning',
        message: `O flow tem ${assignHumanCount} nós "assign_human". Apenas o primeiro terá efeito — os demais são redundantes.`,
      })
    }

    const errors = warnings.filter(w => w.severity === 'error')
    const valid = errors.length === 0

    console.log(JSON.stringify({
      level: 'info', fn: 'validate-flow-conflicts',
      flow_id, valid, warnings: warnings.length, errors: errors.length
    }))

    return new Response(JSON.stringify({ valid, warnings, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'validate-flow-conflicts', error: msg }))
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
