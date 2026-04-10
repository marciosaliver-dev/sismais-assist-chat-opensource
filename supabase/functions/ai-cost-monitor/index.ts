/**
 * ai-cost-monitor — Daily AI cost spike detector (Onda 6A)
 *
 * Compares today's LLM cost vs 7-day baseline (excluding today) and fires
 * a Discord alert if cost jumps more than SPIKE_THRESHOLD (default 50%).
 *
 * Trigger: pg_cron invokes this once per day (recommended 09:00 BRT).
 * Manual trigger: `curl -X POST .../ai-cost-monitor -d '{}'`
 *
 * Reads from: ai_cost_daily_summary (materialized view created in migration
 *             20260409_ai_cost_daily_summary.sql)
 *
 * Sends to:   DISCORD_WEBHOOK_ALERTS env var (falls back to
 *             DISCORD_WEBHOOK_ERRORS if not set)
 *
 * Response shape:
 *   { ok: true, spike_detected: bool, today_usd: number, baseline_usd: number,
 *     delta_pct: number, top_spenders: [{agent_id, cost_usd}] }
 *
 * Non-goals:
 *   - Does NOT block traffic, cancel calls or modify agents
 *   - Does NOT store alert history (fire-and-forget Discord notification)
 *   - Does NOT handle per-agent budgets (that's Onda 6B+)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

const SPIKE_THRESHOLD_PCT = Number(Deno.env.get('COST_SPIKE_THRESHOLD_PCT') ?? '50')
const MIN_BASELINE_USD = 0.10 // don't alert if baseline is near zero (avoid division noise)

interface CostRow {
  day: string
  cost_usd: number
  calls: number
}

interface TopSpender {
  agent_id: string | null
  edge_function: string
  cost_usd: number
  calls: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Read today's cost + 7-day baseline from the materialized view
    const { data: costRows, error: costErr } = await supabase
      .from('ai_cost_daily_summary')
      .select('day, cost_usd, calls')
      .gte('day', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('day', { ascending: false })

    if (costErr) {
      console.error('[ai-cost-monitor] Failed to read summary:', costErr)
      return jsonResponse({ ok: false, error: costErr.message }, 500)
    }

    const rows = (costRows ?? []) as CostRow[]
    const todayKey = new Date().toISOString().slice(0, 10)

    // Sum today's cost across all agents/models
    const todayCost = rows
      .filter((r) => r.day === todayKey)
      .reduce((sum, r) => sum + Number(r.cost_usd), 0)

    // Sum each of the previous 7 days individually, then average
    const dailyBaseline: Record<string, number> = {}
    rows
      .filter((r) => r.day !== todayKey)
      .forEach((r) => {
        dailyBaseline[r.day] = (dailyBaseline[r.day] ?? 0) + Number(r.cost_usd)
      })

    const baselineDays = Object.values(dailyBaseline)
    const baselineAvg =
      baselineDays.length > 0
        ? baselineDays.reduce((a, b) => a + b, 0) / baselineDays.length
        : 0

    // 2. Decide if this is a spike
    const deltaPct =
      baselineAvg > 0 ? ((todayCost - baselineAvg) / baselineAvg) * 100 : 0
    const spikeDetected =
      baselineAvg >= MIN_BASELINE_USD && deltaPct >= SPIKE_THRESHOLD_PCT

    // 3. If spike, fetch top spenders for context
    let topSpenders: TopSpender[] = []
    if (spikeDetected) {
      const { data: tops } = await supabase
        .from('ai_cost_daily_summary')
        .select('agent_id, edge_function, cost_usd, calls')
        .eq('day', todayKey)
        .order('cost_usd', { ascending: false })
        .limit(5)
      topSpenders = (tops ?? []) as TopSpender[]
    }

    // 4. Fire Discord alert if spike
    if (spikeDetected) {
      const webhookUrl =
        Deno.env.get('DISCORD_WEBHOOK_ALERTS') ??
        Deno.env.get('DISCORD_WEBHOOK_ERRORS')

      if (webhookUrl) {
        const embed = {
          title: '💸 Spike de custo IA detectado',
          description:
            `Custo de hoje: **$${todayCost.toFixed(4)}** USD\n` +
            `Baseline 7 dias: **$${baselineAvg.toFixed(4)}** USD\n` +
            `Variação: **+${deltaPct.toFixed(1)}%** (threshold: ${SPIKE_THRESHOLD_PCT}%)`,
          color: 0xffb800, // GMS yellow = warning
          fields: topSpenders.length
            ? [
                {
                  name: '🔝 Top 5 consumidores hoje',
                  value: topSpenders
                    .map(
                      (t, i) =>
                        `${i + 1}. \`${t.edge_function}\` — $${Number(t.cost_usd).toFixed(4)} (${t.calls} calls)`
                    )
                    .join('\n'),
                  inline: false,
                },
              ]
            : [],
          footer: {
            text: `Sismais Tecnologia • AI Cost Monitor • ${todayKey}`,
          },
        }

        try {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
          })
          if (!resp.ok) {
            console.warn(
              `[ai-cost-monitor] Discord webhook returned ${resp.status}: ${await resp.text()}`
            )
          }
        } catch (e) {
          console.warn('[ai-cost-monitor] Failed to send Discord alert:', e)
        }
      } else {
        console.warn(
          '[ai-cost-monitor] Spike detected but no DISCORD_WEBHOOK_ALERTS/DISCORD_WEBHOOK_ERRORS configured'
        )
      }
    }

    return jsonResponse({
      ok: true,
      day: todayKey,
      spike_detected: spikeDetected,
      today_usd: Number(todayCost.toFixed(6)),
      baseline_usd: Number(baselineAvg.toFixed(6)),
      delta_pct: Number(deltaPct.toFixed(2)),
      threshold_pct: SPIKE_THRESHOLD_PCT,
      baseline_days: baselineDays.length,
      top_spenders: topSpenders,
    })
  } catch (e) {
    console.error('[ai-cost-monitor] Fatal error:', e)
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
