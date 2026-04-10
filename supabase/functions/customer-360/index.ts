import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Customer 360 v2 — Visao unificada do cliente.
 *
 * Consolida dados de 4 fontes:
 *   1. helpdesk_clients (dados locais + campos sincronizados)
 *   2. helpdesk_client_contacts / contracts / annotations
 *   3. ai_conversations + ai_messages (historico de atendimento)
 *   4. crm_timeline (timeline unificada)
 *   5. crm_data_sources (rastreabilidade de fontes)
 *   6. crm_score_history (evolucao de scores)
 *   7. customer_profiles (dados WhatsApp/UAZAPI)
 *
 * Input: { client_id: string } | { phone: string } | { email: string } | { documento: string }
 * Opcoes: { include_timeline?: boolean, include_scores_history?: boolean, include_whatsapp?: boolean }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth check — aceita user token OU service_role (server-to-server calls)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // Se o token é o service_role_key, é uma chamada server-to-server (ex: copilot-suggest)
  const isServiceRole = token === serviceRoleKey
  if (!isServiceRole) {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const {
      client_id, phone, email, documento,
      include_timeline = true,
      include_scores_history = false,
      include_whatsapp = true,
    } = body

    if (!client_id && !phone && !email && !documento) {
      return new Response(
        JSON.stringify({ error: 'Provide client_id, phone, email, or documento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Resolve client_id
    let clientId = client_id

    if (!clientId) {
      // Usar RPC de busca unificada
      const { data: searchResults } = await supabase.rpc('crm_search_client', {
        p_phone: phone || null,
        p_documento: documento || null,
        p_email: email || null,
        p_name: null,
      })

      if (searchResults && searchResults.length > 0) {
        clientId = searchResults[0].id
      }
    }

    // Fallback: buscar por contato
    if (!clientId && (phone || email)) {
      const contactQuery = supabase
        .from('helpdesk_client_contacts')
        .select('client_id')

      if (phone) {
        const phoneShort = phone.replace(/\D/g, '').slice(-8)
        contactQuery.ilike('phone', `%${phoneShort}%`)
      } else if (email) {
        contactQuery.ilike('email', `%${email}%`)
      }

      const { data: contactData } = await contactQuery.limit(1).maybeSingle()
      if (contactData) {
        clientId = contactData.client_id
      }
    }

    if (!clientId) {
      // Tentar customer_profiles como ultima opcao (dados WhatsApp)
      if (phone) {
        const phoneClean = phone.replace(/\D/g, '')
        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('phone, nome, documento, email, avatar_url, dados_cadastrais')
          .eq('phone', phoneClean)
          .maybeSingle()

        if (profile) {
          return new Response(
            JSON.stringify({
              partial: true,
              source: 'whatsapp_only',
              client: {
                name: profile.nome,
                phone: profile.phone,
                email: profile.email,
                documento: profile.documento,
                avatar_url: profile.avatar_url,
              },
              message: 'Cliente encontrado apenas no WhatsApp, sem vinculo com helpdesk.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(JSON.stringify({ level: 'info', fn: 'customer-360', client_id: clientId }))

    // 2. Fetch all data in parallel
    const queries: Promise<any>[] = [
      // [0] Client
      supabase
        .from('helpdesk_clients')
        .select('*')
        .eq('id', clientId)
        .single(),

      // [1] Contacts
      supabase
        .from('helpdesk_client_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false }),

      // [2] Contracts
      supabase
        .from('helpdesk_client_contracts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),

      // [3] Annotations (latest 10)
      supabase
        .from('helpdesk_client_annotations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10),

      // [4] Conversations (latest 20)
      supabase
        .from('ai_conversations')
        .select('id, status, handler_type, created_at, resolved_at, resolution_summary, ai_resolved, current_agent_id, customer_name, csat_score, ticket_number, tags, communication_channel')
        .eq('helpdesk_client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20),

      // [5] Data sources
      supabase
        .from('crm_data_sources')
        .select('source_system, source_id, last_synced_at, sync_status')
        .eq('client_id', clientId),

      // [6] Client companies (CNPJs)
      supabase
        .from('helpdesk_client_companies')
        .select('id, cnpj, company_name, is_primary, created_at')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false }),

      // [7] Recent messages count (last 30 days)
      (async () => {
        const { data: convIds } = await supabase
          .from('ai_conversations')
          .select('id')
          .eq('helpdesk_client_id', clientId)
        const ids = (convIds || []).map((c: any) => c.id)
        if (ids.length === 0) return { count: 0 }
        return supabase
          .from('ai_messages')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .in('conversation_id', ids)
      })(),
    ]

    // Queries opcionais
    if (include_timeline) {
      // [7] Timeline (latest 30)
      queries.push(
        supabase
          .from('crm_timeline')
          .select('*')
          .eq('client_id', clientId)
          .order('occurred_at', { ascending: false })
          .limit(30)
      )
    }

    if (include_scores_history) {
      // [8] Score history (latest 10 per type)
      queries.push(
        supabase
          .from('crm_score_history')
          .select('score_type, score_value, factors, calculated_at')
          .eq('client_id', clientId)
          .order('calculated_at', { ascending: false })
          .limit(30)
      )
    }

    if (include_whatsapp) {
      // [9] WhatsApp profile
      queries.push((async () => {
        const { data: clientData } = await supabase
          .from('helpdesk_clients')
          .select('phone')
          .eq('id', clientId)
          .single()
        if (!clientData?.phone) return { data: null }
        const phoneClean = clientData.phone.replace(/\D/g, '')
        return supabase
          .from('customer_profiles')
          .select('nome, avatar_url, dados_cadastrais, last_synced_at')
          .eq('phone', phoneClean)
          .maybeSingle()
      })())
    }

    const results = await Promise.all(queries)

    // Fixed results (always present)
    const clientResult = results[0]
    const contactsResult = results[1]
    const contractsResult = results[2]
    const annotationsResult = results[3]
    const conversationsResult = results[4]
    const dataSourcesResult = results[5]
    const companiesResult = results[6]
    const recentMessagesResult = results[7]

    // Dynamic results (optional)
    let idx = 8
    const timelineResult = include_timeline ? results[idx++] : null
    const scoreHistoryResult = include_scores_history ? results[idx++] : null
    const whatsappResult = include_whatsapp ? results[idx++] : null

    const client = clientResult.data
    const contacts = contactsResult.data || []
    const contracts = contractsResult.data || []
    const annotations = annotationsResult.data || []
    const conversations = conversationsResult.data || []
    const dataSources = dataSourcesResult.data || []
    const timeline = timelineResult?.data || []
    const scoreHistory = scoreHistoryResult?.data || []
    const whatsappProfile = whatsappResult?.data || null

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Compute summary metrics
    const totalConversations = conversations.length
    const resolvedConversations = conversations.filter((c: any) => c.status === 'finalizado' || c.status === 'resolved' || c.status === 'closed').length
    const aiResolvedConversations = conversations.filter((c: any) => c.ai_resolved).length
    const csatScores = conversations.filter((c: any) => c.csat_score).map((c: any) => c.csat_score)
    const avgCsat = csatScores.length > 0
      ? Math.round((csatScores.reduce((s: number, v: number) => s + v, 0) / csatScores.length) * 10) / 10
      : null
    const openConversations = conversations.filter((c: any) => c.status !== 'finalizado' && c.status !== 'resolved' && c.status !== 'closed' && c.status !== 'cancelado').length

    // Last interaction
    const lastInteraction = conversations.length > 0 ? conversations[0].created_at : null
    const daysSinceLastInteraction = lastInteraction
      ? Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Active contracts
    const activeContracts = contracts.filter((c: any) => c.status === 'active' || c.status === 'ativo')
    const nearestRenewal = activeContracts
      .filter((c: any) => c.end_date)
      .sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())[0]

    const daysToRenewal = nearestRenewal?.end_date
      ? Math.floor((new Date(nearestRenewal.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    // Channels used
    const channelsUsed = [...new Set(conversations.map((c: any) => c.communication_channel).filter(Boolean))]

    // 4. Compute engagement score (se nao tiver calculado recentemente)
    let engagementScore = client.engagement_score
    if (!client.scores_updated_at || (Date.now() - new Date(client.scores_updated_at).getTime()) > 24 * 60 * 60 * 1000) {
      // Calcular score de engajamento baseado em atividade recente
      const recencyFactor = daysSinceLastInteraction !== null
        ? Math.max(0, 100 - daysSinceLastInteraction * 2)
        : 0
      const frequencyFactor = Math.min(100, (recentMessagesResult.count || 0) * 5)
      const csatFactor = avgCsat ? avgCsat * 20 : 50
      const contractFactor = activeContracts.length > 0 ? 80 : 20

      engagementScore = Math.round(
        recencyFactor * 0.3 + frequencyFactor * 0.25 + csatFactor * 0.25 + contractFactor * 0.2
      )

      // Salvar score atualizado (fire-and-forget)
      supabase.from('helpdesk_clients').update({
        engagement_score: engagementScore,
        scores_updated_at: new Date().toISOString(),
      }).eq('id', clientId).then(() => {}, () => {})

      // Registrar no historico
      supabase.from('crm_score_history').insert({
        client_id: clientId,
        score_type: 'engagement',
        score_value: engagementScore,
        factors: { recency: recencyFactor, frequency: frequencyFactor, csat: csatFactor, contracts: contractFactor },
      }).then(() => {}, () => {})
    }

    // 5. Build response
    const customer360 = {
      client: {
        ...client,
        contacts,
        avatar_url: client.avatar_url || whatsappProfile?.avatar_url || null,
      },
      contracts: {
        all: contracts,
        active_count: activeContracts.length,
        nearest_renewal: nearestRenewal || null,
        days_to_renewal: daysToRenewal,
        total_mrr: activeContracts.reduce((s: number, c: any) => s + (parseFloat(c.value || c.monthly_value || '0') || 0), 0),
      },
      annotations,
      health: {
        score: client.health_score ?? null,
        engagement_score: engagementScore ?? null,
        churn_risk: client.churn_risk ?? false,
        debt_total: client.debt_total ?? 0,
        pending_invoices: client.pending_invoices_count ?? 0,
      },
      conversations: {
        recent: conversations.slice(0, 10),
        total: totalConversations,
        resolved: resolvedConversations,
        ai_resolved: aiResolvedConversations,
        open: openConversations,
        avg_csat: avgCsat,
        channels_used: channelsUsed,
      },
      activity: {
        last_interaction: lastInteraction,
        days_since_last_interaction: daysSinceLastInteraction,
        messages_last_30_days: recentMessagesResult.count || 0,
      },
      lifecycle: {
        stage: client.lifecycle_stage || 'active',
        customer_since: client.customer_since || client.created_at,
        segment: client.segment || null,
        nps_score: client.nps_score ?? null,
        mrr: client.mrr_total ?? client.mrr ?? null,
        tier: client.customer_tier || 'starter',
        plan_level: client.plan_level || null,
        sistema: client.sistema || null,
      },
      data_sources: dataSources.map((ds: any) => ({
        system: ds.source_system,
        id: ds.source_id,
        synced_at: ds.last_synced_at,
        status: ds.sync_status,
      })),
      companies: (companiesResult?.data || []).map((c: any) => ({
        id: c.id,
        cnpj: c.cnpj,
        company_name: c.company_name,
        is_primary: c.is_primary,
      })),
      // Campos opcionais
      ...(include_timeline ? { timeline } : {}),
      ...(include_scores_history ? {
        scores_history: {
          health: scoreHistory.filter((s: any) => s.score_type === 'health'),
          engagement: scoreHistory.filter((s: any) => s.score_type === 'engagement'),
          churn_risk: scoreHistory.filter((s: any) => s.score_type === 'churn_risk'),
        }
      } : {}),
      ...(include_whatsapp && whatsappProfile ? {
        whatsapp: {
          name: whatsappProfile.nome,
          avatar_url: whatsappProfile.avatar_url,
          synced_at: whatsappProfile.last_synced_at,
        }
      } : {}),
    }

    console.log(JSON.stringify({
      level: 'info', fn: 'customer-360',
      client: client.name || clientId,
      health: customer360.health.score,
      engagement: engagementScore,
      conversations: totalConversations,
    }))

    return new Response(JSON.stringify(customer360), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'customer-360', error: errorMessage }))
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
