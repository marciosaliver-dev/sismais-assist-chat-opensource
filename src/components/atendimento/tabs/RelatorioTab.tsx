import { cn } from '@/lib/utils'
import { Timer, MessageSquare, Zap, SmilePlus, Meh, Frown, Bot } from 'lucide-react'
import { SLAIndicator } from '../SLAIndicator'
import type { AtendimentoTicket } from '../types'

interface Props {
  ticket: AtendimentoTicket
}

export function RelatorioTab({ ticket }: Props) {
  const sentimentConfig = {
    positive: { icon: SmilePlus, label: 'Positivo', color: 'text-[var(--gms-ok)]', bg: 'bg-[var(--gms-ok-bg)]' },
    neutral: { icon: Meh, label: 'Neutro', color: 'text-[var(--gms-warn)]', bg: 'bg-[var(--gms-yellow-bg)]' },
    negative: { icon: Frown, label: 'Negativo', color: 'text-[var(--gms-err)]', bg: 'bg-[var(--gms-err-bg)]' },
  }

  const sentiment = sentimentConfig[ticket.sentiment || 'neutral']
  const SentimentIcon = sentiment.icon

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Stats Grid */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Métricas</h3>
        <div className="grid grid-cols-3 gap-2">
          {/* Tempo */}
          <StatCard
            bg="bg-[var(--gms-navy)]"
            textColor="text-white"
            value={ticket.tempoFila || ticket.tempoAtendimento || '—'}
            label="Tempo"
            icon={<Timer className="w-4 h-4 text-[var(--gms-cyan)]" />}
          />
          {/* Mensagens */}
          <StatCard
            bg="bg-white border border-[var(--gms-g200)]"
            textColor="text-[var(--gms-navy)]"
            value={String(ticket.messageCount)}
            label="Mensagens"
            icon={<MessageSquare className="w-4 h-4 text-[var(--gms-yellow)]" />}
          />
          {/* 1ª Resposta */}
          <StatCard
            bg="bg-white border border-[var(--gms-g200)]"
            textColor="text-[var(--gms-navy)]"
            value={ticket.sla.firstResponse.label}
            label="1ª Resposta"
            icon={<Zap className="w-4 h-4 text-[var(--gms-yellow)]" />}
          />
        </div>
      </section>

      {/* Distribuição de Mensagens */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Distribuição de Mensagens</h3>
        <div className="space-y-2">
          <BarRow label="Cliente" value={60} color="bg-[var(--gms-info)]" />
          <BarRow label="Agente" value={40} color="bg-[var(--gms-navy)]" />
        </div>
      </section>

      {/* Status dos SLAs */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Status dos SLAs</h3>
        <div className="space-y-3">
          <SLAIndicator sla={ticket.sla.firstResponse} title="1ª Resposta" />
          <SLAIndicator sla={ticket.sla.resolution} title="Resolução" />
        </div>
      </section>

      {/* Sentimento / Modo / CSAT */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-3 font-[Poppins]">Indicadores</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className={cn('rounded-lg p-3 flex flex-col items-center gap-1.5', sentiment.bg)}>
            <SentimentIcon className={cn('w-5 h-5', sentiment.color)} />
            <span className="text-[9px] text-[var(--gms-g500)]">Sentimento</span>
            <span className={cn('text-xs font-semibold', sentiment.color)}>{sentiment.label}</span>
          </div>
          <div className="rounded-lg p-3 flex flex-col items-center gap-1.5 bg-[var(--gms-purple)]/5">
            <Bot className="w-5 h-5 text-[var(--gms-purple)]" />
            <span className="text-[9px] text-[var(--gms-g500)]">Modo</span>
            <span className="text-xs font-semibold text-[var(--gms-purple)]">
              {ticket.agent?.type === 'ai' ? 'IA' : 'Humano'}
            </span>
          </div>
          <div className="rounded-lg p-3 flex flex-col items-center gap-1.5 bg-[var(--gms-cyan-light)]">
            <SmilePlus className="w-5 h-5 text-[var(--gms-cyan-dark)]" />
            <span className="text-[9px] text-[var(--gms-g500)]">CSAT</span>
            <span className="text-xs font-semibold text-[var(--gms-navy)]">—</span>
          </div>
        </div>
      </section>

      {/* Análise IA */}
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--gms-navy)] mb-2 font-[Poppins]">Análise IA</h3>
        <div className="p-3 bg-[var(--gms-info-bg)] border border-[var(--gms-info)]/20 rounded-lg">
          <p className="text-xs text-[var(--gms-g900)] leading-relaxed">
            Atendimento com {ticket.messageCount} mensagens trocadas. Tempo de primeira resposta dentro do SLA.
            {ticket.slaEstourado ? ' SLA de resolução estourado — requer atenção.' : ' Resolução dentro do prazo esperado.'}
            {ticket.sentiment === 'negative' ? ' Cliente demonstra insatisfação.' : ''}
          </p>
        </div>
      </section>
    </div>
  )
}

function StatCard({ bg, textColor, value, label, icon }: {
  bg: string; textColor: string; value: string; label: string; icon: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg p-3 flex flex-col', bg)}>
      <div className="mb-2">{icon}</div>
      <span className={cn('text-[16px] font-bold font-[Poppins]', textColor)}>{value}</span>
      <span className={cn('text-[9px] mt-0.5', textColor === 'text-white' ? 'text-white/60' : 'text-[var(--gms-g500)]')}>{label}</span>
    </div>
  )
}

function BarRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--gms-g700)] w-14">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-[var(--gms-g100)] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-[var(--gms-g900)] w-8 text-right">{value}%</span>
    </div>
  )
}
