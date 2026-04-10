/**
 * UAZAPI Channel Adapter
 *
 * Implementa ChannelAdapter para o canal UAZAPI (self-hosted WhatsApp).
 * Refatora a logica existente do uazapi-webhook e uazapi-proxy como adapter.
 *
 * NOTA: Este adapter e um wrapper fino sobre a logica existente.
 * A migracao completa do webhook monolitico (2061 linhas) para usar
 * este adapter sera feita em fases (ref: E16, D5).
 */

import {
  type ChannelAdapter,
  type ChannelType,
  type NormalizedIncomingMessage,
  type NormalizedMessageType,
  type SendMessageOptions,
  type SendMessageResult,
  type ChannelStatus,
} from './channel-adapter.ts'

/** Extrai telefone de um JID WhatsApp */
function extractPhone(jid: string): string {
  return jid
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
    .replace(/[\s\-\+\(\)]/g, '')
}

/** Mapeia tipo UAZAPI para tipo normalizado */
function mapMessageType(rawType: string): NormalizedMessageType {
  const t = rawType.toLowerCase()
  if (t === 'text' || t === 'extendedtextmessage' || t === 'conversation') return 'text'
  if (t === 'image' || t === 'imagemessage') return 'image'
  if (t === 'audio' || t === 'ptt' || t === 'audiomessage') return 'audio'
  if (t === 'video' || t === 'videomessage') return 'video'
  if (t === 'document' || t === 'documentmessage') return 'document'
  if (t === 'sticker' || t === 'stickermessage') return 'sticker'
  if (t === 'location' || t === 'locationmessage') return 'location'
  if (t === 'contact' || t === 'contactmessage' || t === 'contactsarraymessage') return 'contact'
  if (t === 'reaction' || t === 'reactionmessage') return 'reaction'
  return 'unknown'
}

/** Instancia UAZAPI resolvida do banco */
interface UazapiInstance {
  id: string
  api_url: string
  api_token: string
  instance_name: string
  profile_name?: string
  is_active: boolean
}

export class UazapiAdapter implements ChannelAdapter {
  readonly channelType: ChannelType = 'uazapi'

  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  async parseWebhook(
    payload: Record<string, unknown>,
    instanceId: string,
  ): Promise<NormalizedIncomingMessage | null> {
    const msg = (payload as any).message || (payload as any).data?.message || (payload as any).data
    if (!msg) return null

    const fromMe = msg.fromMe === true || msg.key?.fromMe === true || msg.wasSentByApi === true
    const chatJid = msg.chatid || msg.key?.remoteJid || msg.from || (payload as any).chat?.id || ''
    const senderJid = msg.sender || msg.key?.remoteJid || chatJid
    const msgId = msg.messageid || msg.key?.id || msg.id || crypto.randomUUID()
    const pushName = msg.senderName || msg.pushName || (payload as any).chat?.wa_name || (payload as any).sender?.pushName || ''

    // Extrair telefone real
    const senderPn = msg.sender_pn || (payload as any).event?.sender_pn || ''
    let phoneNumber = ''
    if (senderPn && /\d{8,}/.test(extractPhone(senderPn))) {
      phoneNumber = extractPhone(senderPn)
    } else if (/\d{8,}/.test(extractPhone(chatJid))) {
      phoneNumber = extractPhone(chatJid)
    }

    // Tipo e conteudo
    const rawType = msg.messageType || msg.type || msg.mediaType || 'text'
    const messageType = mapMessageType(rawType)

    const textBody = msg.text || msg.body || msg.caption ||
      msg.content?.conversation || msg.content?.extendedTextMessage?.text ||
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''

    const isGroup = chatJid.includes('@g.us')

    // Timestamp
    const ts = msg.messageTimestamp || msg.timestamp || Math.floor(Date.now() / 1000)
    const timestamp = typeof ts === 'number'
      ? new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
      : new Date(ts).toISOString()

    // Filtrar mensagens nao processaveis
    const skipTypes = ['pollupdatemessage', 'poll_update', 'pollupdate']
    if (skipTypes.includes(rawType.toLowerCase())) return null

    // Protocol messages (revoke/edit) — retornar null para tratar separadamente
    const protocolMsg = msg.content?.protocolMessage || msg.message?.protocolMessage
    if (protocolMsg && (protocolMsg.type === 0 || protocolMsg.type === 'REVOKE')) return null

    return {
      externalMessageId: msgId,
      channelInstanceId: instanceId,
      channelType: 'uazapi',
      senderPhone: phoneNumber,
      senderName: pushName,
      chatId: chatJid,
      messageType,
      textContent: textBody,
      mediaUrl: msg.mediaUrl || msg.fileUrl || undefined,
      mediaMimeType: msg.mimetype || msg.media_mimetype || undefined,
      isGroup,
      fromMe,
      timestamp,
      rawPayload: payload,
      metadata: {
        remoteJid: msg.key?.remoteJid,
        senderJid,
        instanceName: (payload as any).instanceName || (payload as any).instance,
        baseUrl: (payload as any).BaseUrl,
      },
    }
  }

  async sendMessage(
    instanceId: string,
    options: SendMessageOptions,
  ): Promise<SendMessageResult> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) {
      return { success: false, error: 'UAZAPI instance not found' }
    }

    const apiUrl = inst.api_url.replace(/\/$/, '')

    try {
      // Resolver LID se necessario
      let recipient = options.recipient
      if (recipient && !/^\d/.test(recipient) && !recipient.includes('@')) {
        const { data: chatPhoneRecord } = await this.supabase
          .from('uazapi_chats')
          .select('contact_phone')
          .eq('chat_id', recipient)
          .eq('instance_id', inst.id)
          .maybeSingle()

        let realPhone = chatPhoneRecord?.contact_phone
        if (!realPhone || !/^\d{8,}/.test(realPhone)) {
          const { data: convPhoneRecord } = await this.supabase
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

      // Envio por tipo
      if (options.mediaUrl && options.mediaType) {
        const endpoint = options.mediaType === 'image' ? '/send/image'
          : options.mediaType === 'audio' ? '/send/audio'
          : options.mediaType === 'video' ? '/send/video'
          : '/send/document'

        const resp = await fetch(`${apiUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
          body: JSON.stringify({
            number: recipient,
            url: options.mediaUrl,
            caption: options.text,
            fileName: options.mediaFilename,
          }),
        })
        if (!resp.ok) {
          const errBody = await resp.text()
          return { success: false, error: `UAZAPI send error [${resp.status}]: ${errBody}` }
        }
        const result = await resp.json()
        return { success: true, externalMessageId: result?.key?.id }
      }

      // Mensagem de texto simples
      const resp = await fetch(`${apiUrl}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': inst.api_token },
        body: JSON.stringify({ number: recipient, text: options.text }),
      })

      if (!resp.ok) {
        const errBody = await resp.text()
        return { success: false, error: `UAZAPI send error [${resp.status}]: ${errBody}` }
      }

      const result = await resp.json()

      // Log mensagem enviada (fire-and-forget)
      if (result?.key?.id) {
        this.supabase.from('uazapi_messages').insert({
          message_id: result.key.id,
          chat_id: null,
          instance_id: inst.id,
          type: 'text',
          text_body: options.text,
          from_me: true,
          sender_name: inst.profile_name || 'AI Assistant',
          timestamp: new Date().toISOString(),
          status: 'sent',
        }).then(() => {}).catch((e: any) => console.error('[uazapi-adapter] Log sent msg error:', e))
      }

      return { success: true, externalMessageId: result?.key?.id }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) return { connected: false, error: 'Instance not found' }

    try {
      const apiUrl = inst.api_url.replace(/\/$/, '')
      const resp = await fetch(`${apiUrl}/status`, {
        headers: { 'token': inst.api_token },
      })
      if (!resp.ok) return { connected: false, error: `Status check failed: ${resp.status}` }
      const data = await resp.json()
      return {
        connected: data.connected === true || data.status === 'CONNECTED',
        phoneNumber: data.phoneNumber || data.wid?.user,
        displayName: data.pushName || inst.profile_name,
      }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  async sendTypingIndicator(instanceId: string, recipient: string): Promise<{ success: boolean; error?: string }> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) return { success: false, error: 'Instance not found' }

    const apiUrl = inst.api_url.replace(/\/$/, '')
    
    // Normalizar recipient para JID
    let jid = recipient
    if (!recipient.includes('@')) {
      jid = `${recipient}@s.whatsapp.net`
    }

    // Tentar múltiplos endpoints de typing indicator
    const endpoints = [
      { method: 'POST', endpoint: '/chat/typing', body: { number: recipient, typing: true } },
      { method: 'POST', endpoint: '/message/typing', body: { to: jid } },
      { method: 'POST', endpoint: '/chat/sendTyping', body: { to: jid } },
    ]

    for (const { method, endpoint, body } of endpoints) {
      try {
        const resp = await fetch(`${apiUrl}${endpoint}`, {
          method,
          headers: { 
            'Content-Type': 'application/json',
            'token': inst.api_token,
          },
          body: body ? JSON.stringify(body) : undefined,
        })
        // Accept 200-299 or 400 (maybe already handled)
        if (resp.ok || resp.status === 400) {
          console.log(`[uazapi-adapter] Typing indicator sent via ${endpoint}`)
          return { success: true }
        }
      } catch (e) {
        console.log(`[uazapi-adapter] Typing endpoint ${endpoint} failed:`, e)
      }
    }

    // Não é crítico — typing indicator é cosmético
    console.warn('[uazapi-adapter] All typing indicator endpoints failed, continuing anyway')
    return { success: true }
  }

  async verifyWebhook(
    _request: Request,
    _secret: string,
  ): Promise<boolean> {
    // UAZAPI nao tem verificacao de assinatura — autenticidade e por IP/token
    return true
  }

  // ── Helpers privados ──────────────────────────────────────────────

  private instanceCache = new Map<string, { data: UazapiInstance; ts: number }>()
  private readonly CACHE_TTL = 300_000 // 5 min

  private async resolveInstance(instanceId: string): Promise<UazapiInstance | null> {
    const cached = this.instanceCache.get(instanceId)
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.data

    const { data } = await this.supabase
      .from('uazapi_instances')
      .select('id, api_url, api_token, instance_name, profile_name, is_active')
      .eq('id', instanceId)
      .single()

    if (data) {
      this.instanceCache.set(instanceId, { data, ts: Date.now() })
    }
    return data
  }
}
