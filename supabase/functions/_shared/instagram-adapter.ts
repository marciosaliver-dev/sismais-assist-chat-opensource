/**
 * Instagram Messaging API Adapter
 *
 * Implementa ChannelAdapter para Instagram DMs e Stories mentions.
 * Documentacao: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging
 *
 * Diferencas chave:
 * - Usa mesma Graph API da Meta mas com endpoints de Instagram
 * - Mensagens via /me/messages (Instagram Send API)
 * - Webhook com verificacao de assinatura (HMAC SHA256) — mesmo padrao Meta
 * - Suporta: text, image, story_mention, story_reply, quick_replies
 * - NAO suporta: templates HSM, botoes interativos complexos, audio/video direto
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

const META_API_VERSION = 'v19.0'
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`

/** Mapeia tipo de mensagem Instagram para normalizado */
function mapInstagramMessageType(message: any): NormalizedMessageType {
  if (message.attachments?.[0]?.type === 'image') return 'image'
  if (message.attachments?.[0]?.type === 'video') return 'video'
  if (message.attachments?.[0]?.type === 'audio') return 'audio'
  if (message.attachments?.[0]?.type === 'share') return 'unknown' // Post share
  if (message.attachments?.[0]?.type === 'story_mention') return 'unknown'
  if (message.is_deleted) return 'unknown'
  return 'text'
}

/** Extrai conteudo de texto da mensagem Instagram */
function extractTextContent(message: any): string {
  if (message.text) return message.text
  if (message.attachments?.[0]?.type === 'story_mention') {
    return '[Story mention]'
  }
  if (message.attachments?.[0]?.type === 'share') {
    return `[Post compartilhado: ${message.attachments[0].payload?.url || ''}]`
  }
  return ''
}

/** Instancia Instagram do banco */
interface InstagramInstance {
  id: string
  ig_user_id: string
  page_id: string
  access_token: string
  display_name?: string
  username?: string
  is_active: boolean
}

export class InstagramAdapter implements ChannelAdapter {
  readonly channelType: ChannelType = 'instagram'

  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  async parseWebhook(
    payload: Record<string, unknown>,
    instanceId: string,
  ): Promise<NormalizedIncomingMessage | null> {
    // Instagram envia estrutura similar ao Messenger:
    // { object: 'instagram', entry: [{ messaging: [...] }] }
    const entry = (payload as any).entry?.[0]
    if (!entry) return null

    const messaging = entry.messaging?.[0]
    if (!messaging) return null

    // Ignorar echos (mensagens enviadas por nos)
    if (messaging.message?.is_echo) return null

    // Ignorar delecoes
    if (messaging.message?.is_deleted) return null

    // Ignorar postbacks (tratar separadamente se necessario)
    if (messaging.postback && !messaging.message) return null

    const message = messaging.message
    if (!message) return null

    const senderId = messaging.sender?.id || ''
    const recipientId = messaging.recipient?.id || ''

    const messageType = mapInstagramMessageType(message)
    const textContent = extractTextContent(message)

    // Media
    let mediaUrl: string | undefined
    let mediaMimeType: string | undefined
    const attachment = message.attachments?.[0]
    if (attachment?.payload?.url) {
      mediaUrl = attachment.payload.url
      // Instagram nao fornece MIME type — inferir do tipo
      mediaMimeType = attachment.type === 'image' ? 'image/jpeg'
        : attachment.type === 'video' ? 'video/mp4'
        : attachment.type === 'audio' ? 'audio/mp4'
        : undefined
    }

    return {
      externalMessageId: message.mid || crypto.randomUUID(),
      channelInstanceId: instanceId,
      channelType: 'instagram',
      senderPhone: senderId, // Instagram usa IDs, nao telefones
      senderName: '', // Precisaria de API call extra para obter nome
      chatId: senderId, // Thread ID = sender ID em DMs 1:1
      messageType,
      textContent,
      mediaUrl,
      mediaMimeType,
      isGroup: false,
      fromMe: false,
      timestamp: messaging.timestamp
        ? new Date(messaging.timestamp).toISOString()
        : new Date().toISOString(),
      rawPayload: payload,
      metadata: {
        recipientId,
        isStoryMention: attachment?.type === 'story_mention',
        isStoryReply: !!message.reply_to?.story,
        storyUrl: message.reply_to?.story?.url,
        referralSource: messaging.referral?.source,
      },
    }
  }

  async sendMessage(
    instanceId: string,
    options: SendMessageOptions,
  ): Promise<SendMessageResult> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) {
      return { success: false, error: 'Instagram instance not found' }
    }

    try {
      const url = `${META_GRAPH_URL}/${inst.ig_user_id}/messages`

      let body: Record<string, unknown>

      // Imagem
      if (options.mediaUrl && options.mediaType === 'image') {
        body = {
          recipient: { id: options.recipient },
          message: {
            attachment: {
              type: 'image',
              payload: { url: options.mediaUrl },
            },
          },
        }
      }
      // Quick replies (alternativa a botoes no Instagram)
      else if (options.buttons?.length) {
        body = {
          recipient: { id: options.recipient },
          message: {
            text: options.text,
            quick_replies: options.buttons.slice(0, 13).map(b => ({
              content_type: 'text',
              title: b.text.substring(0, 20),
              payload: b.id,
            })),
          },
        }
      }
      // Texto simples
      else {
        body = {
          recipient: { id: options.recipient },
          message: { text: options.text },
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
        console.error(`[instagram-adapter] Send error: ${errorMsg}`, result)
        return { success: false, error: errorMsg }
      }

      return {
        success: true,
        externalMessageId: result.message_id,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async getStatus(instanceId: string): Promise<ChannelStatus> {
    const inst = await this.resolveInstance(instanceId)
    if (!inst) return { connected: false, error: 'Instance not found' }

    try {
      // Verificar token fazendo request ao perfil
      const url = `${META_GRAPH_URL}/${inst.ig_user_id}?fields=username,name`
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })

      if (!resp.ok) {
        return { connected: false, error: `Token invalid or expired: ${resp.status}` }
      }

      const data = await resp.json()
      return {
        connected: true,
        displayName: data.name || data.username || inst.display_name,
      }
    } catch (err: any) {
      return { connected: false, error: err.message }
    }
  }

  async verifyWebhook(
    request: Request,
    secret: string,
  ): Promise<boolean> {
    // Mesmo padrao da Meta (HMAC SHA256)
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

  async sendTypingIndicator(_instanceId: string, _recipient: string): Promise<{ success: boolean; error?: string }> {
    // Instagram Direct não suporta typing indicator via API
    // Retornar success para não bloquear o fluxo
    return { success: true }
  }

  // ── Helpers privados ──────────────────────────────────────────────

  private async resolveInstance(instanceId: string): Promise<InstagramInstance | null> {
    const { data } = await this.supabase
      .from('channel_instances')
      .select('id, config, is_active, display_name')
      .eq('id', instanceId)
      .eq('channel_type', 'instagram')
      .single()

    if (!data) return null

    const config = data.config as any
    return {
      id: data.id,
      ig_user_id: config.ig_user_id,
      page_id: config.page_id,
      access_token: config.access_token,
      display_name: data.display_name,
      username: config.username,
      is_active: data.is_active,
    }
  }
}
