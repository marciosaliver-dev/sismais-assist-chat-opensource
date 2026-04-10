import { cn } from '@/lib/utils'
import { MessageSquare, AlertTriangle, Clock } from 'lucide-react'
import { PriorityBadge } from './PriorityBadge'
import { SLAIndicator } from './SLAIndicator'
import type { AtendimentoTicket } from './types'

interface Props {
  ticket: AtendimentoTicket
  isActive?: boolean
  onClick: (ticket: AtendimentoTicket) => void
  variant?: 'queue' | 'kanban'
}

const statusLabels: Record<string, { label: string; color: string }> = {
  fila: { label: 'NA FILA', color: 'text-[var(--col-fila)]' },
  em_atendimento: { label: 'EM ATENDIMENTO', color: 'text-[var(--col-atendimento)]' },
  ag_cliente: { label: 'AGUARDANDO CLIENTE', color: 'text-[var(--col-ag-cliente)]' },
  ag_interno: { label: 'AGUARDANDO INTERNO', color: 'text-[var(--col-ag-interno)]' },
  concluido: { label: 'CONCLUÍDO', color: 'text-[var(--col-concluido)]' },
}

const avatarColors = [
  'bg-[var(--gms-navy)]',
  'bg-[var(--gms-info)]',
  'bg-[var(--gms-purple)]',
  'bg-[var(--gms-cyan-dark)]',
  'bg-[var(--gms-ok)]',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export function TicketCard({ ticket, isActive, onClick, variant = 'queue' }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(ticket)
    }
  }

  if (variant === 'kanban') {
    return <KanbanVariant ticket={ticket} isActive={isActive} onClick={onClick} onKeyDown={handleKeyDown} />
  }

  return <QueueVariant ticket={ticket} isActive={isActive} onClick={onClick} onKeyDown={handleKeyDown} />
}

// ── Queue Variant ─────────────────────────────────────

function QueueVariant({
  ticket,
  isActive,
  onClick,
  onKeyDown,
}: {
  ticket: AtendimentoTicket
  isActive?: boolean
  onClick: (t: AtendimentoTicket) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(ticket)}
      onKeyDown={onKeyDown}
      aria-label={`Ticket #${ticket.ticketNumber} - ${ticket.customerName}`}
      className={cn(
        'p-3 border-b border-[var(--gms-g200)]/50 cursor-pointer transition-all duration-150',
        'hover:bg-[var(--gms-bg)]',
        isActive && 'bg-[var(--gms-cyan-light)] border-l-[3px] border-l-[var(--gms-cyan)]',
        ticket.slaEstourado && !isActive && 'border-l-[3px] border-l-[var(--gms-err)]',
        !isActive && !ticket.slaEstourado && 'border-l-[3px] border-l-transparent',
      )}
    >
      {/* SLA Alert */}
      {ticket.slaEstourado && (
        <div className="flex items-center gap-1 bg-[var(--gms-err-bg)] border border-[var(--gms-err)]/20 rounded px-2 py-1 mb-2">
          <AlertTriangle className="w-3 h-3 text-[var(--gms-err)]" />
          <span className="text-xs font-bold text-[var(--gms-err)]">SLA de Resolução Estourado</span>
        </div>
      )}

      {/* Top row: avatar + name + ticket ID */}
      <div className="flex items-start gap-2.5">
        <div className={cn(
          'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white',
          getAvatarColor(ticket.customerName),
        )}>
          {ticket.customerInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-semibold text-[var(--gms-navy)] truncate">{ticket.customerName}</span>
            <span className="text-xs font-mono text-[var(--gms-g500)] flex-shrink-0">#{ticket.ticketNumber}</span>
          </div>
          <span className="text-xs text-[var(--gms-g500)]">{ticket.customerPhone}</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <PriorityBadge priority={ticket.priority} />
        {ticket.category && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-[var(--gms-g700)] bg-[var(--gms-g100)] border border-[var(--gms-g200)]">
            {ticket.category}
          </span>
        )}
      </div>

      {/* Preview */}
      <p className="text-[12px] text-[var(--gms-g500)] mt-1.5 truncate">{ticket.lastMessage}</p>

      {/* SLA metrics */}
      <div className="mt-2 space-y-1">
        <SLAIndicator sla={ticket.sla.firstResponse} title="1ª Resposta" compact />
        <SLAIndicator sla={ticket.sla.resolution} title="Resolução" compact />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--gms-g200)]/30">
        <div className="flex items-center gap-1.5">
          {ticket.assignee && (
            <>
              <div className="w-[18px] h-[18px] rounded-full bg-[var(--gms-navy)] text-[var(--gms-cyan)] flex items-center justify-center text-[8px] font-bold">
                {ticket.assignee.initials}
              </div>
              <span className="text-xs text-[var(--gms-g500)]">{ticket.assignee.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ticket.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded-full text-[9px] text-[var(--gms-g700)] border border-[var(--gms-g200)]">
              {tag}
            </span>
          ))}
          <div className="flex items-center gap-0.5 text-[var(--gms-g500)]">
            <MessageSquare className="w-3 h-3" />
            <span className="text-xs">{ticket.messageCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Variant ────────────────────────────────────

function KanbanVariant({
  ticket,
  isActive,
  onClick,
  onKeyDown,
}: {
  ticket: AtendimentoTicket
  isActive?: boolean
  onClick: (t: AtendimentoTicket) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  const statusInfo = statusLabels[ticket.status]
  const priorityBorderColors: Record<string, string> = {
    critica: 'border-l-[var(--gms-purple)]',
    urgente: 'border-l-[var(--gms-err)]',
    alta: 'border-l-[var(--gms-err)]',
    media: 'border-l-[var(--gms-yellow)]',
    baixa: 'border-l-[var(--gms-ok)]',
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(ticket)}
      onKeyDown={onKeyDown}
      aria-label={`Ticket #${ticket.ticketNumber} - ${ticket.customerName}`}
      className={cn(
        'bg-white border border-[var(--gms-g200)] rounded-lg p-3 pl-3.5 cursor-pointer',
        'border-l-[3px] transition-all duration-150',
        priorityBorderColors[ticket.priority],
        'hover:shadow-[var(--gms-sh-md)] hover:-translate-y-px',
        isActive && 'border-[var(--gms-cyan)] shadow-[0_0_0_2px_rgba(69,229,229,0.3)]',
      )}
    >
      {/* SLA Alert */}
      {ticket.slaEstourado && (
        <div className="flex items-center gap-1 bg-[var(--gms-err-bg)] border border-[var(--gms-err)]/20 rounded px-2 py-1 mb-2 -mt-1">
          <AlertTriangle className="w-3 h-3 text-[var(--gms-err)]" />
          <span className="text-xs font-bold text-[var(--gms-err)]">SLA de Resolução Estourado</span>
        </div>
      )}

      {/* Status sublabel */}
      {ticket.status !== 'concluido' && statusInfo && (
        <div className="flex items-center gap-1 mb-1.5">
          <Clock className="w-3 h-3" style={{ color: 'var(--gms-g500)' }} />
          <span className={cn('text-[9px] font-bold uppercase tracking-wide', statusInfo.color)}>
            {statusInfo.label}
          </span>
        </div>
      )}

      {/* Header: ID + priority */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-[var(--gms-g500)]">#{ticket.ticketNumber}</span>
        <PriorityBadge priority={ticket.priority} />
      </div>

      {/* Subject */}
      <p className="text-[13px] font-medium text-[var(--gms-navy)] leading-snug mb-2 line-clamp-2">
        {ticket.subject}
      </p>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap mb-2">
        {ticket.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs font-medium text-[var(--gms-g700)] bg-[var(--gms-g100)] border border-[var(--gms-g200)] px-1.5 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className={cn(
          'w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold',
          'bg-[var(--gms-navy)] text-[var(--gms-cyan)]',
        )}>
          {ticket.assignee?.initials || ticket.customerInitials}
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--gms-g500)]">
          <Clock className="w-3 h-3" />
          {ticket.lastMessageTime}
        </div>
      </div>
    </div>
  )
}
