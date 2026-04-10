import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const adminUrl = Deno.env.get('SISMAIS_ADMIN_SUPABASE_URL')
    const adminKey = Deno.env.get('SISMAIS_ADMIN_SERVICE_ROLE_KEY')

    if (!adminUrl || !adminKey) {
      return new Response(JSON.stringify({ error: 'Sismais Admin credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { action, search, documento, contrato_id, page = 1, page_size = 50 } = await req.json()

    if (action === 'clients') {
      // Fetch all contracts and aggregate by cliente_documento
      let query = adminClient.from('contratos_assinatura').select('*')
      
      if (search) {
        const term = `%${search}%`
        query = query.or(`cliente_nome.ilike.${term},cliente_documento.ilike.${term},cliente_email.ilike.${term},telefone_contato.ilike.${term},nome_contato.ilike.${term}`)
      }

      const { data: contracts, error } = await query.order('cliente_nome')
      if (error) throw error

      // Aggregate by cliente_documento
      const clientMap = new Map<string, any>()
      for (const c of (contracts || [])) {
        const key = c.cliente_documento || c.doc_contato || c.cliente_nome
        if (!key) continue

        if (!clientMap.has(key)) {
          clientMap.set(key, {
            documento: c.cliente_documento || c.doc_contato || '',
            nome: c.cliente_nome || c.nome_contato || '',
            email: c.cliente_email || c.email_contato || '',
            telefone: c.telefone_contato || '',
            mrr_total: 0,
            contratos_count: 0,
            plataformas: new Set(),
            status_geral: 'cancelado',
            contratos_ativos: 0,
            divida_total: 0,
          })
        }

        const client = clientMap.get(key)!
        client.contratos_count++
        if (c.plataforma) client.plataformas.add(c.plataforma)
        
        const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'
        if (isActive) {
          client.contratos_ativos++
          client.status_geral = 'ativo'
          client.mrr_total += parseFloat(c.mrr || c.valor_assinatura || '0') || 0
        }

        // Update name/email if empty
        if (!client.nome && c.cliente_nome) client.nome = c.cliente_nome
        if (!client.email && c.cliente_email) client.email = c.cliente_email
        if (!client.telefone && c.telefone_contato) client.telefone = c.telefone_contato
      }

      // Fetch overdue invoices to calculate debt per client
      try {
        const today = new Date().toISOString().split('T')[0]
        const { data: overdueInvoices } = await adminClient
          .from('faturas_assinatura')
          .select('cliente_documento, valor, valor_liquido, status')
          .not('status', 'ilike', '%pago%')
          .not('status', 'ilike', '%paid%')
          .lte('data_vencimento', today)

        if (overdueInvoices) {
          for (const inv of overdueInvoices) {
            const doc = inv.cliente_documento
            if (doc && clientMap.has(doc)) {
              const val = parseFloat(inv.valor || inv.valor_liquido || '0') || 0
              clientMap.get(doc)!.divida_total += val
            }
          }
        }
      } catch (e) {
        console.error('Error fetching overdue invoices:', e)
      }

      const allClients = Array.from(clientMap.values()).map(c => ({
        ...c,
        plataformas: Array.from(c.plataformas),
        mrr_total: Math.round(c.mrr_total * 100) / 100,
        divida_total: Math.round(c.divida_total * 100) / 100,
      }))

      const total = allClients.length
      const start = (page - 1) * page_size
      const paginated = allClients.slice(start, start + page_size)

      return new Response(JSON.stringify({ data: paginated, total, page, page_size }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'contracts') {
      if (!documento) {
        return new Response(JSON.stringify({ error: 'documento is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await adminClient
        .from('contratos_assinatura')
        .select('*')
        .or(`cliente_documento.eq.${documento},doc_contato.eq.${documento}`)
        .order('data_inicio', { ascending: false })

      if (error) throw error

      return new Response(JSON.stringify({ data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'invoices') {
      if (!documento && !contrato_id) {
        return new Response(JSON.stringify({ error: 'documento or contrato_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let query = adminClient.from('faturas_assinatura').select('*')
      if (contrato_id) {
        query = query.eq('contrato_id', contrato_id)
      } else {
        query = query.ilike('cliente_documento', documento)
      }

      const { data, error } = await query.order('data_vencimento', { ascending: false }).limit(50)
      if (error) throw error

      return new Response(JSON.stringify({ data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'contacts') {
      if (!documento) {
        return new Response(JSON.stringify({ error: 'documento is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Extract unique contacts from contracts for the given documento
      const { data: contractsData, error: cErr } = await adminClient
        .from('contratos_assinatura')
        .select('nome_contato, telefone_contato, email_contato, doc_contato')
        .or(`cliente_documento.eq.${documento},doc_contato.eq.${documento}`)

      if (cErr) throw cErr

      // Deduplicate contacts by phone or email
      const contactMap = new Map<string, any>()
      for (const c of (contractsData || [])) {
        const key = c.telefone_contato || c.email_contato || c.nome_contato || ''
        if (!key) continue
        if (!contactMap.has(key)) {
          contactMap.set(key, {
            nome: c.nome_contato || '',
            telefone: c.telefone_contato || '',
            email: c.email_contato || '',
            documento: c.doc_contato || '',
          })
        }
      }

      return new Response(JSON.stringify({ data: Array.from(contactMap.values()) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'client_summary') {
      // Single-client summary with contracts + invoices + debt — used by AI agent tool
      if (!documento) {
        return new Response(JSON.stringify({ error: 'documento is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fetch contracts
      const { data: contractsData } = await adminClient
        .from('contratos_assinatura')
        .select('*')
        .or(`cliente_documento.eq.${documento},doc_contato.eq.${documento}`)
        .order('data_inicio', { ascending: false })

      if (!contractsData || contractsData.length === 0) {
        return new Response(JSON.stringify({ data: null, message: 'Cliente não encontrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const c0 = contractsData[0]
      let mrrTotal = 0, activeCount = 0
      const plataformas = new Set<string>()

      const contractsSummary = contractsData.map(c => {
        const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'
        if (isActive) {
          mrrTotal += parseFloat(c.mrr || c.valor_assinatura || '0') || 0
          activeCount++
        }
        if (c.plataforma) plataformas.add(c.plataforma)
        return {
          contrato: c.id_contrato || c.id,
          plano: c.plano || c.plano_nome || c.nome_produto || c.plataforma || 'N/A',
          status: c.status,
          valor: parseFloat(c.mrr || c.valor_assinatura || '0') || 0,
          plataforma: c.plataforma,
        }
      })

      // Fetch invoices summary
      const today = new Date().toISOString().split('T')[0]
      const { data: invoicesData } = await adminClient
        .from('faturas_assinatura')
        .select('valor, valor_liquido, data_vencimento, status, pago')
        .ilike('cliente_documento', documento)
        .order('data_vencimento', { ascending: false })
        .limit(20)

      let debtTotal = 0, pendingCount = 0
      for (const inv of (invoicesData || [])) {
        const isPaid = inv.pago === true || inv.status?.toLowerCase() === 'pago' || inv.status?.toLowerCase() === 'paid'
        if (!isPaid && inv.data_vencimento && inv.data_vencimento <= today) {
          debtTotal += parseFloat(inv.valor || inv.valor_liquido || '0') || 0
          pendingCount++
        }
      }

      return new Response(JSON.stringify({
        data: {
          nome: c0.cliente_nome || c0.nome_contato || '',
          documento,
          email: c0.cliente_email || c0.email_contato || '',
          telefone: c0.telefone_contato || '',
          plataformas: Array.from(plataformas),
          mrr_total: Math.round(mrrTotal * 100) / 100,
          contratos_ativos: activeCount,
          contratos_total: contractsData.length,
          contratos: contractsSummary,
          divida_total: Math.round(debtTotal * 100) / 100,
          faturas_pendentes: pendingCount,
          license_status: activeCount > 0 ? 'active' : 'cancelled',
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('sismais-admin-proxy error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
