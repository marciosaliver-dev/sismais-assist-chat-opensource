import { Bot, Clock, Star, Ticket, AlertTriangle, RefreshCw } from 'lucide-react'
import { useSupportKPIs } from '@/hooks/useSupportKPIs'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface AIStatusBarProps {
  boardId?: string
  periodHours?: number
  className?: string
}

interface MetricItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  status: 'ok' | 'warn' | 'crit' | 'neutral'
  tooltip?: string
}

function MetricItem({ icon: Icon, label, value, status, tooltip }: MetricItemProps) {
  const statusColors = {
    ok: 'text-emerald-400',
    warn: 'text-yellow-400',
    crit: 'text-red-400',
    neutral: 'text-white/50',
  }

  const dotColors = {
    ok: 'bg-emerald-400',
    warn: 'bg-yellow-400',
    crit: 'bg-red-400',
    neutral: 'bg-white/30',
  }

  const item = (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors cursor-default">
      <Icon className={cn('w-3.5 h-3.5 shrink-0', statusColors[status])} />
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[13px] font-bold text-white tabular-nums">{value}</span>
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[status])} />
      </div>
      <span className="text-xs text-white/50 whitespace-nowrap">{label}</span>
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    )
  }
  return item
}

export function AIStatusBar({ boardId, periodHours = 24, className }: AIStatusBarProps) {
  const { data: kpis, isLoading, refetch } = useSupportKPIs(boardId, periodHours)

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-2 bg-gms-navy', className)}>
        <RefreshCw className="w-3.5 h-3.5 text-white/40 animate-spin" />
        <span className="text-xs text-white/40">Carregando métricas...</span>
      </div>
    )
  }

  if (!kpis) return null

  const { avgFirstResponseMinutes, avgResolutionHours, slaCompliancePct, openTickets, criticalTickets } = kpis

  const responseStatus: MetricItemProps['status'] =
    avgFirstResponseMinutes === null ? 'neutral'
    : avgFirstResponseMinutes <= 15 ? 'ok'
    : avgFirstResponseMinutes <= 30 ? 'warn'
    : 'crit'

  const resolutionStatus: MetricItemProps['status'] =
    avgResolutionHours === null ? 'neutral'
    : avgResolutionHours <= 4 ? 'ok'
    : avgResolutionHours <= 8 ? 'warn'
    : 'crit'

  const slaStatus: MetricItemProps['status'] =
    slaCompliancePct === null ? 'neutral'
    : slaCompliancePct >= 90 ? 'ok'
    : slaCompliancePct >= 70 ? 'warn'
    : 'crit'

  const criticalStatus: MetricItemProps['status'] =
    criticalTickets === 0 ? 'ok'
    : criticalTickets <= 2 ? 'warn'
    : 'crit'

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-1.5 bg-gms-navy border-b border-white/[0.08] overflow-x-auto scrollbar-none',
      className
    )}>
      <div className="flex items-center gap-1.5 mr-2 shrink-0">
        <Bot className="w-4 h-4 text-gms-cyan" />
        <span className="text-[12px] font-semibold text-white/80">Métricas</span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <MetricItem
          icon={Clock}
          label="1ª Resposta"
          value={avgFirstResponseMinutes !== null ? `${avgFirstResponseMinutes}min` : '—'}
          status={responseStatus}
          tooltip={`Tempo médio de primeira resposta (${periodHours}h)`}
        />
        <MetricItem
          icon={Clock}
          label="Resolução"
          value={avgResolutionHours !== null ? `${avgResolutionHours}h` : '—'}
          status={resolutionStatus}
          tooltip={`Tempo médio de resolução (${periodHours}h)`}
        />
        <MetricItem
          icon={Star}
          label="SLA"
          value={slaCompliancePct !== null ? `${slaCompliancePct}%` : '—'}
          status={slaStatus}
          tooltip="Compliance SLA"
        />
        <MetricItem
          icon={Ticket}
          label="Abertos"
          value={String(openTickets)}
          status={openTickets === 0 ? 'ok' : openTickets <= 10 ? 'warn' : 'crit'}
          tooltip="Tickets em aberto"
        />
        <MetricItem
          icon={AlertTriangle}
          label="Críticos"
          value={String(criticalTickets)}
          status={criticalStatus}
          tooltip="Tickets críticos"
        />
      </div>

      <button
        onClick={() => refetch()}
        className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-md hover:bg-white/[0.06] shrink-0"
        title="Atualizar métricas"
        aria-label="Atualizar métricas"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
