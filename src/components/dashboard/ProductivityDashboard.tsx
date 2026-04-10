import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportKPICards, type ReportKPI } from '@/components/reports/ReportKPICards'
import { useProductivityMetrics, type ProductivityMetrics } from '@/hooks/useProductivityMetrics'
import { useDashboardFilters } from '@/contexts/DashboardFilterContext'
import { cn } from '@/lib/utils'
import {
  Zap, CheckCircle2, DollarSign, TrendingDown, Layers, Clock,
  ArrowUpDown, RotateCcw, MessageCircle, Star, Bot, UserCheck,
  BarChart3, Users, TrendingUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts'

const NAVY_TOOLTIP = {
  backgroundColor: '#10293F',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  boxShadow: '0 4px 14px rgba(16,41,63,0.3)',
}

function formatTime(seconds: number | string | null | undefined): string {
  if (!seconds) return '--'
  const s = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds
  if (isNaN(s) || s <= 0) return '--'
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function fcrBarColor(rate: number): string {
  if (rate >= 80) return '#16A34A'
  if (rate >= 60) return '#FFB800'
  return '#DC2626'
}

function scoreBarColor(score: number): string {
  if (score >= 80) return '#16A34A'
  if (score >= 60) return '#FFB800'
  return '#DC2626'
}

function SectionHeader({ icon: Icon, title, bgClass }: { icon: React.ElementType; title: string; bgClass?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bgClass || 'bg-[#10293F]')}>
        <Icon className="h-4 w-4 text-[#45E5E5]" />
      </div>
      <h3 className="text-base font-semibold text-[#10293F] dark:text-foreground">{title}</h3>
    </div>
  )
}

export function ProductivityDashboard() {
  const { debouncedFilters } = useDashboardFilters()
  const { data, isLoading } = useProductivityMetrics(debouncedFilters)

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  // Build KPI trend helper
  const mkTrend = (kpi: { deltaPercent: number | null; isPositive: boolean }) =>
    kpi.deltaPercent !== null
      ? { value: `${Math.abs(kpi.deltaPercent)}%`, isPositive: kpi.isPositive }
      : undefined

  const kpiCards: ReportKPI[] = [
    { icon: Zap, title: 'Throughput', value: data.throughput.value, subtitle: 'resolvidos/hora', accent: 'cyan', trend: mkTrend(data.throughput) },
    { icon: CheckCircle2, title: 'FCR', value: `${data.fcrRate.value}%`, subtitle: '1o contato', accent: 'success', trend: mkTrend(data.fcrRate) },
    { icon: DollarSign, title: 'Custo/Resolucao IA', value: data.costPerResolutionAI.value, subtitle: 'por ticket', accent: 'navy', trend: mkTrend(data.costPerResolutionAI) },
    { icon: TrendingDown, title: 'Economia IA', value: data.economyAI.value, subtitle: 'estimada', accent: 'success', trend: mkTrend(data.economyAI) },
    {
      icon: Layers, title: 'Backlog Velocity', value: data.backlogVelocity.value, subtitle: 'entradas-saidas/dia',
      accent: String(data.backlogVelocity.value).includes('+') ? 'error' : 'success',
      trend: mkTrend(data.backlogVelocity),
    },
    { icon: Clock, title: 'Handle Time', value: formatTime(data.handleTime.value), subtitle: 'tempo medio', accent: 'navy', trend: mkTrend(data.handleTime) },
    { icon: ArrowUpDown, title: 'Escalacao', value: `${data.escalationRate.value}%`, subtitle: 'IA→Humano', accent: 'yellow', trend: mkTrend(data.escalationRate) },
    { icon: RotateCcw, title: 'Reopen Rate', value: `${data.reopenRate.value}%`, subtitle: 'reabertos', accent: 'error', trend: mkTrend(data.reopenRate) },
    { icon: MessageCircle, title: 'One-Touch', value: `${data.oneTouchRate.value}%`, subtitle: '≤2 mensagens', accent: 'purple', trend: mkTrend(data.oneTouchRate) },
    { icon: Star, title: 'CSAT', value: `${data.csatTrend.value}/5`, subtitle: 'media', accent: 'yellow', trend: mkTrend(data.csatTrend) },
  ]

  return (
    <div className="space-y-6">
      {/* Section 1: KPI Strip */}
      <div className="space-y-3">
        <SectionHeader icon={Zap} title="Metricas de Produtividade" />
        <ReportKPICards kpis={kpiCards} columns={5} />
      </div>

      {/* Section 2: FCR Breakdown */}
      <div className="space-y-3">
        <SectionHeader icon={CheckCircle2} title="Analise FCR e Ranking" bgClass="bg-[#E8F9F9]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* FCR by Category Chart */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-[#10293F] py-3 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#45E5E5]" />
                FCR por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {data.fcrByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, data.fcrByCategory.length * 40)}>
                  <BarChart data={data.fcrByCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                    <XAxis type="number" domain={[0, 100]} stroke="#666666" fontSize={11} />
                    <YAxis type="category" dataKey="categoryName" stroke="#666666" fontSize={11} width={120} />
                    <Tooltip contentStyle={NAVY_TOOLTIP} formatter={(v: number) => [`${v}%`, 'FCR']} />
                    <Bar dataKey="fcrRate" radius={[0, 4, 4, 0]}>
                      {data.fcrByCategory.map((entry, i) => (
                        <Cell key={i} fill={fcrBarColor(entry.fcrRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no periodo</p>
              )}
            </CardContent>
          </Card>

          {/* Agent Scores Table (compact) */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-[#10293F] py-3 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#45E5E5]" />
                Ranking de Agentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.agentScores.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#10293F] hover:bg-[#10293F] border-b-0">
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider w-8">#</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Agente</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tipo</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tickets</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">FCR%</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">TMA</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">CSAT</TableHead>
                        <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.agentScores.slice(0, 10).map((a, i) => (
                        <TableRow key={a.agentId} className="hover:bg-[#F8FAFC] border-b border-[#F0F0F0]">
                          <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium text-[#10293F] dark:text-foreground text-sm">{a.agentName}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn('text-xs', a.agentType === 'ia'
                              ? 'bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] hover:bg-[#E8F9F9]'
                              : 'bg-[#10293F] text-white border border-[#10293F] hover:bg-[#10293F]'
                            )}>
                              {a.agentType === 'ia' ? 'IA' : 'Humano'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{a.tickets}</TableCell>
                          <TableCell className="text-center">{a.fcrRate}%</TableCell>
                          <TableCell className="text-center font-mono text-sm">{formatTime(a.tmaSeconds)}</TableCell>
                          <TableCell className="text-center">{a.csat > 0 ? `${a.csat}/5` : '--'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${a.score}%`, backgroundColor: scoreBarColor(a.score) }}
                                />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right">{a.score}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no periodo</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 3: Custo por Resolucao */}
      <div className="space-y-3">
        <SectionHeader icon={DollarSign} title="Custo por Resolucao" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border border-t-[3px] border-t-[#45E5E5] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Resolucao IA</span>
              <div className="w-9 h-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <Bot className="w-[18px] h-[18px] text-[#10293F]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              R$ {data.aiCostPerTicketBrl.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {data.aiTotalResolved} tickets · R$ {data.aiTotalCostBrl.toFixed(2)} total
            </p>
          </Card>

          <Card className="border-border border-t-[3px] border-t-[#10293F] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Resolucao Humana</span>
              <div className="w-9 h-9 rounded-lg bg-[#10293F] flex items-center justify-center">
                <UserCheck className="w-[18px] h-[18px] text-[#45E5E5]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              R$ {data.humanCostPerTicketBrl.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {data.humanTotalResolved} tickets · estimativa
            </p>
          </Card>

          <Card className="border-border border-t-[3px] border-t-[#16A34A] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Economia Total</span>
              <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <TrendingDown className="w-[18px] h-[18px] text-[#16A34A]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              R$ {data.totalEconomyBrl}
            </p>
            <p className="text-xs text-muted-foreground mt-2">IA vs custo humano</p>
          </Card>
        </div>

        {/* Cost by Category Chart */}
        {data.costByCategory.length > 0 && (
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-[#10293F] py-3 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#45E5E5]" />
                Custo Medio por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={Math.max(200, data.costByCategory.length * 40)}>
                <BarChart data={data.costByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis type="number" stroke="#666666" fontSize={11} />
                  <YAxis type="category" dataKey="categoryName" stroke="#666666" fontSize={11} width={120} />
                  <Tooltip contentStyle={NAVY_TOOLTIP} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Custo Medio']} />
                  <Bar dataKey="avgCostBrl" fill="#45E5E5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 4: ROI de Automacoes */}
      <div className="space-y-3">
        <SectionHeader icon={Bot} title="ROI de Automacoes" bgClass="bg-[#E8F9F9]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border border-t-[3px] border-t-[#45E5E5] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Tickets Desviados</span>
              <div className="w-9 h-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <Bot className="w-[18px] h-[18px] text-[#10293F]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              {data.aiTicketsDeviated}
            </p>
          </Card>

          <Card className="border-border border-t-[3px] border-t-[#10293F] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Economia em Horas</span>
              <div className="w-9 h-9 rounded-lg bg-[#10293F] flex items-center justify-center">
                <Clock className="w-[18px] h-[18px] text-[#45E5E5]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              {data.aiEconomyHours}h
            </p>
          </Card>

          <Card className="border-border border-t-[3px] border-t-[#16A34A] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Taxa de Sucesso IA</span>
              <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <CheckCircle2 className="w-[18px] h-[18px] text-[#16A34A]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              {data.aiSuccessRate}%
            </p>
          </Card>

          <Card className="border-border border-t-[3px] border-t-[#16A34A] p-5 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Economia em R$</span>
              <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <DollarSign className="w-[18px] h-[18px] text-[#16A34A]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              R$ {data.aiEconomyBrl}
            </p>
          </Card>
        </div>

        {/* Weekly AI Trend Chart */}
        {data.aiWeeklyTrend.length > 0 && (
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-[#10293F] py-3 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#45E5E5]" />
                Evolucao Semanal IA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.aiWeeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="week" stroke="#666666" fontSize={11} />
                  <YAxis yAxisId="rate" domain={[0, 100]} stroke="#666666" fontSize={11} />
                  <YAxis yAxisId="total" orientation="right" stroke="#666666" fontSize={11} />
                  <Tooltip contentStyle={NAVY_TOOLTIP} />
                  <Legend />
                  <Line yAxisId="rate" type="monotone" dataKey="aiRate" name="Taxa IA (%)" stroke="#45E5E5" strokeWidth={2} dot={{ r: 4, fill: '#45E5E5' }} />
                  <Line yAxisId="total" type="monotone" dataKey="total" name="Total" stroke="#10293F" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#10293F' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 5: Ranking Completo de Agentes */}
      {data.agentScores.length > 0 && (
        <div className="space-y-3">
          <SectionHeader icon={Users} title="Ranking Completo de Agentes" />
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-[#10293F] py-3 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#45E5E5]" />
                Todos os Agentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#10293F] hover:bg-[#10293F] border-b-0">
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider w-8">#</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Agente</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tipo</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tickets</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">FCR%</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">TMA</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">CSAT</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Escalacoes</TableHead>
                    <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agentScores.map((a, i) => (
                    <TableRow key={a.agentId} className="hover:bg-[#F8FAFC] border-b border-[#F0F0F0]">
                      <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-[#10293F] dark:text-foreground text-sm">{a.agentName}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs', a.agentType === 'ia'
                          ? 'bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] hover:bg-[#E8F9F9]'
                          : 'bg-[#10293F] text-white border border-[#10293F] hover:bg-[#10293F]'
                        )}>
                          {a.agentType === 'ia' ? 'IA' : 'Humano'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{a.tickets}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs',
                          a.fcrRate >= 80
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[rgba(22,163,74,0.3)] hover:bg-[#F0FDF4]'
                            : a.fcrRate >= 60
                              ? 'bg-[#FFFBEB] text-[#92400E] border border-[rgba(255,184,0,0.5)] hover:bg-[#FFFBEB]'
                              : 'bg-[#FEF2F2] text-[#DC2626] border border-[rgba(220,38,38,0.3)] hover:bg-[#FEF2F2]'
                        )}>
                          {a.fcrRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{formatTime(a.tmaSeconds)}</TableCell>
                      <TableCell className="text-center">
                        {a.csat > 0 ? (
                          <Badge className={cn('text-xs',
                            a.csat >= 4
                              ? 'bg-[#F0FDF4] text-[#16A34A] border border-[rgba(22,163,74,0.3)] hover:bg-[#F0FDF4]'
                              : 'bg-[#FFFBEB] text-[#92400E] border border-[rgba(255,184,0,0.5)] hover:bg-[#FFFBEB]'
                          )}>
                            {a.csat}/5
                          </Badge>
                        ) : '--'}
                      </TableCell>
                      <TableCell className="text-center">{a.escalations}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${a.score}%`, backgroundColor: scoreBarColor(a.score) }}
                            />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{a.score}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
