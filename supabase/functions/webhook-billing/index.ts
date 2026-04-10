import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BILLING_BOARD_ID = 'b51c3016-464d-47dd-9e6a-168ac7bf5e0a'
const INADIMPLENTE_STAGE_ID = 'fe8596e5-5fc9-40d5-a7df-9e633a3b3b26'

interface BillingPayload {
  cliente_nome: string
  cliente_documento?: string
  cliente_email?: string
  cliente_telefone?: string
  plataforma: string
  evento: string
  id_externo?: string
  plano_nome?: string
  valor_assinatura?: number
  data_vencimento?: string
  forma_pagamento?: string
  fatura_id?: string
  fatura_valor?: number
  fatura_vencimento?: string
  fatura_link?: string
  raw_payload?: Record<string, any>
}

interface LogEntry {
  plataforma?: string
  evento?: string
  cliente_nome?: string
  cliente_documento?: string
  cliente_telefone?: string
  action_taken: string
  conversation_id?: string
  ticket_number?: number
  helpdesk_client_id?: string
  existing_board_id?: string
  moved_to_billing?: boolean
  payload?: Record<string, any>
  error_message?: string
  execution_time_ms?: number
}

async function insertLog(supabase: any, log: LogEntry) {
  try {
    await supabase.from('webhook_billing_logs').insert(log)
  } catch (e) {
    console.error('[webhook-billing] Falha ao gravar log:', e)
  }
}

async function fetchBillingDefaultAgent(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('platform_ai_config')
    .select('extra_config')
    .eq('feature', 'billing_default_agent')
    .maybeSingle()
  return data?.extra_config?.value || null
}

async function notifyAgent(supabase: any, defaultAgentId: string, clienteName: string, evento: string, ticketNumber: number) {
  try {
    const { data: agent } = await supabase
      .from('human_agents')
      .select('user_id')
      .eq('id', defaultAgentId)
      .maybeSingle()

    if (!agent?.user_id) return

    await supabase.from('notifications').insert({
      user_id: agent.user_id,
      type: 'system',
      priority: 'high',
      title: `Nova cobrança: ${clienteName}`,
      message: `Evento "${evento}" processado — Ticket #${ticketNumber}`,
      action_url: '/kanban/billing',
    })
    console.log(`[webhook-billing] Notificação enviada para user ${agent.user_id}`)
  } catch (e: any) {
    console.error(`[webhook-billing] Falha ao notificar: ${e.message}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let payload: BillingPayload | null = null

  try {
    payload = await req.json()

    console.log(`[webhook-billing] Recebido: ${payload!.plataforma} - ${payload!.evento} - ${payload!.cliente_nome}`)

    if (!payload!.cliente_nome || !payload!.plataforma || !payload!.evento) {
      const execMs = Date.now() - startTime
      insertLog(supabase, {
        plataforma: payload?.plataforma,
        evento: payload?.evento,
        cliente_nome: payload?.cliente_nome,
        cliente_documento: payload?.cliente_documento,
        cliente_telefone: payload?.cliente_telefone,
        action_taken: 'rejected',
        payload: payload as any,
        error_message: 'Campos obrigatórios ausentes: cliente_nome, plataforma, evento',
        execution_time_ms: execMs,
      })
      return new Response(JSON.stringify({ 
        error: 'Campos obrigatórios: cliente_nome, plataforma, evento' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const phoneMissing = !payload!.cliente_telefone || payload!.cliente_telefone.trim() === ''
    if (phoneMissing) {
      console.warn(`[webhook-billing] cliente_telefone ausente para ${payload!.cliente_nome}. Documento: ${payload!.cliente_documento || 'N/A'}. Usando 'sem-telefone'.`)
    }
    const phone = normalizePhone(payload!.cliente_telefone || 'sem-telefone')

    // Validate WhatsApp number if phone is present
    let phoneValidated: boolean | null = null
    if (!phoneMissing) {
      try {
        const { data: instances } = await supabase
          .from('uazapi_instances')
          .select('id, api_url, api_token')
          .eq('is_active', true)
          .limit(1)
        if (instances && instances.length > 0) {
          const inst = instances[0]
          const apiUrl = inst.api_url.replace(/\/$/, '')
          const checkJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
          const checkRes = await fetch(`${apiUrl}/misc/onWhatsApp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: inst.api_token },
            body: JSON.stringify({ jid: checkJid }),
          })
          if (checkRes.ok) {
            const checkData = await checkRes.json()
            const exists = Array.isArray(checkData) ? checkData.some((r: any) => r.exists) : checkData?.exists === true
            phoneValidated = exists
            console.log(`[webhook-billing] WhatsApp validation for ${phone}: ${exists ? 'VALID' : 'INVALID'}`)
          } else {
            console.warn(`[webhook-billing] WhatsApp validation failed (HTTP ${checkRes.status}), skipping`)
          }
        }
      } catch (e: any) {
        console.warn(`[webhook-billing] WhatsApp validation error: ${e.message}`)
      }
    }

    // 1. Resolver helpdesk_client_id
    const helpdeskClientId = await resolveHelpdeskClientId(supabase, payload!, phone)
    console.log(`[webhook-billing] helpdesk_client_id resolvido: ${helpdeskClientId || 'nenhum'}`)

    // 2. Buscar categoria "Financeiro" e módulo "Cobranças"
    const { data: categoryRow } = await supabase
      .from('ticket_categories')
      .select('id')
      .ilike('name', 'financeiro')
      .eq('active', true)
      .maybeSingle()

    const { data: moduleRow } = await supabase
      .from('ticket_modules')
      .select('id')
      .ilike('name', 'cobranças')
      .eq('active', true)
      .maybeSingle()

    const ticketCategoryId = categoryRow?.id || null
    const ticketModuleId = moduleRow?.id || null
    console.log(`[webhook-billing] Categoria: ${ticketCategoryId || 'não encontrada'}, Módulo: ${ticketModuleId || 'não encontrado'}`)

    // 3. Buscar agente padrão de cobrança
    const defaultAgentId = await fetchBillingDefaultAgent(supabase)
    console.log(`[webhook-billing] Agente padrão: ${defaultAgentId || 'não configurado'}`)

    // 4. Deduplicação por id_fatura (prioridade máxima)
    if (payload!.fatura_id) {
      const { data: byFatura } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, status, kanban_board_id, tags')
        .eq('id_fatura', payload!.fatura_id)
        .eq('kanban_board_id', BILLING_BOARD_ID)
        .not('status', 'eq', 'finalizado')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byFatura) {
        console.log(`[webhook-billing] Ticket existente por fatura_id: #${byFatura.ticket_number} (${byFatura.id})`)

        // Apenas adicionar nota + mensagem de sistema
        await supabase.from('ai_messages').insert({
          conversation_id: byFatura.id,
          role: 'system',
          content: formatSystemMessage(payload!),
        })

        await insertBillingNote(supabase, byFatura.id, payload!)

        // Atualizar id_fatura se mudou
        await supabase.from('ai_conversations').update({
          id_fatura: payload!.fatura_id,
          ...(payload!.id_externo ? { id_contrato: payload!.id_externo } : {}),
        }).eq('id', byFatura.id)

        if (defaultAgentId) {
          await notifyAgent(supabase, defaultAgentId, payload!.cliente_nome, payload!.evento, byFatura.ticket_number)
        }

        const execMs = Date.now() - startTime
        insertLog(supabase, {
          plataforma: payload!.plataforma,
          evento: payload!.evento,
          cliente_nome: payload!.cliente_nome,
          cliente_documento: payload!.cliente_documento,
          cliente_telefone: payload!.cliente_telefone,
          action_taken: 'deduplicated_by_fatura',
          conversation_id: byFatura.id,
          ticket_number: byFatura.ticket_number,
          helpdesk_client_id: helpdeskClientId || undefined,
          moved_to_billing: false,
          payload: payload as any,
          execution_time_ms: execMs,
        })

        return new Response(JSON.stringify({
          ok: true,
          action: 'deduplicated_by_fatura',
          ticket_number: byFatura.ticket_number,
          conversation_id: byFatura.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 5. Buscar ticket existente por cliente/telefone
    const existing = await findExistingTicket(supabase, helpdeskClientId, phone)

    if (existing) {
      console.log(`[webhook-billing] Ticket existente encontrado: #${existing.ticket_number} (${existing.id}) no board ${existing.kanban_board_id || 'nenhum'}`)

      await supabase.from('ai_messages').insert({
        conversation_id: existing.id,
        role: 'system',
        content: formatSystemMessage(payload!),
      })

      await insertBillingNote(supabase, existing.id, payload!)

      const existingBoardId = existing.kanban_board_id
      let movedToBilling = false

      if (existing.kanban_board_id !== BILLING_BOARD_ID) {
        const existingTags: string[] = existing.tags || []
        const newTags = Array.from(new Set([...existingTags, 'cobrança', payload!.plataforma, payload!.evento.toLowerCase()]))

        await supabase.from('ai_conversations').update({
          kanban_board_id: BILLING_BOARD_ID,
          kanban_stage_id: INADIMPLENTE_STAGE_ID,
          stage_id: INADIMPLENTE_STAGE_ID,
          tags: newTags,
          priority: 'high',
          ticket_category_id: ticketCategoryId,
          ticket_module_id: ticketModuleId,
          ...(defaultAgentId ? { human_agent_id: defaultAgentId, handler_type: 'human' } : {}),
          ...(payload!.fatura_id ? { id_fatura: payload!.fatura_id } : {}),
          ...(payload!.id_externo ? { id_contrato: payload!.id_externo } : {}),
        }).eq('id', existing.id)

        movedToBilling = true
        console.log(`[webhook-billing] Ticket #${existing.ticket_number} movido para board de cobrança`)
      } else {
        // Atualizar campos mesmo se já está no board
        await supabase.from('ai_conversations').update({
          ...(defaultAgentId ? { human_agent_id: defaultAgentId } : {}),
          ...(payload!.fatura_id ? { id_fatura: payload!.fatura_id } : {}),
          ...(payload!.id_externo ? { id_contrato: payload!.id_externo } : {}),
        }).eq('id', existing.id)
      }

      if (defaultAgentId) {
        await notifyAgent(supabase, defaultAgentId, payload!.cliente_nome, payload!.evento, existing.ticket_number)
      }

      const execMs = Date.now() - startTime
      insertLog(supabase, {
        plataforma: payload!.plataforma,
        evento: payload!.evento,
        cliente_nome: payload!.cliente_nome,
        cliente_documento: payload!.cliente_documento,
        cliente_telefone: payload!.cliente_telefone,
        action_taken: 'updated',
        conversation_id: existing.id,
        ticket_number: existing.ticket_number,
        helpdesk_client_id: helpdeskClientId || undefined,
        existing_board_id: existingBoardId || undefined,
        moved_to_billing: movedToBilling,
        payload: payload as any,
        execution_time_ms: execMs,
      })

      return new Response(JSON.stringify({ 
        ok: true, 
        action: 'updated',
        ticket_number: existing.ticket_number,
        conversation_id: existing.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. Criar novo ticket
    const { data: statusRow } = await supabase
      .from('ticket_statuses')
      .select('id')
      .eq('slug', 'aguardando')
      .eq('active', true)
      .maybeSingle()

    const { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .insert({
        customer_phone: phone,
        customer_name: payload!.cliente_nome,
        customer_email: payload!.cliente_email || null,
        status: 'aguardando',
        handler_type: 'human',
        kanban_board_id: BILLING_BOARD_ID,
        kanban_stage_id: INADIMPLENTE_STAGE_ID,
        stage_id: INADIMPLENTE_STAGE_ID,
        ticket_status_id: statusRow?.id || null,
        helpdesk_client_id: helpdeskClientId,
        priority: 'high',
        ticket_category_id: ticketCategoryId,
        ticket_module_id: ticketModuleId,
        human_agent_id: defaultAgentId,
        id_contrato: payload!.id_externo || null,
        id_fatura: payload!.fatura_id || null,
        tags: ['cobrança', payload!.plataforma, payload!.evento.toLowerCase()],
        context: {
          billing: {
            plataforma: payload!.plataforma,
            evento: payload!.evento,
            id_externo: payload!.id_externo,
            plano_nome: payload!.plano_nome,
            valor_assinatura: payload!.valor_assinatura,
            data_vencimento: payload!.data_vencimento,
            forma_pagamento: payload!.forma_pagamento,
            fatura_id: payload!.fatura_id,
            fatura_valor: payload!.fatura_valor,
            fatura_vencimento: payload!.fatura_vencimento,
            fatura_link: payload!.fatura_link,
            phone_missing: phoneMissing,
            ...(phoneValidated !== null ? { phone_validated: phoneValidated } : {}),
          }
        },
      })
      .select('id, ticket_number')
      .single()

    if (convError) {
      throw new Error(`Erro ao criar atendimento: ${convError.message}`)
    }

    console.log(`[webhook-billing] Ticket #${conversation.ticket_number} criado para ${payload!.cliente_nome}`)

    await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      role: 'system',
      content: formatSystemMessage(payload!),
    })

    await insertBillingNote(supabase, conversation.id, payload!)

    if (defaultAgentId) {
      await notifyAgent(supabase, defaultAgentId, payload!.cliente_nome, payload!.evento, conversation.ticket_number)
    }

    const execMs = Date.now() - startTime
    insertLog(supabase, {
      plataforma: payload!.plataforma,
      evento: payload!.evento,
      cliente_nome: payload!.cliente_nome,
      cliente_documento: payload!.cliente_documento,
      cliente_telefone: payload!.cliente_telefone,
      action_taken: 'created',
      conversation_id: conversation.id,
      ticket_number: conversation.ticket_number,
      helpdesk_client_id: helpdeskClientId || undefined,
      moved_to_billing: false,
      payload: payload as any,
      execution_time_ms: execMs,
    })

    return new Response(JSON.stringify({ 
      ok: true, 
      action: 'created',
      ticket_number: conversation.ticket_number,
      conversation_id: conversation.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('[webhook-billing] Erro:', err.message)

    const execMs = Date.now() - startTime
    insertLog(supabase, {
      plataforma: payload?.plataforma,
      evento: payload?.evento,
      cliente_nome: payload?.cliente_nome,
      cliente_documento: payload?.cliente_documento,
      cliente_telefone: payload?.cliente_telefone,
      action_taken: 'error',
      payload: payload as any,
      error_message: err.message,
      execution_time_ms: execMs,
    })

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Resolve helpdesk_client_id por documento (cpf/cnpj), telefone, email e contatos
async function resolveHelpdeskClientId(
  supabase: any,
  payload: BillingPayload,
  phone: string
): Promise<string | null> {
  if (payload.cliente_documento) {
    const doc = payload.cliente_documento.replace(/\D/g, '')
    
    const { data: byCpf } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('cpf', doc)
      .maybeSingle()
    if (byCpf) return byCpf.id

    const { data: byCnpj } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('cnpj', doc)
      .maybeSingle()
    if (byCnpj) return byCnpj.id

    const { data: byCpfRaw } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('cpf', payload.cliente_documento)
      .maybeSingle()
    if (byCpfRaw) return byCpfRaw.id

    const { data: byCnpjRaw } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('cnpj', payload.cliente_documento)
      .maybeSingle()
    if (byCnpjRaw) return byCnpjRaw.id
  }

  if (payload.cliente_telefone) {
    const { data: byPhone } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('phone', payload.cliente_telefone)
      .maybeSingle()
    if (byPhone) return byPhone.id

    const { data: byPhoneNorm } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()
    if (byPhoneNorm) return byPhoneNorm.id
  }

  if (payload.cliente_email) {
    const { data: byEmail } = await supabase
      .from('helpdesk_clients')
      .select('id')
      .eq('email', payload.cliente_email)
      .maybeSingle()
    if (byEmail) return byEmail.id
  }

  if (payload.cliente_telefone) {
    const { data: byContact } = await supabase
      .from('helpdesk_client_contacts')
      .select('client_id')
      .eq('phone', payload.cliente_telefone)
      .maybeSingle()
    if (byContact) return byContact.client_id

    const { data: byContactNorm } = await supabase
      .from('helpdesk_client_contacts')
      .select('client_id')
      .eq('phone', phone)
      .maybeSingle()
    if (byContactNorm) return byContactNorm.client_id
  }

  return null
}

// Busca ticket existente em QUALQUER board por helpdesk_client_id ou customer_phone
async function findExistingTicket(
  supabase: any,
  helpdeskClientId: string | null,
  phone: string
): Promise<any | null> {
  if (helpdeskClientId) {
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, ticket_number, status, kanban_board_id, tags')
      .eq('helpdesk_client_id', helpdeskClientId)
      .not('status', 'eq', 'finalizado')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  const { data } = await supabase
    .from('ai_conversations')
    .select('id, ticket_number, status, kanban_board_id, tags')
    .eq('customer_phone', phone)
    .not('status', 'eq', 'finalizado')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    return digits.startsWith('55') ? digits : `55${digits}`
  }
  return phone
}

function buildBillingNoteHtml(payload: BillingPayload): string {
  const platformColors: Record<string, string> = {
    asaas: '#00C851',
    eduzz: '#FF6D00',
    guru: '#7C4DFF',
  }
  const platformColor = platformColors[payload.plataforma?.toLowerCase()] || '#45E5E5'
  const platformName = (payload.plataforma || 'billing').toUpperCase()

  // Map evento to title and action text
  const eventoLower = (payload.evento || '').toLowerCase()
  let titulo = 'AVISO DE COBRANÇA'
  let acaoTexto = ''
  if (eventoLower.includes('vencid') || eventoLower.includes('overdue')) {
    titulo = '⚠️ AVISO DE COBRANÇA VENCIDA'
    acaoTexto = `A fatura do cliente <strong>${payload.cliente_nome}</strong> encontra-se <strong>vencida</strong>. É necessário entrar em contato para regularização do pagamento.`
  } else if (eventoLower.includes('cancel')) {
    titulo = '🚫 AVISO DE CANCELAMENTO'
    acaoTexto = `A assinatura do cliente <strong>${payload.cliente_nome}</strong> foi <strong>cancelada</strong>. Verificar possibilidade de retenção e negociação.`
  } else if (eventoLower.includes('pag') || eventoLower.includes('paid') || eventoLower.includes('confirm')) {
    titulo = '✅ PAGAMENTO CONFIRMADO'
    acaoTexto = `O pagamento do cliente <strong>${payload.cliente_nome}</strong> foi <strong>confirmado</strong>. Atualizar status do contrato.`
  } else if (eventoLower.includes('criada') || eventoLower.includes('created') || eventoLower.includes('nova')) {
    titulo = '📋 NOVA COBRANÇA GERADA'
    acaoTexto = `Uma nova cobrança foi gerada para o cliente <strong>${payload.cliente_nome}</strong>. Acompanhar prazo de pagamento.`
  } else if (eventoLower.includes('reembol') || eventoLower.includes('refund')) {
    titulo = '↩️ REEMBOLSO PROCESSADO'
    acaoTexto = `Um reembolso foi processado para o cliente <strong>${payload.cliente_nome}</strong>. Verificar motivo e atualizar registros.`
  } else {
    titulo = `📋 COBRANÇA: ${payload.evento.toUpperCase()}`
    acaoTexto = `Evento "<strong>${payload.evento}</strong>" registrado para o cliente <strong>${payload.cliente_nome}</strong>. Verificar e tomar as providências necessárias.`
  }

  const cellStyle = 'padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;'
  const labelStyle = `${cellStyle}color:#6b7280;font-weight:600;width:140px;`
  const valueStyle = `${cellStyle}color:#111827;`
  const sectionTitle = (icon: string, text: string) =>
    `<div style="font-size:14px;font-weight:700;color:#1f2937;margin:14px 0 6px;padding-bottom:4px;border-bottom:2px solid ${platformColor}">${icon} ${text}</div>`

  let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff">`

  // Header
  html += `<div style="background:linear-gradient(135deg,${platformColor},${platformColor}dd);padding:14px 16px;color:#fff">`
  html += `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">`
  html += `<div style="font-size:16px;font-weight:800;letter-spacing:0.3px">${titulo}</div>`
  html += `<span style="background:rgba(255,255,255,0.25);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">${platformName}</span>`
  html += `</div>`
  html += `<div style="font-size:11px;opacity:0.85;margin-top:4px">Evento: ${payload.evento} · ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>`
  html += `</div>`

  // Body
  html += `<div style="padding:12px 16px">`

  // Dados do Cliente
  html += sectionTitle('👤', 'Dados do Cliente')
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">`
  html += `<tr><td style="${labelStyle}">Nome</td><td style="${valueStyle}"><strong>${payload.cliente_nome}</strong></td></tr>`
  if (payload.cliente_documento) {
    html += `<tr><td style="${labelStyle}">CPF/CNPJ</td><td style="${valueStyle}">${payload.cliente_documento}</td></tr>`
  }
  if (payload.cliente_email) {
    html += `<tr><td style="${labelStyle}">E-mail</td><td style="${valueStyle}">${payload.cliente_email}</td></tr>`
  }
  if (payload.cliente_telefone) {
    html += `<tr><td style="${labelStyle}">Telefone</td><td style="${valueStyle}">${payload.cliente_telefone}</td></tr>`
  }
  html += `</table>`

  // Detalhes da Fatura
  html += sectionTitle('🧾', 'Detalhes da Fatura')
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">`
  if (payload.plano_nome) {
    html += `<tr><td style="${labelStyle}">Produto/Plano</td><td style="${valueStyle}"><strong>${payload.plano_nome}</strong></td></tr>`
  }
  if (payload.valor_assinatura) {
    html += `<tr><td style="${labelStyle}">Valor</td><td style="${valueStyle}"><mark style="background:#fef08a;padding:1px 6px;border-radius:3px;font-weight:700">R$ ${payload.valor_assinatura.toFixed(2)}</mark></td></tr>`
  }
  if (payload.fatura_valor && payload.fatura_valor !== payload.valor_assinatura) {
    html += `<tr><td style="${labelStyle}">Valor Fatura</td><td style="${valueStyle}"><mark style="background:#fef08a;padding:1px 6px;border-radius:3px;font-weight:700">R$ ${payload.fatura_valor.toFixed(2)}</mark></td></tr>`
  }
  if (payload.data_vencimento) {
    html += `<tr><td style="${labelStyle}">Vencimento</td><td style="${valueStyle}"><strong>${payload.data_vencimento}</strong></td></tr>`
  }
  if (payload.fatura_vencimento && payload.fatura_vencimento !== payload.data_vencimento) {
    html += `<tr><td style="${labelStyle}">Venc. Fatura</td><td style="${valueStyle}"><strong>${payload.fatura_vencimento}</strong></td></tr>`
  }
  if (payload.forma_pagamento) {
    html += `<tr><td style="${labelStyle}">Forma Pgto</td><td style="${valueStyle}">${payload.forma_pagamento}</td></tr>`
  }
  if (payload.id_externo) {
    html += `<tr><td style="${labelStyle}">ID Externo</td><td style="${valueStyle}"><code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">${payload.id_externo}</code></td></tr>`
  }
  if (payload.fatura_id) {
    html += `<tr><td style="${labelStyle}">ID Fatura</td><td style="${valueStyle}"><code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">${payload.fatura_id}</code></td></tr>`
  }
  html += `</table>`

  // Ação Necessária
  html += sectionTitle('⚡', 'Ação Necessária')
  html += `<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:10px 12px;font-size:13px;line-height:1.6;color:#92400e">${acaoTexto}</div>`

  // Link de Pagamento
  if (payload.fatura_link) {
    html += `<div style="margin-top:12px;text-align:center">`
    html += `<a href="${payload.fatura_link}" target="_blank" rel="noopener" style="display:inline-block;background:${platformColor};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px">🔗 Acessar Fatura / Link de Pagamento</a>`
    html += `</div>`
  }

  // Rodapé
  html += `<div style="margin-top:14px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af">Gerado automaticamente pelo sistema <strong>${platformName}</strong> de Cobrança</div>`

  html += `</div>` // body
  html += `</div>` // wrapper
  return html
}

async function insertBillingNote(supabase: any, conversationId: string, payload: BillingPayload) {
  try {
    const { data: current } = await supabase
      .from('ai_conversations')
      .select('context')
      .eq('id', conversationId)
      .maybeSingle()

    const ctx = (current?.context as Record<string, any>) || {}
    const existingNotes = (ctx.notes as any[]) || []

    const newNote = {
      text: buildBillingNoteHtml(payload),
      author: 'Sistema de Cobrança',
      author_email: 'billing@sistema',
      created_at: new Date().toISOString(),
    }

    const updatedContext = { ...ctx, notes: [...existingNotes, newNote] }

    await supabase
      .from('ai_conversations')
      .update({ context: updatedContext })
      .eq('id', conversationId)

    console.log(`[webhook-billing] Nota de cobrança inserida para ${conversationId}`)
  } catch (e: any) {
    console.error(`[webhook-billing] Falha ao inserir nota: ${e.message}`)
  }
}

function formatSystemMessage(payload: BillingPayload): string {
  const lines = [
    `📋 **Cobrança - ${payload.plataforma.toUpperCase()}**`,
    `Evento: ${payload.evento}`,
    `Cliente: ${payload.cliente_nome}`,
  ]

  if (payload.cliente_documento) lines.push(`Documento: ${payload.cliente_documento}`)
  if (payload.plano_nome) lines.push(`Plano: ${payload.plano_nome}`)
  if (payload.valor_assinatura) lines.push(`Valor: R$ ${payload.valor_assinatura.toFixed(2)}`)
  if (payload.data_vencimento) lines.push(`Vencimento: ${payload.data_vencimento}`)
  if (payload.forma_pagamento) lines.push(`Pagamento: ${payload.forma_pagamento}`)
  if (payload.fatura_valor) lines.push(`Fatura: R$ ${payload.fatura_valor.toFixed(2)}`)
  if (payload.fatura_vencimento) lines.push(`Venc. Fatura: ${payload.fatura_vencimento}`)
  if (payload.fatura_link) lines.push(`Link: ${payload.fatura_link}`)

  return lines.join('\n')
}
