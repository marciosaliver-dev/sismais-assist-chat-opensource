import { useState } from 'react'
import { useDemandMetrics, type DemandFilters } from '@/hooks/useDemandMetrics'
import { useDashboardFilters } from '@/contexts/DashboardFilterContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Minus, BarChart3, Layers, Tag, CalendarDays } from 'lucide-react'

const COLORS = ['#45E5E5', '#10293F', '#FFB800', '#2563EB', '#7C3AED', '#16A34A', '#DC2626', '#EA580C', '#666666', '#0891B2']

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function HeatmapCell({ count, maxCount }: { count: number; maxCount: number }) {
  const intensity = maxCount > 0 ? count / maxCount : 0
  const bg = intensity === 0
    ? 'bg-muted'
    : intensity < 0.33
    ? 'bg-[#E8F9F9]'
    : intensity < 0.66
    ? 'bg-[#45E5E5]/40'
    : 'bg-[#45E5E5]'
  const text = intensity >= 0.66 ? 'text-[#10293F] font-semibold' : 'text-muted-foreground'

  return (
    <div className={`w-10 h-10 rounded flex items-center justify-center text-xs ${bg} ${text}`}>
      {count || ''}
    </div>
  )
}

export function DemandDashboard() {
  const { debouncedFilters: globalFilters } = useDashboardFilters()
  const [filters, setFilters] = useState<DemandFilters>({
    period: '30d',
    handlerType: 'all',
  })

  const mergedFilters: DemandFilters = {
    ...filters,
    categoryIds: globalFilters.categoryIds,
    moduleIds: globalFilters.moduleIds,
    boardIds: globalFilters.boardIds,
    humanAgentIds: globalFilters.humanAgentIds,
    aiAgentIds: globalFilters.aiAgentIds,
  }

  const { data, isLoading } = useDemandMetrics(mergedFilters)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const compIcon = (data?.comparisonPercent ?? 0) > 0
    ? <TrendingUp className="w-4 h-4 text-[#DC2626]" />
    : (data?.comparisonPercent ?? 0) < 0
    ? <TrendingDown className="w-4 h-4 text-[#16A34A]" />
    : <Minus className="w-4 h-4 text-muted-foreground" />

  const heatmapMax = Math.max(...(data?.categoryByDayOfWeek?.map(h => h.count) || [1]))
  const heatmapCategories = [...new Set(data?.categoryByDayOfWeek?.map(h => h.category) || [])]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filters.period} onValueChange={(v) => setFilters(f => ({ ...f, period: v as DemandFilters['period'] }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.handlerType || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, handlerType: v as DemandFilters['handlerType'] }))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ai">Somente IA</SelectItem>
            <SelectItem value="human">Somente Humano</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          {compIcon}
          <span className={`text-sm font-semibold ${(data?.comparisonPercent ?? 0) > 0 ? 'text-[#DC2626]' : (data?.comparisonPercent ?? 0) < 0 ? 'text-[#16A34A]' : 'text-muted-foreground'}`}>
            {data?.comparisonPercent !== undefined ? `${data.comparisonPercent > 0 ? '+' : ''}${data.comparisonPercent}%` : '--'}
          </span>
          <span className="text-xs text-muted-foreground">vs período anterior</span>
          <span className="ml-3 text-sm font-bold text-[#10293F] dark:text-foreground">
            {data?.totalConversations ?? 0} conversas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#45E5E5]" />
              Top Categorias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.topCategories || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} tick={{ fill: '#666' }} />
                <Tooltip formatter={(v: number) => [v, 'Tickets']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(data?.topCategories || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Modules */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#10293F]" />
              Top Módulos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.topModules || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} tick={{ fill: '#666' }} />
                <Tooltip formatter={(v: number) => [v, 'Tickets']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(data?.topModules || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap: category x day of week */}
      {heatmapCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#FFB800]" />
              Demanda por Dia da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="text-left pr-3 pb-2 text-muted-foreground font-medium">Categoria</th>
                    {DAY_NAMES.map(d => (
                      <th key={d} className="text-center pb-2 text-muted-foreground font-medium px-1">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapCategories.map(cat => (
                    <tr key={cat}>
                      <td className="pr-3 py-1 font-medium text-[#10293F] dark:text-foreground whitespace-nowrap">{cat}</td>
                      {DAY_NAMES.map((_, dayIdx) => {
                        const cell = data?.categoryByDayOfWeek?.find(h => h.category === cat && h.dayOfWeek === dayIdx)
                        return (
                          <td key={dayIdx} className="px-1 py-1">
                            <HeatmapCell count={cell?.count || 0} maxCount={heatmapMax} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Subjects */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#7C3AED]" />
            Top Assuntos (classificação IA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Assunto</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Qtd</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topSubjects || []).map((s, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium text-[#10293F] dark:text-foreground">{s.subject}</td>
                    <td className="py-2 text-right font-semibold">{s.count}</td>
                    <td className="py-2 text-right text-muted-foreground">{s.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
