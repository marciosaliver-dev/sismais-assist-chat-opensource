import { useMemo } from 'react'
import { useCustomer360 } from '@/hooks/useCustomer360'
import { useCrmTimeline } from '@/hooks/useCrmTimeline'
import { HealthScoreRing } from '@/components/clients/HealthScoreRing'
import { DataSourceBadge } from '@/components/clients/DataSourceBadge'
import { TimelineItem } from '@/components/clients/TimelineItem'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, AlertTriangle, TrendingUp, FileText, Activity } from 'lucide-react'
import { cn, formatBRL } from '@/lib/utils'

interface ClienteContextCardProps {
  clientId: string
}

const LIGHT_OPTIONS = { light: true, includeScores: false } as const
const TIMELINE_FILTERS = { limit: 5 } as const

export function ClienteContextCard({ clientId }: ClienteContextCardProps) {
  const { data: c360, isLoading } = useCustomer360(clientId, LIGHT_OPTIONS)
  const { data: recentEvents = [] } = useCrmTimeline(clientId, TIMELINE_FILTERS)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-secondary rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    )
  }

  if (!c360?.client) return null

  const client = c360.client
  const hasDebt = (client.debt_total || 0) > 0
  const hasChurnRisk = client.churn_risk === true

  return (
    <div className="space-y-3">
      {/* Health + Financial Card */}
      <div className="bg-secondary rounded-2xl p-3 space-y-3">
        {/* Health Score + Engagement + Tier */}
        <div className="flex items-center gap-3">
          <HealthScoreRing score={client.health_score} size="sm" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {client.customer_tier && (
                <Badge className="text-[10px] font-bold bg-[#10293F] text-white border-[#10293F]">
                  {client.customer_tier}
                </Badge>
              )}
              {hasChurnRisk && (
                <Badge className="text-[10px] font-bold gap-1 bg-[#FEF2F2] text-[#DC2626] border border-[rgba(220,38,38,0.3)] animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  Risco de Churn
                </Badge>
              )}
            </div>
            {client.engagement_score != null && (
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-[#45E5E5]" />
                <span className="text-[10px] text-muted-foreground">Engajamento</span>
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, client.engagement_score)}%`,
                      backgroundColor: client.engagement_score >= 70 ? '#16A34A' : client.engagement_score >= 40 ? '#FFB800' : '#DC2626',
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground">{client.engagement_score}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial row */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-background rounded-lg p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              <TrendingUp className="w-3 h-3" /> MRR
            </div>
            <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {client.mrr_total ? formatBRL(client.mrr_total) : '—'}
            </p>
          </div>
          <div className={cn(
            'rounded-lg p-2 text-center border',
            hasDebt ? 'bg-[#FEF2F2] border-[rgba(220,38,38,0.2)]' : 'bg-background border-border/50'
          )}>
            <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              <DollarSign className="w-3 h-3" /> Dívida
            </div>
            <p className={cn('text-sm font-bold', hasDebt ? 'text-[#DC2626]' : 'text-foreground')} style={{ fontFamily: "'Poppins', sans-serif" }}>
              {client.debt_total ? formatBRL(client.debt_total) : '—'}
            </p>
          </div>
          <div className="bg-background rounded-lg p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              <FileText className="w-3 h-3" /> Contratos
            </div>
            <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {client.active_contracts_count ?? 0}
            </p>
          </div>
        </div>

        {/* Data Sources */}
        {c360.data_sources && c360.data_sources.length > 0 && (
          <DataSourceBadge sources={c360.data_sources} />
        )}
      </div>

      {/* Mini Timeline */}
      {recentEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-[6px] rounded-full bg-primary" />
            <span className="text-xs font-bold text-foreground">Atividade Recente</span>
          </div>
          <div className="space-y-0.5">
            {recentEvents.map(event => (
              <TimelineItem key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
