import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Star, TrendingUp, Award, Bot, CheckCircle2, CalendarIcon, AlertTriangle, BarChart3, Filter, X, Users } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { EvaluationsTable } from '@/components/evaluations/EvaluationsTable'
import { FinishedTicketsTable } from '@/components/evaluations/FinishedTicketsTable'
import { LowScoreTable } from '@/components/evaluations/LowScoreTable'
import { KanbanInboxPanel } from '@/components/tickets/KanbanChatPanel'
import { CSATDashboardTab } from '@/components/csat/CSATDashboardTab'
import { CSATByAgentTab } from '@/components/csat/CSATByAgentTab'
import { ReportKPICards, type ReportKPI } from '@/components/reports/ReportKPICards'
import { ExportCSVButton } from '@/components/reports/ExportCSVButton'
import { ExportPDFButton } from '@/components/reports/ExportPDFButton'
import { Download } from 'lucide-react'

export default function Evaluations() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [activeTab, setActiveTab] = useState('avaliacoes')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  // Evaluations query
  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['evaluations', typeFilter, agentFilter, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_service_evaluations')
        .select('*, human_agents(name), ai_conversations(ticket_number, customer_name, csat_score)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (typeFilter !== 'all') query = query.eq('evaluation_type', typeFilter)
      if (agentFilter !== 'all') query = query.eq('human_agent_id', agentFilter)
      if (startDate) query = query.gte('created_at', startDate.toISOString())
      if (endDate) query = query.lte('created_at', new Date(endDate.getTime() + 86400000).toISOString())

      const { data } = await query
      return data || []
    },
  })

  // Agents
  const { data: agents } = useQuery({
    queryKey: ['eval-agents'],
    queryFn: async () => {
      const { data } = await supabase.from('human_agents').select('id, name').neq('is_active', false)
      return data || []
    },
  })

  // Finished tickets
  const { data: finishedTickets, isLoading: loadingFinished } = useQuery({
    queryKey: ['finished-tickets', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_conversations')
        .select('id, ticket_number, customer_name, status, resolved_at, csat_score, human_agent_id, human_agents:human_agent_id(name)')
        .in('status', ['finalizado', 'resolvido', 'closed'])
        .order('resolved_at', { ascending: false })
        .limit(200)

      if (startDate) query = query.gte('resolved_at', startDate.toISOString())
      if (endDate) query = query.lte('resolved_at', new Date(endDate.getTime() + 86400000).toISOString())

      const { data } = await query
      if (!data || data.length === 0) return []

      const convIds = data.map((c: any) => c.id)
      const { data: evals } = await (supabase as any)
        .from('ai_service_evaluations')
        .select('conversation_id, overall_score')
        .in('conversation_id', convIds)

      const evalMap: Record<string, number> = {}
      for (const e of evals || []) {
        evalMap[e.conversation_id] = e.overall_score
      }

      return data.map((c: any) => ({
        ...c,
        eval_score: evalMap[c.id] ?? null,
      }))
    },
    enabled: activeTab === 'finalizados' || activeTab === 'avaliacoes',
  })

  // KPIs
  const avgAiScore = evaluations?.length
    ? (evaluations.reduce((s: number, e: any) => s + (e.overall_score || 0), 0) / evaluations.length).toFixed(1)
    : '--'
  const avgCsat = evaluations?.filter((e: any) => e.ai_conversations?.csat_score)?.length
    ? (evaluations.filter((e: any) => e.ai_conversations?.csat_score).reduce((s: number, e: any) => s + e.ai_conversations.csat_score, 0) / evaluations.filter((e: any) => e.ai_conversations?.csat_score).length).toFixed(1)
    : '--'
  const totalEvals = evaluations?.length || 0
  const lowScoreCount = evaluations?.filter((e: any) => (e.overall_score || 0) <= 5).length || 0
  const lowScoreEvals = useMemo(() => evaluations?.filter((e: any) => (e.overall_score || 0) <= 5) || [], [evaluations])

  const finishedTotal = finishedTickets?.length || 0
  const evaluatedCount = finishedTickets?.filter((t: any) => t.eval_score !== null).length || 0
  const evaluatedPct = finishedTotal ? ((evaluatedCount / finishedTotal) * 100).toFixed(0) : '--'

  // Best agent
  const agentScores: Record<string, { name: string; total: number; count: number }> = {}
  for (const e of evaluations || []) {
    const aid = (e as any).human_agent_id
    const name = (e as any).human_agents?.name
    if (aid && name) {
      if (!agentScores[aid]) agentScores[aid] = { name, total: 0, count: 0 }
      agentScores[aid].total += (e as any).overall_score || 0
      agentScores[aid].count++
    }
  }
  const bestAgent = Object.values(agentScores).sort((a, b) => (b.total / b.count) - (a.total / a.count))[0]

  // Score distribution chart
  const scoreDistribution = useMemo(() => {
    const dist = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }))
    for (const e of evaluations || []) {
      const s = (e as any).overall_score
      if (s >= 1 && s <= 10) dist[s - 1].count++
    }
    return dist
  }, [evaluations])

  const barColors = (score: number) => {
    if (score >= 8) return '#16A34A'
    if (score >= 6) return '#FFB800'
    return '#DC2626'
  }

  const handleOpenTicket = (conversationId: string) => {
    setSelectedConversationId(conversationId)
  }

  const hasActiveFilters = typeFilter !== 'all' || agentFilter !== 'all' || startDate || endDate
  const activeFilterAgent = agents?.find((a: any) => a.id === agentFilter)

  // KPI cards data
  const kpis: ReportKPI[] = [
    {
      icon: Bot,
      title: 'Score Médio IA',
      value: `${avgAiScore}/10`,
      subtitle: 'Avaliação por IA',
      accent: avgAiScore !== '--' && parseFloat(avgAiScore) >= 8 ? 'success' : avgAiScore !== '--' && parseFloat(avgAiScore) >= 6 ? 'yellow' : avgAiScore !== '--' ? 'error' : 'cyan',
    },
    {
      icon: Star,
      title: 'CSAT Médio',
      value: `${avgCsat}/5`,
      subtitle: 'Avaliação do cliente',
      accent: 'cyan',
    },
    {
      icon: TrendingUp,
      title: 'Total Avaliações',
      value: totalEvals,
      subtitle: lowScoreCount > 0 ? `${lowScoreCount} com nota baixa` : 'No período',
      accent: 'navy',
    },
    {
      icon: CheckCircle2,
      title: '% Avaliados',
      value: `${evaluatedPct}%`,
      subtitle: `${evaluatedCount}/${finishedTotal} finalizados`,
      accent: 'success',
    },
    {
      icon: Award,
      title: 'Agente Destaque',
      value: bestAgent ? bestAgent.name : '--',
      subtitle: bestAgent ? `${(bestAgent.total / bestAgent.count).toFixed(1)}/10 (${bestAgent.count} aval.)` : 'Sem dados',
      accent: 'purple',
    },
  ]

  // Export columns per tab
  const evalColumns = [
    { key: 'ticket', label: 'Ticket' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'agente', label: 'Agente' },
    { key: 'score', label: 'Score IA' },
    { key: 'csat', label: 'CSAT' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'data', label: 'Data' },
    { key: 'resumo', label: 'Resumo' },
  ]

  const finishedColumns = [
    { key: 'ticket', label: 'Ticket' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'agente', label: 'Agente' },
    { key: 'status', label: 'Status' },
    { key: 'score', label: 'Score Avaliação' },
    { key: 'csat', label: 'CSAT' },
    { key: 'data', label: 'Data Resolução' },
  ]

  const mapEvalRow = (e: any) => ({
    ticket: e.ai_conversations?.ticket_number || '--',
    cliente: e.ai_conversations?.customer_name || '--',
    agente: e.human_agents?.name || '--',
    score: e.overall_score ?? '--',
    csat: e.ai_conversations?.csat_score ?? '--',
    tipo: e.evaluation_type === 'ai' ? 'IA' : 'Cliente',
    data: e.created_at ? format(new Date(e.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '--',
    resumo: e.summary || '--',
  })

  const mapFinishedRow = (t: any) => ({
    ticket: t.ticket_number || '--',
    cliente: t.customer_name || '--',
    agente: t.human_agents?.name || '--',
    status: t.status || '--',
    score: t.eval_score ?? '--',
    csat: t.csat_score ?? '--',
    data: t.resolved_at ? format(new Date(t.resolved_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '--',
  })

  const getExportColumns = () => {
    if (activeTab === 'finalizados') return finishedColumns
    return evalColumns
  }

  const getExportData = async () => {
    if (activeTab === 'finalizados') return (finishedTickets || []).map(mapFinishedRow)
    if (activeTab === 'baixa') return (lowScoreEvals || []).map(mapEvalRow)
    return (evaluations || []).map(mapEvalRow)
  }

  const getExportFilename = () => {
    if (activeTab === 'finalizados') return 'tickets-finalizados'
    if (activeTab === 'baixa') return 'baixa-avaliacao'
    return 'avaliacoes'
  }

  const getExportTitle = () => {
    if (activeTab === 'finalizados') return 'Tickets Finalizados'
    if (activeTab === 'baixa') return 'Avaliações com Baixa Nota'
    return 'Avaliações de Atendimento'
  }

  const tabs = [
    { id: 'avaliacoes', label: 'Avaliações', count: totalEvals },
    { id: 'finalizados', label: 'Tickets Finalizados', count: finishedTotal },
    { id: 'baixa', label: 'Baixa Avaliação', count: lowScoreCount, icon: AlertTriangle },
    { id: 'csat', label: 'CSAT', count: null },
    { id: 'por-agente', label: 'Por Agente', count: null, icon: Users },
  ]

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn(
        "flex-1 overflow-auto p-6 space-y-6 transition-all duration-300",
        selectedConversationId && "hidden lg:block"
      )}>
        {/* Header */}
        <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif] tracking-tight">
          Avaliações de Atendimento
        </h1>

        {/* KPI Cards */}
        <ReportKPICards kpis={kpis} />

        {/* Score Distribution Chart */}
        {totalEvals > 0 && (
          <Card className="border-border overflow-hidden">
            <div className="bg-[#10293F] px-5 py-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#45E5E5]" />
              <span className="text-sm font-semibold text-white">Distribuição de Notas</span>
              <span className="text-xs text-white/50 ml-auto">{totalEvals} avaliações</span>
            </div>
            <CardContent className="pt-4 pb-2">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreDistribution} barCategoryGap="20%">
                  <XAxis
                    dataKey="score"
                    tick={{ fontSize: 12, fill: '#666666' }}
                    axisLine={{ stroke: '#E5E5E5' }}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(16,41,63,0.05)' }}
                    contentStyle={{
                      background: '#10293F',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 12px rgba(16,41,63,0.3)',
                    }}
                    labelStyle={{ color: '#45E5E5', fontWeight: 600, fontSize: 12 }}
                    itemStyle={{ color: '#fff', fontSize: 12 }}
                    formatter={(v: number) => [`${v} avaliações`, 'Qtd']}
                    labelFormatter={(l) => `Nota ${l}`}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {scoreDistribution.map((entry) => (
                      <Cell key={entry.score} fill={barColors(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filter Bar */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
          </div>

          <div className="h-5 w-px bg-border" />

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="ai">Avaliação IA</SelectItem>
              <SelectItem value="customer">Avaliação Cliente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos agentes</SelectItem>
              {(agents || []).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {startDate ? format(startDate, 'dd/MM/yy') : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {endDate ? format(endDate, 'dd/MM/yy') : 'Data fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2 flex-wrap">
                {typeFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pr-1 cursor-pointer hover:bg-muted" onClick={() => setTypeFilter('all')}>
                    {typeFilter === 'ai' ? 'IA' : 'Cliente'}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {agentFilter !== 'all' && activeFilterAgent && (
                  <Badge variant="secondary" className="gap-1 pr-1 cursor-pointer hover:bg-muted" onClick={() => setAgentFilter('all')}>
                    {activeFilterAgent.name}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {startDate && (
                  <Badge variant="secondary" className="gap-1 pr-1 cursor-pointer hover:bg-muted" onClick={() => setStartDate(undefined)}>
                    De {format(startDate, 'dd/MM')}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {endDate && (
                  <Badge variant="secondary" className="gap-1 pr-1 cursor-pointer hover:bg-muted" onClick={() => setEndDate(undefined)}>
                    Até {format(endDate, 'dd/MM')}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => { setTypeFilter('all'); setAgentFilter('all'); setStartDate(undefined); setEndDate(undefined) }}
                >
                  Limpar tudo
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Export Actions */}
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            <ExportCSVButton
              getData={getExportData}
              columns={getExportColumns()}
              filename={getExportFilename()}
            />
            <ExportPDFButton
              getData={getExportData}
              columns={getExportColumns()}
              filename={getExportFilename()}
              title={getExportTitle()}
            />
          </div>
        </div>

        {/* Custom Tabs */}
        <div>
          <div className="flex border-b border-border gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-200 rounded-t-md",
                    isActive
                      ? "border-b-[#45E5E5] text-[#10293F] dark:text-foreground font-semibold"
                      : "border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {TabIcon && <TabIcon className={cn("h-3.5 w-3.5", tab.id === 'baixa' && lowScoreCount > 0 && "text-[#DC2626]")} />}
                  {tab.label}
                  {tab.count !== null && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] h-5 min-w-[20px] px-1.5",
                        tab.id === 'baixa' && lowScoreCount > 0 && !isActive && "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20"
                      )}
                    >
                      {tab.count}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            {activeTab === 'avaliacoes' && (
              <EvaluationsTable evaluations={evaluations || []} onOpenTicket={handleOpenTicket} />
            )}
            {activeTab === 'finalizados' && (
              <FinishedTicketsTable tickets={finishedTickets || []} isLoading={loadingFinished} onOpenTicket={handleOpenTicket} />
            )}
            {activeTab === 'baixa' && (
              <LowScoreTable evaluations={lowScoreEvals} onOpenTicket={handleOpenTicket} />
            )}
            {activeTab === 'csat' && (
              <CSATDashboardTab />
            )}
            {activeTab === 'por-agente' && (
              <CSATByAgentTab />
            )}
          </div>
        </div>
      </div>

      {/* Ticket Panel - slide-over */}
      {selectedConversationId && (
        <>
          <div
            className="hidden lg:block flex-shrink-0 w-1 cursor-col-resize bg-border hover:bg-primary/30 transition-colors"
            onClick={() => setSelectedConversationId(null)}
          />
          <div className="w-full lg:w-[45%] lg:min-w-[400px] lg:max-w-[700px] flex-shrink-0 bg-card border-l border-border shadow-2xl">
            <KanbanInboxPanel
              conversationId={selectedConversationId}
              onClose={() => setSelectedConversationId(null)}
            />
          </div>
        </>
      )}
    </div>
  )
}
