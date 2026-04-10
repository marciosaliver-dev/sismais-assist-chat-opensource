import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { DEFAULT_CONTENT_MODEL } from '../_shared/default-models.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Proactive Campaign Executor
 *
 * Receives an execution_id and processes all pending contacts:
 * 1. For each contact, generates a personalized AI message
 * 2. Starts a WhatsApp conversation via uazapi-proxy
 * 3. Tracks delivery and updates status
 * 4. Links conversation back to campaign for follow-up handling
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
    const { execution_id } = await req.json()
    if (!execution_id) {
      return new Response(JSON.stringify({ error: 'execution_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[campaign-executor] Starting execution ${execution_id}`)

    // Fetch execution with campaign data
    const { data: execution, error: execError } = await supabase
      .from('campaign_executions')
      .select('*, proactive_campaigns(*)')
      .eq('id', execution_id)
      .single()

    if (execError || !execution) {
      throw new Error(`Execution not found: ${execError?.message}`)
    }

    // Check status - must be approved or pending (auto)
    if (!['approved', 'pending'].includes(execution.status)) {
      console.log(`[campaign-executor] Execution ${execution_id} status is ${execution.status}, skipping`)
      return jsonResponse({ skipped: true, reason: `Status is ${execution.status}` })
    }

    const campaign = execution.proactive_campaigns
    if (!campaign) throw new Error('Campaign not found')

    // Update execution to running
    await supabase
      .from('campaign_executions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', execution_id)

    await logActivity(supabase, campaign.id, execution_id, null, 'execution_started', {
      campaign_name: campaign.name,
      campaign_type: campaign.campaign_type,
    })

    // Fetch pending contacts
    const { data: contacts, error: contactsErr } = await supabase
      .from('campaign_contacts')
      .select('*')
      .eq('execution_id', execution_id)
      .eq('status', 'pending')
      .order('created_at')

    if (contactsErr) throw contactsErr
    if (!contacts?.length) {
      await completeExecution(supabase, execution_id)
      return jsonResponse({ contacted: 0 })
    }

    // Get WhatsApp instance
    const instanceId = campaign.whatsapp_instance_id
    let uazapiInstance: any = null
    if (instanceId) {
      const { data: inst } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('id', instanceId)
        .eq('is_active', true)
        .single()
      uazapiInstance = inst
    }
    if (!uazapiInstance) {
      const { data: fallback } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('is_active', true)
        .limit(1)
      uazapiInstance = fallback?.[0]
    }

    if (!uazapiInstance) {
      throw new Error('No active WhatsApp instance available')
    }

    // Get agent for AI message generation
    let agent: any = null
    if (campaign.agent_id) {
      const { data: a } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', campaign.agent_id)
        .single()
      agent = a
    }
    if (!agent) {
      // Get default agent for this campaign type
      const specialtyMap: Record<string, string> = {
        follow_up: 'support',
        billing: 'financial',
        onboarding: 'sales',
        reactivation: 'sdr',
        health_check: 'support',
      }
      const { data: defaultAgent } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('specialty', specialtyMap[campaign.campaign_type] || 'support')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle()
      agent = defaultAgent
    }

    // Process each contact
    let contacted = 0
    let failed = 0
    const skipped = 0
    const delayBetweenMs = 3000 // 3 seconds between messages to avoid rate limiting

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]

      try {
        // Mark as sending
        await supabase
          .from('campaign_contacts')
          .update({ status: 'sending' })
          .eq('id', contact.id)

        // Generate personalized message
        const message = await generateMessage(supabase, campaign, contact, agent)

        if (!message) {
          await supabase
            .from('campaign_contacts')
            .update({ status: 'failed', error_message: 'Failed to generate message' })
            .eq('id', contact.id)
          failed++
          continue
        }

        // Start conversation and send message
        const result = await sendProactiveMessage(
          supabase, uazapiInstance, contact.contact_phone, message, campaign, agent
        )

        if (result.success) {
          // Update contact record
          await supabase
            .from('campaign_contacts')
            .update({
              status: 'sent',
              message_sent: message,
              sent_at: new Date().toISOString(),
              conversation_id: result.conversation_id,
            })
            .eq('id', contact.id)

          // If conversation was created, tag it as proactive campaign
          if (result.conversation_id) {
            await supabase
              .from('ai_conversations')
              .update({
                context: {
                  proactive_campaign_id: campaign.id,
                  proactive_execution_id: execution_id,
                  proactive_contact_id: contact.id,
                  campaign_type: campaign.campaign_type,
                },
                current_agent_id: agent?.id,
                handler_type: 'ai',
              })
              .eq('id', result.conversation_id)
          }

          await logActivity(supabase, campaign.id, execution_id, contact.id, 'message_sent', {
            phone: contact.contact_phone,
            name: contact.contact_name,
          })

          contacted++
        } else {
          await supabase
            .from('campaign_contacts')
            .update({ status: 'failed', error_message: result.error })
            .eq('id', contact.id)
          failed++

          await logActivity(supabase, campaign.id, execution_id, contact.id, 'message_failed', {
            phone: contact.contact_phone,
            error: result.error,
          })
        }

        // Delay between messages
        if (i < contacts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenMs))
        }

      } catch (contactErr: any) {
        console.error(`[campaign-executor] Error processing contact ${contact.id}:`, contactErr.message)
        await supabase
          .from('campaign_contacts')
          .update({ status: 'failed', error_message: contactErr.message })
          .eq('id', contact.id)
        failed++
      }
    }

    // Update execution stats
    await supabase
      .from('campaign_executions')
      .update({
        contacted,
        failed,
        skipped,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', execution_id)

    await logActivity(supabase, campaign.id, execution_id, null, 'execution_completed', {
      contacted, failed, skipped,
    })

    console.log(`[campaign-executor] Execution ${execution_id} completed. Contacted: ${contacted}, Failed: ${failed}`)
    return jsonResponse({ contacted, failed, skipped })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[campaign-executor] Fatal error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Generate personalized message using AI
async function generateMessage(
  supabase: any,
  campaign: any,
  contact: any,
  agent: any
): Promise<string | null> {
  const ctx = contact.ai_context || {}

  // If template mode, just replace variables
  if (campaign.message_mode === 'template' && campaign.message_template) {
    return campaign.message_template
      .replace(/\{nome\}/g, contact.contact_name || 'Cliente')
      .replace(/\{empresa\}/g, ctx.company_name || '')
      .replace(/\{produto\}/g, ctx.subscribed_product || '')
      .replace(/\{plano\}/g, ctx.contract_plan || '')
      .replace(/\{divida\}/g, ctx.debt_amount ? `R$ ${ctx.debt_amount.toFixed(2)}` : '')
      .replace(/\{dias_inativo\}/g, ctx.days_inactive?.toString() || '')
      .trim()
  }

  // AI-generated personalized message
  const campaignTypePrompts: Record<string, string> = {
    follow_up: `Você está fazendo um follow-up pós-atendimento com o cliente. Pergunte se o problema foi resolvido e se precisa de mais alguma coisa. Seja breve e cordial.`,
    billing: `Você está entrando em contato sobre questões financeiras. O cliente tem uma pendência de ${ctx.debt_amount ? `R$ ${ctx.debt_amount.toFixed(2)}` : 'valor pendente'}. Seja profissional e empático, oferecendo ajuda para regularizar a situação.`,
    onboarding: `Você está dando boas-vindas a um novo cliente! Apresente-se, explique que está disponível para ajudar com o ${ctx.subscribed_product || 'sistema'} e pergunte se precisa de orientação.`,
    reactivation: `O cliente está inativo há ${ctx.days_inactive || 'algum'} dias. Entre em contato de forma amigável perguntando como está, se está tudo bem com o ${ctx.subscribed_product || 'sistema'} e se precisa de alguma ajuda.`,
    health_check: `Faça um check-in periódico com o cliente. Pergunte como está a experiência com o ${ctx.subscribed_product || 'sistema'} e se há algo que possamos melhorar.`,
  }

  const basePrompt = campaignTypePrompts[campaign.campaign_type] || 'Entre em contato com o cliente de forma profissional.'
  const customPrompt = campaign.message_prompt || ''

  const systemPrompt = `Você é um assistente de atendimento da Sismais. Gere uma mensagem curta e natural para WhatsApp (máximo 3 parágrafos curtos).

Contexto do cliente:
- Nome: ${contact.contact_name || 'Cliente'}
- Empresa: ${ctx.company_name || 'N/A'}
- Produto: ${ctx.subscribed_product || 'N/A'}
- Plano: ${ctx.contract_plan || 'N/A'}

Instruções: ${basePrompt}
${customPrompt ? `\nInstruções adicionais: ${customPrompt}` : ''}

REGRAS:
- Mensagem para WhatsApp - seja conciso e natural
- Use o nome do cliente
- NÃO use markdown, asteriscos ou formatação
- NÃO inclua saudações genéricas longas
- Comece direto ao ponto com uma saudação curta
- Use emojis com moderação (máximo 2)
- A mensagem deve parecer escrita por um humano`

  try {
    const model = agent?.model || DEFAULT_CONTENT_MODEL

    const result = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Gere a mensagem proativa para este cliente.' },
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    return result.content?.trim() || null

  } catch (err: any) {
    console.error('[campaign-executor] AI generation error:', err.message)
    return null
  }
}

// Send message via UAZAPI and create conversation
async function sendProactiveMessage(
  supabase: any,
  instance: any,
  phone: string,
  message: string,
  campaign: any,
  agent: any
): Promise<{ success: boolean; conversation_id?: string; error?: string }> {
  try {
    const apiUrl = instance.api_url.replace(/\/$/, '')

    // Normalize phone for WhatsApp
    const cleanPhone = phone.replace(/\D/g, '')
    const jid = `${cleanPhone}@s.whatsapp.net`

    // Send message via UAZAPI
    const sendResp = await fetch(`${apiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instance.api_token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    })

    if (!sendResp.ok) {
      const errText = await sendResp.text()
      return { success: false, error: `UAZAPI error ${sendResp.status}: ${errText}` }
    }

    const sendResult = await sendResp.json()
    const messageId = sendResult?.key?.id

    // Create or find uazapi_chat record
    let { data: existingChat } = await supabase
      .from('uazapi_chats')
      .select('id, chat_id')
      .eq('instance_id', instance.id)
      .eq('chat_id', jid)
      .maybeSingle()

    if (!existingChat) {
      const { data: newChat } = await supabase
        .from('uazapi_chats')
        .insert({
          instance_id: instance.id,
          chat_id: jid,
          contact_phone: cleanPhone,
          last_message_preview: message.substring(0, 100),
          last_message_time: new Date().toISOString(),
          last_message_from_me: true,
        })
        .select()
        .single()
      existingChat = newChat
    } else {
      await supabase
        .from('uazapi_chats')
        .update({
          last_message_preview: message.substring(0, 100),
          last_message_time: new Date().toISOString(),
          last_message_from_me: true,
        })
        .eq('id', existingChat.id)
    }

    // Save to uazapi_messages
    if (messageId) {
      await supabase.from('uazapi_messages').insert({
        message_id: messageId,
        chat_id: existingChat?.id,
        instance_id: instance.id,
        type: 'text',
        text_body: message,
        from_me: true,
        sender_name: instance.profile_name || 'AI Assistant',
        timestamp: new Date().toISOString(),
        status: 'sent',
      })
    }

    // Create ai_conversation for this proactive outreach
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .insert({
        customer_phone: cleanPhone,
        customer_name: null, // will be enriched on reply
        status: 'aguardando_cliente',
        handler_type: 'ai',
        current_agent_id: agent?.id,
        uazapi_chat_id: jid,
        whatsapp_instance_id: instance.id,
        communication_channel: 'whatsapp',
        started_at: new Date().toISOString(),
        context: {
          proactive: true,
          campaign_type: campaign.campaign_type,
        },
      })
      .select('id')
      .single()

    // Save AI message record
    if (conversation?.id) {
      await supabase.from('ai_messages').insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: message,
        agent_id: agent?.id,
        model_used: agent?.model || 'campaign-proactive',
      })
    }

    return {
      success: true,
      conversation_id: conversation?.id,
    }

  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function logActivity(
  supabase: any,
  campaignId: string,
  executionId: string | null,
  contactId: string | null,
  action: string,
  details: any
) {
  await supabase.from('campaign_activity_log').insert({
    campaign_id: campaignId,
    execution_id: executionId,
    contact_id: contactId,
    action,
    details,
    actor_type: 'ai',
  }).catch((e: any) => console.error('[campaign-executor] Log error:', e.message))
}

async function completeExecution(supabase: any, executionId: string) {
  await supabase
    .from('campaign_executions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', executionId)
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
