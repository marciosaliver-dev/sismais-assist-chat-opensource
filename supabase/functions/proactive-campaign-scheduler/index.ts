import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Proactive Campaign Scheduler
 *
 * Runs every 10 minutes (via cron). For each active campaign:
 * 1. Checks if it's time to run based on schedule
 * 2. Identifies target clients using target_rules
 * 3. Creates a campaign_execution record
 * 4. For auto campaigns: immediately invokes proactive-campaign-executor
 * 5. For approval_required campaigns: creates execution in 'pending' status
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('[campaign-scheduler] Starting campaign evaluation...')
    const now = new Date()

    // Fetch active campaigns due for execution
    const { data: campaigns, error: campError } = await supabase
      .from('proactive_campaigns')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'active')
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)

    if (campError) throw campError
    if (!campaigns || campaigns.length === 0) {
      console.log('[campaign-scheduler] No campaigns due for execution')
      return jsonResponse({ scheduled: 0 })
    }

    console.log(`[campaign-scheduler] Found ${campaigns.length} campaigns to evaluate`)

    let scheduled = 0
    let pendingApproval = 0

    for (const campaign of campaigns) {
      try {
        // Check daily limit
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { count: todayContacts } = await supabase
          .from('campaign_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .gte('created_at', todayStart.toISOString())

        if ((todayContacts ?? 0) >= (campaign.max_contacts_per_day ?? 200)) {
          console.log(`[campaign-scheduler] Campaign ${campaign.name}: daily limit reached (${todayContacts})`)
          continue
        }

        // Identify target clients
        const targets = await identifyTargets(supabase, campaign)
        if (targets.length === 0) {
          console.log(`[campaign-scheduler] Campaign ${campaign.name}: no targets found`)
          await updateNextRun(supabase, campaign)
          continue
        }

        // Limit to max_contacts_per_run
        const limitedTargets = targets.slice(0, campaign.max_contacts_per_run ?? 50)
        console.log(`[campaign-scheduler] Campaign ${campaign.name}: ${limitedTargets.length} targets identified`)

        // Create execution record
        const requiresApproval = campaign.approval_mode === 'approval_required'
        const execStatus = requiresApproval ? 'pending' : 'approved'

        const { data: execution, error: execError } = await supabase
          .from('campaign_executions')
          .insert({
            campaign_id: campaign.id,
            status: execStatus,
            requires_approval: requiresApproval,
            total_targets: limitedTargets.length,
          })
          .select()
          .single()

        if (execError) throw execError

        // Create contact records
        const contactInserts = limitedTargets.map(t => ({
          execution_id: execution.id,
          campaign_id: campaign.id,
          helpdesk_client_id: t.id,
          contact_phone: t.phone,
          contact_name: t.name,
          status: 'pending' as const,
          ai_context: {
            company_name: t.company_name,
            subscribed_product: t.subscribed_product,
            contract_plan: t.plan_name,
            contract_status: t.contract_status,
            last_conversation_date: t.last_conversation_date,
            days_inactive: t.days_inactive,
            debt_amount: t.debt_amount,
          },
        }))

        const { error: contactsError } = await supabase
          .from('campaign_contacts')
          .insert(contactInserts)

        if (contactsError) throw contactsError

        // Log activity
        await supabase.from('campaign_activity_log').insert({
          campaign_id: campaign.id,
          execution_id: execution.id,
          action: requiresApproval ? 'execution_pending_approval' : 'execution_scheduled',
          details: { total_targets: limitedTargets.length },
          actor_type: 'system',
        })

        // If auto-approval, invoke executor immediately
        if (!requiresApproval) {
          supabase.functions.invoke('proactive-campaign-executor', {
            body: { execution_id: execution.id }
          }).catch(err => console.error(`[campaign-scheduler] Executor invoke error:`, err.message))
          scheduled++
        } else {
          pendingApproval++
        }

        // Update next_run_at
        await updateNextRun(supabase, campaign)

      } catch (err: any) {
        console.error(`[campaign-scheduler] Error processing campaign ${campaign.name}:`, err.message)
        await supabase.from('campaign_activity_log').insert({
          campaign_id: campaign.id,
          action: 'scheduler_error',
          details: { error: err.message },
          actor_type: 'system',
        })
      }
    }

    console.log(`[campaign-scheduler] Done. Scheduled: ${scheduled}, Pending approval: ${pendingApproval}`)
    return jsonResponse({ scheduled, pendingApproval })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[campaign-scheduler] Fatal error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Identify target clients based on campaign rules
async function identifyTargets(supabase: any, campaign: any): Promise<any[]> {
  const rules = campaign.target_rules || []
  const campaignType = campaign.campaign_type

  // Base query: clients with phone numbers
  const query = supabase
    .from('helpdesk_clients')
    .select(`
      id, name, phone, email, company_name, subscribed_product, cnpj,
      helpdesk_client_contracts!inner(plan_name, status, value, end_date)
    `)
    .not('phone', 'is', null)

  // Apply campaign-type-specific logic
  switch (campaignType) {
    case 'follow_up':
      return await getFollowUpTargets(supabase, campaign, rules)
    case 'billing':
      return await getBillingTargets(supabase, campaign, rules)
    case 'onboarding':
      return await getOnboardingTargets(supabase, campaign, rules)
    case 'reactivation':
      return await getReactivationTargets(supabase, campaign, rules)
    case 'health_check':
      return await getHealthCheckTargets(supabase, campaign, rules)
    default:
      return await getGenericTargets(supabase, rules)
  }
}

// Follow-up: clients with recently resolved conversations
async function getFollowUpTargets(supabase: any, campaign: any, rules: any[]): Promise<any[]> {
  const hoursAfterClose = getRule(rules, 'hours_after_close', 24)
  const cutoff = new Date(Date.now() - hoursAfterClose * 60 * 60 * 1000).toISOString()
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Find conversations resolved in the target window
  const { data: conversations } = await supabase
    .from('ai_conversations')
    .select('id, customer_phone, customer_name, helpdesk_client_id, resolved_at')
    .in('status', ['finalizado', 'resolvida'])
    .gte('resolved_at', recentCutoff)
    .lte('resolved_at', cutoff)
    .not('customer_phone', 'is', null)

  if (!conversations?.length) return []

  // Exclude those already contacted by this campaign recently
  const targets = await filterRecentlyContacted(supabase, campaign.id, conversations.map((c: any) => ({
    id: c.helpdesk_client_id,
    name: c.customer_name,
    phone: c.customer_phone,
    last_conversation_date: c.resolved_at,
  })), campaign.min_hours_between_contacts ?? 24)

  return targets
}

// Billing: clients with overdue invoices
async function getBillingTargets(supabase: any, campaign: any, rules: any[]): Promise<any[]> {
  // Query Sismais Admin for overdue clients
  const { data: adminResult, error: adminErr } = await supabase.functions.invoke('sismais-admin-proxy', {
    body: { action: 'clients' }
  })

  if (adminErr || !adminResult?.data) return []

  const overdueClients = adminResult.data.filter((c: any) => c.divida_total > 0)
  const minDebt = getRule(rules, 'min_debt_amount', 0)

  // Match with local helpdesk clients
  const targets: any[] = []
  for (const oc of overdueClients) {
    if (oc.divida_total < minDebt) continue

    const { data: localClient } = await supabase
      .from('helpdesk_clients')
      .select('id, name, phone, company_name, subscribed_product')
      .or(`cnpj.eq.${oc.documento},email.eq.${oc.email}`)
      .not('phone', 'is', null)
      .limit(1)
      .maybeSingle()

    if (localClient) {
      targets.push({
        ...localClient,
        debt_amount: oc.divida_total,
        contract_status: oc.status_geral,
      })
    }
  }

  return await filterRecentlyContacted(supabase, campaign.id, targets, campaign.min_hours_between_contacts ?? 48)
}

// Onboarding: new clients (created recently, no conversations yet)
async function getOnboardingTargets(supabase: any, campaign: any, rules: any[]): Promise<any[]> {
  const daysNew = getRule(rules, 'days_since_created', 7)
  const cutoff = new Date(Date.now() - daysNew * 24 * 60 * 60 * 1000).toISOString()

  const { data: clients } = await supabase
    .from('helpdesk_clients')
    .select('id, name, phone, company_name, subscribed_product')
    .gte('created_at', cutoff)
    .not('phone', 'is', null)

  if (!clients?.length) return []

  // Exclude those who already have conversations
  const targets: any[] = []
  for (const client of clients) {
    const { count } = await supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('helpdesk_client_id', client.id)

    if ((count ?? 0) <= 1) {
      targets.push({ ...client, days_inactive: 0 })
    }
  }

  return await filterRecentlyContacted(supabase, campaign.id, targets, campaign.min_hours_between_contacts ?? 24)
}

// Reactivation: clients with no recent conversations
async function getReactivationTargets(supabase: any, campaign: any, rules: any[]): Promise<any[]> {
  const daysInactive = getRule(rules, 'days_inactive', 30)
  const cutoff = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString()

  const { data: clients } = await supabase
    .from('helpdesk_clients')
    .select('id, name, phone, company_name, subscribed_product')
    .not('phone', 'is', null)

  if (!clients?.length) return []

  const targets: any[] = []
  for (const client of clients) {
    const { data: lastConv } = await supabase
      .from('ai_conversations')
      .select('created_at')
      .eq('helpdesk_client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastDate = lastConv?.created_at || client.created_at
    if (lastDate && new Date(lastDate) < new Date(cutoff)) {
      const diffMs = Date.now() - new Date(lastDate).getTime()
      targets.push({
        ...client,
        days_inactive: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
        last_conversation_date: lastDate,
      })
    }
  }

  return await filterRecentlyContacted(supabase, campaign.id, targets, campaign.min_hours_between_contacts ?? 72)
}

// Health check: periodic check-in with active clients
async function getHealthCheckTargets(supabase: any, campaign: any, rules: any[]): Promise<any[]> {
  const { data: clients } = await supabase
    .from('helpdesk_clients')
    .select('id, name, phone, company_name, subscribed_product')
    .not('phone', 'is', null)

  if (!clients?.length) return []

  return await filterRecentlyContacted(supabase, campaign.id, clients, campaign.min_hours_between_contacts ?? 168) // 7 days default
}

// Generic filter based on target_rules
async function getGenericTargets(supabase: any, rules: any[]): Promise<any[]> {
  let query = supabase
    .from('helpdesk_clients')
    .select('id, name, phone, company_name, subscribed_product')
    .not('phone', 'is', null)

  // Apply basic filter rules
  for (const rule of rules) {
    if (rule.field && rule.op && rule.value !== undefined) {
      switch (rule.op) {
        case 'eq': query = query.eq(rule.field, rule.value); break
        case 'neq': query = query.neq(rule.field, rule.value); break
        case 'like': query = query.ilike(rule.field, `%${rule.value}%`); break
      }
    }
  }

  const { data } = await query.limit(100)
  return data || []
}

// Filter out clients already contacted recently by this campaign
async function filterRecentlyContacted(
  supabase: any,
  campaignId: string,
  targets: any[],
  minHours: number
): Promise<any[]> {
  if (!targets.length) return []

  const cutoff = new Date(Date.now() - minHours * 60 * 60 * 1000).toISOString()
  const clientIds = targets.filter(t => t.id).map(t => t.id)
  const phones = targets.map(t => t.phone).filter(Boolean)

  // Check recent contacts
  const { data: recentContacts } = await supabase
    .from('campaign_contacts')
    .select('helpdesk_client_id, contact_phone')
    .eq('campaign_id', campaignId)
    .gte('created_at', cutoff)
    .in('status', ['sent', 'delivered', 'replied', 'converted'])

  if (!recentContacts?.length) return targets

  const contactedIds = new Set(recentContacts.map((c: any) => c.helpdesk_client_id))
  const contactedPhones = new Set(recentContacts.map((c: any) => c.contact_phone))

  return targets.filter(t =>
    !contactedIds.has(t.id) && !contactedPhones.has(t.phone)
  )
}

// Get a rule value from target_rules array
function getRule(rules: any[], key: string, defaultValue: any): any {
  const rule = rules.find((r: any) => r.field === key)
  return rule?.value ?? defaultValue
}

// Update next_run_at based on schedule_cron (simplified interval-based)
async function updateNextRun(supabase: any, campaign: any): Promise<void> {
  const cron = campaign.schedule_cron
  if (!cron) return

  // Simple cron parsing for common patterns
  let nextRun: Date | null = null
  const now = new Date()

  if (cron.match(/^\*\/(\d+) \* \* \* \*$/)) {
    // Every N minutes
    const minutes = parseInt(cron.match(/^\*\/(\d+)/)?.[1] || '60')
    nextRun = new Date(now.getTime() + minutes * 60 * 1000)
  } else if (cron.match(/^0 (\d+) \* \* \*$/)) {
    // Daily at hour H
    const hour = parseInt(cron.match(/^0 (\d+)/)?.[1] || '9')
    nextRun = new Date(now)
    nextRun.setHours(hour, 0, 0, 0)
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1)
  } else if (cron.match(/^0 (\d+) \* \* (\d[\-\d,]*)$/)) {
    // Weekdays at hour H
    const hour = parseInt(cron.match(/^0 (\d+)/)?.[1] || '9')
    nextRun = new Date(now)
    nextRun.setHours(hour, 0, 0, 0)
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1)
    // Skip weekends
    while (nextRun.getDay() === 0 || nextRun.getDay() === 6) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
  } else {
    // Default: next day at 9am
    nextRun = new Date(now)
    nextRun.setDate(nextRun.getDate() + 1)
    nextRun.setHours(9, 0, 0, 0)
  }

  if (nextRun) {
    await supabase
      .from('proactive_campaigns')
      .update({ next_run_at: nextRun.toISOString(), last_run_at: now.toISOString() })
      .eq('id', campaign.id)
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
