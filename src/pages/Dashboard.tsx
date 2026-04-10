import { useState, useEffect, useCallback } from 'react'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useSLAMetrics } from '@/hooks/useSLAAnalytics'
import { useErrorHandler, EmptyState } from '@/hooks/useErrorHandler'
import { DashboardFilterProvider, useDashboardFilters } from '@/contexts/DashboardFilterContext'
import { DashboardGlobalFilters } from '@/components/dashboard/DashboardGlobalFilters'

import { StageTimeReport } from '@/components/dashboard/StageTimeReport'
import { AILearningInsights } from '@/components/dashboard/AILearningInsights'
import { ReportKPICards } from '@/components/reports/ReportKPICards'
import { AgentCard } from '@/components/dashboard/AgentCard'
import { PerformanceChart } from '@/components/dashboard/PerformanceChart'
import { RecentConversations } from '@/components/dashboard/RecentConversations'
import { CostMetrics } from '@/components/dashboard/CostMetrics'
import { QualityDashboard } from '@/components/dashboard/QualityDashboard'
import { ClientHealthDashboard } from '@/components/dashboard/ClientHealthDashboard'
import { DemandDashboard } from '@/components/dashboard/DemandDashboard'
import { UnclassifiedCTA } from '@/components/dashboard/UnclassifiedCTA'
import { AgentHealthPanel } from '@/components/dashboard/AgentHealthPanel'
import { ProductivityDashboard } from '@/components/dashboard/ProductivityDashboard'
import { SLAComplianceCard } from '@/components/reports/SLAComplianceCard'
import { AIvsHumanComparison } from '@/components/reports/AIvsHumanComparison'
import { MonitoringPanel } from '@/components/monitoring/MonitoringPanel'
import {
  Bot, MessageSquare, Clock, TrendingUp, RefreshCw, BarChart3, Shield, Timer,
  UserCheck, Users, Layers, CheckCircle2, ArrowUpDown, Inbox, MessageCircle, Gauge, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useQueryClient } from '@tanstack/react-query'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function DashboardContent() {
  const queryClient = useQueryClient()
  const { user } = useSupabaseAuth()
  const { debouncedFilters } = useDashboardFilters()
  const { todayStats, todayCosts, weeklyStats, agentMetrics, recentConversations, isLoading, isError, error } = useDashboardMetrics(debouncedFilters)
  const { data: slaMetrics, isLoading: slaLoading } = useSLAMetrics(debouncedFilters.period)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [secondsAgo, setSecondsAgo] = useState(0)
  const { ErrorDisplay, retry } = useErrorHandler()

  const agentName = user?.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Agente'
  const todayFormatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries()
    setLastRefresh(Date.now())
    setIsRefreshing(false)
  }, [queryClient])

  useEffect(() => {
    const interval = setInterval(() => { handleRefresh() }, 60000)
    return () => clearInterval(interval)
  }, [handleRefresh])

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastRefresh])

  const formatTime = (seconds: number) => {
    if (!seconds) return '--'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  const formatSecondsAgo = () => {
    if (secondsAgo < 5) return 'agora'
    if (secondsAgo < 60) return `${secondsAgo}s`
    return `${Math.floor(secondsAgo / 60)}min`
  }

  const kpis = [
    {
      icon: TrendingUp,
      title: 'IA Resolveu',
      value: `${todayStats?.aiResolvedPercent || 0}%`,
      subtitle: `${todayStats?.aiResolved || 0} de ${todayStats?.total || 0} conversas`,
      accent: 'success' as const,
    },
    {
      icon: MessageSquare,
      title: 'Total Conversas',
      value: todayStats?.total || 0,
      subtitle: 'No período',
      accent: 'cyan' as const,
    },
    {
      icon: Clock,
      title: 'Tempo Médio',
      value: formatTime(todayStats?.avgTimeSeconds || 0),
      subtitle: 'Abertura → Conclusão',
      tooltip: 'Da abertura do ticket até a conclusão',
      accent: 'navy' as const,
    },
    {
      icon: UserCheck,
      title: '1ª Resposta Humana',
      value: formatTime(todayStats?.avgFirstResponseSeconds || 0),
      subtitle: 'Tempo médio',
      tooltip: 'Tempo médio até o primeiro atendente humano responder',
      accent: 'cyan' as const,
    },
    {
      icon: Bot,
      title: 'CSAT Médio',
      value: todayStats?.avgCsat ? `${todayStats.avgCsat}/5` : '--',
      subtitle: `${todayStats?.resolved || 0} resolvidas`,
      accent: 'yellow' as const,
    },
    // Novos KPIs
    {
      icon: CheckCircle2,
      title: 'FCR',
      value: `${todayStats?.fcrRate || 0}%`,
      subtitle: 'Resolução no 1º contato',
      tooltip: 'First Contact Resolution — % resolvidos sem troca de agente',
      accent: 'success' as const,
    },
    {
      icon: Shield,
      title: 'SLA',
      value: slaMetrics ? `${slaMetrics.complianceRate}%` : '--',
      subtitle: `${slaMetrics?.withinSLA || 0} dentro do SLA`,
      tooltip: '% de tickets atendidos dentro do prazo',
      accent: 'navy' as const,
    },
    {
      icon: ArrowUpDown,
      title: 'Escalação',
      value: `${todayStats?.escalationRate || 0}%`,
      subtitle: 'IA → Humano',
      tooltip: '% de conversas escaladas de IA para atendimento humano',
      accent: 'yellow' as const,
    },
    {
      icon: Inbox,
      title: 'Fila Ativa',
      value: todayStats?.queueCount || 0,
      subtitle: 'Aguardando atendimento',
      accent: 'cyan' as const,
    },
    {
      icon: Layers,
      title: 'Backlog',
      value: todayStats?.backlog || 0,
      subtitle: 'Tickets em aberto',
      accent: 'navy' as const,
    },
  ]

  if (isLoading) {
    return (
      <div className="page-container p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page-container p-6">
        <ErrorDisplay
          title="Erro ao carregar dashboard"
          message="Não foi possível carregar as métricas do dashboard."
          onRetry={() => retry()}
        />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="page-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
                {getGreeting()}, {agentName.split(' ')[0]}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                {todayFormatted}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]" />
              </span>
              AO VIVO
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Atualizado {formatSecondsAgo()}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} disabled={isRefreshing}>
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar dados</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filtros Globais */}
        <DashboardGlobalFilters />

        <Tabs defaultValue="overview" className="space-y-4">
          <div className="border-b border-border">
            <TabsList className="bg-transparent h-auto p-0 gap-0">
              {[
                { value: 'overview', icon: BarChart3, label: 'Visão Geral' },
                { value: 'quality', icon: Shield, label: 'Qualidade' },
                { value: 'stage-time', icon: Timer, label: 'Tempo por Etapa' },
                { value: 'demand', icon: Layers, label: 'Demanda' },
                { value: 'clients', icon: Users, label: 'Clientes' },
                { value: 'productivity', icon: Gauge, label: 'Produtividade' },
                { value: 'monitoring', icon: Activity, label: 'Monitoramento' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#45E5E5] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#10293F] dark:data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 font-medium"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* KPIs — 2 linhas de 5 */}
            <ReportKPICards kpis={kpis} loading={isLoading} columns={5} />

            {/* Painel de Saúde dos Agentes */}
            <AgentHealthPanel />

            {/* CTA: atendimentos finalizados sem classificação */}
            <UnclassifiedCTA />

            {/* AI Learning Loop */}
            <AILearningInsights />

            {/* SLA + AI vs Human */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SLAComplianceCard data={slaMetrics} loading={slaLoading} />
              <AIvsHumanComparison data={slaMetrics} loading={slaLoading} />
            </div>

            {/* Agents */}
            {agentMetrics && agentMetrics.length > 0 && (
              <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#10293F] flex items-center justify-center">
                  <Bot className="h-4 w-4 text-[#45E5E5]" />
                </div>
                <h2 className="text-sm font-semibold text-[#10293F] dark:text-foreground uppercase tracking-wide">
                  Agentes Ativos
                </h2>
              </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {agentMetrics.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>
            )}

            {/* Chart + Cost */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <PerformanceChart data={weeklyStats || []} />
              </div>
              <CostMetrics metrics={todayCosts} />
            </div>

            {/* Recent Conversations */}
            <RecentConversations conversations={recentConversations || []} />
          </TabsContent>

          <TabsContent value="quality">
            <QualityDashboard />
          </TabsContent>

          <TabsContent value="stage-time">
            <StageTimeReport />
          </TabsContent>

          <TabsContent value="demand">
            <DemandDashboard />
          </TabsContent>

          <TabsContent value="clients">
            <ClientHealthDashboard />
          </TabsContent>

          <TabsContent value="productivity">
            <ProductivityDashboard />
          </TabsContent>

          <TabsContent value="monitoring">
            <MonitoringPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <DashboardFilterProvider>
      <DashboardContent />
    </DashboardFilterProvider>
  )
}
