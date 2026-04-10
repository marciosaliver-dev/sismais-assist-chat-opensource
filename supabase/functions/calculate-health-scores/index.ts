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
    console.log('[calculate-health-scores] Starting...')

    // Get unique customers from conversations
    const { data: conversations, error: convError } = await supabase
      .from('ai_conversations')
      .select('customer_phone, customer_name, started_at, status, handler_type, csat_rating, resolution_time_seconds')
      .order('started_at', { ascending: true })

    if (convError) throw convError
    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ success: true, customers_processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Group by phone
    const customerMap: Record<string, any[]> = {}
    for (const c of conversations) {
      if (!c.customer_phone) continue
      if (!customerMap[c.customer_phone]) customerMap[c.customer_phone] = []
      customerMap[c.customer_phone].push(c)
    }

    const healthScores: any[] = []
    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

    for (const [phone, convs] of Object.entries(customerMap)) {
      const lastContact = Math.max(...convs.map(c => new Date(c.started_at).getTime()))
      const recencyDays = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24))
      const frequency30d = convs.filter(c => now - new Date(c.started_at).getTime() <= thirtyDaysMs).length

      const csatRatings = convs.filter(c => c.csat_rating).map(c => c.csat_rating)
      const avgCsat = csatRatings.length > 0 ? csatRatings.reduce((s: number, r: number) => s + r, 0) / csatRatings.length : null

      const humanCount = convs.filter(c => c.handler_type === 'human').length
      const escalationRate = convs.length > 0 ? (humanCount / convs.length) * 100 : 0

      // Calculate health score (0-100)
      let score = 100
      if (recencyDays > 60) score -= 30
      else if (recencyDays > 30) score -= 15
      else if (recencyDays > 14) score -= 5

      if (frequency30d === 0) score -= 20
      else if (frequency30d < 2) score -= 10

      if (avgCsat !== null) {
        if (avgCsat < 3) score -= 30
        else if (avgCsat < 4) score -= 15
      }

      if (escalationRate > 50) score -= 20
      else if (escalationRate > 30) score -= 10

      score = Math.max(0, Math.min(100, score))
      const churnProb = 100 - score

      const riskFactors: any[] = []
      if (recencyDays > 30) riskFactors.push({ factor: 'low_engagement', weight: 0.3 })
      if (avgCsat !== null && avgCsat < 3.5) riskFactors.push({ factor: 'low_satisfaction', weight: 0.3 })
      if (escalationRate > 40) riskFactors.push({ factor: 'high_escalation', weight: 0.2 })
      if (frequency30d === 0) riskFactors.push({ factor: 'no_recent_activity', weight: 0.4 })

      let riskLevel = 'green'
      if (churnProb >= 70) riskLevel = 'red'
      else if (churnProb >= 40) riskLevel = 'yellow'

      let segment = 'regular'
      if (score >= 80) segment = 'vip'
      else if (score < 50) segment = 'at_risk'
      else if (convs.length <= 2) segment = 'new'

      const firstConv = convs[0]

      healthScores.push({
        customer_phone: phone,
        customer_name: firstConv.customer_name,
        health_score: Math.round(score),
        risk_level: riskLevel,
        recency_days: recencyDays,
        frequency_30d: frequency30d,
        avg_csat: avgCsat ? Math.round(avgCsat * 100) / 100 : null,
        escalation_rate: Math.round(escalationRate * 100) / 100,
        churn_probability: Math.round(churnProb * 100) / 100,
        churn_risk_factors: riskFactors,
        customer_since: firstConv.started_at?.split('T')[0] || null,
        total_interactions: convs.length,
        segment,
        last_calculated_at: new Date().toISOString()
      })
    }

    // Upsert in batches of 50
    for (let i = 0; i < healthScores.length; i += 50) {
      const batch = healthScores.slice(i, i + 50)
      const { error } = await supabase
        .from('customer_health_scores')
        .upsert(batch, { onConflict: 'customer_phone' })
      if (error) {
        console.error(`[calculate-health-scores] Batch ${i} error:`, error)
        throw error
      }
    }

    console.log(`[calculate-health-scores] Processed ${healthScores.length} customers`)

    return new Response(JSON.stringify({
      success: true,
      customers_processed: healthScores.length,
      at_risk: healthScores.filter(s => s.risk_level !== 'green').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[calculate-health-scores] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
