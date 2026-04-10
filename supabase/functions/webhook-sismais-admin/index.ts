import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

/**
 * webhook-sismais-admin
 *
 * Recebe webhooks do Sismais Admin quando dados de clientes/contratos/faturas
 * são atualizados, e sincroniza com o SisCRM (helpdesk_clients).
 *
 * Events:
 *   - client.updated    → Atualiza helpdesk_clients
 *   - contract.updated  → Re-importa contratos para o cliente
 *   - invoice.updated   → Atualiza status financeiro do cliente
 *   - sync.request      → Força sync completo de um cliente por documento
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Verify webhook secret
    const webhookSecret = Deno.env.get('SISMAIS_ADMIN_WEBHOOK_SECRET')
    if (webhookSecret) {
      const headerSecret = req.headers.get('x-webhook-secret')
      if (headerSecret !== webhookSecret) {
        console.error('[webhook-sismais-admin] Invalid webhook secret')
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminUrl = Deno.env.get('SISMAIS_ADMIN_SUPABASE_URL')
    const adminKey = Deno.env.get('SISMAIS_ADMIN_SERVICE_ROLE_KEY')

    if (!adminUrl || !adminKey) {
      return new Response(JSON.stringify({ error: 'Sismais Admin credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const adminClient = createClient(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const body = await req.json()
    const { event, data } = body

    if (!event || !data) {
      return new Response(JSON.stringify({ error: 'event and data are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[webhook-sismais-admin] Event: ${event}, documento: ${data.documento || 'N/A'}`)

    const documento = data.documento || data.cliente_documento
    if (!documento) {
      return new Response(JSON.stringify({ error: 'documento is required in data' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find local client by documento (cnpj/cpf)
    const { data: localClient } = await supabase
      .from('helpdesk_clients')
      .select('id, cnpj, cpf, name')
      .or(`cnpj.eq.${documento},cpf.eq.${documento},sismais_admin_id.eq.${documento}`)
      .limit(1)
      .maybeSingle()

    // Handle events
    if (event === 'client.updated' || event === 'sync.request') {
      // Fetch fresh data from Sismais Admin
      const clientData = await fetchClientFromAdmin(adminClient, documento)
      if (!clientData) {
        console.log(`[webhook-sismais-admin] Client not found in Sismais Admin: ${documento}`)
        return new Response(JSON.stringify({ success: true, action: 'skipped', reason: 'not_found_in_admin' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fetch invoice/debt data
      const financialData = await fetchFinancialData(adminClient, documento)

      // Upsert local client
      const clientId = await upsertClient(supabase, localClient?.id || null, clientData, financialData, documento)
      if (!clientId) {
        return new Response(JSON.stringify({ success: false, error: 'upsert_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Sync contracts
      await syncContracts(supabase, adminClient, clientId, documento)

      console.log(`[webhook-sismais-admin] Client ${clientId} synced successfully`)
      return new Response(JSON.stringify({
        success: true,
        action: localClient ? 'updated' : 'created',
        client_id: clientId,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (event === 'contract.updated') {
      if (!localClient) {
        console.log(`[webhook-sismais-admin] No local client for contract update, creating...`)
        // Create the client first, then sync contracts
        const clientData = await fetchClientFromAdmin(adminClient, documento)
        if (!clientData) {
          return new Response(JSON.stringify({ success: true, action: 'skipped' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        const financialData = await fetchFinancialData(adminClient, documento)
        const clientId = await upsertClient(supabase, null, clientData, financialData, documento)
        if (clientId) await syncContracts(supabase, adminClient, clientId, documento)
        return new Response(JSON.stringify({ success: true, action: 'created_and_synced', client_id: clientId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await syncContracts(supabase, adminClient, localClient.id, documento)

      // Update financial summary
      const financialData = await fetchFinancialData(adminClient, documento)
      await supabase.from('helpdesk_clients').update({
        ...financialData,
        last_synced_at: new Date().toISOString(),
      }).eq('id', localClient.id)

      return new Response(JSON.stringify({ success: true, action: 'contracts_synced', client_id: localClient.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (event === 'invoice.updated') {
      if (!localClient) {
        return new Response(JSON.stringify({ success: true, action: 'skipped', reason: 'no_local_client' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const financialData = await fetchFinancialData(adminClient, documento)
      await supabase.from('helpdesk_clients').update({
        ...financialData,
        last_synced_at: new Date().toISOString(),
      }).eq('id', localClient.id)

      console.log(`[webhook-sismais-admin] Financial data updated for client ${localClient.id}`)
      return new Response(JSON.stringify({ success: true, action: 'financial_updated', client_id: localClient.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[webhook-sismais-admin] Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ── Fetch aggregated client data from Sismais Admin ──
async function fetchClientFromAdmin(adminClient: any, documento: string) {
  const { data: contracts, error } = await adminClient
    .from('contratos_assinatura')
    .select('*')
    .or(`cliente_documento.eq.${documento},doc_contato.eq.${documento}`)

  if (error || !contracts || contracts.length === 0) return null

  let nome = '', email = '', telefone = ''
  let mrrTotal = 0, contratosAtivos = 0
  const plataformas = new Set<string>()

  for (const c of contracts) {
    if (!nome) nome = c.cliente_nome || c.nome_contato || ''
    if (!email) email = c.cliente_email || c.email_contato || ''
    if (!telefone) telefone = c.telefone_contato || ''
    if (c.plataforma) plataformas.add(c.plataforma)

    const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'
    if (isActive) {
      mrrTotal += parseFloat(c.mrr || c.valor_assinatura || '0') || 0
      contratosAtivos++
    }
  }

  const mapPlataforma = (plats: string[]): string => {
    const p = (plats[0] || '').toLowerCase()
    if (p.includes('gms') && p.includes('web')) return 'GMS Web'
    if (p.includes('gms')) return 'GMS Desktop'
    if (p.includes('maxpro') || p.includes('pdv')) return 'Maxpro'
    if (plats.length > 0) return plats[0]
    return 'Outro'
  }

  return {
    nome,
    email,
    telefone,
    mrr_total: mrrTotal,
    contratos_ativos: contratosAtivos,
    contratos_count: contracts.length,
    plataformas: Array.from(plataformas),
    sistema: mapPlataforma(Array.from(plataformas)),
    customer_tier: mrrTotal > 500 ? 'enterprise' : mrrTotal > 200 ? 'business' : 'starter',
    plan_level: mrrTotal > 500 ? 'Enterprise' : mrrTotal > 200 ? 'Profissional' : 'Basico',
    license_status: contratosAtivos > 0 ? 'active' : 'cancelled',
  }
}

// ── Fetch financial data (invoices, debt) ──
async function fetchFinancialData(adminClient: any, documento: string) {
  const today = new Date().toISOString().split('T')[0]

  const { data: invoices } = await adminClient
    .from('faturas_assinatura')
    .select('valor, valor_liquido, data_vencimento, status, pago')
    .ilike('cliente_documento', documento)
    .order('data_vencimento', { ascending: false })
    .limit(100)

  let debtTotal = 0
  let pendingCount = 0
  let lastInvoiceDate: string | null = null
  let churnRisk = false

  const now = Date.now()
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000

  for (const inv of (invoices || [])) {
    if (!lastInvoiceDate) lastInvoiceDate = inv.data_vencimento

    const isPaid = inv.pago === true ||
      inv.status?.toLowerCase() === 'pago' ||
      inv.status?.toLowerCase() === 'paid'

    if (!isPaid && inv.data_vencimento && inv.data_vencimento <= today) {
      const val = parseFloat(inv.valor || inv.valor_liquido || '0') || 0
      debtTotal += val
      pendingCount++

      const vencDate = new Date(inv.data_vencimento)
      if ((now - vencDate.getTime()) >= SIXTY_DAYS_MS) {
        churnRisk = true
      }
    }
  }

  return {
    debt_total: Math.round(debtTotal * 100) / 100,
    pending_invoices_count: pendingCount,
    last_invoice_date: lastInvoiceDate,
    churn_risk: churnRisk || debtTotal > 0,
  }
}

// ── Upsert client in helpdesk_clients ──
async function upsertClient(
  supabase: any,
  existingId: string | null,
  clientData: any,
  financialData: any,
  documento: string
): Promise<string | null> {
  const isCnpj = documento.replace(/\D/g, '').length > 11
  const now = new Date().toISOString()

  const fields = {
    name: clientData.nome || documento,
    company_name: clientData.nome || null,
    email: clientData.email || null,
    phone: clientData.telefone || null,
    sistema: clientData.sistema,
    plan_level: clientData.plan_level,
    customer_tier: clientData.customer_tier,
    license_status: clientData.license_status,
    mrr_total: clientData.mrr_total,
    active_contracts_count: clientData.contratos_ativos,
    sismais_admin_id: documento,
    last_synced_at: now,
    ...financialData,
  }

  if (existingId) {
    const { error } = await supabase.from('helpdesk_clients')
      .update({ ...fields, updated_at: now })
      .eq('id', existingId)
    if (error) {
      console.error('[webhook-sismais-admin] Update error:', error)
      return null
    }
    return existingId
  }

  const { data: created, error } = await supabase.from('helpdesk_clients')
    .insert({
      ...fields,
      cnpj: isCnpj ? documento : null,
      cpf: !isCnpj ? documento : null,
      external_id: documento,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[webhook-sismais-admin] Insert error:', error)
    return null
  }
  return created?.id || null
}

// ── Sync contracts from Sismais Admin ──
async function syncContracts(supabase: any, adminClient: any, clientId: string, documento: string) {
  try {
    const { data: contracts } = await adminClient
      .from('contratos_assinatura')
      .select('*')
      .or(`cliente_documento.eq.${documento},doc_contato.eq.${documento}`)
      .order('data_inicio', { ascending: false })

    if (!contracts || contracts.length === 0) return

    for (const c of contracts) {
      const contractNum = (c.id_contrato || c.id || '').toString()
      if (!contractNum) continue

      const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'

      // Check if contract exists
      const { data: existing } = await supabase
        .from('helpdesk_client_contracts')
        .select('id')
        .eq('client_id', clientId)
        .eq('contract_number', contractNum)
        .maybeSingle()

      const contractData = {
        client_id: clientId,
        contract_number: contractNum,
        plan_name: c.plano || c.plano_nome || c.nome_produto || c.descricao || c.plataforma || 'N/A',
        value: parseFloat(c.mrr || c.valor_assinatura || '0') || null,
        status: isActive ? 'active' : 'cancelled',
        start_date: c.data_inicio || null,
        end_date: c.data_fim || c.data_cancelamento || null,
        notes: [c.plataforma, c.vendedor, c.segmento_cliente].filter(Boolean).join(' | '),
      }

      if (existing) {
        await supabase.from('helpdesk_client_contracts').update(contractData).eq('id', existing.id)
      } else {
        await supabase.from('helpdesk_client_contracts').insert(contractData)
      }
    }

    console.log(`[webhook-sismais-admin] Synced ${contracts.length} contracts for client ${clientId}`)
  } catch (err) {
    console.error('[webhook-sismais-admin] Contract sync error:', err)
  }
}
