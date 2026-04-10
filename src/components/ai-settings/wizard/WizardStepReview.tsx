import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2, AlertTriangle, Wifi, DollarSign,
  Cpu, Users, Bot, ArrowRight
} from 'lucide-react'
import { useOpenRouterCredits, useModelCatalog, estimateCostPer1kMessages } from '@/hooks/useModelCatalog'
import { usePlatformAIConfigs } from '@/hooks/usePlatformAIConfig'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { cn } from '@/lib/utils'

interface CheckItem {
  label: string
  status: 'ok' | 'warning' | 'error'
  detail: string
}

export function WizardStepReview() {
  const { data: credits, isLoading: loadingCredits } = useOpenRouterCredits()
  const { data: configs, isLoading: loadingConfigs } = usePlatformAIConfigs()
  const { data: models = [] } = useModelCatalog({ activeOnly: true })
  const { rate: exchangeRate } = useExchangeRate()
  const { data: agents, isLoading: loadingAgents } = useQuery({
    queryKey: ['ai-agents-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, specialty, model, is_active')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const loading = loadingCredits || loadingConfigs || loadingAgents

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
  }

  // Build checklist
  const internalFeatures = ['orchestrator', 'message_analyzer', 'agent_executor', 'copilot', 'summarization', 'audio_transcription', 'image_transcription', 'embedding', 'tts']
  const squadFeatures = ['default_model_triage', 'default_model_support', 'default_model_financial', 'default_model_sales', 'default_model_copilot']

  const activeInternals = configs?.filter(c => internalFeatures.includes(c.feature) && c.enabled) || []
  const activeSquads = configs?.filter(c => squadFeatures.includes(c.feature) && c.enabled && c.model) || []
  const activeAgents = agents?.filter(a => a.is_active) || []

  const checks: CheckItem[] = [
    {
      label: 'Conexão OpenRouter',
      status: 'ok',
      detail: 'Gateway conectado e operacional',
    },
    {
      label: 'Créditos',
      status: credits && (credits.balance ?? credits.limit_remaining ?? 0) > 1 ? 'ok' : credits && (credits.balance ?? credits.limit_remaining ?? 0) > 0 ? 'warning' : 'error',
      detail: credits ? `Saldo: $${(credits.balance ?? credits.limit_remaining ?? 0).toFixed(2)}` : 'Não foi possível verificar',
    },
    {
      label: 'IAs Internas',
      status: activeInternals.length >= 3 ? 'ok' : activeInternals.length > 0 ? 'warning' : 'error',
      detail: `${activeInternals.length} de ${internalFeatures.length} ativas`,
    },
    {
      label: 'Squads Configurados',
      status: activeSquads.length >= 2 ? 'ok' : activeSquads.length > 0 ? 'warning' : 'error',
      detail: `${activeSquads.length} de ${squadFeatures.length} com modelo definido`,
    },
    {
      label: 'Agentes IA',
      status: activeAgents.length > 0 ? 'ok' : 'warning',
      detail: activeAgents.length > 0 ? `${activeAgents.length} agentes ativos` : 'Nenhum agente ativo — crie pelo menos um',
    },
  ]

  // Cost estimation
  const estimateMonthlyCost = () => {
    let totalCost = 0
    const relevantConfigs = configs?.filter(c =>
      [...internalFeatures, ...squadFeatures].includes(c.feature) && c.enabled && c.model
    ) || []

    relevantConfigs.forEach(config => {
      const modelInfo = models.find(m => m.model_id === config.model)
      if (modelInfo) {
        totalCost += estimateCostPer1kMessages(modelInfo)
      }
    })

    return totalCost
  }

  const monthlyCost = estimateMonthlyCost()
  const allOk = checks.every(c => c.status === 'ok')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Revisão da Configuração</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verifique se tudo está configurado corretamente antes de finalizar.
        </p>
      </div>

      {/* Status banner */}
      {allOk ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-200">Tudo configurado!</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Seu motor de IA está pronto para operar.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Atenção</p>
            <p className="text-sm text-amber-600 dark:text-amber-400">Alguns itens precisam de atenção. Revise os pontos abaixo.</p>
          </div>
        </div>
      )}

      {/* Checklist */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium text-sm text-foreground mb-2">Checklist</h3>
          {checks.map((check) => {
            const StatusIcon = check.status === 'ok' ? CheckCircle2 : check.status === 'warning' ? AlertTriangle : AlertTriangle
            const statusColor = check.status === 'ok'
              ? 'text-emerald-500'
              : check.status === 'warning'
                ? 'text-amber-500'
                : 'text-red-500'

            return (
              <div key={check.label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <StatusIcon className={cn('w-5 h-5 shrink-0', statusColor)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{check.label}</span>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-sm text-foreground mb-3">Estimativa de Custo Mensal</h3>
          <div className="flex items-baseline gap-2">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <span className="text-3xl font-bold text-foreground">${monthlyCost.toFixed(2)}</span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
          {exchangeRate && (
            <p className="text-sm text-muted-foreground mt-1">
              Aproximadamente R$ {(monthlyCost * exchangeRate).toFixed(2)}/mês
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            * Estimativa baseada em 1.000 conversas/mês com média de 150 tokens de entrada e 100 tokens de saída por mensagem.
            O custo real pode variar.
          </p>
        </CardContent>
      </Card>

      {/* Summary Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Cpu className="w-6 h-6 text-[#45E5E5] mx-auto mb-2" />
            <p className="text-lg font-bold">{activeInternals.length}</p>
            <p className="text-xs text-muted-foreground">IAs Internas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-[#45E5E5] mx-auto mb-2" />
            <p className="text-lg font-bold">{activeSquads.length}</p>
            <p className="text-xs text-muted-foreground">Squads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Bot className="w-6 h-6 text-[#45E5E5] mx-auto mb-2" />
            <p className="text-lg font-bold">{activeAgents.length}</p>
            <p className="text-xs text-muted-foreground">Agentes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
