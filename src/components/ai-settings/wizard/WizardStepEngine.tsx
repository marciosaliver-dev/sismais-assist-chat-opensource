import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Save, Route, Brain, Mic, Image, MessageSquare,
  Volume2, Sparkles, Cpu, Target, ChevronDown, ChevronUp,
  Loader2, CheckCircle2
} from 'lucide-react'
import { usePlatformAIConfigs, useUpdatePlatformAIConfig, type AIFeature } from '@/hooks/usePlatformAIConfig'
import { useModelCatalog, type ModelCatalogEntry } from '@/hooks/useModelCatalog'
import { ModelCombobox } from '@/components/ai-settings/ModelCombobox'
import { cn } from '@/lib/utils'

interface FeatureConfig {
  key: AIFeature
  label: string
  description: string
  icon: React.ElementType
  recommended: string
  category: 'core' | 'media' | 'special'
  hasTemperature: boolean
  hasMaxTokens: boolean
}

const ENGINE_FEATURES: FeatureConfig[] = [
  { key: 'orchestrator', label: 'Orquestrador', description: 'Roteia mensagens para o agente correto', icon: Route, recommended: 'google/gemini-3.1-flash-lite-preview', category: 'core', hasTemperature: true, hasMaxTokens: false },
  { key: 'message_analyzer', label: 'Analisador de Mensagens', description: 'Extrai sentimento, intenção e urgência', icon: Brain, recommended: 'google/gemini-3.1-flash-lite-preview', category: 'core', hasTemperature: true, hasMaxTokens: true },
  { key: 'agent_executor', label: 'Executor de Agentes', description: 'Modelo padrão do motor de agentes', icon: Cpu, recommended: 'google/gemini-3.1-flash-lite-preview', category: 'core', hasTemperature: false, hasMaxTokens: true },
  { key: 'copilot', label: 'Copiloto', description: 'Sugestões para agentes humanos', icon: Sparkles, recommended: 'google/gemini-3.1-flash-lite-preview', category: 'core', hasTemperature: true, hasMaxTokens: true },
  { key: 'summarization', label: 'Resumo de Conversas', description: 'Resumos automáticos de histórico', icon: MessageSquare, recommended: 'google/gemini-3.1-flash-lite-preview', category: 'core', hasTemperature: false, hasMaxTokens: true },
  { key: 'audio_transcription', label: 'Transcrição de Áudio', description: 'Converte áudio em texto', icon: Mic, recommended: 'google/gemini-3.1-flash-image-preview', category: 'media', hasTemperature: false, hasMaxTokens: false },
  { key: 'image_transcription', label: 'Transcrição de Imagem', description: 'OCR e descrição de imagens', icon: Image, recommended: 'google/gemini-3.1-flash-image-preview', category: 'media', hasTemperature: false, hasMaxTokens: false },
  { key: 'embedding', label: 'Embeddings (RAG)', description: 'Vetores semânticos para busca', icon: Target, recommended: 'text-embedding-3-small', category: 'special', hasTemperature: false, hasMaxTokens: false },
  { key: 'tts', label: 'Texto para Fala', description: 'Converte texto em áudio', icon: Volume2, recommended: 'openai/tts-1', category: 'special', hasTemperature: false, hasMaxTokens: false },
]

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Motor Principal',
  media: 'Processamento de Mídia',
  special: 'Modelos Especializados',
}

export function WizardStepEngine() {
  const { data: configs, isLoading: loadingConfigs } = usePlatformAIConfigs()
  const { data: models = [], isLoading: loadingModels } = useModelCatalog({ activeOnly: true })
  const updateConfig = useUpdatePlatformAIConfig()

  const [localState, setLocalState] = useState<Record<string, { model: string; enabled: boolean; temperature?: number; max_tokens?: number }>>({})
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null)
  const [savedFeatures, setSavedFeatures] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (configs) {
      const state: Record<string, { model: string; enabled: boolean; temperature?: number; max_tokens?: number }> = {}
      configs.forEach(c => {
        const extra = c.extra_config as Record<string, unknown> || {}
        state[c.feature] = {
          model: c.model,
          enabled: c.enabled,
          temperature: extra.temperature as number | undefined,
          max_tokens: extra.max_tokens as number | undefined,
        }
      })
      setLocalState(state)
    }
  }, [configs])

  const update = (feature: string, field: string, value: unknown) => {
    setLocalState(prev => ({
      ...prev,
      [feature]: { ...prev[feature], model: prev[feature]?.model || '', enabled: prev[feature]?.enabled ?? true, [field]: value }
    }))
  }

  const handleSave = (feature: AIFeature) => {
    const s = localState[feature]
    if (!s) return
    const extra_config: Record<string, unknown> = {}
    if (s.temperature !== undefined) extra_config.temperature = s.temperature
    if (s.max_tokens !== undefined) extra_config.max_tokens = s.max_tokens
    updateConfig.mutate(
      { feature, model: s.model, enabled: s.enabled, extra_config },
      {
        onSuccess: () => {
          setSavedFeatures(prev => new Set(prev).add(feature))
          setTimeout(() => setSavedFeatures(prev => { const n = new Set(prev); n.delete(feature); return n }), 2000)
        },
      }
    )
  }

  if (loadingConfigs || loadingModels) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
  }

  const categories = ['core', 'media', 'special'] as const

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Motor Interno de IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o modelo e parâmetros de cada componente interno do sistema.
        </p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm">
        <Cpu className="w-4 h-4 shrink-0" />
        <span>
          <strong>{configs?.filter(c => c.enabled).length || 0}</strong> de {ENGINE_FEATURES.length} IAs ativas
        </span>
      </div>

      {categories.map(cat => {
        const features = ENGINE_FEATURES.filter(f => f.category === cat)
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {CATEGORY_LABELS[cat]}
            </h3>
            {features.map(feat => {
              const Icon = feat.icon
              const state = localState[feat.key] || { model: '', enabled: true }
              const isExpanded = expandedFeature === feat.key
              const isSaved = savedFeatures.has(feat.key)
              const original = configs?.find(c => c.feature === feat.key)
              const isDirty = original
                ? state.model !== original.model || state.enabled !== original.enabled
                : state.model !== ''

              return (
                <Card key={feat.key} className={cn(
                  'transition-shadow',
                  isExpanded && 'shadow-[0_4px_12px_rgba(16,41,63,0.08)]'
                )}>
                  <CardContent className="p-0">
                    {/* Header row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#10293F] dark:text-[#45E5E5]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{feat.label}</span>
                          {state.enabled ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                          {isSaved && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Salvo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{feat.description}</p>
                      </div>
                      <Switch
                        checked={state.enabled}
                        onCheckedChange={v => update(feat.key, 'enabled', v)}
                      />
                      <button
                        onClick={() => setExpandedFeature(isExpanded ? null : feat.key)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Expanded config */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-border space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Modelo de IA</Label>
                          <ModelCombobox
                            models={models}
                            value={state.model}
                            onChange={v => update(feat.key, 'model', v)}
                            showCostEstimate
                          />
                          <p className="text-xs text-muted-foreground">
                            Recomendado: <span className="font-mono">{feat.recommended}</span>
                          </p>
                        </div>

                        {feat.hasTemperature && (
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-xs">Temperatura</Label>
                              <span className="text-xs text-primary font-medium">{(state.temperature ?? 0.3).toFixed(1)}</span>
                            </div>
                            <Slider
                              value={[Number(state.temperature ?? 0.3)]}
                              min={0} max={1} step={0.1}
                              onValueChange={([v]) => update(feat.key, 'temperature', v)}
                            />
                          </div>
                        )}

                        {feat.hasMaxTokens && (
                          <div className="space-y-2">
                            <Label className="text-xs">Máximo de Tokens</Label>
                            <Input
                              type="number" min={100} max={8000}
                              value={state.max_tokens ?? 1000}
                              onChange={e => update(feat.key, 'max_tokens', parseInt(e.target.value) || 1000)}
                              className="h-8 text-sm"
                            />
                          </div>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleSave(feat.key)}
                          disabled={updateConfig.isPending || !isDirty}
                          className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
                        >
                          {updateConfig.isPending ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-1" />
                          )}
                          Salvar Configuração
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
