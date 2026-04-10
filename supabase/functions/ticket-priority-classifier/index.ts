import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Keyword scoring tables
const CRITICAL_KEYWORDS = [
  'sistema parado', 'sistema fora do ar', 'sistema caiu', 'sistema travado',
  'nf-e parada', 'nf-e bloqueada', 'nota fiscal bloqueada', 'nota fiscal parada',
  'nfc-e parada', 'nfc-e bloqueada', 'não consigo emitir nota',
  'perda de dados', 'dados perdidos', 'sumiu os dados', 'banco corrompido',
  'perdemos os dados', 'faturamento parado', 'impedindo faturamento',
]

const HIGH_KEYWORDS = [
  'erro', 'falha', 'não funciona', 'não está funcionando', 'não abre',
  'impedindo', 'bloqueado', 'bloqueando', 'urgente', 'urgência',
  'parou de funcionar', 'deu erro', 'aparece erro', 'mensagem de erro',
  'impede', 'está impedindo', 'operação parada', 'preciso urgente',
]

const MEDIUM_KEYWORDS = [
  'lento', 'demora', 'demora muito', 'lentidão', 'travando', 'trava',
  'dúvida', 'como fazer', 'como funciona', 'como configurar',
  'não aparece', 'não encontro', 'não sei como',
]

function scoreKeywords(text: string): { score: number; matched: string[] } {
  const lower = text.toLowerCase()
  let score = 0
  const matched: string[] = []

  for (const kw of CRITICAL_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 40
      matched.push(kw)
    }
  }
  for (const kw of HIGH_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 20
      matched.push(kw)
    }
  }
  for (const kw of MEDIUM_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 5
      matched.push(kw)
    }
  }

  return { score, matched }
}

function scoreToPriority(score: number): string {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

type Condition = {
  field: string
  operator: string
  value: string | number
}

type PriorityRule = {
  id: string
  priority: string
  conditions: Condition[]
  logic: string
}

function evalCondition(cond: Condition, context: Record<string, any>): boolean {
  const { field, operator, value } = cond

  if (field === 'keyword') {
    const text = (context.message_content || '').toLowerCase()
    return operator === 'contains' ? text.includes(String(value).toLowerCase()) : false
  }

  if (field === 'customer_tier') {
    return operator === 'equals' ? context.customer_tier === value : false
  }

  if (field === 'time_without_response') {
    const mins = context.minutes_without_response || 0
    if (operator === 'greater_than') return mins > Number(value)
    if (operator === 'less_than') return mins < Number(value)
    return false
  }

  if (field === 'ticket_count') {
    const count = context.recent_ticket_count || 0
    if (operator === 'greater_than') return count > Number(value)
    if (operator === 'less_than') return count < Number(value)
    if (operator === 'equals') return count === Number(value)
    return false
  }

  return false
}

function evalRule(rule: PriorityRule, context: Record<string, any>): boolean {
  const results = rule.conditions.map(c => evalCondition(c, context))
  if (rule.logic === 'AND') return results.every(Boolean)
  return results.some(Boolean)
}

const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 100,
  high: 70,
  medium: 50,
  low: 20,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const body = await req.json().catch(() => ({}))
    const { conversation_id, message_content, force_reclassify } = body

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'conversation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[ticket-priority-classifier] Classifying conversation ${conversation_id}`)

    // 1. Fetch conversation data
    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('id, priority, priority_source, customer_phone, started_at, helpdesk_client_id, queue_entered_at, first_human_response_at')
      .eq('id', conversation_id)
      .maybeSingle()

    if (convErr || !conv) {
      console.warn(`[ticket-priority-classifier] Conversation ${conversation_id} not found, skipping`)
      return new Response(
        JSON.stringify({ success: true, data: { priority: 'low', priority_source: 'default', skipped: true, reason: 'conversation_not_found' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Skip if already classified and not force_reclassify
    if (!force_reclassify && conv.priority && conv.priority_source && conv.priority_source !== 'manual') {
      return new Response(
        JSON.stringify({ success: true, data: { priority: conv.priority, priority_source: conv.priority_source, skipped: true } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch client data (if linked)
    let clientData: any = null
    if (conv.helpdesk_client_id) {
      const { data: client } = await supabase
        .from('helpdesk_clients')
        .select('churn_risk, customer_tier, activation_date, plan_level')
        .eq('id', conv.helpdesk_client_id)
        .maybeSingle()
      clientData = client
    }

    // 3. Fetch recent ticket count (same phone, last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: recentTicketCount } = await supabase
      .from('ai_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_phone', conv.customer_phone)
      .gte('started_at', sevenDaysAgo)

    // 4. Compute minutes without response
    const startedAt = new Date(conv.started_at || Date.now())
    const minutesWithoutResponse = Math.floor((Date.now() - startedAt.getTime()) / 60000)

    // 5. Build context for rule evaluation
    const evalContext = {
      message_content: message_content || '',
      customer_tier: (clientData as any)?.customer_tier || 'starter',
      recent_ticket_count: recentTicketCount || 0,
      minutes_without_response: minutesWithoutResponse,
    }

    // 6. Keyword scoring
    const keywordResult = scoreKeywords(message_content || '')
    let totalScore = keywordResult.score
    const factors: string[] = []

    if (keywordResult.matched.length > 0) {
      factors.push(`keywords: ${keywordResult.matched.slice(0, 3).join(', ')}`)
    }

    // 7. Parameter scoring
    if ((clientData as any)?.churn_risk === true) {
      totalScore += 30
      factors.push('churn_risk=true (+30)')
    }

    const tier = (clientData as any)?.customer_tier || 'starter'
    if (tier === 'enterprise') {
      totalScore += 20
      factors.push('enterprise_tier (+20)')
    } else if (tier === 'business') {
      totalScore += 10
      factors.push('business_tier (+10)')
    }

    if ((clientData as any)?.activation_date) {
      const activationDate = new Date((clientData as any).activation_date)
      const daysSinceActivation = Math.floor((Date.now() - activationDate.getTime()) / (24 * 60 * 60 * 1000))
      if (daysSinceActivation < 30) {
        totalScore += 20
        factors.push(`onboarding_period ${daysSinceActivation}d (+20)`)
      }
    }

    if ((recentTicketCount || 0) >= 3) {
      totalScore += 25
      factors.push(`recurrence ${recentTicketCount} tickets/7d (+25)`)
    }

    // 8. Evaluate configured rules from DB
    const { data: rules } = await supabase
      .from('priority_rules')
      .select('id, priority, conditions, logic')
      .eq('active', true)
      .order('sort_order')

    let ruleMatchedPriority: string | null = null
    let matchedRuleId: string | null = null

    for (const rule of (rules || []) as PriorityRule[]) {
      if (evalRule(rule, evalContext)) {
        const ruleWeight = PRIORITY_WEIGHTS[rule.priority] || 0
        if (ruleWeight > totalScore) {
          totalScore = ruleWeight
          ruleMatchedPriority = rule.priority
          matchedRuleId = rule.id
          factors.push(`rule: "${(rule as any).name}" → ${rule.priority}`)
        }
      }
    }

    // 9. Final priority
    const prioritySource = ruleMatchedPriority ? 'rule' : (totalScore > 0 ? 'params' : 'manual')
    const finalPriority = ruleMatchedPriority || scoreToPriority(totalScore)

    console.log(`[ticket-priority-classifier] Score: ${totalScore}, Priority: ${finalPriority}, Source: ${prioritySource}`)

    // 10. Update ai_conversations
    await supabase
      .from('ai_conversations')
      .update({
        priority: finalPriority,
        priority_score: Math.min(100, totalScore),
        priority_source: prioritySource,
      })
      .eq('id', conversation_id)

    // 11. Insert ticket_ai_logs (fire-and-forget style but we await it here since this is the main job)
    await supabase.from('ticket_ai_logs').insert({
      ticket_id: conversation_id,
      evento_tipo: 'classificacao',
      resposta_recebida: JSON.stringify({ priority: finalPriority, score: totalScore, factors }),
      tokens_input: 0,
      tokens_output: 0,
      confianca: Math.min(1.0, totalScore / 100),
      metadata: {
        priority_source: prioritySource,
        factors,
        recent_ticket_count: recentTicketCount,
        customer_tier: tier,
        churn_risk: (clientData as any)?.churn_risk || false,
      },
    }).then(() => {}, () => {})

    // 12. Insert ticket_priority_log
    await supabase.from('ticket_priority_log').insert({
      ticket_id: conversation_id,
      priority_before: conv.priority || null,
      priority_after: finalPriority,
      classification_source: prioritySource,
      ai_confidence: Math.min(1.0, totalScore / 100),
      ai_reasoning: factors.join('; '),
      rule_id: matchedRuleId || null,
    }).then(() => {}, () => {})

    const durationMs = Date.now() - startTime

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          priority: finalPriority,
          priority_score: Math.min(100, totalScore),
          priority_source: prioritySource,
          factors,
        },
        meta: { duration_ms: durationMs },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[ticket-priority-classifier] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err), meta: { duration_ms: durationMs } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
