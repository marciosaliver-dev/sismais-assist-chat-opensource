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
    const { conversation_id, customer_phone, documento, email, whatsapp_instance_id } = await req.json()

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[auto-link] Starting for conversation ${conversation_id}, phone: ${customer_phone ? customer_phone.slice(0, -4) + '****' : 'none'}, documento: ${documento ? '***masked***' : 'none'}, email: ${email ? email.split('@')[0].slice(0, 2) + '***@' + email.split('@')[1] : 'none'}`)

    // 1. Check if already linked
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('helpdesk_client_id, uazapi_chat_id, context, human_agent_id')
      .eq('id', conversation_id)
      .single()

    if (conv?.helpdesk_client_id) {
      console.log(`[auto-link] Already linked to client ${conv.helpdesk_client_id}`)
      return new Response(JSON.stringify({ success: true, already_linked: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === BRANCH: Search by documento or email (when customer replied with identification data) ===
    if (documento || email) {
      return await handleIdentificationSearch(supabase, conversation_id, documento || null, email || null, conv, whatsapp_instance_id)
    }

    // === BRANCH: Search by phone (initial auto-link) ===
    if (!customer_phone) {
      return new Response(JSON.stringify({ error: 'customer_phone or documento required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Normalize phone
    const phoneDigits = customer_phone.replace(/\D/g, '')
    const phoneShort = phoneDigits.length > 8 ? phoneDigits.slice(-8) : phoneDigits
    console.log(`[auto-link] Normalized phone: ${phoneDigits}, short: ${phoneShort}`)

    // 3. Search local helpdesk_clients by phone
    const { data: localClients } = await supabase
      .from('helpdesk_clients')
      .select('id, name, phone, cnpj')
      .or(`phone.ilike.%${phoneShort}%`)
      .limit(5)

    if (localClients && localClients.length === 1) {
      console.log(`[auto-link] Found local client: ${localClients[0].name} (${localClients[0].id})`)
      await linkClient(supabase, conversation_id, localClients[0].id, localClients[0].name, 'local')
      await checkAndNotifyDebt(supabase, conversation_id, localClients[0].id, localClients[0].cnpj, conv)
      return new Response(JSON.stringify({ success: true, source: 'local_client', client_id: localClients[0].id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Search local helpdesk_client_contacts by phone
    if (!localClients || localClients.length === 0) {
      const { data: localContacts } = await supabase
        .from('helpdesk_client_contacts')
        .select('id, client_id, name, phone')
        .or(`phone.ilike.%${phoneShort}%`)
        .limit(5)

      if (localContacts && localContacts.length === 1) {
        const { data: clientData } = await supabase
          .from('helpdesk_clients')
          .select('id, name, cnpj')
          .eq('id', localContacts[0].client_id)
          .single()

        if (clientData) {
          console.log(`[auto-link] Found via local contact: ${clientData.name} (${clientData.id})`)
          await linkClient(supabase, conversation_id, clientData.id, clientData.name, 'local_contact')
          await checkAndNotifyDebt(supabase, conversation_id, clientData.id, clientData.cnpj, conv)
          return new Response(JSON.stringify({ success: true, source: 'local_contact', client_id: clientData.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // 5. Search Sismais Admin
    console.log(`[auto-link] No local match, searching Sismais Admin...`)
    const { data: sismaisResult, error: sismaisError } = await supabase.functions.invoke(
      'sismais-admin-proxy',
      { body: { action: 'clients', search: phoneDigits } }
    )

    if (sismaisError) {
      console.error(`[auto-link] Sismais Admin search error:`, sismaisError)
      return new Response(JSON.stringify({ success: false, error: 'sismais_search_failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sismaisClients = sismaisResult?.data || []
    console.log(`[auto-link] Sismais Admin returned ${sismaisClients.length} results`)

    if (sismaisClients.length === 0) {
      console.log(`[auto-link] No results, requesting identification from customer...`)
      await requestIdentification(supabase, conversation_id, conv)
      return new Response(JSON.stringify({ success: true, requested_identification: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (sismaisClients.length > 1) {
      console.log(`[auto-link] Multiple results (${sismaisClients.length}), skipping auto-link`)
      return new Response(JSON.stringify({ success: true, skipped: true, results_count: sismaisClients.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. Exactly 1 result - upsert client and link
    const sismaisClient = sismaisClients[0]
    const clientId = await upsertSismaisClient(supabase, sismaisClient, customer_phone)

    if (!clientId) {
      console.error(`[auto-link] Failed to create/find client`)
      return new Response(JSON.stringify({ success: false, error: 'client_creation_failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await importContracts(supabase, clientId, sismaisClient.documento)
    await syncFinancialData(supabase, clientId, sismaisClient)
    await syncGlLicenseData(supabase, clientId, customer_phone, sismaisClient.documento, sismaisClient.email, conversation_id)
    await linkClient(supabase, conversation_id, clientId, sismaisClient.nome, 'sismais_admin')
    await checkAndNotifyDebt(supabase, conversation_id, clientId, sismaisClient.documento, conv)

    return new Response(JSON.stringify({ success: true, source: 'sismais_admin', client_id: clientId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auto-link] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// === Handle identification search by documento and/or email ===
async function handleIdentificationSearch(
  supabase: any,
  conversationId: string,
  documento: string | null,
  email: string | null,
  conv: any,
  instanceId?: string | null
) {
  const { data: convFull } = await supabase
    .from('ai_conversations')
    .select('customer_phone')
    .eq('id', conversationId)
    .single()

  // Try by documento first
  if (documento) {
    const docDigits = documento.replace(/\D/g, '')
    console.log(`[auto-link] Searching Sismais Admin by documento: ${docDigits}`)

    const { data: docResult, error: docError } = await supabase.functions.invoke(
      'sismais-admin-proxy',
      { body: { action: 'clients', search: docDigits } }
    )

    if (!docError && (docResult?.data || []).length > 0) {
      const sismaisClient = docResult.data[0]
      const clientId = await upsertSismaisClient(supabase, sismaisClient, convFull?.customer_phone)
      if (clientId) {
        await importContracts(supabase, clientId, sismaisClient.documento)
        await syncGlLicenseData(supabase, clientId, convFull?.customer_phone, sismaisClient.documento, sismaisClient.email, conversationId)
        await linkClient(supabase, conversationId, clientId, sismaisClient.nome, 'sismais_admin_documento')
        await checkAndNotifyDebt(supabase, conversationId, clientId, sismaisClient.documento, conv)
        await clearAwaitingFlag(supabase, conversationId, conv)
        console.log(`[auto-link] Linked client via documento: ${sismaisClient.nome}`)
        return new Response(JSON.stringify({ success: true, source: 'sismais_admin_documento', client_id: clientId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (docError) {
      console.error(`[auto-link] Documento search error:`, docError)
    } else {
      console.log(`[auto-link] No results for documento ${docDigits}`)
    }
  }

  // Try by email as fallback
  if (email) {
    console.log(`[auto-link] Searching Sismais Admin by email: ${email}`)

    const { data: emailResult, error: emailError } = await supabase.functions.invoke(
      'sismais-admin-proxy',
      { body: { action: 'clients', search: email } }
    )

    if (!emailError && (emailResult?.data || []).length > 0) {
      const sismaisClient = emailResult.data[0]
      const clientId = await upsertSismaisClient(supabase, sismaisClient, convFull?.customer_phone)
      if (clientId) {
        await importContracts(supabase, clientId, sismaisClient.documento)
        await syncGlLicenseData(supabase, clientId, convFull?.customer_phone, sismaisClient.documento, sismaisClient.email, conversationId)
        await linkClient(supabase, conversationId, clientId, sismaisClient.nome, 'sismais_admin_email')
        await checkAndNotifyDebt(supabase, conversationId, clientId, sismaisClient.documento, conv)
        await clearAwaitingFlag(supabase, conversationId, conv)
        console.log(`[auto-link] Linked client via email: ${sismaisClient.nome}`)
        return new Response(JSON.stringify({ success: true, source: 'sismais_admin_email', client_id: clientId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (emailError) {
      console.error(`[auto-link] Email search error:`, emailError)
    } else {
      console.log(`[auto-link] No results for email ${email}`)
    }
  }

  // Not found — clear flag, let agent inform the customer
  await clearAwaitingFlag(supabase, conversationId, conv)
  console.log(`[auto-link] Client not found by documento/email, cleared identification flag`)
  return new Response(JSON.stringify({ success: true, not_found: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// === Check debt and notify agent ===
async function checkAndNotifyDebt(
  supabase: any,
  conversationId: string,
  clientId: string,
  documento: string | null,
  conv: any
) {
  if (!documento) return

  try {
    console.log(`[auto-link] Checking debt for documento: ${documento}`)
    const { data: invoicesResult, error: invoicesError } = await supabase.functions.invoke(
      'sismais-admin-proxy',
      { body: { action: 'invoices', documento } }
    )

    if (invoicesError) {
      console.error(`[auto-link] Invoice check error:`, invoicesError)
      return
    }

    const invoices = invoicesResult?.data || []
    const pendingInvoices = invoices.filter((inv: any) => {
      const status = inv.status?.toLowerCase() || ''
      return status !== 'pago' && status !== 'paid'
    })

    if (pendingInvoices.length === 0) {
      console.log(`[auto-link] No pending invoices`)
      return
    }

    // Filter only invoices with 3+ days overdue
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const overdueInvoices = pendingInvoices.filter((inv: any) => {
      const dueDateStr = inv.data_vencimento || inv.vencimento
      if (!dueDateStr) return false
      const dueDate = new Date(dueDateStr)
      return (now - dueDate.getTime()) >= THREE_DAYS_MS
    })

    if (overdueInvoices.length === 0) {
      console.log(`[auto-link] Pending invoices exist but none with 3+ days overdue, skipping debt alert`)
      return
    }

    const debtTotal = overdueInvoices.reduce((sum: number, inv: any) => {
      return sum + (parseFloat(inv.valor || inv.valor_liquido || '0') || 0)
    }, 0)

    if (debtTotal <= 0) return

    // Calculate max overdue days
    const maxOverdueDays = Math.max(...overdueInvoices.map((inv: any) => {
      const dueDateStr = inv.data_vencimento || inv.vencimento
      if (!dueDateStr) return 0
      return Math.floor((now - new Date(dueDateStr).getTime()) / (24 * 60 * 60 * 1000))
    }))

    const formattedDebt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debtTotal)
    console.log(`[auto-link] Client has debt: ${formattedDebt} (${overdueInvoices.length} invoices, max ${maxOverdueDays} days overdue)`)

    // 1. Update conversation context with debt info (only 3+ days overdue)
    const currentContext = (conv?.context as Record<string, any>) || {}
    await supabase
      .from('ai_conversations')
      .update({
        context: {
          ...currentContext,
          debt_total: debtTotal,
          pending_invoices_count: overdueInvoices.length,
          max_overdue_days: maxOverdueDays,
          debt_checked_at: new Date().toISOString(),
        }
      })
      .eq('id', conversationId)

    // 2. Insert system message about debt
    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'system',
      content: `⚠️ Cliente com dívida de ${formattedDebt} — ${overdueInvoices.length} fatura(s) com ${maxOverdueDays} dia(s) de atraso. Comunicar ao cliente sobre a pendência financeira.`,
    })

    // 3. If human agent assigned, create notification
    if (conv?.human_agent_id) {
      const { data: agent } = await supabase
        .from('human_agents')
        .select('user_id')
        .eq('id', conv.human_agent_id)
        .single()

      if (agent?.user_id) {
        await supabase.from('notifications').insert({
          user_id: agent.user_id,
          type: 'system',
          title: 'Cliente com dívida',
          message: `Cliente vinculado à conversa possui dívida de ${formattedDebt} (${pendingInvoices.length} fatura(s) pendente(s)). Comunique ao cliente sobre a pendência.`,
          priority: 'high',
          metadata: { conversation_id: conversationId, client_id: clientId, debt_total: debtTotal },
        }).then(({ error }: { error: any }) => {
          if (error) console.error('[auto-link] Notification insert error:', error)
          else console.log('[auto-link] Debt notification created for agent')
        })
      }
    }

  } catch (err) {
    console.error(`[auto-link] Debt check error:`, err)
  }
}

// === Request identification from customer (set flag only, agent handles messaging) ===
async function requestIdentification(supabase: any, conversationId: string, conv: any) {
  const currentContext = (conv?.context as Record<string, any>) || {}
  await supabase
    .from('ai_conversations')
    .update({ context: { ...currentContext, awaiting_client_identification: true } })
    .eq('id', conversationId)
  console.log(`[auto-link] Set awaiting_client_identification flag — agent will request data`)
}

// === Clear awaiting identification flag ===
async function clearAwaitingFlag(supabase: any, conversationId: string, conv: any) {
  const currentContext = (conv?.context as Record<string, any>) || {}
  const { awaiting_client_identification, awaiting_client_cnpj, ...rest } = currentContext
  await supabase
    .from('ai_conversations')
    .update({ context: Object.keys(rest).length > 0 ? rest : null })
    .eq('id', conversationId)
}

// === Send WhatsApp message and log to ai_messages ===
async function sendWhatsAppAndLog(supabase: any, conversationId: string, conv: any, message: string, instanceId?: string | null) {
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: message,
  })

  let chatJid = conv?.uazapi_chat_id
  if (!chatJid) {
    const { data: convData } = await supabase
      .from('ai_conversations')
      .select('uazapi_chat_id')
      .eq('id', conversationId)
      .single()
    if (!convData?.uazapi_chat_id) {
      console.log(`[auto-link] No uazapi_chat_id, skipping WhatsApp send`)
      return
    }
    chatJid = convData.uazapi_chat_id
  }

  await sendViaUazapi(supabase, chatJid, message, conversationId, instanceId)
}

async function sendViaUazapi(supabase: any, chatJid: string, message: string, conversationId?: string, instanceId?: string | null) {
  try {
    let inst: any = null

    // 0. Priority: use whatsapp_instance_id if provided
    if (instanceId) {
      const { data: instById } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('id', instanceId)
        .eq('is_active', true)
        .maybeSingle()
      inst = instById
      if (inst) console.log(`[auto-link] Using provided instance: ${inst.instance_name}`)
    }

    // 1. Try to find instance via conversation's whatsapp_instance_id
    if (!inst && conversationId) {
      const { data: convInst } = await supabase
        .from('ai_conversations')
        .select('whatsapp_instance_id')
        .eq('id', conversationId)
        .single()
      if (convInst?.whatsapp_instance_id) {
        const { data: instByConv } = await supabase
          .from('uazapi_instances')
          .select('*')
          .eq('id', convInst.whatsapp_instance_id)
          .eq('is_active', true)
          .maybeSingle()
        inst = instByConv
        if (inst) console.log(`[auto-link] Using conversation instance: ${inst.instance_name}`)
      }
    }

    // 2. Try to find instance via uazapi_chats
    const { data: chatRecord } = await supabase
      .from('uazapi_chats')
      .select('instance_id, chat_id, contact_phone')
      .eq('chat_id', chatJid)
      .limit(1)
      .maybeSingle()

    if (!inst && chatRecord?.instance_id) {
      const { data: foundInst } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('id', chatRecord.instance_id)
        .eq('is_active', true)
        .single()
      inst = foundInst
    }

    // 3. Fallback: first active instance
    if (!inst) {
      const { data: instances } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
      inst = instances?.[0] || null
    }

    if (!inst) {
      console.log(`[auto-link] No active UAZAPI instance found`)
      return
    }

    const apiUrl = inst.api_url.replace(/\/$/, '')

    // Resolve recipient: use phone number format for /send/text
    let recipient = chatJid
    // If chatJid is not a phone@s.whatsapp.net format, resolve it
    if (!chatJid.includes('@s.whatsapp.net')) {
      // Try to get phone from chat record or conversation
      const phone = chatRecord?.contact_phone
      if (phone && /^\d{8,}/.test(phone)) {
        recipient = `${phone}@s.whatsapp.net`
      } else if (conversationId) {
        const { data: convRecord } = await supabase
          .from('ai_conversations')
          .select('customer_phone')
          .eq('id', conversationId)
          .single()
        if (convRecord?.customer_phone && /^\d{8,}/.test(convRecord.customer_phone)) {
          recipient = `${convRecord.customer_phone}@s.whatsapp.net`
        }
      }
    }

    console.log(`[auto-link] Sending via instance ${inst.instance_name} to ${recipient}`)

    const sendResponse = await fetch(`${apiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
      body: JSON.stringify({ number: recipient, text: message })
    })

    const sendResult = await sendResponse.json()
    console.log(`[auto-link] WhatsApp message sent:`, JSON.stringify(sendResult).substring(0, 200))

    const msgId = sendResult?.key?.id || sendResult?.id
    if (msgId) {
      // Find the chat DB id for the uazapi_messages insert
      const chatDbId = chatRecord?.instance_id ? chatJid : null
      const { data: chatForInsert } = await supabase
        .from('uazapi_chats')
        .select('id')
        .eq('instance_id', inst.id)
        .eq('chat_id', chatJid)
        .maybeSingle()

      await supabase.from('uazapi_messages').insert({
        message_id: msgId,
        instance_id: inst.id,
        chat_id: chatForInsert?.id || null,
        type: 'text',
        text_body: message,
        from_me: true,
        sender_name: inst.profile_name || 'AI Assistant',
        timestamp: new Date().toISOString(),
        status: 'sent'
      })

      // Update ai_messages with uazapi_message_id for delivery tracking
      if (conversationId) {
        await supabase
          .from('ai_messages')
          .update({ uazapi_message_id: msgId, delivery_status: 'sent' })
          .eq('conversation_id', conversationId)
          .eq('content', message)
          .is('uazapi_message_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
      }
    }
  } catch (err) {
    console.error(`[auto-link] WhatsApp send error:`, err)
  }
}

// === Upsert Sismais client to helpdesk_clients ===
async function upsertSismaisClient(supabase: any, sismaisClient: any, customerPhone: string | null): Promise<string | null> {
  let clientId: string | null = null

  if (sismaisClient.documento) {
    const { data: existingByDoc } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .or(`cnpj.eq.${sismaisClient.documento},cpf.eq.${sismaisClient.documento}`)
      .limit(1)
      .maybeSingle()

    if (existingByDoc) {
      clientId = existingByDoc.id
      await supabase.from('helpdesk_clients').update({
        name: sismaisClient.nome || undefined,
        email: sismaisClient.email || undefined,
        phone: sismaisClient.telefone || customerPhone,
        updated_at: new Date().toISOString(),
      }).eq('id', clientId)
      console.log(`[auto-link] Updated existing client ${clientId}`)
    }
  }

  if (!clientId) {
    const isCnpj = (sismaisClient.documento || '').replace(/\D/g, '').length > 11
    const { data: newClient } = await supabase
      .from('helpdesk_clients')
      .insert({
        name: sismaisClient.nome || 'Cliente Sismais',
        email: sismaisClient.email || null,
        phone: sismaisClient.telefone || customerPhone,
        cnpj: isCnpj ? sismaisClient.documento : null,
        cpf: !isCnpj ? sismaisClient.documento : null,
        company_name: sismaisClient.nome || null,
        external_id: sismaisClient.documento || null,
      })
      .select('id')
      .single()

    clientId = newClient?.id || null
    console.log(`[auto-link] Created new client ${clientId}`)
  }

  return clientId
}

// === Import contracts from Sismais Admin ===
async function importContracts(supabase: any, clientId: string, documento: string | null) {
  if (!documento) return

  try {
    const { data: contractsResult } = await supabase.functions.invoke(
      'sismais-admin-proxy',
      { body: { action: 'contracts', documento } }
    )

    const contracts = contractsResult?.data || []
    console.log(`[auto-link] Found ${contracts.length} contracts to import`)

    for (const c of contracts) {
      const isActive = c.status?.toLowerCase() === 'ativo' || c.status?.toLowerCase() === 'active'
      await supabase.from('helpdesk_client_contracts').upsert({
        client_id: clientId,
        contract_number: c.id_contrato || c.id || null,
        plan_name: c.plano || c.descricao || c.plataforma || 'N/A',
        value: parseFloat(c.mrr || c.valor_assinatura || '0') || null,
        status: isActive ? 'active' : 'cancelled',
        start_date: c.data_inicio || null,
        end_date: c.data_fim || null,
        notes: `Plataforma: ${c.plataforma || 'N/A'}`,
      }, { onConflict: 'client_id,contract_number', ignoreDuplicates: true })
    }
  } catch (err) {
    console.error(`[auto-link] Contract import error:`, err)
  }
}

// === Sync financial/license data when linking ===
async function syncFinancialData(supabase: any, clientId: string, sismaisClient: any) {
  try {
    const mrrTotal = sismaisClient.mrr_total || 0
    const contratosAtivos = sismaisClient.contratos_ativos || 0

    const updateData: Record<string, any> = {
      license_status: contratosAtivos > 0 ? 'active' : 'cancelled',
      mrr_total: Math.round(mrrTotal * 100) / 100,
      active_contracts_count: contratosAtivos,
      sismais_admin_id: sismaisClient.documento || null,
      last_synced_at: new Date().toISOString(),
    }

    // Fetch invoice data for debt summary
    if (sismaisClient.documento) {
      const { data: invoicesResult } = await supabase.functions.invoke(
        'sismais-admin-proxy',
        { body: { action: 'invoices', documento: sismaisClient.documento } }
      )

      const invoices = invoicesResult?.data || []
      const today = new Date().toISOString().split('T')[0]
      let debtTotal = 0
      let pendingCount = 0

      for (const inv of invoices) {
        const isPaid = inv.status?.toLowerCase() === 'pago' || inv.status?.toLowerCase() === 'paid'
        if (!isPaid && inv.data_vencimento && inv.data_vencimento <= today) {
          debtTotal += parseFloat(inv.valor || inv.valor_liquido || '0') || 0
          pendingCount++
        }
      }

      updateData.debt_total = Math.round(debtTotal * 100) / 100
      updateData.pending_invoices_count = pendingCount
      updateData.churn_risk = debtTotal > 0
    }

    // Map tier/plan based on MRR
    if (mrrTotal > 500) {
      updateData.customer_tier = 'enterprise'
      updateData.plan_level = 'Enterprise'
    } else if (mrrTotal > 200) {
      updateData.customer_tier = 'business'
      updateData.plan_level = 'Profissional'
    } else {
      updateData.customer_tier = 'starter'
      updateData.plan_level = 'Basico'
    }

    // Map sistema from plataformas
    if (sismaisClient.plataformas && sismaisClient.plataformas.length > 0) {
      const p = (sismaisClient.plataformas[0] || '').toLowerCase()
      if (p.includes('gms') && p.includes('web')) updateData.sistema = 'GMS Web'
      else if (p.includes('gms')) updateData.sistema = 'GMS Desktop'
      else if (p.includes('maxpro') || p.includes('pdv')) updateData.sistema = 'Maxpro'
      else updateData.sistema = sismaisClient.plataformas[0]
    }

    await supabase.from('helpdesk_clients').update(updateData).eq('id', clientId)
    console.log(`[auto-link] Financial data synced for client ${clientId}: license=${updateData.license_status}, mrr=${updateData.mrr_total}, debt=${updateData.debt_total}`)
  } catch (err) {
    console.error(`[auto-link] Financial sync error:`, err)
  }
}

// === Sync GL License Status ===
async function syncGlLicenseData(
  supabase: any,
  clientId: string,
  customerPhone: string | null,
  documento: string | null,
  email: string | null,
  conversationId: string | null
) {
  try {
    const { data: glLicenses } = await supabase.rpc('gl_search_licenses', {
      p_phone: customerPhone || null,
      p_cpf_cnpj: documento || null,
      p_email: email || null,
    })

    if (glLicenses && glLicenses.length > 0) {
      const statusMS = glLicenses.find((l: any) => l.source_system === 'mais_simples')?.status_pessoa || null
      const statusMaxpro = glLicenses.find((l: any) => l.source_system === 'maxpro')?.status_pessoa || null
      const supportEligible = glLicenses.some((l: any) => l.support_eligible)
      const blockReasons = glLicenses
        .filter((l: any) => !l.support_eligible && l.block_reason)
        .map((l: any) => {
          const sysName = l.source_system === 'mais_simples' ? 'Mais Simples' : 'Maxpro'
          return `${sysName}: ${l.block_reason}`
        })
        .join('; ')

      const firstLicense = glLicenses[0]

      await supabase
        .from('helpdesk_clients')
        .update({
          gl_license_id: firstLicense.gl_id,
          gl_source_system: firstLicense.source_system,
          support_eligible: supportEligible,
          support_block_reason: supportEligible ? null : blockReasons,
          gl_status_mais_simples: statusMS,
          gl_status_maxpro: statusMaxpro,
        })
        .eq('id', clientId)

      console.log(`[auto-link] GL sync: client=${clientId}, eligible=${supportEligible}, MS=${statusMS}, Maxpro=${statusMaxpro}`)

      // Se cliente não tem suporte, adicionar mensagem de sistema na conversa
      if (!supportEligible && conversationId) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'system',
          content: `⚠️ Cliente sem direito a suporte técnico.\n${blockReasons}\nRecomendação: transferir para agente humano.`,
        })
      }
    }
  } catch (glSyncErr) {
    console.error('[auto-link] GL license sync error:', glSyncErr)
  }
}

// === Link client to conversation ===
async function linkClient(
  supabase: any,
  conversationId: string,
  clientId: string,
  clientName: string,
  source: string
) {
  await supabase
    .from('ai_conversations')
    .update({ helpdesk_client_id: clientId })
    .eq('id', conversationId)

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'system',
    content: `✅ Cliente vinculado automaticamente: ${clientName} (fonte: ${source})`,
  })

  console.log(`[auto-link] Linked conversation ${conversationId} to client ${clientId} (${clientName}) via ${source}`)
}
