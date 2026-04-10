import { Clock, CheckCircle2, TrendingUp, Inbox, AlertTriangle, RefreshCw } from 'lucide-react'
import { useSupportKPIs } from '@/hooks/useSupportKPIs'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface KPIWidgetProps {
  boardId?: string
  periodHours?: number
}

interface KPICardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  status: 'green' | 'yellow' | 'red' | 'neutral'
  tooltip?: string
}

function KPICard({ icon: Icon, label, value, status, tooltip }: KPICardProps) {
  const statusStyles = {
    green:   'text-emerald-600 dark:text-emerald-400',
    yellow:  'text-amber-600 dark:text-amber-400',
    red:     'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }

  const dotStyles = {
    green:   'bg-emerald-500',
    yellow:  'bg-amber-500',
    red:     'bg-red-500',
    neutral: 'bg-muted-foreground/40',
  }

  const card = (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50 border border-border hover:bg-muted/80 transition-colors min-w-0">
      <div className={cn('shrink-0', statusStyles[status])}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-bold tabular-nums', statusStyles[status])}>{value}</span>
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[status])} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    )
  }
  return card
}

export function KPIWidget({ boardId, periodHours = 24 }: KPIWidgetProps) {
  const { data: kpis, isLoading, refetch } = useSupportKPIs(boardId, periodHours)

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Carregando KPIs...
      </div>
    )
  }

  if (!kpis) return null

  const { avgFirstResponseMinutes, avgResolutionHours, slaCompliancePct, openTickets, criticalTickets } = kpis

  // Determine status colors
  const responseStatus: KPICardProps['status'] =
    avgFirstResponseMinutes === null ? 'neutral'
    : avgFirstResponseMinutes <= 15 ? 'green'
    : avgFirstResponseMinutes <= 30 ? 'yellow'
    : 'red'

  const resolutionStatus: KPICardProps['status'] =
    avgResolutionHours === null ? 'neutral'
    : avgResolutionHours <= 4 ? 'green'
    : avgResolutionHours <= 8 ? 'yellow'
    : 'red'

  const slaStatus: KPICardProps['status'] =
    slaCompliancePct === null ? 'neutral'
    : slaCompliancePct >= 90 ? 'green'
    : slaCompliancePct >= 70 ? 'yellow'
    : 'red'

  const criticalStatus: KPICardProps['status'] =
    criticalTickets === 0 ? 'green'
    : criticalTickets <= 2 ? 'yellow'
    : 'red'

  return (
    <div className="flex items-center gap-2 flex-wrap stagger-container">
      <KPICard
        icon={Clock}
        label="1ª Resposta"
        value={avgFirstResponseMinutes !== null ? `${avgFirstResponseMinutes}min` : '—'}
        status={responseStatus}
        tooltip={`Tempo médio de primeira resposta nas últimas ${periodHours}h`}
      />
      <KPICard
        icon={TrendingUp}
        label="Resolução"
        value={avgResolutionHours !== null ? `${avgResolutionHours}h` : '—'}
        status={resolutionStatus}
        tooltip={`Tempo médio de resolução nas últimas ${periodHours}h`}
      />
      <KPICard
        icon={CheckCircle2}
        label="SLA %"
        value={slaCompliancePct !== null ? `${slaCompliancePct}%` : '—'}
        status={slaStatus}
        tooltip="Percentual de tickets resolvidos dentro do SLA"
      />
      <KPICard
        icon={Inbox}
        label="Em aberto"
        value={String(openTickets)}
        status={openTickets === 0 ? 'green' : openTickets <= 10 ? 'yellow' : 'red'}
        tooltip="Tickets ainda não resolvidos"
      />
      <KPICard
        icon={AlertTriangle}
        label="Críticos"
        value={String(criticalTickets)}
        status={criticalStatus}
        tooltip="Tickets críticos em aberto"
      />
      <button
        onClick={() => refetch()}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        title="Atualizar KPIs"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  )
}
