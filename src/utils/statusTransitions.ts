export type ConversationStatus =
  | 'aguardando'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'finalizado'
  | 'resolvido'
  | 'cancelado'

const ALLOWED_TRANSITIONS: Record<string, ConversationStatus[]> = {
  aguardando: ['em_atendimento', 'finalizado', 'cancelado'],
  em_atendimento: ['aguardando_cliente', 'finalizado', 'cancelado'],
  aguardando_cliente: ['em_atendimento', 'finalizado'],
  finalizado: ['em_atendimento'], // reabrir
  resolvido: ['em_atendimento'],  // reabrir
  cancelado: [],
}

const CLOSED_STATUSES: ConversationStatus[] = ['finalizado', 'resolvido', 'cancelado']

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.includes(status as ConversationStatus)
}

export function isTransitionAllowed(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to as ConversationStatus)
}

export function getTransitionError(from: string, to: string): string | null {
  if (isTransitionAllowed(from, to)) return null

  if (from === 'cancelado') {
    return 'Atendimentos cancelados não podem ser reabertos.'
  }
  if (from === to) {
    return 'O atendimento já está neste status.'
  }
  return `Transição de "${from}" para "${to}" não é permitida.`
}

export const CLOSE_REASONS = [
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'sem_resposta', label: 'Sem resposta do cliente' },
  { value: 'duplicado', label: 'Duplicado' },
  { value: 'cancelado_cliente', label: 'Cancelado pelo cliente' },
  { value: 'encaminhado', label: 'Encaminhado externamente' },
] as const

export type CloseReason = typeof CLOSE_REASONS[number]['value']
