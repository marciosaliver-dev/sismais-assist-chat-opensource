import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logActionAsync } from "../_shared/action-logger.ts"
import { getGreetingByTime, isBusinessHours, getAfterHoursMessage } from '../_shared/brazil-timezone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Timeouts padrão (podem ser sobrescritos via platform_ai_config)
const DEFAULT_FIRST_FOLLOWUP_MINUTES = 10
const DEFAULT_SECOND_FOLLOWUP_MINUTES = 30
const DEFAULT_CLOSE_MINUTES = 50

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('[check-inactive] Starting inactive conversation check...')

    // Buscar configuração de timeouts
    const { data: inactiveConfig } = await supabase
      .from('platform_ai_config')
      .select('extra_config')
      .eq('feature', 'inactive_conversation')
      .maybeSingle()

    const cfg = (inactiveConfig?.extra_config as Record<string, any>) || {}
    const firstFollowupMin = Number(cfg.first_followup_minutes) || DEFAULT_FIRST_FOLLOWUP_MINUTES
    const secondFollowupMin = Number(cfg.second_followup_minutes) || DEFAULT_SECOND_FOLLOWUP_MINUTES
    const closeMin = Number(cfg.close_minutes) || DEFAULT_CLOSE_MINUTES

    // Buscar conversas ativas sob controle da IA
    const { data: conversations, error: convError } = await supabase
      .from('ai_conversations')
      .select('id, customer_phone, uazapi_chat_id, context, current_agent_id, started_at, kanban_board_id')
      .eq('status', 'em_atendimento')
      .eq('handler_type', 'ai')

    if (convError) throw convError
    if (!conversations || conversations.length === 0) {
      console.log('[check-inactive] No active AI conversations found')
      return new Response(JSON.stringify({ checked: 0, actioned: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[check-inactive] Checking ${conversations.length} active conversations`)

    const now = new Date()

    // ── CHECK HORÁRIO COMERCIAL ──
    const businessStatus = await isBusinessHours(supabase)
    if (!businessStatus.isOpen) {
      console.log(`[check-inactive] Outside business hours (${businessStatus.reason}) — skipping regular follow-ups`)

      // ── FORA DO EXPEDIENTE: verificar conversas aguardando humano SEM resposta ──
      // Essas conversas foram escaladas para humano mas ninguém está disponível
      const { data: abandonedHumanConvs } = await supabase
        .from('ai_conversations')
        .select('id, customer_phone, uazapi_chat_id, context, whatsapp_instance_id')
        .eq('status', 'aguardando')
        .eq('handler_type', 'human')
        .eq('is_discarded', false)

      let afterHoursActioned = 0
      if (abandonedHumanConvs && abandonedHumanConvs.length > 0) {
        for (const conv of abandonedHumanConvs) {
          const ctx = (conv.context as Record<string, any>) || {}
          // Só enviar mensagem de fora do expediente UMA VEZ
          if (ctx.after_hours_message_sent) continue

          try {
            const afterHoursMsg = await getAfterHoursMessage(supabase, businessStatus)
            const uazapiInstance = await getUazapiInstance(supabase, conv.uazapi_chat_id)
            await sendFollowUp(supabase, uazapiInstance, conv.customer_phone, conv.uazapi_chat_id, afterHoursMsg)

            // Marcar que já enviou mensagem de fora do expediente + devolver para IA
            await supabase
              .from('ai_conversations')
              .update({
                handler_type: 'ai',
                status: 'em_atendimento',
                context: { ...ctx, after_hours_message_sent: true, wants_human_outside_hours: true },
              })
              .eq('id', conv.id)

            // Salvar na ai_messages
            await supabase.from('ai_messages').insert({
              conversation_id: conv.id,
              role: 'assistant',
              content: afterHoursMsg,
              delivery_status: 'sent',
            })

            afterHoursActioned++
            console.log(`[check-inactive] Sent after-hours message for conv ${conv.id} and returned to AI`)
          } catch (err: any) {
            console.error(`[check-inactive] After-hours message failed for conv ${conv.id}:`, err.message)
          }
        }
      }

      // Também verificar conversas em_atendimento pela IA que não tiveram resposta
      // (ex: dead letter falhou, agent-executor crashou)
      for (const conv of conversations) {
        const ctx = (conv.context as Record<string, any>) || {}
        if (ctx.after_hours_message_sent) continue

        // Verificar se a IA respondeu à última mensagem do cliente
        const { data: lastMsgs } = await supabase
          .from('ai_messages')
          .select('role, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(2)

        // Se a última mensagem é do cliente (IA não respondeu), enviar mensagem
        if (lastMsgs && lastMsgs.length > 0 && lastMsgs[0].role === 'user') {
          const lastMsgTime = new Date(lastMsgs[0].created_at)
          const minutesSinceMsg = (now.getTime() - lastMsgTime.getTime()) / (1000 * 60)

          // Só intervir se passou mais de 5 minutos sem resposta
          if (minutesSinceMsg >= 5) {
            try {
              const afterHoursMsg = await getAfterHoursMessage(supabase, businessStatus)
              const uazapiInstance = await getUazapiInstance(supabase, conv.uazapi_chat_id)
              await sendFollowUp(supabase, uazapiInstance, conv.customer_phone, conv.uazapi_chat_id, afterHoursMsg)
              await supabase.from('ai_conversations').update({
                context: { ...ctx, after_hours_message_sent: true },
              }).eq('id', conv.id)
              await supabase.from('ai_messages').insert({
                conversation_id: conv.id,
                role: 'assistant',
                content: afterHoursMsg,
                delivery_status: 'sent',
              })
              afterHoursActioned++
              console.log(`[check-inactive] Sent after-hours recovery message for conv ${conv.id} (AI failed to respond for ${minutesSinceMsg.toFixed(0)}min)`)
            } catch (err: any) {
              console.error(`[check-inactive] After-hours recovery failed for conv ${conv.id}:`, err.message)
            }
          }
        }
      }

      return new Response(JSON.stringify({
        checked: conversations.length,
        actioned: afterHoursActioned,
        skipped_reason: 'outside_business_hours',
        after_hours_messages_sent: afterHoursActioned,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let actioned = 0

    for (const conv of conversations) {
      try {
        // Buscar última mensagem do cliente
        const { data: lastUserMsg } = await supabase
          .from('ai_messages')
          .select('created_at')
          .eq('conversation_id', conv.id)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!lastUserMsg) continue

        const lastMsgTime = new Date(lastUserMsg.created_at)
        const inactiveMinutes = (now.getTime() - lastMsgTime.getTime()) / (1000 * 60)

        const ctx = (conv.context as Record<string, any>) || {}
        const followupCount = Number(ctx.followup_count) || 0

        // Buscar mensagem de escalação do agente atual (se houver)
        let agentEscalationMsg = ''
        if (conv.current_agent_id) {
          const { data: agent } = await supabase
            .from('ai_agents')
            .select('support_config')
            .eq('id', conv.current_agent_id)
            .single()
          const supportCfg = (agent?.support_config as Record<string, any>) || {}
          agentEscalationMsg = supportCfg.escalationMessage || ''
        }

        // Buscar instância UAZAPI para enviar mensagem
        const uazapiInstance = await getUazapiInstance(supabase, conv.uazapi_chat_id)

        if (followupCount === 0 && inactiveMinutes >= firstFollowupMin) {
          // Primeiro follow-up — contextual via IA
          console.log(`[check-inactive] Conv ${conv.id}: sending AI follow-up #1 (${inactiveMinutes.toFixed(0)}min inactive)`)

          const followupText = await generateContextualFollowUp(
            supabase, conv, 'first_followup', inactiveMinutes
          )
          await sendFollowUp(supabase, uazapiInstance, conv.customer_phone, conv.uazapi_chat_id, followupText)
          await incrementFollowup(supabase, conv.id, ctx)
          await triggerNoResponseAutomations(supabase, conv.id, firstFollowupMin)
          actioned++

        } else if (followupCount === 1 && inactiveMinutes >= secondFollowupMin) {
          // Segundo follow-up — contextual via IA
          console.log(`[check-inactive] Conv ${conv.id}: sending AI follow-up #2 (${inactiveMinutes.toFixed(0)}min inactive)`)

          const followupText = await generateContextualFollowUp(
            supabase, conv, 'second_followup', inactiveMinutes
          )
          await sendFollowUp(supabase, uazapiInstance, conv.customer_phone, conv.uazapi_chat_id, followupText)
          await incrementFollowup(supabase, conv.id, ctx)
          await triggerNoResponseAutomations(supabase, conv.id, secondFollowupMin)
          actioned++

        } else if (followupCount >= 2 && inactiveMinutes >= closeMin) {
          // Encerrar por inatividade — contextual via IA
          console.log(`[check-inactive] Conv ${conv.id}: closing by inactivity (${inactiveMinutes.toFixed(0)}min inactive)`)

          const followupText = await generateContextualFollowUp(
            supabase, conv, 'closing', inactiveMinutes
          )
          await sendFollowUp(supabase, uazapiInstance, conv.customer_phone, conv.uazapi_chat_id, followupText)

          const resolvedAt = new Date().toISOString()
          const resolutionTimeSeconds = conv.started_at
            ? Math.round((now.getTime() - new Date(conv.started_at).getTime()) / 1000)
            : null

          // Buscar etapa "Fechado por IA" (is_ai_validation) no board atual
          let aiValidationStageId: string | null = null
          if (conv.kanban_board_id) {
            const { data: aiValStage } = await supabase
              .from('kanban_stages')
              .select('id')
              .eq('board_id', conv.kanban_board_id)
              .eq('is_ai_validation', true)
              .eq('active', true)
              .maybeSingle()
            aiValidationStageId = aiValStage?.id || null
            console.log(`[check-inactive] AI validation stage lookup: board=${conv.kanban_board_id}, found=${aiValidationStageId}`)
          }

          const updatePayload: Record<string, unknown> = {
            status: 'finalizado',
            ai_resolved: true,
            resolved_at: resolvedAt,
            resolution_summary: `Encerrado por inatividade do cliente após ${closeMin} minutos`,
            resolution_time_seconds: resolutionTimeSeconds,
            resolution_seconds: resolutionTimeSeconds,
          }

          if (aiValidationStageId) {
            updatePayload.kanban_stage_id = aiValidationStageId
            console.log(`[check-inactive] Moving conv ${conv.id} to AI validation stage: ${aiValidationStageId}`)
          }

          await supabase
            .from('ai_conversations')
            .update(updatePayload)
            .eq('id', conv.id)

          await triggerNoResponseAutomations(supabase, conv.id, closeMin)
          actioned++
        }
      } catch (convErr: any) {
        console.error(`[check-inactive] Error processing conv ${conv.id}:`, convErr.message)
      }
    }

    // Buscar conversas aguardando humano que não receberam resposta
    const { data: humanWaitConvs } = await supabase
      .from('ai_conversations')
      .select('id, customer_phone, uazapi_chat_id, current_agent_id, started_at, queue_entered_at, whatsapp_instance_id, communication_channel, channel_instance_id')
      .eq('status', 'aguardando')
      .eq('handler_type', 'human')
      .eq('is_discarded', false)

    // ── CONVERSAS AGUARDANDO HUMANO: NÃO retomar por IA durante expediente ──
    // A IA só deve retomar se estiver FORA do expediente (já barrado acima)
    // Durante expediente, as conversas aguardando humano devem permanecer na fila
    if (humanWaitConvs && humanWaitConvs.length > 0) {
      console.log(`[check-inactive] ${humanWaitConvs.length} conversations waiting for human — keeping in queue (business hours active)`)
    }

    console.log(`[check-inactive] Done. Checked: ${conversations.length}, Actioned: ${actioned}`)

    return new Response(JSON.stringify({ checked: conversations.length, actioned }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[check-inactive] Fatal error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getUazapiInstance(supabase: any, chat_jid: string | null): Promise<Record<string, any> | null> {
  if (chat_jid) {
    const { data: chatRecord } = await supabase
      .from('uazapi_chats')
      .select('instance_id')
      .eq('chat_id', chat_jid)
      .limit(1)
      .maybeSingle()

    if (chatRecord?.instance_id) {
      const { data: inst } = await supabase
        .from('uazapi_instances')
        .select('*')
        .eq('id', chatRecord.instance_id)
        .single()
      if (inst) return inst
    }
  }

  const { data: fallback } = await supabase
    .from('uazapi_instances')
    .select('*')
    .eq('is_active', true)
    .limit(1)
  return fallback?.[0] ?? null
}

async function sendFollowUp(
  supabase: any,
  inst: Record<string, any> | null,
  customer_phone: string | null,
  chat_jid: string | null,
  text: string
): Promise<void> {
  if (!inst || (!customer_phone && !chat_jid)) return

  const apiUrl = inst.api_url.replace(/\/$/, '')
  const recipient = /^\d{8,}/.test(customer_phone || '') ? customer_phone : chat_jid

  const sendResp = await fetch(`${apiUrl}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
    body: JSON.stringify({ number: recipient, text })
  })

  if (!sendResp.ok) {
    console.error(`[check-inactive] UAZAPI send error [${sendResp.status}]`)
    return
  }

  const sendResult = await sendResp.json()
  if (sendResult?.key?.id) {
    await supabase.from('uazapi_messages').insert({
      message_id: sendResult.key.id,
      chat_id: null,
      instance_id: inst.id,
      type: 'text',
      text_body: text,
      from_me: true,
      sender_name: inst.profile_name || 'AI Assistant',
      timestamp: new Date().toISOString(),
      status: 'sent'
    })
  }
}

/** Gera follow-up contextual via agent-executor, com fallback para mensagem fixa */
async function generateContextualFollowUp(
  supabase: any,
  conv: Record<string, any>,
  stage: 'first_followup' | 'second_followup' | 'closing',
  inactiveMinutes: number
): Promise<string> {
  const FALLBACKS: Record<string, string> = {
    first_followup: 'Oi! Vi que ficou um tempinho sem responder. Sem pressa — quando puder, é só mandar mensagem que continuamos daqui! 😊',
    second_followup: 'Só passando pra avisar que seu atendimento ainda está aberto. Se não conseguir responder agora, tudo bem — mas vamos encerrar em breve pra não ficar pendente. Quando quiser, é só chamar de novo!',
    closing: 'Vou encerrar esse atendimento por enquanto, tá? Se precisar de mais ajuda, é só abrir uma nova conversa. Estamos sempre por aqui! 👋',
  }

  if (!conv.current_agent_id) return FALLBACKS[stage]

  try {
    // Buscar últimas mensagens para contexto
    const { data: recentMsgs } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(6)

    const conversationSummary = (recentMsgs || [])
      .reverse()
      .map((m: any) => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${(m.content || '').slice(0, 150)}`)
      .join('\n')

    const greeting = getGreetingByTime()

    const followupPrompts: Record<string, string> = {
      first_followup: `[FOLLOW-UP PROATIVO — REENGAJAMENTO]
O cliente parou de responder há ${Math.round(inactiveMinutes)} minutos.
Saudação atual: ${greeting}

Contexto recente da conversa:
${conversationSummary}

INSTRUÇÕES:
- Gere UMA mensagem curta (máx 2 frases) para reengajar o cliente
- Faça referência ao assunto que estava sendo tratado (não seja genérico)
- Tom: caloroso, prestativo, sem pressão
- Use emoji com moderação (máx 1)
- NÃO repita saudação, NÃO se apresente novamente
- Exemplo bom: "Conseguiu verificar o problema no módulo financeiro? Estou aqui se precisar de mais alguma orientação! 😊"
- Exemplo ruim: "Olá! Ainda está por aí?"`,

      second_followup: `[FOLLOW-UP PROATIVO — SEGUNDO CONTATO]
O cliente não responde há ${Math.round(inactiveMinutes)} minutos (segundo follow-up).

Contexto recente da conversa:
${conversationSummary}

INSTRUÇÕES:
- Gere UMA mensagem curta (máx 2 frases) informando que o atendimento continua aberto
- Mencione brevemente o assunto tratado
- Avise que se não retornar, o chamado será encerrado automaticamente
- Tom: gentil mas claro, sem ser ameaçador
- Use emoji com moderação (máx 1)
- NÃO se apresente, NÃO cumprimente`,

      closing: `[ENCERRAMENTO POR INATIVIDADE]
O cliente não responde há ${Math.round(inactiveMinutes)} minutos. Vamos encerrar.

Contexto recente da conversa:
${conversationSummary}

INSTRUÇÕES:
- Gere UMA mensagem curta (máx 2 frases) de encerramento
- Mencione brevemente o assunto e que pode voltar quando quiser
- Tom: acolhedor e profissional
- Use emoji com moderação (máx 1)
- NÃO se apresente, NÃO cumprimente`,
    }

    const { data, error } = await supabase.functions.invoke('agent-executor', {
      body: {
        conversation_id: conv.id,
        agent_id: conv.current_agent_id,
        message_content: '[SISTEMA: cliente inativo, gerar follow-up]',
        extra_system_prompt: followupPrompts[stage],
      }
    })

    if (error) throw error

    const aiResponse = data?.response || data?.content
    if (aiResponse && typeof aiResponse === 'string' && aiResponse.length > 5 && aiResponse.length < 500) {
      console.log(`[check-inactive] AI generated ${stage} follow-up for conv ${conv.id}`)
      return aiResponse
    }

    console.warn(`[check-inactive] AI response invalid for ${stage}, using fallback`)
    return FALLBACKS[stage]
  } catch (err: any) {
    console.error(`[check-inactive] AI follow-up generation failed for conv ${conv.id}:`, err.message)
    return FALLBACKS[stage]
  }
}

async function incrementFollowup(
  supabase: any,
  conversation_id: string,
  currentCtx: Record<string, any>
): Promise<void> {
  const newCtx = { ...currentCtx, followup_count: (Number(currentCtx.followup_count) || 0) + 1 }
  await supabase
    .from('ai_conversations')
    .update({ context: newCtx })
    .eq('id', conversation_id)
}

async function triggerNoResponseAutomations(
  supabase: any,
  conversation_id: string,
  elapsed_minutes: number
): Promise<void> {
  // Disparar fluxos configurados com trigger no_response_timeout (fire-and-forget)
  supabase.functions.invoke('trigger-flows', {
    body: {
      trigger_type: 'no_response_timeout',
      conversation_id,
      data: { elapsed_minutes }
    }
  }).catch((e: any) => console.error('[check-inactive] trigger-flows error:', e.message))
}
