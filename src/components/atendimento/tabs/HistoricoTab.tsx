import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sparkles, Bot, ArrowRight, User, Clock, MessageSquare } from 'lucide-react'
import { mockTimelineEvents, mockHistoryTickets } from '../mockData'
import type { AtendimentoTicket } from '../types'

interface Props {
  ticket: AtendimentoTicket
}

const iconMap: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  bot: Bot,
  'arrow-right': ArrowRight,
  user: User,
  clock: Clock,
  'message-square': MessageSquare,
}

const colorMap: Record<string, string> = {
  cyan: 'bg-[var(--gms-cyan)] text-[var(--gms-navy)]',
  purple: 'bg-[var(--gms-purple)] text-white',
  yellow: 'bg-[var(--gms-yellow)] text-[var(--gms-navy)]',
  navy: 'bg-[var(--gms-navy)] text-white',
  green: 'bg-[var(--gms-ok)] text-white',
}

export function HistoricoTab({ ticket }: Props) {
  const [note, setNote] = useState('')

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Linha do Tempo */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Linha do Tempo</h3>
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-[var(--gms-g200)]" />

          <div className="space-y-4">
            {mockTimelineEvents.map(event => {
              const Icon = iconMap[event.icon] || Clock
              return (
                <div key={event.id} className="relative flex gap-3">
                  {/* Dot */}
                  <div className={cn(
                    'absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center z-10',
                    colorMap[event.color] || 'bg-[var(--gms-g200)] text-[var(--gms-g500)]',
                  )}>
                    <Icon className="w-3 h-3" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--gms-navy)]">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-[var(--gms-g500)] mt-0.5">{event.description}</p>
                    )}
                  </div>
                  {/* Time */}
                  <span className="text-xs text-[var(--gms-g500)] flex-shrink-0 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Histórico de Tickets */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Histórico de Tickets</h3>
        <div className="space-y-2">
          {mockHistoryTickets.map(ht => (
            <div key={ht.id} className="border border-[var(--gms-g200)] rounded-lg p-2.5 hover:bg-[var(--gms-g100)]/50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-bold font-mono text-[var(--gms-navy)]">#{ht.ticketNumber}</span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[9px] font-semibold border',
                  ht.status === 'finalizado' && 'bg-[var(--gms-ok-bg)] text-[var(--gms-ok)] border-[var(--gms-ok)]/30',
                  ht.status === 'aberto' && 'bg-[var(--gms-info-bg)] text-[var(--gms-info)] border-[var(--gms-info)]/30',
                  ht.status === 'cancelado' && 'bg-[var(--gms-g100)] text-[var(--gms-g500)] border-[var(--gms-g200)]',
                )}>
                  {ht.status.charAt(0).toUpperCase() + ht.status.slice(1)}
                </span>
              </div>
              <p className="text-xs text-[var(--gms-g900)]">{ht.subject}</p>
              <p className="text-xs text-[var(--gms-g500)] mt-0.5">{ht.date}</p>

              {ht.aiSummary && (
                <div className="mt-2 p-2 bg-[var(--gms-info-bg)] rounded text-xs text-[var(--gms-info)]">
                  <span className="font-semibold">RESUMO IA:</span> {ht.aiSummary}
                </div>
              )}

              <button className="text-xs text-[var(--gms-cyan-dark)] font-medium mt-1.5 hover:underline">
                Ver Conversa ▾
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Observações Internas */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-2 font-[Poppins]">Observações Internas</h3>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Escreva uma nota interna (não enviada ao cliente)"
          className="w-full h-20 p-2.5 text-[12px] text-[var(--gms-g900)] placeholder:text-[var(--gms-g300)] border border-[var(--gms-g200)] rounded-lg resize-none outline-none focus:border-[var(--gms-cyan)] focus:ring-2 focus:ring-[var(--gms-cyan)]/15 transition-colors"
        />
      </section>
    </div>
  )
}
