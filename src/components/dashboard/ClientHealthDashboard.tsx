import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Heart, DollarSign, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportKPICards, ReportKPI } from '@/components/reports/ReportKPICards'
import { HealthScoreRing } from '@/components/clients/HealthScoreRing'
import { TimelineItem } from '@/components/clients/TimelineItem'
import { useClientHealthMetrics } from '@/hooks/useClientHealthMetrics'
import { useRecentTimeline } from '@/hooks/useCrmTimeline'
import { formatBRL } from '@/lib/utils'

function healthAccent(score: number): 'success' | 'yellow' | 'error' {
  if (score >= 80) return 'success'
  if (score >= 50) return 'yellow'
  return 'error'
}

function DonutChart({ good, medium, poor }: { good: number; medium: number; poor: number }) {
  const total = good + medium + poor
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de health score
      </div>
    )
  }

  const goodAngle = (good / total) * 360
  const mediumAngle = (medium / total) * 360

  const pct = (n: number) => Math.round((n / total) * 100)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <div
          className="w-full h-full rounded-full"
          style={{
            background: `conic-gradient(
              #16A34A 0deg ${goodAngle}deg,
              #FFB800 ${goodAngle}deg ${goodAngle + mediumAngle}deg,
              #DC2626 ${goodAngle + mediumAngle}deg 360deg
            )`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-card flex items-center justify-center">
            <span className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
              {total}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
          Bom ({pct(good)}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFB800]" />
          Médio ({pct(medium)}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
          Baixo ({pct(poor)}%)
        </span>
      </div>
    </div>
  )
}

// TODO: Global dashboard filters (useDashboardFilters) could be applied here in the future.
// Client health is not directly filterable by ticket categories/boards since it's a different
// entity — it would require a join through ai_conversations which is too complex for this phase.
export function ClientHealthDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useClientHealthMetrics()
  const { data: timeline, isLoading: timelineLoading } = useRecentTimeline(20)
  const navigate = useNavigate()

  const kpis = useMemo<ReportKPI[]>(() => {
    if (!metrics) return []
    return [
      {
        icon: Users,
        title: 'Total Clientes',
        value: metrics.totalClients,
        subtitle: 'Ativos no helpdesk',
        accent: 'navy' as const,
      },
      {
        icon: Heart,
        title: 'Health Médio',
        value: metrics.avgHealthScore,
        subtitle: metrics.avgHealthScore >= 80 ? 'Saudável' : metrics.avgHealthScore >= 50 ? 'Atenção' : 'Crítico',
        accent: healthAccent(metrics.avgHealthScore),
      },
      {
        icon: DollarSign,
        title: 'MRR Total',
        value: formatBRL(metrics.totalMrr),
        subtitle: 'Receita recorrente mensal',
        accent: 'cyan' as const,
      },
      {
        icon: AlertTriangle,
        title: 'Em Risco',
        value: metrics.churnRiskCount,
        subtitle: 'Risco de churn',
        accent: metrics.churnRiskCount > 0 ? 'error' as const : 'success' as const,
      },
    ]
  }, [metrics])

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <ReportKPICards kpis={kpis} loading={false} />

      {/* Distribution + Churn Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#10293F] flex items-center justify-center">
              <Heart className="h-4 w-4 text-[#45E5E5]" />
            </div>
            <h2 className="text-sm font-semibold text-[#10293F] dark:text-foreground uppercase tracking-wide">
              Distribuição de Saúde
            </h2>
          </div>
          {metrics && (
            <DonutChart
              good={metrics.healthDistribution.good}
              medium={metrics.healthDistribution.medium}
              poor={metrics.healthDistribution.poor}
            />
          )}
        </div>

        {/* Churn Risk Table */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#10293F] flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-[#45E5E5]" />
            </div>
            <h2 className="text-sm font-semibold text-[#10293F] dark:text-foreground uppercase tracking-wide">
              Top Risco de Churn
            </h2>
          </div>
          {metrics?.topChurnRisk && metrics.topChurnRisk.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-3">
                      Cliente
                    </th>
                    <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 px-3">
                      Saúde
                    </th>
                    <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 pl-3">
                      MRR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topChurnRisk.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-muted/50 transition-colors duration-150"
                    >
                      <td className="py-2.5 pr-3">
                        <p className="text-sm font-medium text-[#10293F] dark:text-foreground truncate max-w-[180px]">
                          {client.name}
                        </p>
                        {client.company_name && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {client.company_name}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex justify-center">
                          <HealthScoreRing score={client.health_score} size="sm" />
                        </div>
                      </td>
                      <td className="py-2.5 pl-3 text-right text-sm font-medium text-[#10293F] dark:text-foreground whitespace-nowrap">
                        {formatBRL(client.mrr_total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Nenhum cliente em risco
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#10293F] flex items-center justify-center">
            <Users className="h-4 w-4 text-[#45E5E5]" />
          </div>
          <h2 className="text-sm font-semibold text-[#10293F] dark:text-foreground uppercase tracking-wide">
            Atividade Recente
          </h2>
        </div>
        {timelineLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="w-6 h-6 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : timeline && timeline.length > 0 ? (
          <div className="divide-y divide-border/50">
            {timeline.map((event) => (
              <TimelineItem key={event.id} event={event} compact />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Nenhuma atividade recente
          </div>
        )}
      </div>
    </div>
  )
}
