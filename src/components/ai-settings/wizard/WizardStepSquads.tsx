import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Users, Loader2, CheckCircle2 } from 'lucide-react'
import { usePlatformAIConfigs, useUpdatePlatformAIConfig, type AIFeature } from '@/hooks/usePlatformAIConfig'
import { useModelCatalog, type ModelCatalogEntry, estimateCostPer1kMessages } from '@/hooks/useModelCatalog'
import { ModelCombobox } from '@/components/ai-settings/ModelCombobox'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { cn } from '@/lib/utils'

interface SquadConfig {
  key: AIFeature
  label: string
  description: string
  borderColor: string
  badgeColor: string
}

const SQUADS: SquadConfig[] = [
  {
    key: 'default_model_triage',
    label: 'Triagem',
    description: 'Classificação rápida e roteamento de mensagens. Modelo rápido e econômico.',
    borderColor: 'border-l-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    key: 'default_model_support',
    label: 'Suporte',
    description: 'Atendimento técnico ao cliente. Bom equilíbrio entre custo e qualidade.',
    borderColor: 'border-l-emerald-500',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  },
  {
    key: 'default_model_financial',
    label: 'Financeiro',
    description: 'Cobranças e pagamentos. Precisão é prioridade — temperatura baixa.',
    borderColor: 'border-l-amber-500',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  {
    key: 'default_model_sales',
    label: 'Vendas / SDR',
    description: 'Qualificação de leads e vendas. Modelo mais criativo e persuasivo.',
    borderColor: 'border-l-pink-500',
    badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  },
  {
    key: 'default_model_copilot',
    label: 'Copiloto',
    description: 'Sugestões inteligentes para agentes humanos. Modelo avançado recomendado.',
    borderColor: 'border-l-purple-500',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
]

export function WizardStepSquads() {
  const { data: configs, isLoading: loadingConfigs } = usePlatformAIConfigs()
  const { data: models = [], isLoading: loadingModels } = useModelCatalog({ activeOnly: true })
  const updateConfig = useUpdatePlatformAIConfig()
  const { rate: exchangeRate } = useExchangeRate()

  const [localState, setLocalState] = useState<Record<string, { model: string; enabled: boolean }>>({})
  const [savedSquads, setSavedSquads] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (configs) {
      const state: Record<string, { model: string; enabled: boolean }> = {}
      configs.forEach(c => {
        state[c.feature] = { model: c.model, enabled: c.enabled }
      })
      setLocalState(state)
    }
  }, [configs])

  const update = (feature: string, field: 'model' | 'enabled', value: string | boolean) => {
    setLocalState(prev => ({
      ...prev,
      [feature]: { ...prev[feature], model: prev[feature]?.model || '', enabled: prev[feature]?.enabled ?? true, [field]: value }
    }))
  }

  const handleSave = (feature: AIFeature) => {
    const s = localState[feature]
    if (!s) return
    updateConfig.mutate(
      { feature, model: s.model, enabled: s.enabled },
      {
        onSuccess: () => {
          setSavedSquads(prev => new Set(prev).add(feature))
          setTimeout(() => setSavedSquads(prev => { const n = new Set(prev); n.delete(feature); return n }), 2000)
        },
      }
    )
  }

  if (loadingConfigs || loadingModels) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
  }

  const getModelInfo = (modelId: string) => models.find(m => m.model_id === modelId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Padrões por Especialidade (Squads)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Defina o modelo padrão para novos agentes de cada especialidade. Agentes individuais podem sobrescrever este padrão.
        </p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm">
        <Users className="w-4 h-4 shrink-0" />
        Novos agentes herdam automaticamente o modelo do seu Squad. Agentes existentes mantêm seu modelo atual.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SQUADS.map(squad => {
          const state = localState[squad.key] || { model: '', enabled: true }
          const original = configs?.find(c => c.feature === squad.key)
          const isDirty = original ? (state.model !== original.model || state.enabled !== original.enabled) : state.model !== ''
          const modelInfo = getModelInfo(state.model)
          const costEstimate = modelInfo ? estimateCostPer1kMessages(modelInfo) : null
          const isSaved = savedSquads.has(squad.key)

          return (
            <Card key={squad.key} className={cn('border-l-4', squad.borderColor)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#10293F] dark:text-[#45E5E5]" />
                    <h3 className="font-medium text-sm">{squad.label}</h3>
                    {isSaved && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Salvo
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={state.enabled}
                    onCheckedChange={v => update(squad.key, 'enabled', v)}
                  />
                </div>

                <Badge className={cn('text-xs', squad.badgeColor)}>{squad.label}</Badge>

                <p className="text-xs text-muted-foreground">{squad.description}</p>

                <ModelCombobox
                  models={models}
                  value={state.model}
                  onChange={v => update(squad.key, 'model', v)}
                  showCostEstimate
                />

                {costEstimate !== null && exchangeRate && (
                  <p className="text-xs text-muted-foreground">
                    Estimativa: ~${costEstimate.toFixed(2)}/mês (R$ {(costEstimate * exchangeRate).toFixed(2)}) para 1.000 conversas
                  </p>
                )}

                <Button
                  size="sm"
                  className="w-full bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
                  onClick={() => handleSave(squad.key)}
                  disabled={updateConfig.isPending || !isDirty}
                >
                  {updateConfig.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
