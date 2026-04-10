import { useCancellationKPIs, CANCELLATION_REASONS, RETENTION_OFFERS } from '@/hooks/useCancellationKPIs'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { TrendingUp, Clock, DollarSign, PhoneOff, ShieldAlert, BarChart3, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) return '—'
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function CancellationDashboard() {
  const { data: boards, isLoading: boardsLoading } = useKanbanBoards()
  const board = boards?.find(b => b.board_type === 'cancellation')
  const { data, isLoading: kpisLoading } = useCancellationKPIs(board?.id, 30)

  const isLoading = boardsLoading || (board && kpisLoading)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <ShieldAlert className="w-10 h-10 text-gms-g300" />
        <p className="text-sm text-gms-g500">Nenhum board de cancelamento encontrado.</p>
      </div>
    )
  }

  const kpis = data ?? {
    reversalRate: null,
    avgFirstContactMinutes: null,
    mrrSaved: 0,
    mrrLost: 0,
    noResponseRate: null,
    totalTickets: 0,
    openTickets: 0,
    reasonRanking: [],
    offerEffectiveness: [],
  }

  const maxReasonCount = kpis.reasonRanking.length > 0
    ? Math.max(...kpis.reasonRanking.map(r => r.count))
    : 1

  return (
    <div className="page-container bg-gms-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gms-g200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gms-navy">Dashboard de Cancelamentos</h1>
            <p className="text-xs text-gms-g500">Métricas de retenção — últimos 30 dias</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Taxa de Reversão */}
          <Card className="p-5 border-gms-g200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <Target className="w-4 h-4 text-gms-navy" />
              </div>
              {kpis.reversalRate !== null && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-semibold',
                    kpis.reversalRate >= 40
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-red-300 bg-red-50 text-red-700'
                  )}
                >
                  Meta ≥ 40%
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-gms-navy">
              {kpis.reversalRate !== null ? `${kpis.reversalRate}%` : '—'}
            </p>
            <p className="text-xs text-gms-g500 mt-1">Taxa de Reversão</p>
          </Card>

          {/* Tempo Médio 1° Contato */}
          <Card className="p-5 border-gms-g200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gms-navy">
              {formatMinutes(kpis.avgFirstContactMinutes)}
            </p>
            <p className="text-xs text-gms-g500 mt-1">Tempo Médio 1° Contato</p>
          </Card>

          {/* MRR Salvo */}
          <Card className="p-5 border-gms-g200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(kpis.mrrSaved)}
            </p>
            <p className="text-xs text-gms-g500 mt-1">MRR Salvo</p>
          </Card>

          {/* MRR Perdido */}
          <Card className="p-5 border-gms-g200">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(kpis.mrrLost)}
            </p>
            <p className="text-xs text-gms-g500 mt-1">MRR Perdido</p>
          </Card>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Ranking de Motivos (60%) */}
          <Card className="lg:col-span-3 p-5 border-gms-g200">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-gms-navy" />
              <h2 className="text-sm font-semibold text-gms-navy">Ranking de Motivos</h2>
            </div>
            {kpis.reasonRanking.length === 0 ? (
              <p className="text-xs text-gms-g500 py-6 text-center">Sem dados no período.</p>
            ) : (
              <div className="space-y-3">
                {kpis.reasonRanking.map(({ reason, count }) => {
                  const pct = (count / maxReasonCount) * 100
                  return (
                    <div key={reason} className="flex items-center gap-3">
                      <span className="text-xs text-gms-g700 w-[160px] flex-shrink-0 truncate">
                        {CANCELLATION_REASONS[reason] || reason}
                      </span>
                      <div className="flex-1 h-6 bg-gms-g100 rounded overflow-hidden">
                        <div
                          className="h-full bg-gms-navy rounded transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gms-navy w-8 text-right">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Right: Efetividade por Oferta (40%) */}
          <Card className="lg:col-span-2 p-5 border-gms-g200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gms-navy" />
              <h2 className="text-sm font-semibold text-gms-navy">Efetividade por Oferta</h2>
            </div>
            {kpis.offerEffectiveness.length === 0 ? (
              <p className="text-xs text-gms-g500 py-6 text-center">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gms-g200">
                      <th className="text-left py-2 font-semibold text-gms-g500 uppercase tracking-wide">Oferta</th>
                      <th className="text-right py-2 font-semibold text-gms-g500 uppercase tracking-wide">Total</th>
                      <th className="text-right py-2 font-semibold text-gms-g500 uppercase tracking-wide">Revert.</th>
                      <th className="text-right py-2 font-semibold text-gms-g500 uppercase tracking-wide">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.offerEffectiveness.map(({ offer, total, reversed, rate }) => (
                      <tr
                        key={offer}
                        className={cn(
                          'border-b border-gms-g100',
                          rate >= 40 && 'bg-green-50'
                        )}
                      >
                        <td className="py-2 text-gms-g900">
                          {RETENTION_OFFERS[offer] || offer}
                        </td>
                        <td className="py-2 text-right text-gms-g700">{total}</td>
                        <td className="py-2 text-right text-gms-g700">{reversed}</td>
                        <td className={cn(
                          'py-2 text-right font-semibold',
                          rate >= 40 ? 'text-green-600' : 'text-gms-g700'
                        )}>
                          {rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Bottom stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border-gms-g200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gms-g100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gms-navy" />
            </div>
            <div>
              <p className="text-lg font-bold text-gms-navy">{kpis.totalTickets}</p>
              <p className="text-xs text-gms-g500">Total de Tickets</p>
            </div>
          </Card>

          <Card className="p-4 border-gms-g200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gms-navy">{kpis.openTickets}</p>
              <p className="text-xs text-gms-g500">Tickets em Aberto</p>
            </div>
          </Card>

          <Card className="p-4 border-gms-g200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <PhoneOff className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gms-navy">
                {kpis.noResponseRate !== null ? `${kpis.noResponseRate}%` : '—'}
              </p>
              <p className="text-xs text-gms-g500">Taxa Sem Resposta</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
