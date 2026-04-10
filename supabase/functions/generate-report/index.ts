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
    const { report_type, date_range_start, date_range_end, filters, user_id } = await req.json()

    console.log(`[generate-report] Generating ${report_type} report`)

    let reportData: any = {}
    let reportName = ''

    if (report_type === 'executive') {
      reportName = `Relatório Executivo - ${date_range_start} a ${date_range_end}`

      const { data: kpis, error: kpiError } = await supabase.rpc('get_analytics_kpis', {
        p_start_date: date_range_start,
        p_end_date: date_range_end
      })
      if (kpiError) throw kpiError

      const { data: agents, error: agentError } = await supabase.rpc('get_agent_performance', {
        p_start_date: date_range_start,
        p_end_date: date_range_end
      })
      if (agentError) throw agentError

      reportData = {
        period: `${date_range_start} a ${date_range_end}`,
        kpis: kpis?.[0] || kpis,
        top_agents: (agents || []).slice(0, 5),
        generated_at: new Date().toISOString()
      }

    } else if (report_type === 'churn') {
      reportName = `Relatório de Churn - ${new Date().toISOString().split('T')[0]}`

      const { data: predictions } = await supabase
        .from('customer_health_scores')
        .select('*')
        .order('churn_probability', { ascending: false })
        .limit(50)

      const { data: stats } = await supabase.rpc('get_churn_statistics')

      reportData = {
        overview: stats?.[0] || stats,
        high_risk: (predictions || []).filter((p: any) => p.risk_level === 'red'),
        medium_risk: (predictions || []).filter((p: any) => p.risk_level === 'yellow'),
        generated_at: new Date().toISOString()
      }

    } else if (report_type === 'agents') {
      reportName = `Performance Agentes - ${date_range_start} a ${date_range_end}`

      const { data: agents, error } = await supabase.rpc('get_agent_performance', {
        p_start_date: date_range_start,
        p_end_date: date_range_end
      })
      if (error) throw error

      reportData = {
        period: `${date_range_start} a ${date_range_end}`,
        agents: agents || [],
        generated_at: new Date().toISOString()
      }

    } else if (report_type === 'costs') {
      reportName = `Análise de Custos IA - ${date_range_start} a ${date_range_end}`

      const { data: kpis } = await supabase.rpc('get_analytics_kpis', {
        p_start_date: date_range_start,
        p_end_date: date_range_end
      })

      const { data: snapshots } = await supabase
        .from('analytics_snapshots')
        .select('snapshot_date, total_ai_cost_brl, total_tokens_used, total_conversations')
        .gte('snapshot_date', date_range_start)
        .lte('snapshot_date', date_range_end)
        .order('snapshot_date')

      reportData = {
        period: `${date_range_start} a ${date_range_end}`,
        summary: kpis?.[0] || kpis,
        daily_costs: snapshots || [],
        generated_at: new Date().toISOString()
      }
    }

    // Save report
    const { data: saved, error: saveError } = await supabase
      .from('analytics_reports')
      .insert({
        name: reportName,
        report_type,
        date_range_start,
        date_range_end,
        filters: filters || {},
        data: reportData,
        generated_by: user_id || null
      })
      .select()
      .single()

    if (saveError) throw saveError

    console.log(`[generate-report] Report saved: ${saved.id}`)

    return new Response(JSON.stringify({
      success: true,
      report_id: saved.id,
      name: reportName,
      data: reportData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[generate-report] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
