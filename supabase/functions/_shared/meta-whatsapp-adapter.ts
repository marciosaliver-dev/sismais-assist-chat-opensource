/**
 * Meta WhatsApp Business API Adapter
 *
 * Implementa ChannelAdapter para WhatsApp Business API (Cloud API oficial da Meta).
 * Documentacao: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Diferencas chave vs UAZAPI:
 * - Webhook com verificacao de assinatura (HMAC SHA256)
 * - Envio via Graph API (v19.0+)
 * - Suporte a templates HSM para mensagens proativas
 * - Media precisa ser baixada via endpoint separado
 * - Webhook verification challenge (GET request)
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

const DEFAULT_API_VERSION = 'v21.0'

/** Mapeia tipo de mensagem Meta para normalizado */
function mapMetaMessageType(type: string): NormalizedMessageType {
  switch (type) {
    case 'text': return 'text'
    case 'image': return 'image'
    case 'audio': return 'audio'
    case 'video': return 'video'
    case 'document': return 'document'
    case 'sticker': return 'sticker'
    case 'location': return 'location'
    case 'contacts': return 'contact'
    case 'reaction': return 'reaction'
    case 'interactive': return 'interactive'
    case 'button': return 'interactive'
    default: return 'unknown'
  }
}

/** Extrai texto de qualquer tipo de mensagem Meta */
function extractTextContent(message: any): string {
  if (message.text?.body) return message.text.body
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title
  if (message.image?.caption) return message.image.caption
  if (message.video?.caption) return message.video.caption
  if (message.document?.caption) return message.document.caption
  if (message.button?.text) return message.button.text
  if (message.location) {
    return `[Localizacao: ${message.location.latitude}, ${message.location.longitude}]`
  }
  if (message.contacts) {
    const names = message.contacts.map((c: any) => c.name?.formatted_name || 'Contato').join(', ')
    return `[Contato: ${names}]`
  }
  if (message.reaction?.emoji) return `[Reacao: ${message.reaction.emoji}]`
  return ''
}

/** Instancia Meta WhatsApp do banco */
interface MetaWhatsAppInstance {
  id: string
  phone_number_id: string
  waba_id: string
  access_token: string
  display_name?: string
  phone_number?: string
  is_active: boolean
  webhook_verify_token?: string
  graphUrl: string
}

export class MetaWhatsAppAdapter implements ChannelAdapter {
  readonly channelType: ChannelType = 'meta_whatsapp'

  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  async parseWebhook(
    payload: Record<string, unknown>,
    instanceId: string,
  ): Promise<NormalizedIncomingMessage | null> {
    // Meta envia estrutura: { object: 'whatsapp_business_account', entry: [...] }
    const entry = (payload as any).entry?.[0]
    if (!entry) return null

    const changes = entry.changes?.[0]
    if (!changes || changes.field !== 'messages') return null

    const value = changes.value
    if (!value?.messages?.[0]) return null

    const message = value.messages[0]
    const contact = value.contacts?.[0]
    const metadata = value.metadata

    // Status updates nao sao mensagens
    if (value.statuses && !value.messages) return null

    const messageType = mapMetaMessageType(message.type)
    const textContent = extractTextContent(message)

    // Extrair media ID se aplicavel
    let mediaUrl: string | undefined
    let mediaMimeType: string | undefined
    let mediaFilename: string | undefined
    const mediaObj = message.image || message.audio || message.video || message.document || message.sticker
    if (mediaObj) {
      mediaUrl = mediaObj.id // Media ID — precisa ser baixado via downloadMedia
      mediaMimeType = mediaObj.mime_type
      mediaFilename = mediaObj.filename
    }

    return {
      externalMessageId: message.id,
      channelInstanceId: instanceId,
      channelType: 'meta_whatsapp',
      senderPhone: message.from, // Telefone sem @s.whatsapp.net
      senderName: contact?.profile?.name || '',
      chatId: message.from, // Em 1:1, chat ID = phone
      messageType,
      textContent,
      mediaUrl,
      mediaMimeType,
      mediaFilename,
      isGroup: false, // Cloud API nao suporta grupos diretamente
      fromMe: false, // Webhook so recebe mensagens incoming
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      rawPayload: payload,
      metadata: {
        phoneNumberId: metadata?.phone_number_id,
        displayPhoneNumber: metadata?.display_phone_number,
        waId: contact?.wa_id,
        contextMessageId: message.context?.id, // reply-to
      },
    }
  }

  async sendMessage(
    instanceId: string,
    options: SendMessageOptions,
  ): Promise<SendMessageResult> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) {
      return { success: false, error: 'Meta WhatsApp instance not found' }
    }

    try {
      const url = `${inst.graphUrl}/${inst.phone_number_id}/messages`

      let body: Record<string, unknown>

      // Template HSM
      if (options.templateName) {
        body = {
          messaging_product: 'whatsapp',
          to: options.recipient,
          type: 'template',
          template: {
            name: options.templateName,
            language: { code: options.templateLanguage || 'pt_BR' },
            components: options.templateParams?.length
              ? [{
                  type: 'body',
                  parameters: options.templateParams.map(p => ({ type: 'text', text: p })),
                }]
              : undefined,
          },
        }
      }
      // Mensagem interativa com botoes
      else if (options.buttons?.length) {
        body = {
          messaging_product: 'whatsapp',
          to: options.recipient,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: options.text },
            action: {
              buttons: options.buttons.map(b => ({
                type: 'reply',
                reply: { id: b.id, title: b.text.substring(0, 20) },
              })),
            },
          },
        }
      }
      // Media
      else if (options.mediaUrl && options.mediaType) {
        body = {
          messaging_product: 'whatsapp',
          to: options.recipient,
          type: options.mediaType,
          [options.mediaType]: {
            link: options.mediaUrl,
            caption: options.text || undefined,
          },
        }
      }
      // Texto simples
      else {
        body = {
          messaging_product: 'whatsapp',
          to: options.recipient,
          type: 'text',
          text: { body: options.text },
          ...(options.replyToMessageId ? { context: { message_id: options.replyToMessageId } } : {}),
        }
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inst.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const result = await resp.json()

      if (!resp.ok) {
        const errorMsg = result?.error?.message || `HTTP ${resp.status}`
        console.error(`[meta-whatsapp-adapter] Send error: ${errorMsg}`, result)
        return { success: false, error: errorMsg }
      }

      return {
        success: true,
        externalMessageId: result.messages?.[0]?.id,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) return { connected: false, error: 'Instance not found' }

    try {
      // Verificar se o token e valido fazendo um request ao phone number endpoint
      const url = `${inst.graphUrl}/${inst.phone_number_id}`
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })

      if (!resp.ok) {
        return { connected: false, error: `Token invalid or expired: ${resp.status}` }
      }

      const data = await resp.json()
      return {
        connected: true,
        phoneNumber: data.display_phone_number,
        displayName: data.verified_name || inst.display_name,
      }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  async verifyWebhook(
    request: Request,
    secret: string,
  ): Promise<boolean> {
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) return false

    const body = await request.clone().text()
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expectedSig = 'sha256=' + Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return signature === expectedSig
  }

  async sendTypingIndicator(instanceId: string, recipient: string): Promise<{ success: boolean; error?: string }> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) return { success: false, error: 'Instance not found' }

    try {
      const resp = await fetch(`${inst.graphUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${inst.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'typing-indicator',
          typing_action: 'typing_on',
        }),
      })

      if (resp.ok || resp.status === 200) {
        return { success: true }
      }
      
      const err = await resp.text()
      console.log('[meta-whatsapp-adapter] Typing indicator failed:', resp.status, err)
      // Não é crítico — typing indicator é cosmético
      return { success: true }
    } catch (err: any) {
      console.log('[meta-whatsapp-adapter] Typing indicator error:', err.message)
      return { success: true }
    }
  }

  async downloadMedia(
    instanceId: string,
    mediaId: string,
  ): Promise<{ url: string; mimeType: string } | null> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) return null

    try {
      // Passo 1: obter URL temporaria da media
      const metaResp = await fetch(`${inst.graphUrl}/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })
      if (!metaResp.ok) return null

      const metaData = await metaResp.json()
      return {
        url: metaData.url,
        mimeType: metaData.mime_type,
      }
    } catch {
      return null
    }
  }

  // ── Helpers privados ──────────────────────────────────────────────

  private async resolveInstance(instanceId: string): Promise<MetaWhatsAppInstance | null> {
    const { data } = await this.supabase
      .from('channel_instances')
      .select('id, config, is_active, display_name, phone_number')
      .eq('id', instanceId)
      .eq('channel_type', 'meta_whatsapp')
      .single()

    if (!data) return null

    const config = data.config as any
    const version = config.graph_api_version || DEFAULT_API_VERSION
    return {
      id: data.id,
      phone_number_id: config.phone_number_id,
      waba_id: config.waba_id,
      access_token: config.access_token,
      display_name: data.display_name,
      phone_number: data.phone_number,
      is_active: data.is_active,
      webhook_verify_token: config.webhook_verify_token,
      graphUrl: `https://graph.facebook.com/${version}`,
    }
  }
}
