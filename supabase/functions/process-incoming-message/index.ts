import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isBusinessHours, getNextBusinessDay, getNowBrazil } from '../_shared/brazil-timezone.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'
import { MetaWhatsAppAdapter } from '../_shared/meta-whatsapp-adapter.ts'
import { registerAdapter, getAdapter } from '../_shared/channel-adapter.ts'
import { cachedQuery } from '../_shared/cache.ts'
import { analyzeQueue, buildQueueMessage } from '../_shared/queue-analyzer.ts'
import { logActionAsync } from '../_shared/action-logger.ts'

// ── Instance cache (persists across requests in same Deno isolate) ──
const instanceCache = new Map<string, { data: Record<string, any>; ts: number }>()
const INSTANCE_CACHE_TTL = 300_000 // 5 minutes

async function resolveInstance(
  supabase: any,
  chat_jid: string | null,
  whatsapp_instance_id?: string | null
): Promise<Record<string, any> | null> {
  // 1. Try pre-resolved instance ID (from conversation data)
  if (whatsapp_instance_id) {
    const cached = instanceCache.get(whatsapp_instance_id)
    if (cached && Date.now() - cached.ts < INSTANCE_CACHE_TTL) return cached.data

    const { data: inst } = await supabase
      .from('uazapi_instances')
      .select('*')
      .eq('id', whatsapp_instance_id)
      .single()
    if (inst) {
      instanceCache.set(whatsapp_instance_id, { data: inst, ts: Date.now() })
      return inst
    }
  }

  // 2. Try chat_jid lookup
  if (chat_jid) {
    const cacheKey = `chat:${chat_jid}`
    const cached = instanceCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < INSTANCE_CACHE_TTL) return cached.data

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
      if (inst) {
        instanceCache.set(cacheKey, { data: inst, ts: Date.now() })
        instanceCache.set(chatRecord.instance_id, { data: inst, ts: Date.now() })
        return inst
      }
    }
  }

  // 3. Fallback to any active instance
  const fallbackCached = instanceCache.get('__fallback__')
  if (fallbackCached && Date.now() - fallbackCached.ts < INSTANCE_CACHE_TTL) return fallbackCached.data

  const { data: fallbackInstances } = await supabase
    .from('uazapi_instances')
    .select('*')
    .eq('is_active', true)
    .limit(1)
  const inst = fallbackInstances?.[0] ?? null
  if (inst) {
    instanceCache.set('__fallback__', { data: inst, ts: Date.now() })
  }
  return inst
}

// Helper: envia mensagem de texto via UAZAPI para o cliente
async function sendTextViaWhatsApp(
  supabase: any,
  customer_phone: string | null,
  chat_jid: string | null,
  text: string,
  label: string,
  whatsapp_instance_id?: string | null,
  channel_type?: string | null,
  channel_instance_id?: string | null,
  conversation_id?: string | null,
): Promise<void> {
  if (!customer_phone && !chat_jid) return

  // ── MULTICHANNEL: Meta WhatsApp Cloud API ──
  if (channel_type === 'meta_whatsapp' && channel_instance_id) {
    try {
      const adapter = getAdapter('meta_whatsapp') || (() => {
        const a = new MetaWhatsAppAdapter(supabase)
        registerAdapter(a)
        return a
      })()

      const result = await adapter.sendMessage(channel_instance_id, {
        recipient: customer_phone || chat_jid || '',
        text,
      })

      if (result.success) {
        console.log(`[${label}] Meta WA message sent: ${result.externalMessageId || 'ok'}`)
        // Salvar na channel_messages
        if (result.externalMessageId) {
          supabase.from('channel_messages').insert({
            channel_type: 'meta_whatsapp',
            channel_instance_id,
            external_message_id: result.externalMessageId,
            sender_phone: null,
            message_type: 'text',
            text_content: text,
            from_me: true,
            status: 'sent',
            timestamp: new Date().toISOString(),
          }).then(() => {}).catch((e: any) => console.error(`[${label}] Failed to log Meta sent message:`, e))
        }
        // Garantir visibilidade no inbox: salvar em ai_messages (await para não perder em edge function)
        if (conversation_id) {
          const { error: insertErr } = await supabase.from('ai_messages').insert({
            conversation_id,
            role: 'assistant',
            content: text,
            delivery_status: 'sent',
            whatsapp_instance_id: whatsapp_instance_id || null,
          })
          if (insertErr) {
            console.error(`[${label}] CRITICAL: Failed to save to ai_messages:`, insertErr.message)
          } else {
            console.log(`[${label}] ai_messages synced for inbox visibility`)
          }
        }
      } else {
        console.error(`[${label}] Meta WA send error: ${result.error}`)
      }
    } catch (err: any) {
      console.error(`[${label}] Meta WA send exception: ${err.message}`)
    }
    return
  }

  // ── LEGADO: UAZAPI ──
  const inst = await resolveInstance(supabase, chat_jid, whatsapp_instance_id)

  if (!inst) {
    console.warn(`[${label}] No UAZAPI instance found, skipping send`)
    return
  }

  const apiUrl = inst.api_url.replace(/\/$/, '')
  let recipient = /^\d{8,}/.test(customer_phone || '') ? customer_phone : chat_jid

  // LID resolution
  if (recipient && !/^\d/.test(recipient) && !recipient.includes('@')) {
    const { data: chatPhoneRecord } = await supabase
      .from('uazapi_chats')
      .select('contact_phone')
      .eq('chat_id', recipient)
      .eq('instance_id', inst.id)
      .maybeSingle()

    let realPhone = chatPhoneRecord?.contact_phone
    if (!realPhone || !/^\d{8,}/.test(realPhone)) {
      const { data: convPhoneRecord } = await supabase
        .from('ai_conversations')
        .select('customer_phone')
        .eq('uazapi_chat_id', recipient)
        .in('status', ['aguardando', 'em_atendimento'])
        .maybeSingle()
      if (convPhoneRecord?.customer_phone && /^\d{8,}/.test(convPhoneRecord.customer_phone)) {
        realPhone = convPhoneRecord.customer_phone
      }
    }
    if (realPhone && /^\d{8,}/.test(realPhone)) {
      recipient = `${realPhone}@s.whatsapp.net`
    } else {
      recipient = `${recipient}@lid`
    }
  }

  const sendResp = await fetch(`${apiUrl}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
    body: JSON.stringify({ number: recipient, text })
  })

  if (!sendResp.ok) {
    const errBody = await sendResp.text()
    console.error(`[${label}] UAZAPI send error [${sendResp.status}]: ${errBody}`)
    return
  }

  const sendResult = await sendResp.json()
  console.log(`[${label}] Message sent:`, sendResult?.key?.id || 'ok')

  if (sendResult?.key?.id) {
    // Non-blocking insert — don't await to avoid adding latency
    supabase.from('uazapi_messages').insert({
      message_id: sendResult.key.id,
      chat_id: null,
      instance_id: inst.id,
      type: 'text',
      text_body: text,
      from_me: true,
      sender_name: inst.profile_name || 'AI Assistant',
      timestamp: new Date().toISOString(),
      status: 'sent'
    }).then(() => {}).catch((e: any) => console.error(`[${label}] Failed to log sent message:`, e))
  }

  // Garantir visibilidade no inbox: salvar em ai_messages (await para não perder em edge function)
  if (conversation_id) {
    const { error: insertErr } = await supabase.from('ai_messages').insert({
      conversation_id,
      role: 'assistant',
      content: text,
      uazapi_message_id: sendResult?.key?.id || null,
      delivery_status: sendResp.ok ? 'sent' : 'failed',
      whatsapp_instance_id: inst?.id || null,
    })
    if (insertErr) {
      console.error(`[${label}] CRITICAL: Failed to save to ai_messages:`, insertErr.message)
    } else {
      console.log(`[${label}] ai_messages synced for inbox visibility`)
    }
  }
}

// ── ENVIO DE MENSAGENS PICOTADAS (chunked) ──────────────────────────────
// Divide respostas longas em múltiplas mensagens curtas, simulando digitação humana
function splitIntoChunks(text: string, maxLen = 300, maxChunks = 5): string[] {
  // Primeiro, separar por parágrafos
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())

  if (paragraphs.length <= 1 && text.length <= maxLen) {
    return [text]
  }

  const chunks: string[] = []

  for (const para of paragraphs) {
    if (chunks.length >= maxChunks) {
      // Anexar restante ao último chunk
      chunks[chunks.length - 1] += '\n\n' + para
      continue
    }

    if (para.length <= maxLen) {
      chunks.push(para)
    } else {
      // Parágrafo grande: dividir por frases
      const sentences = para.split(/(?<=\.)\s+/)
      let current = ''
      for (const sentence of sentences) {
        if (current && (current + ' ' + sentence).length > maxLen) {
          chunks.push(current.trim())
          current = sentence
          if (chunks.length >= maxChunks) break
        } else {
          current = current ? current + ' ' + sentence : sentence
        }
      }
      if (current.trim()) {
        if (chunks.length >= maxChunks) {
          chunks[chunks.length - 1] += ' ' + current.trim()
        } else {
          chunks.push(current.trim())
        }
      }
    }
  }

  // Se resultou em apenas 1 chunk, retornar como está (sem delay desnecessário)
  return chunks.length === 0 ? [text] : chunks
}

async function sendChunkedViaWhatsApp(
  supabase: any,
  customer_phone: string | null,
  chat_jid: string | null,
  text: string,
  label: string,
  whatsapp_instance_id?: string | null,
  channel_type?: string | null,
  channel_instance_id?: string | null,
  conversation_id?: string | null,
): Promise<void> {
  const chunks = splitIntoChunks(text)

  if (chunks.length <= 1) {
    return sendTextViaWhatsApp(supabase, customer_phone, chat_jid, text, label, whatsapp_instance_id, channel_type, channel_instance_id, conversation_id)
  }

  console.log(`[${label}] Sending ${chunks.length} chunked messages`)

  // Enviar typing indicator antes de enviar as mensagens
  if (customer_phone || chat_jid) {
    try {
      const { getAdapter, registerAdapter } = await import('../_shared/channel-adapter.ts')
      const { UazapiAdapter } = await import('../_shared/uazapi-adapter.ts')
      const { MetaWhatsAppAdapter } = await import('../_shared/meta-whatsapp-adapter.ts')

      const channelInstId = channel_instance_id || whatsapp_instance_id
      if (channel_type === 'meta_whatsapp' && channel_instance_id) {
        const adapter = getAdapter('meta_whatsapp') || (() => { const a = new MetaWhatsAppAdapter(supabase); registerAdapter(a); return a })()
        await adapter.sendTypingIndicator(channel_instance_id, customer_phone || chat_jid || '')
      } else if (channelInstId) {
        const adapter = getAdapter('uazapi') || (() => { const a = new UazapiAdapter(supabase); registerAdapter(a); return a })()
        await adapter.sendTypingIndicator(channelInstId, customer_phone || chat_jid || '')
      }
    } catch (e) {
      // Typing indicator é cosmético — não falha o envio
      console.log(`[${label}] Typing indicator skipped:`, (e as Error).message)
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      const delay = 1500 + Math.floor(Math.random() * 1000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    await sendTextViaWhatsApp(
      supabase, customer_phone, chat_jid, chunks[i],
      `${label}/chunk-${i + 1}`, whatsapp_instance_id, channel_type, channel_instance_id, conversation_id
    )
  }
}

// Regex patterns for CPF/CNPJ detection
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/
const DIGITS_ONLY_REGEX = /^\d{11}$|^\d{14}$/
const EMAIL_REGEX = /[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/

function extractDocumento(text: string): string | null {
  const trimmed = text.trim()
  // Check digits-only first (11 or 14 digits)
  const digitsMatch = trimmed.match(DIGITS_ONLY_REGEX)
  if (digitsMatch) return digitsMatch[0]
  // Check formatted CNPJ
  const cnpjMatch = trimmed.match(CNPJ_REGEX)
  if (cnpjMatch) return cnpjMatch[0]
  // Check formatted CPF
  const cpfMatch = trimmed.match(CPF_REGEX)
  if (cpfMatch) return cpfMatch[0]
  return null
}

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX)
  return match ? match[0].toLowerCase() : null
}

const PHONE_REGEX = /\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/

function extractPhone(text: string): string | null {
  const match = text.match(PHONE_REGEX)
  if (!match) return null
  return match[0].replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Feature flag: ativar via variável de ambiente no Supabase
  const USE_PROCESSING_LOCK = Deno.env.get('FF_PROCESSING_LOCK') === 'true'
  const FLOWS_BLOCK_AGENT = Deno.env.get('FF_FLOWS_BLOCK_AGENT') === 'true'
  const DISABLE_LEGACY_AUTO = Deno.env.get('FF_DISABLE_LEGACY_AUTO') === 'true'

  // Extrair conversation_id antes do try para usar no finally (lock release)
  let conversation_id_for_lock: string | null = null

  try {
    const body = await req.json()
    const { conversation_id, message_content, message_id: incomingMsgId, shadow_mode, debounce_check } = body
    conversation_id_for_lock = conversation_id

    // ── SHADOW MODE: processa mas NÃO envia respostas ao cliente ──
    const isShadowMode = shadow_mode === true
    if (isShadowMode) {
      console.log(JSON.stringify({
        level: 'info', fn: 'process-incoming-message', step: 'shadow_start',
        conversation_id, ts: new Date().toISOString()
      }))
    }

    // ── DEBOUNCE CHECK: se chamado com debounce_check, verificar se há mensagens mais novas ──
    if (debounce_check) {
      const { data: pendingMsgs } = await supabase
        .from('ai_messages')
        .select('id, created_at')
        .eq('conversation_id', conversation_id)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(2)

      if (pendingMsgs && pendingMsgs.length >= 2) {
        const newest = new Date(pendingMsgs[0].created_at).getTime()
        const secondNewest = new Date(pendingMsgs[1].created_at).getTime()
        // Se a mensagem mais nova chegou nos últimos 3s, significa que o cliente
        // ainda está digitando — abortar e deixar a próxima invocação processar
        if (newest - secondNewest < 3000 && Date.now() - newest < 5000) {
          console.log(JSON.stringify({
            level: 'info', fn: 'process-incoming-message', step: 'debounce_skip',
            conversation_id, reason: 'newer_message_within_window'
          }))
          return new Response(JSON.stringify({ success: true, skipped: 'debounce_active' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // ── PARALLEL BLOCK 1: Conversation + Aggregated Messages ─────────────
    // These two queries are independent — fetch in parallel to save ~100-150ms
    console.log(JSON.stringify({
      level: 'info', fn: 'process-incoming-message', step: 'start',
      conversation_id, shadow: isShadowMode, ts: new Date().toISOString()
    }))

    const windowMs = 6000
    const cutoff = new Date(Date.now() - windowMs).toISOString()

    const [conversationResult, recentUserMsgsResult] = await Promise.all([
      supabase
        .from('ai_conversations')
        .select('handler_type, status, customer_name, customer_phone, helpdesk_client_id, context, uazapi_chat_id, whatsapp_instance_id, queue_entered_at, is_group, communication_channel, channel_instance_id, channel_chat_id')
        .eq('id', conversation_id)
        .single(),
      supabase
        .from('ai_messages')
        .select('content, created_at')
        .eq('conversation_id', conversation_id)
        .eq('role', 'user')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
    ])

    const { data: conversation } = conversationResult
    const { data: recentUserMsgs } = recentUserMsgsResult

    // Agregar mensagens picotadas do cliente (últimos 6s)
    let aggregatedContent = message_content
    if (recentUserMsgs && recentUserMsgs.length > 1) {
      aggregatedContent = recentUserMsgs.map((m: any) => m.content).join('\n')
      console.log(JSON.stringify({
        level: 'info', fn: 'process-incoming-message', step: 'aggregated_messages',
        conversation_id, count: recentUserMsgs.length, aggregated_length: aggregatedContent.length
      }))
    }

    if (!conversation) {
      throw new Error(`Conversation ${conversation_id} not found`)
    }

    // ── EXCEÇÃO: Confirmação positiva após ticket fechado → não criar novo ticket ──
    const POSITIVE_CONFIRMATIONS = /^(ok|obrigad[oa]|valeu|tudo certo|perfeito|show|top|beleza|blz|vlw|thanks|obg|isso|certinho|certo|ótimo|maravilha|massa|fechou|combinado)[\s!.\,]*$/i

    if (POSITIVE_CONFIRMATIONS.test((message_content || aggregatedContent || '').trim())) {
      // Buscar última conversa fechada deste cliente nas últimas 24h
      const { data: recentClosed } = await supabase
        .from('ai_conversations')
        .select('id, resolved_at')
        .eq('customer_phone', conversation.customer_phone)
        .eq('status', 'resolvido')
        .gte('resolved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('resolved_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentClosed) {
        console.log(`[process-incoming-message] Positive confirmation after closed ticket ${recentClosed.id}, not reopening`)
        // Registrar a mensagem no ticket fechado
        await supabase.from('ai_messages').insert({
          conversation_id: recentClosed.id,
          role: 'user',
          content: message_content || aggregatedContent,
          intent: 'positive_confirmation',
        })
        // Return early — do NOT process through AI agent
        return new Response(JSON.stringify({
          action: 'positive_confirmation',
          conversation_id: recentClosed.id,
          message: 'Positive confirmation registered on closed ticket',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ─── LOCK DE PROCESSAMENTO ──────────────────────────────────────────
    // Adquirir lock antes de qualquer lógica — previne processamento paralelo
    // que pode gerar respostas duplicadas ao cliente.
    if (USE_PROCESSING_LOCK) {
      const { data: lockAcquired } = await supabase.rpc('acquire_processing_lock', {
        p_conversation_id: conversation_id,
        p_locked_by: 'process-incoming-message',
        p_message_id: incomingMsgId || null,
      })
      if (!lockAcquired) {
        console.log(JSON.stringify({
          level: 'info', fn: 'process-incoming-message', step: 'lock_skip',
          conversation_id, reason: 'already_processing'
        }))
        return new Response(JSON.stringify({ success: true, skipped: 'lock_unavailable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }
    // ────────────────────────────────────────────────────────────────────

    // ETAPA 0: AUTO-LINK CLIENT
    let justIdentified = false
    if (!conversation.helpdesk_client_id) {
      const ctx0 = (conversation.context as Record<string, any>) || {}
      if (ctx0.awaiting_client_identification === true) {
        // Customer may have replied with CNPJ/CPF and/or email
        console.log(`[process-incoming] Awaiting identification — extracting from message...`)
        const documento = extractDocumento(message_content || '')
        const email = extractEmail(message_content || '')

        if (documento || email) {
          console.log(`[process-incoming] Found identification data — documento: ${documento ? '***masked***' : 'none'}, email: ${email ? email.split('@')[0].slice(0, 2) + '***@' + email.split('@')[1] : 'none'}`)
          // Awaited so we know the result before continuing to agent flow
          const { error: autoLinkErr } = await supabase.functions.invoke('sismais-client-auto-link', {
            body: { conversation_id, customer_phone: conversation.customer_phone, documento, email }
          })
          if (autoLinkErr) {
            console.error('[process-incoming] Auto-link by identification error:', autoLinkErr)
          } else {
            justIdentified = true
          }
          // Continue to agent flow — agent confirms the identification result
        } else {
          console.log(`[process-incoming] No identification data in message, continuing with agent`)
          // Keep the flag — agent will ask again based on injected context
        }
      } else {
        // Synchronous auto-link by phone (await to ensure client data is available for agent)
        try {
          console.log(`[process-incoming] Step 0: Auto-linking client by phone (await)...`)
          await supabase.functions.invoke('sismais-client-auto-link', {
            body: { conversation_id, customer_phone: conversation.customer_phone, whatsapp_instance_id: conversation.whatsapp_instance_id }
          })
          // Re-fetch to get the updated helpdesk_client_id
          const { data: refreshed } = await supabase
            .from('ai_conversations')
            .select('helpdesk_client_id')
            .eq('id', conversation_id)
            .single()
          if (refreshed?.helpdesk_client_id) {
            conversation.helpdesk_client_id = refreshed.helpdesk_client_id
            console.log(`[process-incoming] Auto-link found client: ${refreshed.helpdesk_client_id}`)
          } else {
            console.log(`[process-incoming] Auto-link: no client found for phone ${conversation.customer_phone}`)
          }
        } catch (err) {
          console.error('[process-incoming] Auto-link error (non-blocking):', err)
        }
      }
    }

    // Auto-extract and save client data from message content
    if (conversation.helpdesk_client_id && message_content) {
      const documento = extractDocumento(message_content)
      const email = extractEmail(message_content)
      const phone = extractPhone(message_content)

      if (documento || email || phone) {
        try {
          const { data: currentClient } = await supabase
            .from('helpdesk_clients')
            .select('cnpj, cpf, email, phone')
            .eq('id', conversation.helpdesk_client_id)
            .single()

          if (currentClient) {
            const updateFields: Record<string, string> = {}
            if (documento) {
              const cleanDoc = documento.replace(/\D/g, '')
              if (cleanDoc.length === 14 && !currentClient.cnpj) {
                updateFields.cnpj = documento
              } else if (cleanDoc.length === 11 && !currentClient.cpf) {
                updateFields.cpf = documento
              }
            }
            if (email && !currentClient.email) {
              updateFields.email = email
            }
            if (phone && !currentClient.phone) {
              updateFields.phone = phone
            }

            if (Object.keys(updateFields).length > 0) {
              console.log(`[process-incoming] Auto-saving client data: ${Object.keys(updateFields).join(', ')}`)
              await supabase
                .from('helpdesk_clients')
                .update(updateFields)
                .eq('id', conversation.helpdesk_client_id)
            }
          }
        } catch (err) {
          console.warn('[process-incoming] Error auto-saving client data:', err)
        }
      }
    }

    // Se handler_type é 'human', verificar timeout antes de pular
    if (conversation.handler_type === 'human') {
      const HUMAN_TIMEOUT_MINUTES = parseInt(Deno.env.get('FF_HUMAN_TIMEOUT_MINUTES') || '0', 10)

      if (HUMAN_TIMEOUT_MINUTES > 0) {
        // Verificar se a conversa está em 'human' sem resposta humana há mais de X minutos
        const { data: lastHumanMsg } = await supabase
          .from('ai_messages')
          .select('created_at')
          .eq('conversation_id', conversation_id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Usar queue_entered_at como referência se não houver mensagem do assistente
        const referenceTime = lastHumanMsg?.created_at || (conversation as any).queue_entered_at || null
        if (referenceTime) {
          const elapsedMs = Date.now() - new Date(referenceTime).getTime()
          const elapsedMinutes = elapsedMs / 60000

          if (elapsedMinutes >= HUMAN_TIMEOUT_MINUTES) {
            console.log(JSON.stringify({
              level: 'info', fn: 'process-incoming-message', step: 'human_timeout_revert',
              conversation_id, elapsed_minutes: Math.round(elapsedMinutes), threshold: HUMAN_TIMEOUT_MINUTES
            }))

            // Reverter para IA — nenhum humano respondeu dentro do timeout
            // Parallel: conversation update + system message insert are independent
            await Promise.all([
              supabase
                .from('ai_conversations')
                .update({
                  handler_type: 'ai',
                  status: 'em_atendimento',
                })
                .eq('id', conversation_id),
              supabase.from('ai_messages').insert({
                conversation_id,
                role: 'system',
                content: `⏰ Timeout de atendimento humano (${HUMAN_TIMEOUT_MINUTES}min sem resposta). Conversa retornada para IA.`,
              })
            ])

            // Avisar o cliente que a IA vai reassumir com tom acolhedor
            const revertMsg = 'Oi! Percebi que nosso time ainda não conseguiu te atender. ' +
              'Peço desculpas pela demora! 😊\n\n' +
              'Para não te deixar esperando mais, vou te ajudar por aqui mesmo. ' +
              'Me conta o que você precisa — vou fazer o meu melhor para resolver!'

            await sendTextViaWhatsApp(
              supabase,
              conversation.customer_phone,
              conversation.uazapi_chat_id,
              revertMsg,
              'process-incoming/timeout-revert-notice',
              conversation.whatsapp_instance_id,
              conversation.communication_channel,
              conversation.channel_instance_id,
              conversation_id
            ).catch(err => console.error('[process-incoming] Timeout revert msg error:', err))

            // Continuar processamento normal com IA (não retornar aqui)
            console.log(`[process-incoming] Human handler timed out, reverting to AI for conversation ${conversation_id}`)
          } else {
            // ── ALERTAS PROGRESSIVOS DE ESPERA NA FILA ──
            // Enviar mensagem amigável quando o cliente manda msg enquanto aguarda
            const roundedMin = Math.round(elapsedMinutes)

            // Verificar última mensagem de espera enviada para não spammar
            const { data: lastQueueNotice } = await supabase
              .from('ai_messages')
              .select('created_at, content')
              .eq('conversation_id', conversation_id)
              .eq('role', 'assistant')
              .like('content', '%aguardando%atend%')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            const lastNoticeMinsAgo = lastQueueNotice
              ? (Date.now() - new Date(lastQueueNotice.created_at).getTime()) / 60000
              : 999

            // Só enviar nova mensagem de espera se a última foi há mais de 3 minutos
            if (lastNoticeMinsAgo >= 3) {
              let waitMsg: string

              if (roundedMin <= 3) {
                waitMsg = 'Sua mensagem foi recebida! 😊 Nosso time já está ciente e em breve vai te atender. Obrigado pela paciência!'
              } else if (roundedMin <= 10) {
                waitMsg = `Você está aguardando há aproximadamente ${roundedMin} minutos. ` +
                  'Sabemos que esperar não é fácil, mas fique tranquilo — sua solicitação está na fila e nosso time vai te atender o mais rápido possível! 🙏'
              } else {
                waitMsg = `Pedimos desculpas pela espera de ${roundedMin} minutos. ` +
                  'Estamos com um volume acima do normal, mas sua solicitação é prioridade para nós. ' +
                  'Nosso time está trabalhando para te atender o quanto antes! Agradecemos muito a compreensão 💙'
              }

              await sendTextViaWhatsApp(
                supabase,
                conversation.customer_phone,
                conversation.uazapi_chat_id,
                waitMsg,
                'process-incoming/queue-wait-progressive',
                conversation.whatsapp_instance_id,
                conversation.communication_channel,
                conversation.channel_instance_id,
                conversation_id
              ).catch(err => console.error('[process-incoming] Queue wait msg error:', err))
            }

            console.log(`[process-incoming] Conversation ${conversation_id} is handled by human (${roundedMin}min elapsed, timeout=${HUMAN_TIMEOUT_MINUTES}min), skipping AI`)
            return new Response(JSON.stringify({ success: true, skipped: true, reason: 'human_handler' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        } else {
          console.log(`[process-incoming] Conversation ${conversation_id} is handled by human, no reference time found, skipping AI`)
          return new Response(JSON.stringify({ success: true, skipped: true, reason: 'human_handler' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      } else {
        // Timeout desabilitado — enviar mensagem de confirmação na fila se ainda não enviou
        const { data: lastQueueMsg } = await supabase
          .from('ai_messages')
          .select('created_at')
          .eq('conversation_id', conversation_id)
          .eq('role', 'assistant')
          .like('content', '%fila%atend%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastQueueMinsAgo = lastQueueMsg
          ? (Date.now() - new Date(lastQueueMsg.created_at).getTime()) / 60000
          : 999

        if (lastQueueMinsAgo >= 3) {
          const queueConfirmMsg = 'Sua mensagem foi recebida! 😊 Você já está na fila de atendimento e em breve um de nossos atendentes vai te responder. Agradecemos a paciência!'
          await sendTextViaWhatsApp(
            supabase,
            conversation.customer_phone,
            conversation.uazapi_chat_id,
            queueConfirmMsg,
            'process-incoming/queue-confirm-no-timeout',
            conversation.whatsapp_instance_id,
            conversation.communication_channel,
            conversation.channel_instance_id,
            conversation_id
          ).catch(err => console.error('[process-incoming] Queue confirm msg error:', err))
        }

        console.log(`[process-incoming] Conversation ${conversation_id} is handled by human, skipping AI`)
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'human_handler' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // INJECT CONTEXT FOR AI AGENTS
    const ctx = (conversation.context as Record<string, any>) || {}
    const extraPromptParts: string[] = []

    // Debt context (only for invoices with 3+ days overdue)
    if (ctx.debt_total > 0) {
      const formattedDebt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ctx.debt_total)
      const overdueDays = ctx.max_overdue_days || '?'
      extraPromptParts.push(`\nCONTEXTO FINANCEIRO: O cliente possui dívida de ${formattedDebt} (${ctx.pending_invoices_count || '?'} fatura(s) com ${overdueDays} dia(s) de atraso). Informe a pendência de forma educada e ofereça conectar com o setor financeiro (Kira) para regularizar.`)
      console.log(`[process-incoming] Debt context injected: ${formattedDebt}, ${overdueDays} days overdue`)
    }

    // Client identification context
    if (!conversation.helpdesk_client_id && ctx.awaiting_client_identification === true && !justIdentified) {
      extraPromptParts.push(`\n\nIDENTIFICAÇÃO PENDENTE: O cliente ainda não está cadastrado em nossa base. Solicite gentilmente o CNPJ/CPF e o e-mail para localizarmos o cadastro dele no Sismais Admin. Se o cliente já tiver fornecido esses dados antes, peça novamente de forma cordial.`)
      console.log(`[process-incoming] Identification context injected`)
    }

    const debtContextPrompt = extraPromptParts.join('')

    // ETAPA 1: ANÁLISE DA MENSAGEM
    console.log(`[process-incoming] Step 1: Analyzing message...`)
    const { data: analysis, error: analysisError } = await supabase.functions.invoke(
      'message-analyzer',
      { body: { conversation_id, message_content: aggregatedContent } }
    )

    if (analysisError) {
      console.error('[process-incoming] Analysis error:', analysisError)
      throw new Error(`Analysis failed: ${analysisError.message}`)
    }

    console.log(`[process-incoming] Analysis complete: intent=${analysis?.intent}, sentiment=${analysis?.sentiment}, urgency=${analysis?.urgency}`)

    // ETAPA 2: ORQUESTRAÇÃO (escolher agente)
    console.log(`[process-incoming] Step 2: Orchestrating...`)
    const { data: orchestration, error: orchError } = await supabase.functions.invoke(
      'orchestrator',
      { body: { conversation_id, message_content: aggregatedContent, analysis } }
    )

    if (orchError) {
      console.error('[process-incoming] Orchestration error:', orchError)
      throw new Error(`Orchestration failed: ${orchError.message}`)
    }

    console.log(`[process-incoming] Orchestration: action=${orchestration?.action}, agent=${orchestration?.agent_name || 'none'}`)

    // Handle orchestrator "ignore" action (e.g. group without group agent)
    if (orchestration?.action === 'ignore') {
      console.log(`[process-incoming] Orchestrator ignored: ${orchestration.reason}`)
      return new Response(JSON.stringify({ success: true, ignored: true, reason: orchestration.reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ETAPA 3: EXECUTAR AGENTE OU ESCALONAR
    if (orchestration.action === 'agent') {
      console.log(`[process-incoming] Step 3: Executing agent ${orchestration.agent_name}...`)

      // Verificar channel_type e support_config do agente antes de executar
      // Cache de 5 min — config de agente muda raramente
      const agentConfig = await cachedQuery(
        `agent_config:${orchestration.agent_id}`,
        300_000,
        async () => {
          const { data } = await supabase
            .from('ai_agents')
            .select('channel_type, name, support_config')
            .eq('id', orchestration.agent_id)
            .single()
          return data
        }
      )

      const isInternalAgent = agentConfig?.channel_type === 'internal'
      if (isInternalAgent) {
        console.log(`[process-incoming] Agent ${orchestration.agent_name} is internal (copilot) — skipping WhatsApp response`)
      }

      // ── SILENT MODE: para grupos, só responder quando mencionado ou em reply direto ──
      if (conversation.is_group && (agentConfig?.support_config as any)?.group_mode === 'silent') {
        const botName = (agentConfig?.name || '').toLowerCase()
        const msgText = (message_content || '').toLowerCase()
        const isDirectReply = body.quoted_message_from_me === true
        const isMentioned = msgText.includes(`@${botName}`) || msgText.includes(botName)

        if (!isDirectReply && !isMentioned) {
          console.log(`[process-incoming] Group silent mode — bot not addressed, skipping response`)
          return new Response(JSON.stringify({ success: true, skipped: 'group_silent_mode' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
      
      const { data: response, error: execError } = await supabase.functions.invoke(
        'agent-executor',
        {
          body: {
            conversation_id,
            agent_id: orchestration.agent_id,
            message_content: aggregatedContent,
            analysis,
            extra_system_prompt: debtContextPrompt || undefined,
          }
        }
      )

      if (execError) {
        console.error('[process-incoming] Agent execution error:', execError)
        throw new Error(`Agent execution failed: ${execError.message}`)
      }

      // ── SHADOW MODE: log resultado mas NÃO enviar mensagens ──
      if (isShadowMode) {
        console.log(JSON.stringify({
          level: 'info', fn: 'process-incoming-message', step: 'shadow_result',
          conversation_id,
          agent: orchestration.agent_name,
          confidence: response?.confidence,
          action: response?.action || 'reply',
          message_length: response?.message?.length || 0,
          rag_docs: response?.rag_documents_count || 0,
        }))
        return new Response(JSON.stringify({
          success: true, shadow: true,
          agent: orchestration.agent_name,
          confidence: response?.confidence,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Log confidence para métricas
      if (response?.confidence !== undefined) {
        console.log(JSON.stringify({
          level: 'info', fn: 'process-incoming-message', step: 'confidence_score',
          conversation_id, confidence: response.confidence,
          agent: orchestration.agent_name,
        }))
      }

      // Se agente decidiu escalonar
      if (response?.action === 'escalate') {
        console.log(`[process-incoming] Agent escalated: ${response.reason}`)

        // ── GATE: verificar se há humanos online E dentro do expediente ──
        // Parallel: these two checks are independent
        const [{ data: onlineHumans }, escalateBizStatus] = await Promise.all([
          supabase
            .from('human_agents')
            .select('id')
            .eq('is_active', true)
            .eq('is_online', true),
          isBusinessHours(supabase)
        ])
        const humansOnline = onlineHumans?.length || 0

        if (!escalateBizStatus.isOpen || humansOnline === 0) {
          const noHumanReason = !escalateBizStatus.isOpen
            ? `fora do expediente (${escalateBizStatus.reason})`
            : 'nenhum atendente humano online'
          console.log(`[process-incoming] Escalation blocked: ${noHumanReason} — AI continues`)

          const nextDay = await getNextBusinessDay(supabase)

          // IA continua atendendo — avisar que humano entra em contato no próximo dia útil
          if (!isInternalAgent) {
            const noHumanMsg = humansOnline === 0 && escalateBizStatus.isOpen
              ? `Entendo que você gostaria de falar com nosso time! 😊 No momento todos os nossos atendentes estão indisponíveis, mas vou continuar te ajudando por aqui. Se precisar de atendimento humano, nossa equipe retorna em ${nextDay}.`
              : `Entendo que você gostaria de falar com nosso time! 😊 Estamos fora do horário de atendimento agora, mas vou continuar te ajudando por aqui. Nossa equipe retorna em ${nextDay}.`
            await sendChunkedViaWhatsApp(
              supabase, conversation.customer_phone, conversation.uazapi_chat_id,
              noHumanMsg, 'process-incoming/escalate-blocked-no-human',
              conversation.whatsapp_instance_id, conversation.communication_channel,
              conversation.channel_instance_id, conversation_id
            ).catch(err => console.error('[process-incoming] No-human msg error:', err))
          }

          // Manter conversa com IA (não mudar handler_type)
          return new Response(JSON.stringify({
            success: true, escalated: false,
            reason: `Escalação bloqueada: ${noHumanReason}. IA continua.`,
            next_business_day: nextDay,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Enviar mensagem de escalação ao cliente antes de transferir para fila humana
        if (!isInternalAgent) {
          const escalateTransferMsg = response.escalation_message ||
            'Vou te encaminhar para um de nossos atendentes. 😊\n\n' +
            'Por favor, descreva o que você precisa para que nosso time já tenha o contexto quando te atender!'

          console.log(`[process-incoming] Sending escalation message to customer`)
          await sendChunkedViaWhatsApp(
            supabase,
            conversation.customer_phone,
            conversation.uazapi_chat_id,
            escalateTransferMsg,
            'process-incoming/escalate',
            conversation.whatsapp_instance_id,
            conversation.communication_channel,
            conversation.channel_instance_id,
            conversation_id
          ).catch(err => console.error('[process-incoming] Escalation message send error:', err))

          // Analisar fila REAL antes de enviar mensagem de demanda
          const queueState = await analyzeQueue(supabase)
          const queueMsg = buildQueueMessage(queueState)

          logActionAsync({
            conversationId: conversation_id,
            actionType: 'escalation',
            status: 'success',
            details: {
              queue_waiting: queueState.waitingCount,
              queue_in_progress: queueState.inProgressCount,
              available_agents: queueState.availableAgents,
              demand_level: queueState.demandLevel,
              estimated_wait: queueState.estimatedWaitMinutes,
            },
          })

          await sendChunkedViaWhatsApp(
            supabase,
            conversation.customer_phone,
            conversation.uazapi_chat_id,
            queueMsg.text,
            'process-incoming/queue-wait-notice',
            conversation.whatsapp_instance_id,
            conversation.communication_channel,
            conversation.channel_instance_id,
            conversation_id
          ).catch(err => console.error('[process-incoming] Queue notice send error:', err))

          // Sugestão de vídeos enquanto aguarda
          const videoTip = '💡 Enquanto aguarda, sabia que você pode tirar muitas dúvidas assistindo nossos vídeos tutoriais? ' +
            'Acesse de qualquer lugar: https://videos.sismais.com/'
          await sendTextViaWhatsApp(
            supabase,
            conversation.customer_phone,
            conversation.uazapi_chat_id,
            videoTip,
            'process-incoming/queue-video-tip',
            conversation.whatsapp_instance_id,
            conversation.communication_channel,
            conversation.channel_instance_id,
            conversation_id
          ).catch(err => console.error('[process-incoming] Video tip send error:', err))
        }

        return new Response(JSON.stringify({ success: true, escalated: true, reason: response.reason }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Se agente detectou resolução do problema
      if (response?.action === 'resolve') {
        console.log(`[process-incoming] AI resolved conversation: ${response.resolution_summary}`)
        // Conversa já foi marcada como finalizada (status=finalizado) e movida pelo agent-executor
        // Enviar mensagem de encerramento dedicada ao cliente (apenas se não for agente interno)
        if (!isInternalAgent) {
          const msgToSend = response.closing_message || response.message
          if (msgToSend) {
            await sendChunkedViaWhatsApp(
              supabase,
              conversation.customer_phone,
              conversation.uazapi_chat_id,
              msgToSend,
              'process-incoming/resolve',
              conversation.whatsapp_instance_id,
              conversation.communication_channel,
              conversation.channel_instance_id,
              conversation_id
            ).catch(err => console.error('[process-incoming] Resolve closing message send error:', err))
          }
        }
        return new Response(JSON.stringify({ success: true, resolved: true, resolution_summary: response.resolution_summary }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ETAPA 4: ENVIAR RESPOSTA VIA WHATSAPP (chunked para parecer humano)
      if (response?.message && !isInternalAgent) {
        console.log(`[process-incoming] Step 4: Sending response via WhatsApp (chunked)...`)
        await sendChunkedViaWhatsApp(
          supabase,
          conversation.customer_phone,
          conversation.uazapi_chat_id,
          response.message,
          'process-incoming/ai-response',
          conversation.whatsapp_instance_id,
          conversation.communication_channel,
          conversation.channel_instance_id,
          conversation_id
        )
      } else if (response?.message && isInternalAgent) {
        console.log(`[process-incoming] Step 4: Internal agent — response saved to DB only, NOT sent to WhatsApp`)
      }

      // ETAPA 5: APRENDIZADO (async, não bloqueante)
      console.log(`[process-incoming] Step 5: Learning loop (fire and forget)...`)
      supabase.functions.invoke('learning-loop', {
        body: {
          conversation_id,
          message_id: response?.message_id,
          agent_id: orchestration.agent_id,
          confidence: response?.confidence
        }
      }).catch(err => console.error('[process-incoming] Learning loop error:', err))

      return new Response(JSON.stringify({
        success: true,
        agent: orchestration.agent_name,
        confidence: response?.confidence,
        rag_docs: response?.rag_documents_count || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (orchestration.action === 'human') {
      console.log(`[process-incoming] Escalated to human by orchestrator: ${orchestration.reason}`)

      // ── SHADOW MODE: apenas logar decisão de escalação ──
      if (isShadowMode) {
        console.log(JSON.stringify({
          level: 'info', fn: 'process-incoming-message', step: 'shadow_escalation',
          conversation_id, reason: orchestration.reason,
        }))
        return new Response(JSON.stringify({ success: true, shadow: true, escalated: true, reason: orchestration.reason }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ── CHECK HORÁRIO COMERCIAL: fora do expediente → redirecionar para agente IA ──
      const businessStatus = await isBusinessHours(supabase)

      if (!businessStatus.isOpen) {
        console.log(`[process-incoming] Out of business hours (${businessStatus.reason}) — re-routing to AI agent instead of escalating`)

        // Buscar agente de fallback (maior prioridade) para atender via IA
        const { data: fallbackAgents } = await supabase
          .from('ai_agents')
          .select('id, name')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .limit(1)

        if (fallbackAgents && fallbackAgents.length > 0) {
          const fallbackAgent = fallbackAgents[0]

          // Atualizar conversa para IA
          await supabase
            .from('ai_conversations')
            .update({ current_agent_id: fallbackAgent.id, handler_type: 'ai' })
            .eq('id', conversation_id)

          // Chamar agent-executor com o agente de fallback
          console.log(`[process-incoming] OOH fallback → calling agent-executor with ${fallbackAgent.name}`)
          const agentResponse = await supabase.functions.invoke('agent-executor', {
            body: {
              conversation_id,
              agent_id: fallbackAgent.id,
              message_content: aggregatedContent || message_content,
            }
          })

          const response = agentResponse.data
          if (response?.message) {
            await sendChunkedViaWhatsApp(
              supabase,
              conversation.customer_phone,
              conversation.uazapi_chat_id,
              response.message,
              'process-incoming/ooh-ai-response',
              conversation.whatsapp_instance_id,
              conversation.communication_channel,
              conversation.channel_instance_id
            )
          }

          return new Response(JSON.stringify({
            success: true,
            escalated: false,
            agent: fallbackAgent.name,
            outside_business_hours: true,
            confidence: response?.confidence
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Fallback extremo: sem agentes ativos — enviar mensagem genérica
        const nextDay = await getNextBusinessDay(supabase)
        const outOfHoursMsg =
          `Olá! 😊 Neste momento estamos fora do horário de atendimento, ` +
          `mas sua solicitação foi registrada e será priorizada no próximo dia útil (${nextDay}). ` +
          `Obrigado pelo contato! 💪`

        await sendChunkedViaWhatsApp(
          supabase, conversation.customer_phone, conversation.uazapi_chat_id,
          outOfHoursMsg, 'process-incoming/out-of-hours',
          conversation.whatsapp_instance_id, conversation.communication_channel,
          conversation.channel_instance_id, conversation_id
        ).catch(err => console.error('[process-incoming] Out-of-hours message send error:', err))

        return new Response(JSON.stringify({
          success: true, escalated: false, queued_for_next_business_day: true, reason: businessStatus.reason
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ── GATE: verificar se há humanos online antes de transferir ──
      const [{ data: orchOnlineAgents }, { count: orchQueueCount }] = await Promise.all([
        supabase.from('human_agents').select('id').eq('is_active', true).eq('is_online', true),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('handler_type', 'human').in('status', ['aguardando', 'em_atendimento']),
      ])
      const orchHumansOnline = orchOnlineAgents?.length || 0
      const orchInQueue = orchQueueCount || 0

      if (orchHumansOnline === 0) {
        console.log(`[process-incoming] Orchestrator escalation blocked: no humans online — AI continues`)
        const nextDay2 = await getNextBusinessDay(supabase)

        // Redirecionar para agente IA fallback
        const { data: fallbackAgents2 } = await supabase
          .from('ai_agents')
          .select('id, name')
          .eq('is_active', true)
          .neq('channel_type', 'internal')
          .order('priority', { ascending: false })
          .limit(1)

        if (fallbackAgents2 && fallbackAgents2.length > 0) {
          const fb = fallbackAgents2[0]
          await supabase.from('ai_conversations').update({ current_agent_id: fb.id, handler_type: 'ai' }).eq('id', conversation_id)

          const noHumanMsg2 = `Entendo que você gostaria de falar com nosso time! 😊 No momento nossos atendentes não estão disponíveis, mas vou continuar te ajudando. Nossa equipe retorna em ${nextDay2}.`
          await sendChunkedViaWhatsApp(
            supabase, conversation.customer_phone, conversation.uazapi_chat_id,
            noHumanMsg2, 'process-incoming/orch-escalate-blocked',
            conversation.whatsapp_instance_id, conversation.communication_channel,
            conversation.channel_instance_id, conversation_id
          ).catch(err => console.error('[process-incoming] No-human orch msg error:', err))

          // Chamar agent-executor para continuar atendendo
          const fbResponse = await supabase.functions.invoke('agent-executor', {
            body: { conversation_id, agent_id: fb.id, message_content: aggregatedContent || message_content }
          })
          if (fbResponse.data?.message) {
            await sendChunkedViaWhatsApp(
              supabase, conversation.customer_phone, conversation.uazapi_chat_id,
              fbResponse.data.message, 'process-incoming/no-human-ai-response',
              conversation.whatsapp_instance_id, conversation.communication_channel,
              conversation.channel_instance_id
            )
          }

          return new Response(JSON.stringify({
            success: true, escalated: false, agent: fb.name,
            reason: 'Nenhum humano online — IA continua atendendo',
            next_business_day: nextDay2,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // ── DENTRO DO HORÁRIO COM HUMANOS ONLINE: escalação normal ──
      // Mensagem 1: confirmar transferência e pedir descrição do problema
      const transferMsg = orchestration.reason?.includes('explicitamente')
        ? 'Certo! Vou te transferir agora para um de nossos atendentes. 😊\n\n' +
          'Enquanto isso, por favor descreva o que você precisa para que nosso time já tenha o contexto quando te atender. ' +
          'Quanto mais detalhes, mais rápido conseguimos te ajudar!'
        : 'Entendido! Vou encaminhar você para nossa equipe de atendimento.\n\n' +
          'Por favor, aproveite para descrever o que precisa — assim nosso time já chega preparado para te ajudar!'

      await sendChunkedViaWhatsApp(
        supabase,
        conversation.customer_phone,
        conversation.uazapi_chat_id,
        transferMsg,
        'process-incoming/orchestrator-escalate',
        conversation.whatsapp_instance_id,
        conversation.communication_channel,
        conversation.channel_instance_id,
        conversation_id
      ).catch(err => console.error('[process-incoming] Transfer message send error:', err))

      // Mensagem 2: aviso de tempo de espera baseado na demanda real
      let queueMsg: string
      if (orchInQueue <= 3) {
        queueMsg = '✅ Você será atendido em breve por nossa equipe! ' +
          'Fique tranquilo, já estamos cuidando disso.'
      } else if (orchInQueue <= 8) {
        const estimateMin = Math.ceil(orchInQueue / Math.max(orchHumansOnline, 1)) * 5
        queueMsg = `⏳ Nosso time está atendendo ${orchInQueue} clientes no momento. ` +
          `Previsão de espera: ~${estimateMin} minutos. Agradecemos a paciência!`
      } else {
        queueMsg = `⏳ Estamos com alta demanda (${orchInQueue} atendimentos em andamento). ` +
          'Enquanto aguarda, posso continuar te ajudando com dúvidas — é só mandar!'
      }

      await sendTextViaWhatsApp(
        supabase,
        conversation.customer_phone,
        conversation.uazapi_chat_id,
        queueMsg,
        'process-incoming/queue-wait-notice',
        conversation.whatsapp_instance_id,
        conversation.communication_channel,
        conversation.channel_instance_id,
        conversation_id
      ).catch(err => console.error('[process-incoming] Queue notice send error:', err))

      // Mensagem 3: sugestão de vídeos enquanto aguarda
      const videoTip2 = '💡 Enquanto aguarda, sabia que você pode tirar muitas dúvidas assistindo nossos vídeos tutoriais? ' +
        'Acesse de qualquer lugar: https://videos.sismais.com/'
      await sendTextViaWhatsApp(
        supabase,
        conversation.customer_phone,
        conversation.uazapi_chat_id,
        videoTip2,
        'process-incoming/queue-video-tip',
        conversation.whatsapp_instance_id,
        conversation.communication_channel,
        conversation.channel_instance_id,
        conversation_id
      ).catch(err => console.error('[process-incoming] Video tip send error:', err))

      // Find the "Fila" stage in the Suporte board to move conversation there
      // Cache: kanban stages rarely change
      const filaStage = await cachedQuery(
        'kanban_stage_fila',
        600_000, // 10 min
        async () => {
          const { data } = await supabase
            .from('kanban_stages')
            .select('id, board_id')
            .eq('slug', 'fila')
            .limit(1)
            .maybeSingle()
          return data
        }
      )

      const escalateUpdate: Record<string, unknown> = {
        handler_type: 'human',
        status: 'aguardando',
        queue_entered_at: new Date().toISOString(),
      }
      if (filaStage) {
        escalateUpdate.kanban_stage_id = filaStage.id
        escalateUpdate.kanban_board_id = filaStage.board_id
      }

      await supabase
        .from('ai_conversations')
        .update(escalateUpdate)
        .eq('id', conversation_id)

      return new Response(JSON.stringify({
        success: true,
        escalated: true,
        reason: orchestration.reason
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ─── AUTOMAÇÕES LEGADAS (triggers não-message_received mantidas) ────
    // message_received está sendo migrado para flows — desabilitar via FF_DISABLE_LEGACY_AUTO
    if (!DISABLE_LEGACY_AUTO) {
      console.log(JSON.stringify({ level: 'info', fn: 'process-incoming-message', step: 'legacy_automations_start' }))
      const { data: activeAutomations } = await supabase
        .from('ai_automations')
        .select('id')
        .eq('trigger_type', 'message_received')
        .eq('is_active', true)

      if (activeAutomations && activeAutomations.length > 0) {
        for (const auto of activeAutomations) {
          // Mantém fire & forget para compatibilidade durante migração
          supabase.functions.invoke('automation-executor', {
            body: {
              automation_id: auto.id,
              trigger_data: {
                conversation_id,
                customer_name: conversation?.customer_name,
                customer_phone: conversation?.customer_phone,
                message_content,
                sentiment: analysis?.sentiment,
                urgency: analysis?.urgency,
                intent: analysis?.intent,
                time_of_day: getNowBrazil().time,
              }
            }
          }).catch(err => console.error('[process-incoming] Legacy automation error:', err))
        }
        console.log(JSON.stringify({
          level: 'info', fn: 'process-incoming-message', step: 'legacy_automations_triggered',
          count: activeAutomations.length
        }))
      }
    }

    // ─── FLOWS — AWAIT coordenado (não fire & forget) ──────────────────
    // Aguarda resultado para saber se algum flow enviou mensagem.
    // Se FLOWS_BLOCK_AGENT=true e flow enviou mensagem → pula agente IA.
    console.log(JSON.stringify({ level: 'info', fn: 'process-incoming-message', step: 'flows_start', conversation_id }))
    let flowSentMessage = false
    try {
      const { data: flowResult } = await supabase.functions.invoke('trigger-flows', {
        body: {
          trigger_type: 'message_received',
          conversation_id,
          data: {
            customer_name: conversation?.customer_name,
            customer_phone: conversation?.customer_phone,
            message_content,
            sentiment: analysis?.sentiment,
            urgency: analysis?.urgency,
            intent: analysis?.intent,
          }
        }
      })
      flowSentMessage = flowResult?.message_sent === true
      console.log(JSON.stringify({
        level: 'info', fn: 'process-incoming-message', step: 'flows_done',
        triggered: flowResult?.triggered, message_sent: flowSentMessage
      }))
    } catch (err) {
      console.error('[process-incoming] Flow trigger error:', err)
      // Não bloqueia o pipeline — agente IA pode ainda responder
    }

    // ─── LEARNING LOOP (mantém fire & forget — não envia mensagem) ─────
    // Nota: neste path (flow-only), não temos message_id/agent_id/confidence
    // do agente IA, pois a resposta veio de um fluxo estático. O learning-loop
    // ainda consegue operar (detecta escalação e CSAT rating via conversation_id).
    supabase.functions.invoke('learning-loop', {
      body: { conversation_id }
    }).catch(err => console.error('[process-incoming] Learning loop error:', err))

    // ─── RESULTADO ─────────────────────────────────────────────────────
    console.log(JSON.stringify({
      level: 'info', fn: 'process-incoming-message', step: 'done',
      conversation_id, flow_sent_message: flowSentMessage,
      ts: new Date().toISOString()
    }))

    return new Response(JSON.stringify({ success: true, flow_sent_message: flowSentMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({
      level: 'error', fn: 'process-incoming-message', step: 'fatal_error',
      error: errorMessage
    }))
    return new Response(JSON.stringify({ error: 'Message processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } finally {
    // SEMPRE liberar o lock — mesmo em caso de erro
    if (USE_PROCESSING_LOCK && conversation_id_for_lock) {
      const { error: releaseError } = await supabase.rpc('release_processing_lock', { p_conversation_id: conversation_id_for_lock })
      if (releaseError) console.error('[process-incoming] Lock release error:', releaseError)
    }
  }
})
