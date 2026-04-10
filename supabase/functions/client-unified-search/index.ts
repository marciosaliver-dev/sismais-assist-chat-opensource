import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GL_SELECT = "gl_id, nome, cpf_cnpj, fantasia, email, telefone1, celular, status_pessoa, sistema_utilizado, source_system, nome_segmento, engajamento, tag, dias_status_atual, dias_assinatura, ltv_dias, dt_inicio_assinatura, cidade, uf, id_plano, dias_instalacao, ultima_verificacao, dt_atualizacao, dt_inclusao, dias_de_uso, qtd_login, support_eligible"

function mapGlRow(gl: any) {
  return {
    id: `gl_${gl.gl_id}_${gl.source_system}`,
    name: gl.nome || gl.fantasia,
    company: gl.fantasia,
    cnpj: gl.cpf_cnpj,
    phone: gl.celular || gl.telefone1,
    email: gl.email,
    source: "gl",
    gl_status_mais_simples: gl.source_system === "mais_simples" ? gl.status_pessoa : null,
    gl_status_maxpro: gl.source_system === "maxpro" ? gl.status_pessoa : null,
    license_status: gl.status_pessoa,
    mrr_total: null,
    health_score: null,
    customer_tier: null,
    is_linked: false,
    gl_source_system: gl.source_system,
    segmento: gl.nome_segmento ?? null,
    engajamento: gl.engajamento ?? null,
    tag: gl.tag ?? null,
    dias_status_atual: gl.dias_status_atual ?? null,
    dias_assinatura: gl.dias_assinatura ?? null,
    ltv_dias: gl.ltv_dias ?? null,
    dt_inicio_assinatura: gl.dt_inicio_assinatura ?? null,
    cidade: gl.cidade ?? null,
    uf: gl.uf ?? null,
    sistema_utilizado: gl.sistema_utilizado ?? null,
    id_plano: gl.id_plano ?? null,
    dias_instalacao: gl.dias_instalacao ?? null,
    ultima_verificacao: gl.ultima_verificacao ?? null,
    dias_de_uso: gl.dias_de_uso ?? null,
    qtd_logins: gl.qtd_login ?? null,
    data_cadastro: gl.dt_inclusao ?? null,
    ultimo_login: gl.ultima_verificacao ?? null,
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const {
      query = '',
      limit = 50,
      offset = 0,
      sortBy = 'name',
      sortDir = 'asc',
      filterStatus = '',
      filterSegmento = '',
      filterDateRange = '',
    } = await req.json().catch(() => ({}))

    // KPI counts via RPC (instantaneo, sem limite de 1000)
    const kpiCountsPromise = supabase
      .rpc('gl_kpi_counts')
      .then(({ data }) => data ?? { total: 0, ativos: 0, bloqueados: 0, trial: 0, inativos: 0 })

    // =============================================
    // NO QUERY: return GL clients with server-side pagination
    // =============================================
    if (!query || query.length < 2) {
      // Contar total para paginacao
      let countQuery = supabase
        .from("gl_client_licenses")
        .select("gl_id", { count: 'exact', head: true })

      if (filterStatus) {
        countQuery = countQuery.eq('status_pessoa', filterStatus)
      }
      if (filterSegmento) {
        countQuery = countQuery.eq('nome_segmento', filterSegmento)
      }
      if (filterDateRange) {
        const days = parseInt(filterDateRange)
        const since = new Date(Date.now() - days * 86400000).toISOString()
        countQuery = countQuery.gte('dt_inclusao', since)
      }

      const { count: totalCount } = await countQuery

      // Buscar GL com paginacao server-side
      let glQuery = supabase
        .from("gl_client_licenses")
        .select(GL_SELECT)

      if (filterStatus) {
        glQuery = glQuery.eq('status_pessoa', filterStatus)
      }
      if (filterSegmento) {
        glQuery = glQuery.eq('nome_segmento', filterSegmento)
      }
      if (filterDateRange) {
        const days = parseInt(filterDateRange)
        const since = new Date(Date.now() - days * 86400000).toISOString()
        glQuery = glQuery.gte('dt_inclusao', since)
      }

      // Sorting server-side
      const glSortMap: Record<string, string> = {
        name: 'nome',
        cnpj: 'cpf_cnpj',
        segmento: 'nome_segmento',
        gl_status: 'status_pessoa',
        dias_de_uso: 'dias_de_uso',
        qtd_logins: 'qtd_login',
        ultimo_login: 'ultima_verificacao',
        data_cadastro: 'dt_inclusao',
        cidade_uf: 'cidade',
        sistema_utilizado: 'sistema_utilizado',
        dias_instalacao: 'dias_instalacao',
        dias_assinatura: 'dias_assinatura',
        ltv_dias: 'ltv_dias',
        ultima_verificacao: 'ultima_verificacao',
        dt_inicio_assinatura: 'dt_inicio_assinatura',
      }
      const dbSortCol = glSortMap[sortBy] || 'nome'
      glQuery = glQuery
        .order(dbSortCol, { ascending: sortDir === 'asc' })
        .range(offset, offset + limit - 1)

      const glResult = await glQuery

      // Buscar clientes locais vinculados para enriquecer
      const glDocs = new Set<string>()
      const results: any[] = []

      if (glResult.data) {
        for (const gl of glResult.data) {
          const doc = (gl.cpf_cnpj || '').replace(/\D/g, '')
          if (doc) glDocs.add(doc)
          results.push(mapGlRow(gl))
        }
      }

      // Enriquecer: buscar helpdesk_clients que tem esses CNPJs
      if (glDocs.size > 0) {
        const docArray = [...glDocs].slice(0, 100) // limitar para performance
        const { data: localMatches } = await supabase
          .from("helpdesk_clients")
          .select("id, cnpj, cpf, mrr_total, health_score, customer_tier")
          .or(docArray.map(d => `cnpj.eq.${d}`).join(','))

        if (localMatches) {
          const localMap = new Map<string, any>()
          for (const lc of localMatches) {
            const doc = (lc.cnpj || lc.cpf || '').replace(/\D/g, '')
            if (doc) localMap.set(doc, lc)
          }

          // Enriquecer resultados GL com dados locais
          for (const r of results) {
            const doc = (r.cnpj || '').replace(/\D/g, '')
            const local = doc ? localMap.get(doc) : null
            if (local) {
              r.is_linked = true
              r.id = local.id // usar ID local para navegacao
              r.mrr_total = local.mrr_total
              r.health_score = local.health_score
              r.customer_tier = local.customer_tier
              r.source = "local"
            }
          }
        }
      }

      const kpiCounts = await kpiCountsPromise

      return new Response(JSON.stringify({
        results,
        kpiCounts,
        pagination: {
          total: totalCount ?? 0,
          limit,
          offset,
          hasMore: (offset + limit) < (totalCount ?? 0),
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // =============================================
    // WITH QUERY: search across all sources
    // =============================================
    const pattern = `%${query}%`

    const [localResult, glResult, contactsResult, kpiCounts] = await Promise.all([
      supabase
        .from("helpdesk_clients")
        .select("id, name, company_name, cnpj, cpf, email, phone, license_status, mrr_total, gl_status_mais_simples, gl_status_maxpro, health_score, customer_tier")
        .or(`name.ilike.${pattern},company_name.ilike.${pattern},cnpj.ilike.${pattern},cpf.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .eq("is_merged", false)
        .limit(limit),
      supabase
        .from("gl_client_licenses")
        .select(GL_SELECT)
        .or(`nome.ilike.${pattern},cpf_cnpj.ilike.${pattern},fantasia.ilike.${pattern},email.ilike.${pattern},telefone1.ilike.${pattern},celular.ilike.${pattern}`)
        .limit(limit),
      supabase
        .from("contacts")
        .select("id, name, phone, email")
        .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .limit(10),
      kpiCountsPromise,
    ])

    const results: any[] = []
    const seenDocs = new Set<string>()

    // Process local clients
    if (localResult.data) {
      for (const c of localResult.data) {
        const doc = (c.cnpj || c.cpf || '').replace(/\D/g, '')
        if (doc) seenDocs.add(doc)
        results.push({
          id: c.id,
          name: c.name,
          company: c.company_name,
          cnpj: c.cnpj || c.cpf,
          phone: c.phone,
          email: c.email,
          source: "local",
          gl_status_mais_simples: c.gl_status_mais_simples,
          gl_status_maxpro: c.gl_status_maxpro,
          license_status: c.license_status,
          mrr_total: c.mrr_total,
          health_score: c.health_score,
          customer_tier: c.customer_tier,
          is_linked: true,
        })
      }
    }

    // Process GL (skip duplicates)
    if (glResult.data) {
      for (const gl of glResult.data) {
        const doc = (gl.cpf_cnpj || '').replace(/\D/g, '')
        if (doc && seenDocs.has(doc)) continue
        if (doc) seenDocs.add(doc)
        results.push(mapGlRow(gl))
      }
    }

    // Process contacts
    if (contactsResult.data && contactsResult.data.length > 0) {
      const contactIds = contactsResult.data.map((c: any) => c.id)
      const { data: links } = await supabase
        .from("client_contact_links")
        .select("client_id, contact_id")
        .in("contact_id", contactIds)

      if (links) {
        const seenIds = new Set(results.map(r => r.id))
        const clientIds = [...new Set(links.map((l: any) => l.client_id))].filter(id => !seenIds.has(id))
        if (clientIds.length > 0) {
          const { data: linkedClients } = await supabase
            .from("helpdesk_clients")
            .select("id, name, company_name, cnpj, cpf, email, phone, license_status, mrr_total, gl_status_mais_simples, gl_status_maxpro, health_score, customer_tier")
            .in("id", clientIds)
            .limit(10)

          if (linkedClients) {
            for (const c of linkedClients) {
              results.push({
                id: c.id, name: c.name, company: c.company_name,
                cnpj: c.cnpj || c.cpf, phone: c.phone, email: c.email,
                source: "contact",
                gl_status_mais_simples: c.gl_status_mais_simples,
                gl_status_maxpro: c.gl_status_maxpro,
                license_status: c.license_status, mrr_total: c.mrr_total,
                health_score: c.health_score, customer_tier: c.customer_tier,
                is_linked: true,
              })
            }
          }
        }
      }
    }

    // Sort search results client-side (mixed sources)
    results.sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? ''
      const bVal = (b as any)[sortBy] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true })
      return sortDir === 'desc' ? -cmp : cmp
    })

    return new Response(JSON.stringify({
      results: results.slice(0, limit),
      kpiCounts,
      pagination: { total: results.length, limit, offset: 0, hasMore: false },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[client-unified-search] error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
