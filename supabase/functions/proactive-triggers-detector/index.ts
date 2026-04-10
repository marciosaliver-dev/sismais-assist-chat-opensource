/**
 * proactive-triggers-detector — Onda 6F (dry-run mode)
 *
 * Lê triggers ativos em `ai_proactive_triggers` e, para cada tipo,
 * executa a query de detecção específica. Registra cada "match" em
 * `ai_proactive_trigger_fires` com status='dry_run'.
 *
 * NÃO EXECUTA as ações reais (escalate, send_message, schedule_callback)
 * — apenas detecta e loga. Isso dá visibilidade total do que aconteceria
 * se o sistema fosse 100% autônomo, sem riscos ao pipeline.
 *
 * Trigger types suportados:
 *   - ticket_stale        (conditions.days_stale, default 7)
 *   - client_inactivity   (conditions.hours_inactive, default 24)
 *   - sla_warning         (conditions.percent_consumed, default 80)
 *   - churn_risk          (conditions.min_score, default 70) — placeholder
 *
 * Invocação:
 *   curl -X POST .../proactive-triggers-detector -d '{}'
 *
 * Pode ser agendado via pg_cron (ex: 1x/hora). Runtime < 5s esperado.
 *
 * Response:
 *   {
 *     ok: true,
 *     triggers_checked: number,
 *     total_fires: number,
 *     by_trigger: [{ name, type, matched, samples }]
 *   }
 *
 * Não-objetivos:
 *   - NÃO envia mensagens WhatsApp (não toca UAZAPI)
 *   - NÃO modifica conversas, agentes ou tickets
 *   - NÃO cria callbacks reais
 *   - NÃO escalona para humano
 *
 * Ativação futura: adicionar mode='execute' via request body quando
 * admin validar que os disparos detectados são corretos.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

interface ProactiveTrigger {
  id: string
  name: string
  trigger_type: string
  action_type: string
  conditions: Record<string, any>
  action_config: Record<string, any>
  priority: number
  is_active: boolean | null
}

interface DetectionResult {
  trigger_id: string
  trigger_name: string
  trigger_type: string
  action_type: string
  matches: Array<Record<string, any>>
}

const MAX_SAMPLES_PER_FIRE = 50 // cap pra evitar blowup em produção

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Carrega todos os triggers ativos, ordenados por prioridade (desc = mais urgente primeiro)
    const { data: triggers, error: triggersErr } = await supabase
      .from('ai_proactive_triggers')
      .select('id, name, trigger_type, action_type, conditions, action_config, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (triggersErr) {
      console.error('[proactive-triggers-detector] Failed to load triggers:', triggersErr)
      return jsonResponse({ ok: false, error: triggersErr.message }, 500)
    }

    const activeTriggers = (triggers ?? []) as ProactiveTrigger[]

    if (activeTriggers.length === 0) {
      return jsonResponse({ ok: true, triggers_checked: 0, total_fires: 0, by_trigger: [] })
    }

    // 2. Para cada trigger, rodar a detecção específica do tipo
    const results: DetectionResult[] = []
    for (const trigger of activeTriggers) {
      try {
        const matches = await detectMatches(supabase, trigger)
        results.push({
          trigger_id: trigger.id,
          trigger_name: trigger.name,
          trigger_type: trigger.trigger_type,
          action_type: trigger.action_type,
          matches: matches.slice(0, MAX_SAMPLES_PER_FIRE),
        })
      } catch (e) {
        console.warn(
          `[proactive-triggers-detector] Detection failed for "${trigger.name}":`,
          e instanceof Error ? e.message : String(e)
        )
        results.push({
          trigger_id: trigger.id,
          trigger_name: trigger.name,
          trigger_type: trigger.trigger_type,
          action_type: trigger.action_type,
          matches: [],
        })
      }
    }

    // 3. Gravar cada match como uma linha em ai_proactive_trigger_fires (dry_run)
    const fireRows: Array<Record<string, any>> = []
    for (const result of results) {
      for (const match of result.matches) {
        fireRows.push({
          trigger_id: result.trigger_id,
          trigger_name: result.trigger_name,
          trigger_type: result.trigger_type,
          action_type: result.action_type,
          context: match,
          would_execute: buildWouldExecute(result, match),
          status: 'dry_run',
          message: 'Dry-run: no action performed',
        })
      }
    }

    if (fireRows.length > 0) {
      const { error: insertErr } = await supabase
        .from('ai_proactive_trigger_fires')
        .insert(fireRows)
      if (insertErr) {
        console.warn('[proactive-triggers-detector] Failed to persist fires:', insertErr)
        // Não falha a função — ainda retorna o detectado para o caller
      }
    }

    const totalFires = fireRows.length
    const summary = results.map((r) => ({
      name: r.trigger_name,
      type: r.trigger_type,
      matched: r.matches.length,
      samples: r.matches.slice(0, 3), // só 3 amostras na resposta pra não vazar PII
    }))

    return jsonResponse({
      ok: true,
      triggers_checked: activeTriggers.length,
      total_fires: totalFires,
      by_trigger: summary,
    })
  } catch (e) {
    console.error('[proactive-triggers-detector] Fatal error:', e)
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})

// ============================================================================
// Detection logic per trigger_type
// ============================================================================
async function detectMatches(
  supabase: any,
  trigger: ProactiveTrigger
): Promise<Array<Record<string, any>>> {
  switch (trigger.trigger_type) {
    case 'ticket_stale':
      return detectTicketStale(supabase, trigger)
    case 'client_inactivity':
      return detectClientInactivity(supabase, trigger)
    case 'sla_warning':
      return detectSlaWarning(supabase, trigger)
    case 'churn_risk':
      return detectChurnRisk(supabase, trigger)
    default:
      console.warn(`[proactive-triggers-detector] Unknown trigger_type: ${trigger.trigger_type}`)
      return []
  }
}

/**
 * ticket_stale: conversas abertas sem atualização há N dias
 * conditions.days_stale (default 7)
 */
async function detectTicketStale(supabase: any, trigger: ProactiveTrigger) {
  const days = Number(trigger.conditions?.days_stale ?? 7)
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, customer_name, customer_phone, status, last_customer_message_at, started_at')
    .in('status', ['open', 'waiting', 'in_progress'])
    .lt('last_customer_message_at', threshold)
    .limit(MAX_SAMPLES_PER_FIRE)

  if (error) throw error
  return (data ?? []).map((conv: any) => ({
    conversation_id: conv.id,
    customer_name: conv.customer_name,
    customer_phone: conv.customer_phone,
    status: conv.status,
    stale_since: conv.last_customer_message_at,
    days_stale: days,
  }))
}

/**
 * client_inactivity: clientes sem mensagem nas últimas N horas
 * conditions.hours_inactive (default 24)
 */
async function detectClientInactivity(supabase: any, trigger: ProactiveTrigger) {
  const hours = Number(trigger.conditions?.hours_inactive ?? 24)
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, customer_name, customer_phone, status, last_customer_message_at')
    .in('status', ['open', 'waiting'])
    .lt('last_customer_message_at', threshold)
    .limit(MAX_SAMPLES_PER_FIRE)

  if (error) throw error
  return (data ?? []).map((conv: any) => ({
    conversation_id: conv.id,
    customer_name: conv.customer_name,
    customer_phone: conv.customer_phone,
    status: conv.status,
    inactive_since: conv.last_customer_message_at,
    hours_inactive: hours,
  }))
}

/**
 * sla_warning: conversas cujo SLA está perto de estourar
 * conditions.percent_consumed (default 80)
 *
 * Nota: como não sabemos exatamente como SLA está modelado neste banco
 * (pode ser em platform_ai_config, sla_config, ou hardcoded), esta
 * implementação é uma aproximação conservadora baseada em idade da
 * conversa vs um SLA fixo de 4h. Admin pode refinar via conditions.sla_hours.
 */
async function detectSlaWarning(supabase: any, trigger: ProactiveTrigger) {
  const percentConsumed = Number(trigger.conditions?.percent_consumed ?? 80)
  const slaHours = Number(trigger.conditions?.sla_hours ?? 4)
  const thresholdMinutes = (slaHours * 60 * percentConsumed) / 100

  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, customer_name, customer_phone, status, started_at, first_human_response_at')
    .in('status', ['open', 'waiting'])
    .lt('started_at', threshold)
    .is('first_human_response_at', null)
    .limit(MAX_SAMPLES_PER_FIRE)

  if (error) throw error
  return (data ?? []).map((conv: any) => ({
    conversation_id: conv.id,
    customer_name: conv.customer_name,
    customer_phone: conv.customer_phone,
    status: conv.status,
    started_at: conv.started_at,
    sla_hours: slaHours,
    percent_consumed: percentConsumed,
  }))
}

/**
 * churn_risk: placeholder — em produção, dependeria de ai_health_scores
 * ou de um ML model. Por ora, detecta clientes com múltiplas conversas
 * recentes encerradas com CSAT baixo (<3).
 */
async function detectChurnRisk(supabase: any, trigger: ProactiveTrigger) {
  const minNegativeRatings = Number(trigger.conditions?.min_negative_ratings ?? 2)
  const lookbackDays = Number(trigger.conditions?.lookback_days ?? 30)

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  // Busca clientes (pelo phone) com múltiplas conversas de CSAT baixo
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('customer_phone, customer_name, csat_rating, rated_at')
    .lte('csat_rating', 3)
    .gte('rated_at', since)
    .not('customer_phone', 'is', null)
    .limit(500) // fetch amplo, agrega em memória abaixo

  if (error) throw error

  // Agrupar por customer_phone
  const byPhone: Record<string, { name: string; ratings: number[]; phone: string }> = {}
  for (const row of (data as any[]) ?? []) {
    const phone = row.customer_phone
    if (!phone) continue
    if (!byPhone[phone]) {
      byPhone[phone] = { name: row.customer_name || '', phone, ratings: [] }
    }
    byPhone[phone].ratings.push(Number(row.csat_rating))
  }

  return Object.values(byPhone)
    .filter((c) => c.ratings.length >= minNegativeRatings)
    .slice(0, MAX_SAMPLES_PER_FIRE)
    .map((c) => ({
      customer_phone: c.phone,
      customer_name: c.name,
      negative_ratings_count: c.ratings.length,
      avg_rating: c.ratings.reduce((a, b) => a + b, 0) / c.ratings.length,
      lookback_days: lookbackDays,
    }))
}

// ============================================================================
// Would-execute preview — descreve o que seria feito sem fazer
// ============================================================================
function buildWouldExecute(
  result: DetectionResult,
  match: Record<string, any>
): Record<string, any> {
  return {
    action_type: result.action_type,
    target: match.conversation_id
      ? { type: 'conversation', id: match.conversation_id }
      : match.customer_phone
      ? { type: 'customer', phone: match.customer_phone }
      : { type: 'unknown' },
    note: `dry-run: acao "${result.action_type}" NAO foi executada`,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
