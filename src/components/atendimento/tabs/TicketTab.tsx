import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import { FlowStepper } from '../FlowStepper'
import { PriorityBadge } from '../PriorityBadge'
import { getFlowSteps } from '../mockData'
import type { AtendimentoTicket, AtendimentoPriority } from '../types'

interface Props {
  ticket: AtendimentoTicket
}

const priorities: AtendimentoPriority[] = ['alta', 'media', 'baixa']

export function TicketTab({ ticket }: Props) {
  const steps = getFlowSteps(ticket.status)

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Fluxo do Atendimento */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Fluxo do Atendimento</h3>
        <FlowStepper steps={steps} />
      </section>

      {/* Classificação */}
      <section className="border border-[var(--gms-g200)] rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-[var(--gms-cyan-light)]">
            <Info className="w-3 h-3 text-[var(--gms-cyan-dark)]" />
          </div>
          <h4 className="text-[12px] font-semibold text-[var(--gms-navy)] font-[Poppins]">Classificação</h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Número */}
          <div>
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Número</span>
            <p className="text-[16px] font-bold font-mono text-[var(--gms-navy)]">#{ticket.ticketNumber}</p>
          </div>

          {/* Status */}
          <div>
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Status</span>
            <div className="mt-0.5">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
                ticket.status === 'ag_cliente' && 'bg-[var(--gms-yellow-bg)] text-[var(--gms-warn)] border-[var(--gms-yellow)]/30',
                ticket.status === 'ag_interno' && 'bg-[var(--gms-purple)]/10 text-[var(--gms-purple)] border-[var(--gms-purple)]/30',
                ticket.status === 'em_atendimento' && 'bg-[var(--gms-info-bg)] text-[var(--gms-info)] border-[var(--gms-info)]/30',
                ticket.status === 'fila' && 'bg-[var(--col-fila)]/10 text-[var(--col-fila)] border-[var(--col-fila)]/30',
                ticket.status === 'concluido' && 'bg-[var(--gms-ok-bg)] text-[var(--gms-ok)] border-[var(--gms-ok)]/30',
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {ticket.status === 'fila' && 'Fila'}
                {ticket.status === 'em_atendimento' && 'Em Atendimento'}
                {ticket.status === 'ag_cliente' && 'Aguardando'}
                {ticket.status === 'ag_interno' && 'Aguard. Interno'}
                {ticket.status === 'concluido' && 'Concluído'}
              </span>
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Prioridade</span>
            <div className="flex gap-1 mt-1">
              {priorities.map(p => (
                <button
                  key={p}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                    p === ticket.priority
                      ? 'border-current opacity-100'
                      : 'border-[var(--gms-g200)] text-[var(--gms-g500)] opacity-50',
                  )}
                >
                  <PriorityBadge priority={p} />
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Categoria</span>
            <p className="text-[12px] text-[var(--gms-g900)] mt-0.5">{ticket.category || '—'}</p>
          </div>

          {/* Módulo */}
          <div>
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Módulo</span>
            <p className="text-[12px] text-[var(--gms-g900)] mt-0.5">{ticket.module || '—'}</p>
          </div>

          {/* Criado em */}
          <div>
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Criado em</span>
            <p className="text-[12px] text-[var(--gms-g900)] mt-0.5">
              {new Date(ticket.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Responsável */}
          <div className="col-span-2">
            <span className="text-xs text-[var(--gms-g500)] uppercase tracking-wide">Responsável</span>
            <p className="text-[12px] font-semibold text-[var(--gms-navy)] mt-0.5">
              {ticket.assignee?.name || 'Não atribuído'}
            </p>
          </div>
        </div>
      </section>

      {/* Título / Assunto */}
      <section>
        <span className="text-xs font-semibold text-[var(--gms-cyan-dark)] uppercase tracking-wide">Título / Assunto</span>
        <div className="mt-1 p-2.5 bg-[var(--gms-bg)] border border-[var(--gms-g200)] rounded-lg">
          <p className="text-[12px] text-[var(--gms-g900)]">{ticket.subject}</p>
        </div>
      </section>

      {/* Resumo */}
      <section>
        <span className="text-xs font-semibold text-[var(--gms-cyan-dark)] uppercase tracking-wide">Resumo do problema</span>
        <div className="mt-1 p-2.5 bg-[var(--gms-yellow-bg)] border border-[var(--gms-yellow)]/20 rounded-lg">
          <p className="text-[12px] text-[var(--gms-g900)]">{ticket.lastMessage}</p>
        </div>
      </section>

      {/* Detalhamento */}
      <section>
        <span className="text-xs font-semibold text-[var(--gms-cyan-dark)] uppercase tracking-wide">Detalhamento</span>
        <div className="mt-1 p-2.5 bg-[var(--gms-info-bg)] border border-[var(--gms-info)]/20 rounded-lg">
          <p className="text-[12px] text-[var(--gms-g900)]">
            Cliente relatou problema ao {ticket.subject.toLowerCase()}. Categoria: {ticket.category}. Módulo: {ticket.module}.
          </p>
        </div>
      </section>
    </div>
  )
}
