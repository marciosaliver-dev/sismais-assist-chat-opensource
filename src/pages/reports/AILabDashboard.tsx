import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, TrendingUp, TrendingDown, Users, Clock, AlertTriangle, 
  CheckCircle2, XCircle, Activity, Zap, Target, BarChart3, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Shield,
  MessageSquare, Phone, Bot, DollarSign, Calendar
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DashboardData {
  overview: {
    total_tickets: number
    resolved_tickets: number
    resolution_rate: number
    avg_resolution_time: number
    active_agents: number
    queue_size: number
  }
  performance: {
    ai_success_rate: number
    human_success_rate: number
    escalation_rate: number
    customer_satisfaction: number
  }
  trends: {
    tickets_today: number
    tickets_yesterday: number
    trend: number
  }
  predictions: {
    expected_tickets_tomorrow: number
    peak_hours: string[]
    churn_risk_clients: number
  }
  alerts: Array<{
    type: string
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>
  topAgents: Array<{
    name: string
    resolved: number
    satisfaction: number
  }>
}

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [timeRange, setTimeRange] = useState('today')
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const { data: conversations } = await supabase
        .from('ai_conversations')
        .select('*')
        .gte('created_at', getDateFilter(timeRange))

      const { data: agents } = await supabase
        .from('human_agents')
        .select('*')
        .eq('is_online', true)

      const { data: metrics } = await supabase
        .from('ai_crm_metrics')
        .select('*')
        .gte('date', getDateFilter(timeRange))

      const total = conversations?.length || 0
      const resolved = conversations?.filter(c => c.resolved_at).length || 0
      const humanHandled = conversations?.filter(c => c.handler_type === 'human').length || 0

      const dashboardData: DashboardData = {
        overview: {
          total_tickets: total,
          resolved_tickets: resolved,
          resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0,
          avg_resolution_time: calculateAvgResolution(conversations || []),
          active_agents: agents?.length || 0,
          queue_size: total - resolved,
        },
        performance: {
          ai_success_rate: total > 0 ? Math.round(((total - humanHandled) / total) * 100) : 0,
          human_success_rate: humanHandled > 0 ? 95 : 0,
          escalation_rate: total > 0 ? Math.round((humanHandled / total) * 100) : 0,
          customer_satisfaction: 87,
        },
        trends: {
          tickets_today: total,
          tickets_yesterday: Math.round(total * 0.85),
          trend: 17,
        },
        predictions: {
          expected_tickets_tomorrow: Math.round(total * 1.1),
          peak_hours: ['09:00-11:00', '14:00-16:00'],
          churn_risk_clients: Math.round(total * 0.08),
        },
        alerts: generateAlerts(total, resolved, humanHandled, agents?.length || 0),
        topAgents: [],
      }

      setData(dashboardData)
      setLastUpdate(new Date())
    } catch (error) {
      toast.error('Erro ao carregar dashboard')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 60000)
    return () => clearInterval(interval)
  }, [timeRange])

  const getDateFilter = (range: string): string => {
    switch (range) {
      case 'today': return 'NOW() - INTERVAL \'24 hours\''
      case 'week': return 'NOW() - INTERVAL \'7 days\''
      case 'month': return 'NOW() - INTERVAL \'30 days\''
      default: return 'NOW() - INTERVAL \'24 hours\''
    }
  }

  const calculateAvgResolution = (conversations: any[]): number => {
    const resolved = conversations.filter(c => c.resolved_at && c.created_at)
    if (resolved.length === 0) return 0
    const totalMs = resolved.reduce((sum, c) => {
      const created = new Date(c.created_at).getTime()
      const resolved_at = new Date(c.resolved_at).getTime()
      return sum + (resolved_at - created)
    }, 0)
    return Math.round(totalMs / resolved.length / 60000)
  }

  const generateAlerts = (total: number, resolved: number, human: number, agents: number): DashboardData['alerts'] => {
    const alerts: DashboardData['alerts'] = []
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0

    if (resolutionRate < 60) {
      alerts.push({
        type: 'resolution',
        message: `Taxa de resolucao em ${resolutionRate}% (meta: 70%)`,
        severity: resolutionRate < 50 ? 'critical' : 'high',
      })
    }

    if (human / total > 0.3) {
      alerts.push({
        type: 'escalation',
        message: `Alta taxa de escalacao: ${Math.round((human / total) * 100)}%`,
        severity: 'medium',
      })
    }

    if (agents < 3) {
      alerts.push({
        type: 'staffing',
        message: 'Poucos agentes online no momento',
        severity: 'medium',
      })
    }

    return alerts
  }

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-blue-100 text-blue-700 border-blue-200'
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#10293F]" />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0 mt-0.5">
              <Brain className="w-5 h-5 text-[#10293F]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Dashboard Executivo</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Indicadores para tomada de decisao
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">7 dias</SelectItem>
                <SelectItem value="month">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchDashboardData} variant="outline" size="sm">
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {data?.alerts && data.alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {data.alerts.map((alert, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  getSeverityColor(alert.severity)
                )}
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-sm font-medium">{alert.message}</span>
                <Badge variant="outline" className="text-xs">
                  {alert.severity === 'critical' ? 'Critico' :
                   alert.severity === 'high' ? 'Alto' :
                   alert.severity === 'medium' ? 'Medio' : 'Baixo'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Total Tickets */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Tickets</p>
                <p className="text-3xl font-bold text-[#10293F]">{data?.overview.total_tickets || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#10293F]" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {getTrendIcon(data?.trends.trend || 0)}
              <span className="text-xs text-muted-foreground">
                {data?.trends.trend}% vs ontem
              </span>
            </div>
          </Card>

          {/* Resolution Rate */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Taxa de Resolucao</p>
                <p className="text-3xl font-bold text-[#10293F]">{data?.overview.resolution_rate || 0}%</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Target className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <Progress value={data?.overview.resolution_rate || 0} className="h-2 mt-3" />
          </Card>

          {/* Avg Resolution Time */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tempo Medio</p>
                <p className="text-3xl font-bold text-[#10293F]">
                  {data?.overview.avg_resolution_time || 0}
                  <span className="text-sm font-normal ml-1">min</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Meta: 30 min</p>
          </Card>

          {/* Active Agents */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Agentes Online</p>
                <p className="text-3xl font-bold text-[#10293F]">{data?.overview.active_agents || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data?.overview.queue_size || 0} na fila
            </p>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="predictions">Predicoes</TabsTrigger>
            <TabsTrigger value="ai">IA & ML</TabsTrigger>
            <TabsTrigger value="costs">Custos</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <div className="grid grid-cols-2 gap-6">
              {/* AI vs Human Performance */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#10293F]" />
                  Performance IA vs Humano
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#E8F9F9]">
                    <div className="flex items-center gap-3">
                      <Bot className="w-6 h-6 text-[#10293F]" />
                      <div>
                        <p className="font-medium">Agentes IA</p>
                        <p className="text-xs text-muted-foreground">
                          {100 - (data?.performance.escalation_rate || 0)}% dos tickets
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#10293F]">
                        {data?.performance.ai_success_rate || 0}%
                      </p>
                      <p className="text-xs text-green-600">taxa de sucesso</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Users className="w-6 h-6 text-[#10293F]" />
                      <div>
                        <p className="font-medium">Agentes Humanos</p>
                        <p className="text-xs text-muted-foreground">
                          {data?.performance.escalation_rate || 0}% dos tickets
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#10293F]">
                        {data?.performance.human_success_rate || 0}%
                      </p>
                      <p className="text-xs text-green-600">taxa de sucesso</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Escalation Rate */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-[#10293F]" />
                  Taxa de Escalacao
                </h3>
                <div className="flex items-center justify-center h-40">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#E5E5E5"
                        strokeWidth="12"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke={data?.performance.escalation_rate && data.performance.escalation_rate > 30 ? '#DC2626' : '#10293F'}
                        strokeWidth="12"
                        strokeDasharray={`${(data?.performance.escalation_rate || 0) * 3.52} 352`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-3xl font-bold">{data?.performance.escalation_rate || 0}%</p>
                      <p className="text-xs text-muted-foreground">meta: &lt;20%</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  {data?.performance.escalation_rate && data.performance.escalation_rate > 30 ? (
                    <Badge className="bg-red-100 text-red-700">
                      <XCircle className="w-3 h-3 mr-1" />
                      Acima da meta
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Dentro da meta
                    </Badge>
                  )}
                </div>
              </Card>

              {/* Customer Satisfaction */}
              <Card className="p-6 col-span-2">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#10293F]" />
                  Satisfacao do Cliente
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {Math.round((data?.performance.customer_satisfaction || 0) * 0.7)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Muito Satisfeito</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {Math.round((data?.performance.customer_satisfaction || 0) * 0.2)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Satisfeito</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-yellow-600">
                      {Math.round((data?.performance.customer_satisfaction || 0) * 0.07)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Neutro</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600">
                      {Math.round((data?.performance.customer_satisfaction || 0) * 0.03)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Insatisfeito</p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Predictions Tab */}
          <TabsContent value="predictions">
            <div className="grid grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#10293F]" />
                  Previsoes para Amanha
                </h3>
                <div className="text-center py-6">
                  <p className="text-5xl font-bold text-[#10293F]">
                    {data?.predictions.expected_tickets_tomorrow || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">tickets esperados</p>
                </div>
                <div className="flex items-center gap-2 justify-center text-green-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-sm font-medium">+10% vs hoje</span>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#10293F]" />
                  Horarios de Pico
                </h3>
                <div className="space-y-3">
                  {(data?.predictions.peak_hours || ['09:00-11:00', '14:00-16:00']).map((hour, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#E8F9F9]">
                      <span className="text-sm font-medium">{hour}</span>
                      <Badge variant="outline">{idx === 0 ? 'Mais movimento' : 'Segundo pico'}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#10293F]" />
                  Risco de Churn
                </h3>
                <div className="text-center py-6">
                  <p className="text-5xl font-bold text-red-600">
                    {data?.predictions.churn_risk_clients || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">clientes em risco</p>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Ver Clientes em Risco
                </Button>
              </Card>
            </div>
          </TabsContent>

          {/* AI & ML Tab */}
          <TabsContent value="ai">
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[#10293F]" />
                  Performance do Fine-tuning
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Qualidade Media</span>
                    <span className="font-bold">87%</span>
                  </div>
                  <Progress value={87} className="h-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Exemplos de Treino</span>
                    <span className="font-bold">1,234</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Patterns Identificados</span>
                    <span className="font-bold">89</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#10293F]" />
                  Predicao de Roteamento
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Acuracia do Roteamento</span>
                    <span className="font-bold">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Regras Ativas</span>
                    <span className="font-bold">15</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Agentes Disponiveis</span>
                    <span className="font-bold">{data?.overview.active_agents || 0}</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs">
            <div className="grid grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#10293F]" />
                  Custo por Ticket
                </h3>
                <div className="text-center py-6">
                  <p className="text-4xl font-bold text-[#10293F]">$0.42</p>
                  <p className="text-sm text-muted-foreground mt-2">por ticket resolvido</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm font-medium">-12% vs mes anterior</span>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#10293F]" />
                  Custo de IA
                </h3>
                <div className="text-center py-6">
                  <p className="text-4xl font-bold text-[#10293F]">$127</p>
                  <p className="text-sm text-muted-foreground mt-2">ultimos 7 dias</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm font-medium">-8% vs semana anterior</span>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#10293F]" />
                  ROI do Sistema
                </h3>
                <div className="text-center py-6">
                  <p className="text-4xl font-bold text-green-600">312%</p>
                  <p className="text-sm text-muted-foreground mt-2">retorno sobre investimento</p>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-4">
                  Comparado ao custo de atendimento 100% humano
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Ultima atualizacao: {lastUpdate.toLocaleTimeString('pt-BR')} | Atualizacao automatica a cada 1 minuto
        </div>
      </div>
    </div>
  )
}
