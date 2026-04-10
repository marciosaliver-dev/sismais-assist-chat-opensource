/**
 * Channel Adapter Pattern — Interface abstrata para canais de comunicacao
 *
 * Normaliza mensagens de qualquer canal (UAZAPI, Meta WhatsApp API, Instagram)
 * para um formato unificado que o pipeline de processamento entende.
 *
 * Cada canal implementa esta interface com sua logica especifica de parsing,
 * envio e download de media.
 */

// ── Tipos normalizados ──────────────────────────────────────────────

/** Canal de origem da mensagem */
export type ChannelType = 'uazapi' | 'meta_whatsapp' | 'instagram'

/** Tipo de mensagem normalizado */
export type NormalizedMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction' | 'interactive' | 'unknown'

/** Mensagem normalizada — formato unico independente de canal */
export interface NormalizedIncomingMessage {
  /** ID unico da mensagem no canal de origem */
  externalMessageId: string
  /** ID do canal/instancia no nosso sistema */
  channelInstanceId: string
  /** Tipo do canal */
  channelType: ChannelType
  /** Telefone ou identificador do remetente */
  senderPhone: string
  /** Nome do remetente (push name) */
  senderName: string
  /** ID do chat no canal (JID, thread_id, etc.) */
  chatId: string
  /** Tipo da mensagem normalizado */
  messageType: NormalizedMessageType
  /** Conteudo texto da mensagem */
  textContent: string
  /** URL de media (se aplicavel) */
  mediaUrl?: string
  /** MIME type da media (se aplicavel) */
  mediaMimeType?: string
  /** Nome do arquivo (se aplicavel) */
  mediaFilename?: string
  /** Mensagem e de grupo? */
  isGroup: boolean
  /** Mensagem enviada por nos? */
  fromMe: boolean
  /** Timestamp da mensagem (ISO 8601) */
  timestamp: string
  /** Dados brutos do webhook (para debug) */
  rawPayload?: Record<string, unknown>
  /** Metadados adicionais do canal */
  metadata?: Record<string, unknown>
}

/** Opcoes para envio de mensagem */
export interface SendMessageOptions {
  /** Destinatario (telefone, chat ID, etc.) */
  recipient: string
  /** Texto da mensagem */
  text: string
  /** URL de media para enviar */
  mediaUrl?: string
  /** Tipo de media */
  mediaType?: 'image' | 'audio' | 'video' | 'document'
  /** Botoes interativos (se suportado) */
  buttons?: Array<{ id: string; text: string }>
  /** Template HSM (Meta WhatsApp API) */
  templateName?: string
  templateLanguage?: string
  templateParams?: string[]
  /** Reply to message ID */
  replyToMessageId?: string
}

/** Resultado do envio */
export interface SendMessageResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

/** Status de conexao do canal */
export interface ChannelStatus {
  connected: boolean
  phoneNumber?: string
  displayName?: string
  lastSeen?: string
  error?: string
}

// ── Interface do Adapter ────────────────────────────────────────────

/**
 * Interface que todo channel adapter deve implementar.
 *
 * Metodos:
 * - parseWebhook: Converte payload do webhook para formato normalizado
 * - sendMessage: Envia mensagem pelo canal
 * - getStatus: Verifica status da conexao
 * - verifyWebhook: Verifica assinatura/token do webhook (seguranca)
 * - downloadMedia: Baixa media do canal
 * - sendTypingIndicator: Envia indicador de "digitando"
 */
export interface ChannelAdapter {
  /** Tipo do canal */
  readonly channelType: ChannelType

  /**
   * Converte o payload bruto do webhook para mensagem normalizada.
   * Retorna null se o payload nao e uma mensagem processavel (status update, echo, etc.)
   */
  parseWebhook(
    payload: Record<string, unknown>,
    instanceId: string,
  ): Promise<NormalizedIncomingMessage | null>

  /**
   * Envia mensagem pelo canal.
   */
  sendMessage(
    instanceId: string,
    options: SendMessageOptions,
  ): Promise<SendMessageResult>

  /**
   * Verifica status da conexao/instancia.
   */
  getStatus(instanceId: string): Promise<ChannelStatus>

  /**
   * Verifica assinatura/autenticidade do webhook.
   * Retorna true se o webhook e valido.
   */
  verifyWebhook(
    request: Request,
    secret: string,
  ): Promise<boolean>

  /**
   * Baixa media de uma mensagem.
   * Retorna URL acessivel ou base64.
   */
  downloadMedia?(
    instanceId: string,
    mediaId: string,
  ): Promise<{ url: string; mimeType: string } | null>

  /**
   * Envia indicador de "digitando" para o cliente.
   * Retorna success mesmo se falhar — é cosmético.
   */
  sendTypingIndicator?(
    instanceId: string,
    recipient: string,
  ): Promise<{ success: boolean; error?: string }>
}

// ── Registry de adapters ────────────────────────────────────────────

const adapterRegistry = new Map<ChannelType, ChannelAdapter>()

/** Registra um adapter para um tipo de canal */
export function registerAdapter(adapter: ChannelAdapter): void {
  adapterRegistry.set(adapter.channelType, adapter)
}

/** Retorna o adapter para um tipo de canal */
export function getAdapter(channelType: ChannelType): ChannelAdapter | undefined {
  return adapterRegistry.get(channelType)
}

/** Retorna todos os adapters registrados */
export function getAllAdapters(): ChannelAdapter[] {
  return Array.from(adapterRegistry.values())
}
