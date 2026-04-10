export type AtendimentoPriority = 'baixa' | 'media' | 'alta' | 'urgente' | 'critica'
export type AtendimentoStatus = 'fila' | 'em_atendimento' | 'ag_cliente' | 'ag_interno' | 'concluido'

export interface AtendimentoTicket {
  id: string
  ticketNumber: number
  customerName: string
  customerPhone: string
  customerInitials: string
  subject: string
  lastMessage: string
  lastMessageTime: string
  status: AtendimentoStatus
  priority: AtendimentoPriority
  assignee?: { id: string; name: string; initials: string }
  agent?: { id: string; name: string; type: 'ai' | 'human' }
  unreadCount: number
  createdAt: string
  updatedAt: string
  channel: 'whatsapp'
  tags: string[]
  module?: string
  category?: string
  sla: {
    firstResponse: { percentUsed: number; status: 'ok' | 'warn' | 'critical'; label: string }
    resolution: { percentUsed: number; status: 'ok' | 'warn' | 'critical'; label: string }
  }
  slaEstourado?: boolean
  client?: {
    id: string
    name: string
    companyName?: string
    cnpj?: string
    email?: string
    phone?: string
    product?: string
    licenseStatus?: string
  }
  aiConfidence?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
  tempoFila?: string
  tempoAtendimento?: string
  messageCount: number
}

export interface AtendimentoMessage {
  id: string
  ticketId: string
  content: string
  sender: 'customer' | 'agent' | 'ai' | 'system'
  senderName?: string
  timestamp: string
  isInternal?: boolean
}

export interface FlowStep {
  id: string
  label: string
  status: 'done' | 'current' | 'pending'
  timestamp?: string
}

export interface KBArticle {
  id: string
  title: string
  excerpt: string
  relevance: number
  category: string
  tags: string[]
}

export interface AISuggestion {
  id: string
  content: string
  confidence: number
  source?: string
}

export interface AtendimentoColumn {
  id: AtendimentoStatus
  label: string
  icon: string
  color: string
  tickets: AtendimentoTicket[]
}

export interface TimelineEvent {
  id: string
  type: 'created' | 'assigned' | 'stage_changed' | 'message' | 'note' | 'sla_warning'
  title: string
  description?: string
  timestamp: string
  icon: string
  color: string
}

export interface HistoryTicket {
  id: string
  ticketNumber: number
  subject: string
  status: 'finalizado' | 'aberto' | 'cancelado'
  date: string
  aiSummary?: string
}
