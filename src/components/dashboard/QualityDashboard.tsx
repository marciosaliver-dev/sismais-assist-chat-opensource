import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportKPICards } from '@/components/reports/ReportKPICards'
import { useQualityMetrics, formatCompactTime, type PeriodFilter } from '@/hooks/useQualityMetrics'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Timer, Star, ShieldCheck, CheckCircle2, Users, CalendarIcon, Bot, Headphones, Award, TrendingUp, BarChart3, PieChart as PieChartIcon, BarChart2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDashboardFilters } from '@/contexts/DashboardFilterContext'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
]

const CSAT_COLORS = ['#DC2626', '#EA580C', '#FFB800', '#16A34A', '#10293F']

const NAVY_TOOLTIP = {
  backgroundColor: '#10293F',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  boxShadow: '0 4px 14px rgba(16,41,63,0.3)',
}

export function QualityDashboard() {
  const [period, setPeriod] = useState<PeriodFilter>('7d')
  const [customStart, setCustomStart] = useState<Date>()
  const [customEnd, setCustomEnd] = useState<Date>()
  const [agentId, setAgentId] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const { debouncedFilters } = useDashboardFilters()

  const {
    kpis, humanKpis, aiKpis, queueCount, dailyTrends, statusByDay, agentStats,
    csatDistribution, hourlyVolume, agents, categories, isLoading,
  } = useQualityMetrics({
    period,
    customStart,
    customEnd,
    agentId: agentId || undefined,
    category: category || undefined,
    categoryIds: debouncedFilters.categoryIds,
    moduleIds: debouncedFilters.moduleIds,
    boardIds: debouncedFilters.boardIds,
    humanAgentIds: debouncedFilters.humanAgentIds,
    aiAgentIds: debouncedFilters.aiAgentIds,
  })

  const { data: aiEvalAvg } = useQuery({
    queryKey: ['ai-eval-avg', period, customStart, customEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_service_evaluations')
        .select('overall_score')
        .eq('evaluation_type', 'ai')
      if (!data || data.length === 0) return null
      const avg = data.reduce((s: number, e: any) => s + (e.overall_score || 0), 0) / data.length
      return { avg: avg.toFixed(1), count: data.length }
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  const humanKpiCards = [
    { icon: Timer, title: 'TPRH Médio', value: formatCompactTime(humanKpis.tprh), subtitle: '1ª Resposta Humana', accent: 'navy' as const },
    { icon: Clock, title: 'TMA Médio', value: formatCompactTime(humanKpis.tma), subtitle: 'Tempo Médio Atendimento', accent: 'cyan' as const },
    { icon: Star, title: 'CSAT Médio', value: humanKpis.csatAvg ? `${humanKpis.csatAvg}/5` : '--', subtitle: 'Atendimentos humanos', accent: 'yellow' as const },
    { icon: ShieldCheck, title: 'SLA Cumprido', value: `${humanKpis.slaRate}%`, subtitle: 'Primeira resposta', accent: 'success' as const },
    { icon: CheckCircle2, title: 'Finalizados', value: humanKpis.totalFinished, subtitle: 'Por humanos', accent: 'purple' as const },
  ]

  const aiKpiCards = [
    { icon: Bot, title: 'Resolvidos pela IA', value: aiKpis.totalResolved, subtitle: 'No período', accent: 'cyan' as const },
    { icon: CheckCircle2, title: 'Taxa de Resolução IA', value: `${aiKpis.resolutionRate}%`, subtitle: 'do total', accent: 'success' as const },
    { icon: Star, title: 'CSAT Médio IA', value: aiKpis.csatAvg ? `${aiKpis.csatAvg}/5` : '--', subtitle: 'Atendimentos IA', accent: 'yellow' as const },
    { icon: Users, title: 'Na Fila Agora', value: queueCount, subtitle: 'Tempo real', accent: 'navy' as const },
    ...(aiEvalAvg ? [{ icon: Award, title: 'Avaliação IA', value: `${aiEvalAvg.avg}/10`, subtitle: `${aiEvalAvg.count} avaliações`, accent: 'purple' as const }] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customStart && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customEnd && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Select value={agentId || 'all'} onValueChange={(v) => setAgentId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos agentes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos agentes</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Atendimentos Humanos */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#10293F] flex items-center justify-center">
            <Headphones className="h-4 w-4 text-[#45E5E5]" />
          </div>
          <h3 className="text-base font-semibold text-[#10293F] dark:text-foreground">Atendimentos Humanos</h3>
        </div>
        <ReportKPICards kpis={humanKpiCards} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
      </div>

      {/* Seção: Atendimentos por IA */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
            <Bot className="h-4 w-4 text-[#10293F]" />
          </div>
          <h3 className="text-base font-semibold text-[#10293F] dark:text-foreground">Atendimentos por IA</h3>
        </div>
        <ReportKPICards kpis={aiKpiCards} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border overflow-hidden">
          <CardHeader className="bg-[#10293F] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#45E5E5]" />
              Evolução CSAT e TMA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="date" stroke="#666666" fontSize={11} />
                <YAxis yAxisId="csat" domain={[0, 5]} stroke="#666666" fontSize={11} />
                <YAxis yAxisId="tma" orientation="right" stroke="#666666" fontSize={11} />
                <Tooltip contentStyle={NAVY_TOOLTIP} />
                <Legend />
                <Line yAxisId="csat" type="monotone" dataKey="csat" name="CSAT" stroke="#45E5E5" strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="tma" type="monotone" dataKey="tma" name="TMA (min)" stroke="#FFB800" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border overflow-hidden">
          <CardHeader className="bg-[#10293F] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#45E5E5]" />
              Tickets por Status/Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="date" stroke="#666666" fontSize={11} />
                <YAxis stroke="#666666" fontSize={11} />
                <Tooltip contentStyle={NAVY_TOOLTIP} />
                <Legend />
                <Bar dataKey="pendente" name="Pendente" fill="#FFB800" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="em_atendimento" name="Em Atendimento" fill="#45E5E5" stackId="a" />
                <Bar dataKey="finalizado" name="Finalizado" fill="#16A34A" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border overflow-hidden">
          <CardHeader className="bg-[#10293F] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#45E5E5]" />
              Distribuição CSAT
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={csatDistribution} dataKey="count" nameKey="score" cx="50%" cy="50%" outerRadius={100} label={({ score, count }) => count > 0 ? `${score}★ (${count})` : ''}>
                  {csatDistribution.map((_, i) => (
                    <Cell key={i} fill={CSAT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={NAVY_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border overflow-hidden">
          <CardHeader className="bg-[#10293F] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#45E5E5]" />
              Volume por Hora do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="hour" stroke="#666666" fontSize={10} />
                <YAxis stroke="#666666" fontSize={11} />
                <Tooltip contentStyle={NAVY_TOOLTIP} />
                <Bar dataKey="count" name="Tickets" fill="#45E5E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Agent Distribution Chart */}
      {agentStats.length > 0 && (
        <Card className="border-border overflow-hidden">
          <CardHeader className="bg-[#10293F] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#45E5E5]" />
              Distribuição por Agente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis type="number" stroke="#666666" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#666666" fontSize={11} width={120} />
                <Tooltip contentStyle={NAVY_TOOLTIP} />
                <Legend />
                <Bar dataKey="tickets" name="Tickets" fill="#45E5E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Agent Table */}
      {agentStats.length > 0 && (
        <Card className="border-border overflow-hidden">
          <CardHeader className="bg-[#10293F] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#45E5E5]" />
              Desempenho por Agente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="stagger-rows">
              <TableHeader>
                <TableRow className="bg-[#10293F] hover:bg-[#10293F] border-b-0">
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Agente</TableHead>
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tickets</TableHead>
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">TMA</TableHead>
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">TME</TableHead>
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">CSAT</TableHead>
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">SLA %</TableHead>
                  <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Abertos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentStats.map(a => (
                  <TableRow key={a.id} className="hover:bg-[#F8FAFC] border-b border-[#F0F0F0]">
                    <TableCell className="font-medium text-[#10293F] dark:text-foreground">{a.name}</TableCell>
                    <TableCell className="text-center">{a.tickets}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{formatCompactTime(a.tma)}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{formatCompactTime(a.tme)}</TableCell>
                    <TableCell className="text-center">
                      {a.csat > 0 ? (
                        <Badge className={cn(
                          'text-xs',
                          a.csat >= 4
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[rgba(22,163,74,0.3)] hover:bg-[#F0FDF4]'
                            : 'bg-[#FFFBEB] text-[#92400E] border border-[rgba(255,184,0,0.5)] hover:bg-[#FFFBEB]'
                        )}>
                          {a.csat}/5
                        </Badge>
                      ) : '--'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        'text-xs',
                        a.slaRate >= 90
                          ? 'bg-[#F0FDF4] text-[#16A34A] border border-[rgba(22,163,74,0.3)] hover:bg-[#F0FDF4]'
                          : 'bg-[#FEF2F2] text-[#DC2626] border border-[rgba(220,38,38,0.3)] hover:bg-[#FEF2F2]'
                      )}>
                        {a.slaRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{a.openNow}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
