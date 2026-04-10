import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface SyncResult {
  synced: number
  created: number
  updated: number
  errors: Array<{ documento: string; error: string }>
  total: number
  duration_ms: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminUrl = Deno.env.get('SISMAIS_ADMIN_SUPABASE_URL')
    const adminKey = Deno.env.get('SISMAIS_ADMIN_SERVICE_ROLE_KEY')

    if (!adminUrl || !adminKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sismais Admin credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const adminClient = createClient(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'incremental'
    const pageSize = body.page_size || 100

    console.log(`[sync-sismais-admin-clients] Starting ${action} sync`)

    // Determine lastSyncedAt for incremental sync
    let lastSyncedAt: string | null = null
    if (action === 'incremental') {
      const { data: lastSync } = await supabase
        .from('helpdesk_clients')
        .select('last_synced_at')
        .not('last_synced_at', 'is', null)
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastSyncedAt = lastSync?.last_synced_at || null
      console.log(`[sync-sismais-admin-clients] Last synced at: ${lastSyncedAt}`)
    }

    // Fetch contracts from Sismais Admin (paginated)
    let allContracts: any[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      let query = adminClient
        .from('contratos_assinatura')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('cliente_nome')

      if (lastSyncedAt && action === 'incremental') {
        query = query.gte('updated_at', lastSyncedAt)
      }

      const { data: batch, error } = await query
      if (error) throw error

      if (!batch || batch.length === 0) {
        hasMore = false
      } else {
        allContracts = allContracts.concat(batch)
        hasMore = batch.length === pageSize
        page++
      }
    }

    console.log(`[sync-sismais-admin-clients] Fetched ${allContracts.length} contracts`)

    // Aggregate by cliente_documento (same logic as sismais-admin-proxy)
    const clientMap = new Map<string, any>()
    for (const c of allContracts) {
      const key = c.cliente_documento || c.doc_contato || c.cliente_nome
      if (!key) continue

      if (!clientMap.has(key)) {
        clientMap.set(key, {
          documento: c.cliente_documento || c.doc_contato || '',
          nome: c.cliente_nome || c.nome_contato || '',
          email: c.cliente_email || '',
          telefone: c.telefone_contato || '',
          mrr_total: 0,
          contratos_ativos: 0,
          plataformas: [] as string[],
          status_geral: 'cancelado',
          divida_total: 0,
        })
      }

      const entry = clientMap.get(key)!

      // MRR
      const isAtivo = c.status === 'ativo' || c.status === 'active'
      if (isAtivo) {
        entry.mrr_total += parseFloat(c.mrr || c.valor_assinatura || '0')
        entry.contratos_ativos++
        entry.status_geral = 'ativo'
      }

      // Plataformas
      if (c.plataforma && !entry.plataformas.includes(c.plataforma)) {
        entry.plataformas.push(c.plataforma)
      }
    }

    // Fetch overdue invoices for churn_risk detection
    const documentos = Array.from(clientMap.keys())
    if (documentos.length > 0) {
      const { data: invoices } = await adminClient
        .from('faturas_assinatura')
        .select('cliente_documento, valor, data_vencimento, pago')
        .in('cliente_documento', documentos.slice(0, 500)) // limit for large datasets
        .eq('pago', false)

      const hoje = new Date()
      const treshold60 = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000)

      for (const inv of (invoices || [])) {
        const key = inv.cliente_documento
        if (!key || !clientMap.has(key)) continue
        const entry = clientMap.get(key)!
        const venc = new Date(inv.data_vencimento)
        if (venc < hoje) {
          entry.divida_total += parseFloat(inv.valor || '0')
          entry.pending_invoices_count = (entry.pending_invoices_count || 0) + 1
          if (venc < treshold60) {
            entry.churn_risk_overdue = true
          }
        }
      }
    }

    // Map to platform name
    const mapPlataforma = (plataformas: string[]): string => {
      const p = (plataformas[0] || '').toLowerCase()
      if (p.includes('gms') && p.includes('web')) return 'GMS Web'
      if (p.includes('gms')) return 'GMS Desktop'
      if (p.includes('maxpro') || p.includes('pdv')) return 'Maxpro'
      if (plataformas.length > 0) return plataformas[0]
      return 'Outro'
    }

    const mapCustomerTier = (mrr: number): string => {
      if (mrr > 500) return 'enterprise'
      if (mrr > 200) return 'business'
      return 'starter'
    }

    const mapPlanLevel = (mrr: number): string => {
      if (mrr > 500) return 'Enterprise'
      if (mrr > 200) return 'Profissional'
      return 'Basico'
    }

    // Upsert clients into helpdesk_clients
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [],
      total: clientMap.size,
      duration_ms: 0,
    }

    const batchSize = 50
    const clientEntries = Array.from(clientMap.values())

    for (let i = 0; i < clientEntries.length; i += batchSize) {
      const batch = clientEntries.slice(i, i + batchSize)

      const upsertRows = batch
        .filter(c => c.documento) // skip clients without documento
        .map(c => ({
          cnpj: c.documento || null,
          name: c.nome || c.documento,
          company_name: c.nome || null,
          email: c.email || null,
          phone: c.telefone || null,
          sistema: mapPlataforma(c.plataformas),
          plan_level: mapPlanLevel(c.mrr_total),
          customer_tier: mapCustomerTier(c.mrr_total),
          churn_risk: !!(c.divida_total > 0 || c.churn_risk_overdue),
          sismais_admin_id: c.documento,
          last_synced_at: new Date().toISOString(),
          // Novos campos de status financeiro/licença
          license_status: c.contratos_ativos > 0 ? 'active' : (c.status_geral === 'cancelado' ? 'cancelled' : 'expired'),
          mrr_total: Math.round((c.mrr_total || 0) * 100) / 100,
          active_contracts_count: c.contratos_ativos || 0,
          debt_total: Math.round((c.divida_total || 0) * 100) / 100,
          pending_invoices_count: c.pending_invoices_count || 0,
        }))

      if (upsertRows.length === 0) continue

      const { data: upserted, error: upsertError } = await supabase
        .from('helpdesk_clients')
        .upsert(upsertRows, {
          onConflict: 'cnpj',
          ignoreDuplicates: false,
        })
        .select('id')

      if (upsertError) {
        console.error('[sync-sismais-admin-clients] Upsert error:', upsertError)
        batch.forEach(c => result.errors.push({ documento: c.documento, error: upsertError.message }))
      } else {
        result.synced += upsertRows.length
      }
    }

    const durationMs = Date.now() - startTime
    result.duration_ms = durationMs

    // Log the sync
    await supabase.from('customer_sync_log').insert({
      sync_type: action === 'full' ? 'full' : 'incremental',
      total_processed: result.total,
      total_created: result.created,
      total_updated: result.updated,
      total_errors: result.errors.length,
      error_details: result.errors.length > 0 ? result.errors : null,
      duration_ms: durationMs,
    }).then(() => {}, () => {})

    console.log(`[sync-sismais-admin-clients] Done: ${result.synced} synced, ${result.errors.length} errors in ${durationMs}ms`)

    return new Response(
      JSON.stringify({ success: true, data: result, meta: { duration_ms: durationMs } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[sync-sismais-admin-clients] Fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err), meta: { duration_ms: durationMs } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
