import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Brain, TrendingUp, AlertTriangle, CheckCircle2, Clock, Zap, BarChart3, Lightbulb, Activity, ChevronRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type TimeRange = '1h' | '24h' | '7d' | '30d'
type Scope = 'system' | 'agents' | 'performance' | 'costs' | 'customer'

interface AnalysisResult {
  score: number
  status: 'healthy' | 'warning' | 'critical'
  findings: Array<{
    area: string
    issue: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    recommendation: string
    metrics?: Record<string, number>
  }>
  summary: string
  next_actions: Array<{
    priority: number
    action: string
    expected_impact: string
  }>
}

interface Suggestion {
  category: string
  priority: string
  suggestion: string
  details: string
  action: string
}

export default function CTOAdvisorPage() {
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [scope, setScope] = useState<Scope>('system')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [forecast, setForecast] = useState<any>(null)
  const [comparison, setComparison] = useState<any>(null)

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cto-advisor', {
        body: { action: 'analyze', scope, time_range: timeRange },
      })

      if (error) throw error
      setAnalysis(data.analysis)
      toast.success('Análise concluída')
    } catch (error: any) {
      toast.error('Erro ao executar análise: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cto-advisor', {
        body: { action: 'suggest', scope: 'system', time_range: timeRange },
      })

      if (error) throw error
      setSuggestions(data.suggestions || [])
    } catch (error: any) {
      toast.error('Erro ao carregar sugestões: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadForecast = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cto-advisor', {
        body: { action: 'forecast', time_range: timeRange },
      })

      if (error) throw error
      setForecast(data.forecast)
    } catch (error: any) {
      toast.error('Erro ao carregar previsão: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadComparison = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cto-advisor', {
        body: { action: 'compare', time_range: timeRange },
      })

      if (error) throw error
      setComparison(data.comparison)
    } catch (error: any) {
      toast.error('Erro ao carregar comparação: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200'
    if (score >= 40) return 'bg-orange-50 border-orange-200'
    return 'bg-red-50 border-red-200'
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-blue-100 text-blue-700 border-blue-200'
    }
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
              <h1 className="text-2xl font-semibold text-foreground">CTO Advisor</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Conselheiro estratégico para otimização do sistema
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Período:</label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Última hora</SelectItem>
                  <SelectItem value="24h">Últimas 24h</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Escopo:</label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="agents">Agentes</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="costs">Custos</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={runAnalysis} disabled={loading} className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
              Analisar Sistema
            </Button>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis">Análise</TabsTrigger>
            <TabsTrigger value="suggestions" onClick={loadSuggestions}>Sugestões</TabsTrigger>
            <TabsTrigger value="forecast" onClick={loadForecast}>Previsão</TabsTrigger>
            <TabsTrigger value="comparison" onClick={loadComparison}>Comparativo</TabsTrigger>
          </TabsList>

          {/* Analysis Tab */}
          <TabsContent value="analysis">
            {analysis ? (
              <div className="space-y-6">
                {/* Score Card */}
                <Card className={cn('p-6 border-2', getScoreBg(analysis.score))}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn('text-5xl font-bold', getScoreColor(analysis.score))}>
                        {analysis.score}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">Score de Saúde do Sistema</p>
                        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                      </div>
                    </div>
                    <Badge className={cn(
                      analysis.status === 'healthy' ? 'bg-green-100 text-green-700' :
                      analysis.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {analysis.status === 'healthy' && <CheckCircle2 className="w-4 h-4 mr-1" />}
                      {analysis.status === 'warning' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      {analysis.status === 'critical' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      {analysis.status === 'healthy' ? 'Saudável' :
                       analysis.status === 'warning' ? 'Atenção' : 'Crítico'}
                    </Badge>
                  </div>
                </Card>

                {/* Findings */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#10293F]" />
                    Achados ({analysis.findings.length})
                  </h3>
                  {analysis.findings.length > 0 ? (
                    <div className="space-y-4">
                      {analysis.findings.map((finding, idx) => (
                        <div key={idx} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getImpactColor(finding.impact)}>
                                {finding.impact === 'critical' ? 'Crítico' :
                                 finding.impact === 'high' ? 'Alto' :
                                 finding.impact === 'medium' ? 'Médio' : 'Baixo'}
                              </Badge>
                              <span className="font-medium">{finding.area}</span>
                            </div>
                          </div>
                          <p className="text-sm mb-2">{finding.issue}</p>
                          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{finding.recommendation}</span>
                          </div>
                          {finding.metrics && (
                            <div className="flex gap-4 mt-2 text-xs font-mono text-muted-foreground">
                              {Object.entries(finding.metrics).map(([key, value]) => (
                                <span key={key}>{key}: {typeof value === 'number' ? value.toFixed(2) : value}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum problema encontrado no escopo selecionado
                    </p>
                  )}
                </Card>

                {/* Next Actions */}
                {analysis.next_actions.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-[#10293F]" />
                      Próximas Ações
                    </h3>
                    <div className="space-y-2">
                      {analysis.next_actions.map((action) => (
                        <div key={action.priority} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <div className="w-6 h-6 rounded-full bg-[#45E5E5] text-[#10293F] flex items-center justify-center text-sm font-bold">
                            {action.priority}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{action.action}</p>
                            <p className="text-xs text-muted-foreground">{action.expected_impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Clique em "Analisar Sistema" para gerar uma análise completa
                </p>
              </Card>
            )}
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#10293F]" />
                Sugestões de Melhoria
              </h3>
              {suggestions.length > 0 ? (
                <div className="space-y-4">
                  {suggestions.map((sug, idx) => (
                    <div key={idx} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{sug.category}</Badge>
                        <Badge className={
                          sug.priority === 'critical' ? 'bg-red-100 text-red-700' :
                          sug.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {sug.priority === 'critical' ? 'Crítico' :
                           sug.priority === 'high' ? 'Alta' : 'Média'}
                        </Badge>
                      </div>
                      <p className="font-medium mb-1">{sug.suggestion}</p>
                      <p className="text-sm text-muted-foreground mb-2">{sug.details}</p>
                      <div className="flex items-center gap-2 text-xs bg-[#E8F9F9] p-2 rounded">
                        <Zap className="w-3 h-3 text-[#10293F]" />
                        <span className="text-[#10293F]">{sug.action}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Clique na aba para carregar sugestões
                </p>
              )}
            </Card>
          </TabsContent>

          {/* Forecast Tab */}
          <TabsContent value="forecast">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#10293F]" />
                Previsão de Demanda
              </h3>
              {forecast ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-[#E8F9F9]">
                    <p className="text-sm text-muted-foreground">Volume Diário Projetado</p>
                    <p className="text-3xl font-bold text-[#10293F]">{forecast.projected_daily_volume}</p>
                    <p className="text-xs text-muted-foreground">tickets/dia</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50">
                    <p className="text-sm text-muted-foreground">Taxa de Resolução Projetada</p>
                    <p className="text-3xl font-bold text-green-600">{forecast.projected_resolution_rate}%</p>
                    <p className="text-xs text-muted-foreground">meta</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium mb-2">Recomendações</p>
                    <ul className="space-y-1">
                      {forecast.recommendations?.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="col-span-2 p-3 rounded bg-muted/50 text-xs text-muted-foreground">
                    Confiança: {(forecast.confidence * 100).toFixed(0)}% | Fatores: {forecast.factors?.join(', ')}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Clique na aba para carregar previsão
                </p>
              )}
            </Card>
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#10293F]" />
                Comparativo de Período
              </h3>
              {comparison ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Variação de Volume</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        comparison.volume_change_percent > 0 ? 'text-green-600' :
                        comparison.volume_change_percent < 0 ? 'text-red-600' : 'text-muted-foreground'
                      )}>
                        {comparison.volume_change_percent > 0 ? '+' : ''}{comparison.volume_change_percent}%
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Variação de Erros</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        comparison.error_rate_change < 0 ? 'text-green-600' :
                        comparison.error_rate_change > 0 ? 'text-red-600' : 'text-muted-foreground'
                      )}>
                        {comparison.error_rate_change > 0 ? '+' : ''}{comparison.error_rate_change}%
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-[#10293F] text-white">
                    <p className="text-sm font-medium mb-1">Veredicto</p>
                    <p className="text-lg">{comparison.verdict}</p>
                  </div>

                  <div className="p-3 rounded bg-muted/50 text-xs text-muted-foreground">
                    Período atual: {comparison.period?.current} | Período anterior: {comparison.period?.previous}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Clique na aba para carregar comparativo
                </p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
