/**
 * Channel Router — Roteamento unificado multi-canal
 *
 * Recebe uma NormalizedIncomingMessage de qualquer canal e roteia para o
 * pipeline de processamento (process-incoming-message) de forma unificada.
 *
 * Responsabilidades:
 * 1. Resolver/criar conversa (ai_conversations) independente de canal
 * 2. Salvar mensagem normalizada (channel_messages)
 * 3. Invocar process-incoming-message
 * 4. Enviar resposta pelo canal correto usando o adapter
 */

import {
  type ChannelType,
  type NormalizedIncomingMessage,
  type SendMessageOptions,
  type SendMessageResult,
  getAdapter,
} from './channel-adapter.ts'

/**
 * Processa uma mensagem normalizada de qualquer canal.
 * Cria/atualiza conversa e invoca o pipeline.
 */
export async function routeIncomingMessage(
  supabase: any,
  message: NormalizedIncomingMessage,
): Promise<{ conversationId: string; processed: boolean; skipped?: string }> {
  const log = (step: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      fn: 'channel-router',
      step,
      channel: message.channelType,
      chatId: message.chatId,
      ...data,
    }))
  }

  log('start', { messageType: message.messageType, fromMe: message.fromMe })

  // Ignorar mensagens proprias e de grupo
  if (message.fromMe) {
    log('skip', { reason: 'from_me' })
    return { conversationId: '', processed: false, skipped: 'from_me' }
  }
  if (message.isGroup) {
    log('skip', { reason: 'group_message' })
    return { conversationId: '', processed: false, skipped: 'group_message' }
  }

  // ── 1. Resolver/criar conversa ──────────────────────────────────────

  // Buscar conversa ativa por canal + chat ID (exclui statuses terminais)
  const findActiveConv = () =>
    supabase
      .from('ai_conversations')
      .select('id, handler_type, status, whatsapp_instance_id')
      .eq('communication_channel', message.channelType)
      .eq('channel_chat_id', message.chatId)
      .not('status', 'in', '("finalizado","resolvido","cancelado")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

  const { data: existingConv } = await findActiveConv()

  let conversationId: string

  if (existingConv) {
    conversationId = existingConv.id
    log('conversation_found', { conversationId })
  } else {
    // Buscar board/stage padrão para atribuir à nova conversa
    let defaultBoardId: string | null = null
    let defaultStageId: string | null = null
    let initialStatus = 'aguardando'

    try {
      // 1. Board padrão (is_default = true)
      const { data: defaultBoard } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('is_default', true)
        .eq('active', true)
        .limit(1)
        .maybeSingle()

      if (defaultBoard) {
        defaultBoardId = defaultBoard.id

        // 2. Stage de entrada do board
        const { data: entryStage } = await supabase
          .from('kanban_stages')
          .select('id, status_type')
          .eq('board_id', defaultBoardId)
          .eq('is_entry', true)
          .eq('active', true)
          .limit(1)
          .maybeSingle()

        if (entryStage) {
          defaultStageId = entryStage.id
          initialStatus = entryStage.status_type || 'aguardando'
        }
      }

      log('board_resolved', { defaultBoardId, defaultStageId, initialStatus })
    } catch (e) {
      console.error('[channel-router] Error resolving default board:', e)
    }

    // Criar nova conversa
    const { data: newConv, error: convError } = await supabase
      .from('ai_conversations')
      .insert({
        customer_name: message.senderName || 'Cliente',
        customer_phone: message.senderPhone,
        communication_channel: message.channelType,
        channel_chat_id: message.chatId,
        channel_instance_id: message.channelInstanceId,
        status: initialStatus,
        handler_type: 'ai',
        ...(defaultBoardId ? { kanban_board_id: defaultBoardId } : {}),
        ...(defaultStageId ? { kanban_stage_id: defaultStageId, stage_id: defaultStageId } : {}),
        // Para UAZAPI, manter compatibilidade com campos legados
        ...(message.channelType === 'uazapi' ? {
          uazapi_chat_id: message.chatId,
          whatsapp_instance_id: message.channelInstanceId,
        } : {}),
      })
      .select('id')
      .single()

    if (convError) {
      // Race condition: outra requisição criou a conversa simultaneamente
      if (convError.code === '23505') {
        log('race_condition_avoided', { chatId: message.chatId })
        const { data: raceConv } = await findActiveConv()
        if (raceConv) {
          conversationId = raceConv.id
          log('conversation_found_after_race', { conversationId })
        } else {
          console.error('[channel-router] Race condition but no conv found:', convError)
          throw new Error('Failed to resolve conversation after race condition')
        }
      } else {
        console.error('[channel-router] Failed to create conversation:', convError)
        throw new Error('Failed to create conversation')
      }
    } else if (!newConv) {
      console.error('[channel-router] No conv returned after insert')
      throw new Error('Failed to create conversation')
    } else {
      conversationId = newConv.id
      log('conversation_created', { conversationId })
    }
  }

  // ── 1b. Atualizar timestamp da última mensagem do cliente (janela 24h Meta) ──
  if (!message.fromMe) {
    await supabase
      .from('ai_conversations')
      .update({ last_customer_message_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  // ── 2. Salvar mensagem na tabela unificada ──────────────────────────

  const { error: msgError } = await supabase
    .from('channel_messages')
    .insert({
      conversation_id: conversationId,
      channel_type: message.channelType,
      channel_instance_id: message.channelInstanceId,
      external_message_id: message.externalMessageId,
      sender_phone: message.senderPhone,
      sender_name: message.senderName,
      message_type: message.messageType,
      text_content: message.textContent,
      media_url: message.mediaUrl,
      media_mime_type: message.mediaMimeType,
      from_me: message.fromMe,
      timestamp: message.timestamp,
      raw_payload: message.rawPayload,
    })

  if (msgError) {
    // Duplicate message — skip
    if (msgError.code === '23505') {
      log('skip', { reason: 'duplicate_message' })
      return { conversationId, processed: false, skipped: 'duplicate' }
    }
    console.error('[channel-router] Failed to save message:', msgError)
  }

  // ── 3. Salvar como ai_message (bridge para compatibilidade) ─────────

  await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: message.textContent || `[${message.messageType}]`,
      channel_type: message.channelType,
    })
    .then(() => {})
    .catch((e: any) => console.error('[channel-router] ai_messages bridge error:', e))

  // ── 4. Invocar pipeline de processamento ────────────────────────────

  const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-incoming-message`
  try {
    const resp = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message_content: message.textContent || `[${message.messageType}]`,
        message_id: message.externalMessageId,
        channel_type: message.channelType,
        channel_instance_id: message.channelInstanceId,
      }),
    })

    const result = await resp.json().catch(() => ({}))
    log('pipeline_result', { status: resp.status, result })

    return { conversationId, processed: resp.ok }
  } catch (err: any) {
    console.error('[channel-router] Pipeline invoke error:', err)
    return { conversationId, processed: false }
  }
}

/**
 * Envia mensagem pelo canal correto baseado na conversa.
 * Usado pelo process-incoming-message para responder independente de canal.
 */
export async function sendViaChannel(
  supabase: any,
  conversationId: string,
  text: string,
  options?: Partial<SendMessageOptions>,
): Promise<SendMessageResult> {
  // Buscar dados da conversa
  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('communication_channel, channel_chat_id, channel_instance_id, customer_phone, uazapi_chat_id, whatsapp_instance_id')
    .eq('id', conversationId)
    .single()

  if (!conv) {
    return { success: false, error: 'Conversation not found' }
  }

  const channelType = (conv.communication_channel || 'uazapi') as ChannelType
  const adapter = getAdapter(channelType)

  if (!adapter) {
    console.error(`[channel-router] No adapter registered for channel: ${channelType}`)
    return { success: false, error: `No adapter for channel: ${channelType}` }
  }

  const instanceId = conv.channel_instance_id || conv.whatsapp_instance_id
  const recipient = conv.channel_chat_id || conv.uazapi_chat_id || conv.customer_phone

  if (!instanceId || !recipient) {
    return { success: false, error: 'Missing instance ID or recipient' }
  }

  return adapter.sendMessage(instanceId, {
    recipient,
    text,
    ...options,
  })
}
