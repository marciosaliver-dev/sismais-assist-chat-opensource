import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ArrowRightLeft, CheckCircle2, Clock, AlertTriangle, Link2, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './ChatMessage'
import { ChatComposer } from './ChatComposer'
import { PriorityBadge } from './PriorityBadge'
import { getMessagesForTicket } from './mockData'
import type { AtendimentoTicket, AtendimentoMessage } from './types'

interface Props {
  ticket: AtendimentoTicket
}

const statusPills: Record<string, { label: string; dotColor: string }> = {
  fila: { label: 'Fila', dotColor: 'bg-[var(--col-fila)]' },
  em_atendimento: { label: 'Em Atendimento', dotColor: 'bg-[var(--col-atendimento)]' },
  ag_cliente: { label: 'Aguard. Cliente', dotColor: 'bg-[var(--col-ag-cliente)]' },
  ag_interno: { label: 'Aguard. Interno', dotColor: 'bg-[var(--col-ag-interno)]' },
  concluido: { label: 'Concluído', dotColor: 'bg-[var(--col-concluido)]' },
}

export function ChatPanel({ ticket }: Props) {
  const [messages, setMessages] = useState<AtendimentoMessage[]>([])
  const [showCnpjAlert, setShowCnpjAlert] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(getMessagesForTicket(ticket.id))
  }, [ticket.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback((text: string) => {
    const newMsg: AtendimentoMessage = {
      id: `m-${Date.now()}`,
      ticketId: ticket.id,
      content: text,
      sender: 'agent',
      senderName: ticket.assignee?.name || 'Você',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, newMsg])
  }, [ticket.id, ticket.assignee?.name])

  const statusPill = statusPills[ticket.status]

  return (
    <div className="flex flex-col h-full bg-white">
      {/* CNPJ Alert */}
      {showCnpjAlert && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#FEF2F2] border-b-2 border-[#DC2626] animate-cnpj-alert" role="alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#DC2626] animate-bounce flex-shrink-0" />
            <span className="text-[14px] font-bold text-[#991B1B]">
              😤 Antes de Pedir CNPJ ao Cliente consulte o cadastro na aba Cliente pelo Telefone ou Nome
            </span>
          </div>
          <button
            onClick={() => setShowCnpjAlert(false)}
            className="p-1 rounded hover:bg-[#DC2626]/20 transition-colors flex-shrink-0"
            aria-label="Fechar alerta"
          >
            <X className="w-4 h-4 text-[#991B1B]" />
          </button>
        </div>
      )}

      {/* Alert bar (no client linked) */}
      {!ticket.client && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--gms-yellow-bg)] border-b border-[var(--gms-yellow)]">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#92400E]" />
            <span className="text-xs text-[#92400E]">Nenhum cliente vinculado a este atendimento.</span>
          </div>
          <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--gms-cyan)] text-[var(--gms-navy)] text-xs font-bold hover:bg-[var(--gms-cyan-hover)] transition-colors">
            <Link2 className="w-3 h-3" />
            Vincular Cliente
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--gms-g200)]">
        <div className="w-[38px] h-[38px] rounded-full bg-[var(--gms-navy)] text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
          {ticket.customerInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[var(--gms-navy)]">{ticket.customerName}</span>
            <span className="text-xs font-mono text-[var(--gms-g500)]">#{ticket.ticketNumber}</span>
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="text-xs text-[var(--gms-g500)] truncate">{ticket.subject}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {/* Status pill */}
          {statusPill && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-[var(--gms-g200)] rounded-md text-xs text-[var(--gms-g700)]">
              <span className={cn('w-2 h-2 rounded-full', statusPill.dotColor)} />
              {statusPill.label}
            </span>
          )}
          {/* Transfer */}
          <button
            className="inline-flex items-center gap-1 px-2.5 py-1 border border-[var(--gms-g200)] rounded-md text-xs text-[var(--gms-g700)] hover:bg-[var(--gms-g100)] transition-colors"
            aria-label="Transferir atendimento"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transferir
          </button>
          {/* Time badge */}
          {(ticket.tempoFila || ticket.tempoAtendimento) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--gms-g100)] rounded-md text-xs text-[var(--gms-g500)]">
              <Clock className="w-3 h-3" />
              {ticket.tempoFila || ticket.tempoAtendimento}
            </span>
          )}
          {/* Resolve */}
          <button
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--gms-ok)] text-white rounded-md text-xs font-medium hover:bg-[var(--gms-ok)]/90 transition-colors"
            aria-label="Resolver ticket"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 bg-[var(--gms-bg)]">
        <div className="p-4 space-y-3 min-h-full flex flex-col justify-end">
          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <ChatComposer onSend={handleSend} customerName={ticket.customerName.split(' ')[0]} />
    </div>
  )
}
