import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Save, Users, Layers } from 'lucide-react'
import { usePlatformAIConfigs, useUpdatePlatformAIConfig, type AIFeature } from '@/hooks/usePlatformAIConfig'
import { useModelCatalog, type ModelCatalogEntry, estimateCostPer1kMessages } from '@/hooks/useModelCatalog'
import { ModelCombobox } from '@/components/ai-settings/ModelCombobox'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { cn } from '@/lib/utils'

const SQUAD_FEATURES: { key: AIFeature; label: string; description: string; color: string; borderColor: string }[] = [
  { key: 'default_model_triage', label: 'Triagem', description: 'Classificação e roteamento rápido', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', borderColor: 'border-l-blue-500' },
  { key: 'default_model_support', label: 'Suporte', description: 'Atendimento técnico ao cliente', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', borderColor: 'border-l-emerald-500' },
  { key: 'default_model_financial', label: 'Financeiro', description: 'Cobranças e pagamentos', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', borderColor: 'border-l-amber-500' },
  { key: 'default_model_sales', label: 'Vendas / SDR', description: 'Qualificação de leads', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', borderColor: 'border-l-pink-500' },
  { key: 'default_model_copilot', label: 'Copiloto', description: 'Sugestões para agentes humanos', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', borderColor: 'border-l-purple-500' },
]

export function SquadsTab() {
  const { data: configs, isLoading: loadingConfigs } = usePlatformAIConfigs()
  const { data: models = [], isLoading: loadingModels } = useModelCatalog({ activeOnly: true })
  const updateConfig = useUpdatePlatformAIConfig()
  const { rate: exchangeRate } = useExchangeRate()

  const [localState, setLocalState] = useState<Record<string, { model: string; enabled: boolean }>>({})

  useEffect(() => {
    if (configs) {
      const state: Record<string, { model: string; enabled: boolean }> = {}
      configs.forEach(c => {
        state[c.feature] = { model: c.model, enabled: c.enabled }
      })
      setLocalState(state)
    }
  }, [configs])

  const handleSave = (feature: AIFeature) => {
    const s = localState[feature]
    if (!s) return
    updateConfig.mutate({ feature, model: s.model, enabled: s.enabled })
  }

  const update = (feature: string, field: 'model' | 'enabled', value: string | boolean) => {
    setLocalState(prev => ({
      ...prev,
      [feature]: { ...prev[feature], model: prev[feature]?.model || '', enabled: prev[feature]?.enabled ?? true, [field]: value }
    }))
  }

  if (loadingConfigs || loadingModels) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  const getModelInfo = (modelId: string) => models.find(m => m.model_id === modelId)

  return (
    <div className="space-y-4">
      {/* GMS-style info banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#10293F]/5 dark:bg-[#10293F]/30 border border-[#10293F]/10 dark:border-[#45E5E5]/20">
        <Layers className="w-5 h-5 text-[#10293F] dark:text-[#45E5E5] shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">Padrões por Especialidade</p>
          <p className="text-xs text-muted-foreground">
            Novos agentes herdam automaticamente o modelo do seu Squad. Agentes existentes mantêm a configuração atual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SQUAD_FEATURES.map(feat => {
          const state = localState[feat.key] || { model: '', enabled: true }
          const original = configs?.find(c => c.feature === feat.key)
          const isDirty = original ? (state.model !== original.model || state.enabled !== original.enabled) : state.model !== ''
          const modelInfo = state.model ? getModelInfo(state.model) : null
          const costEstimate = modelInfo ? estimateCostPer1kMessages(modelInfo) : null

          return (
            <Card key={feat.key} className={cn('border-l-4', feat.borderColor)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#10293F] dark:text-[#45E5E5]" />
                    <h3 className="font-medium text-sm">{feat.label}</h3>
                  </div>
                  <Switch
                    checked={state.enabled}
                    onCheckedChange={v => update(feat.key, 'enabled', v)}
                  />
                </div>
                <Badge className={feat.color + ' text-xs'}>{feat.label}</Badge>
                <p className="text-xs text-muted-foreground">{feat.description}</p>
                <ModelCombobox
                  models={models}
                  value={state.model}
                  onChange={v => update(feat.key, 'model', v)}
                  placeholder="Selecionar modelo padrão..."
                  showCostEstimate
                />
                {costEstimate !== null && exchangeRate && (
                  <p className="text-xs text-muted-foreground">
                    Estimativa: ~${costEstimate.toFixed(2)}/mês (R$ {(costEstimate * exchangeRate).toFixed(2)}) para 1.000 conversas
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-full bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] disabled:opacity-50"
                  disabled={!isDirty || updateConfig.isPending}
                  onClick={() => handleSave(feat.key)}
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
