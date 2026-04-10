import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { ExternalLink, Loader2, Star, Eye, Mic, Brain, Wrench, Layers, Wifi, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TablesInsert } from '@/integrations/supabase/types'
import {
  useModelsByTier,
  useModelsByRecommendation,
  TIER_CONFIG,
  formatModelCost,
  estimateCostPer1kMessages,
  type ModelCatalogEntry,
  type ModelTier,
} from '@/hooks/useModelCatalog'
import { usePlatformAIConfigs } from '@/hooks/usePlatformAIConfig'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
  specialty?: string
}

const CUSTOM_MODEL_KEY = '__custom__'

const SPECIALTY_SQUAD_MAP: Record<string, string> = {
  triage: 'default_model_triage',
  support: 'default_model_support',
  financial: 'default_model_financial',
  sales: 'default_model_sales',
  sdr: 'default_model_sales',
  copilot: 'default_model_copilot',
}

const CAPABILITY_ICONS: Record<string, { icon: typeof Eye; label: string }> = {
  vision: { icon: Eye, label: 'Imagem' },
  audio: { icon: Mic, label: 'Áudio' },
  reasoning: { icon: Brain, label: 'Raciocínio' },
  function_calling: { icon: Wrench, label: 'Tools' },
}

function ModelOption({ model, isRecommended }: { model: ModelCatalogEntry; isRecommended?: boolean }) {
  const tierInfo = TIER_CONFIG[model.tier as ModelTier]
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="flex-1 truncate">{model.display_name}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatModelCost(model.input_cost_per_1m)}
      </span>
      {isRecommended && (
        <Star className="w-3 h-3 text-amber-500 shrink-0" />
      )}
      <Badge variant="outline" className={`text-xs px-1 py-0 shrink-0 ${tierInfo.badgeClass}`}>
        {tierInfo.label}
      </Badge>
    </div>
  )
}

export function AgentLLMConfig({ data, onChange, specialty }: Props) {
  const { data: modelsByTier, isLoading } = useModelsByTier()
  const { recommended } = useModelsByRecommendation(specialty || '')
  const { data: platformConfigs } = usePlatformAIConfigs()

  const recommendedIds = new Set(recommended.map(m => m.model_id))

  const currentModel = data.model || ''
  const allModels = modelsByTier
    ? [...modelsByTier.nano, ...modelsByTier.economic, ...modelsByTier.standard, ...modelsByTier.premium, ...modelsByTier.enterprise]
    : []
  const isKnownModel = allModels.some(m => m.model_id === currentModel)
  const [showCustom, setShowCustom] = useState(!isKnownModel && currentModel !== '')
  const [open, setOpen] = useState(false)

  // Find inherited squad model
  const squadFeature = specialty ? SPECIALTY_SQUAD_MAP[specialty] : null
  const squadConfig = squadFeature ? platformConfigs?.find(c => c.feature === squadFeature) : null
  const inheritedModel = squadConfig?.model || null
  const inheritedModelInfo = inheritedModel ? allModels.find(m => m.model_id === inheritedModel) : null
  const isInheriting = !currentModel

  

  const handleSelectChange = (v: string) => {
    if (v === CUSTOM_MODEL_KEY) {
      setShowCustom(true)
      onChange({ model: '' })
    } else {
      setShowCustom(false)
      onChange({ model: v })
    }
  }

  // Get current model info for cost estimate
  const effectiveModel = currentModel || inheritedModel || ''
  const currentModelInfo = allModels.find(m => m.model_id === effectiveModel)
  const costEstimate = currentModelInfo ? estimateCostPer1kMessages(currentModelInfo) : null

  // Filter out embedding and tts models from selection
  const filterAgentModels = (models: ModelCatalogEntry[]) =>
    models.filter(m => !m.capabilities.includes('embedding') && !m.capabilities.includes('tts'))

  return (
    <div className="space-y-6">
      {/* Provider info (read-only) */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Wifi className="w-4 h-4 text-[#45E5E5]" />
        <span className="text-sm text-foreground font-medium">OpenRouter (Multi-LLM)</span>
        <Badge variant="outline" className="text-xs ml-auto">Todos os modelos via OpenRouter</Badge>
      </div>

      {/* Inherited model indicator */}
      {isInheriting && inheritedModelInfo && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Usando padrão do Squad</span>
            <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
              {inheritedModelInfo.display_name} — selecione um modelo abaixo para sobrescrever
            </p>
          </div>
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs shrink-0">
            Herdado
          </Badge>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-foreground">Modelo de IA</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando catálogo de modelos...
          </div>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between h-9 font-normal text-sm"
              >
                {currentModel && isKnownModel ? (
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{allModels.find(m => m.model_id === currentModel)?.display_name}</span>
                    {(() => {
                      const m = allModels.find(m => m.model_id === currentModel)
                      const tierInfo = m ? TIER_CONFIG[m.tier as ModelTier] : null
                      return tierInfo ? (
                        <Badge variant="outline" className={cn('text-xs px-1 py-0 shrink-0', tierInfo.badgeClass)}>
                          {tierInfo.label}
                        </Badge>
                      ) : null
                    })()}
                  </span>
                ) : showCustom && currentModel ? (
                  <span className="truncate">{currentModel}</span>
                ) : (
                  <span className="text-muted-foreground">Usar padrão do Squad</span>
                )}
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[450px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pesquisar modelo..." />
                <CommandList>
                  <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>

                  {/* Recommended for this specialty */}
                  {specialty && filterAgentModels(recommended).length > 0 && (
                    <CommandGroup heading={`⭐ Recomendados para ${specialty}`}>
                      {filterAgentModels(recommended).map(m => (
                        <CommandItem
                          key={`rec-${m.model_id}`}
                          value={`${m.display_name} ${m.model_id}`}
                          onSelect={() => { handleSelectChange(m.model_id); setOpen(false) }}
                          className="flex items-center gap-2"
                        >
                          <Check className={cn('h-3.5 w-3.5 shrink-0', currentModel === m.model_id ? 'opacity-100' : 'opacity-0')} />
                          <ModelOption model={m} isRecommended />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* By tier */}
                  {modelsByTier && (['nano', 'economic', 'standard', 'premium', 'enterprise'] as ModelTier[]).map(tier => {
                    const models = filterAgentModels(modelsByTier[tier])
                    if (models.length === 0) return null
                    const tierInfo = TIER_CONFIG[tier]
                    return (
                      <CommandGroup key={tier} heading={tierInfo.label}>
                        {models.map(m => (
                          <CommandItem
                            key={m.model_id}
                            value={`${m.display_name} ${m.model_id}`}
                            onSelect={() => { handleSelectChange(m.model_id); setOpen(false) }}
                            className="flex items-center gap-2"
                          >
                            <Check className={cn('h-3.5 w-3.5 shrink-0', currentModel === m.model_id ? 'opacity-100' : 'opacity-0')} />
                            <ModelOption model={m} isRecommended={recommendedIds.has(m.model_id)} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )
                  })}

                  {/* Custom model */}
                  <CommandGroup heading="Personalizado">
                    <CommandItem
                      value="outro openrouter personalizado custom"
                      onSelect={() => { handleSelectChange(CUSTOM_MODEL_KEY); setOpen(false) }}
                    >
                      <Check className={cn('h-3.5 w-3.5 shrink-0', showCustom ? 'opacity-100' : 'opacity-0')} />
                      Outro (OpenRouter)
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {showCustom && (
          <div className="space-y-2 mt-2">
            <Input
              placeholder="ex: meta-llama/llama-3-70b"
              value={currentModel}
              onChange={(e) => onChange({ model: e.target.value })}
            />
            <a
              href="https://openrouter.ai/models"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Ver catálogo de modelos no OpenRouter
            </a>
          </div>
        )}

        {/* Model info badges */}
        {currentModelInfo && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(CAPABILITY_ICONS).map(([cap, { icon: Icon, label }]) => {
              if (!currentModelInfo.capabilities.includes(cap)) return null
              return (
                <Badge key={cap} variant="outline" className="text-xs gap-1 px-1.5 py-0.5">
                  <Icon className="w-3 h-3" />
                  {label}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Cost estimate */}
        {costEstimate !== null && (
          <p className="text-xs text-muted-foreground mt-1">
            Custo estimado: ~${costEstimate.toFixed(2)} por 1.000 mensagens
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label className="text-foreground">Temperatura (Criatividade)</Label>
          <span className="text-sm text-primary font-medium">{(data.temperature ?? 0.3).toFixed(1)}</span>
        </div>
        <Slider
          value={[Number(data.temperature ?? 0.3)]}
          min={0}
          max={1}
          step={0.1}
          onValueChange={([v]) => onChange({ temperature: v })}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Preciso</span>
          <span>Equilibrado</span>
          <span>Criativo</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">Máximo de Tokens</Label>
        <Input
          type="number"
          min={100}
          max={8000}
          value={data.max_tokens ?? 1000}
          onChange={(e) => onChange({ max_tokens: parseInt(e.target.value) || 1000 })}
        />
        <p className="text-xs text-muted-foreground">Máximo de tokens por resposta (maior = mais caro)</p>
      </div>

      {/* Fallback Models (Onda 6B) —
          quando o modelo principal falha (erro, timeout, rate limit), o sistema
          tenta cada fallback em ordem antes de cair no DEFAULT_FALLBACK_CHAIN global.
          Campo opcional — se vazio, usa só o chain default. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Modelos de Fallback</Label>
          <Badge variant="outline" className="text-xs">Opcional</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Se o modelo principal falhar (erro, timeout, rate limit), o sistema tenta estes em ordem.
          Deixe vazio para usar apenas a cadeia padrão do sistema.
        </p>
        <FallbackModelsPicker
          value={(data.fallback_models as string[] | null) ?? []}
          onChange={(models) => onChange({ fallback_models: models } as Partial<AgentInsert>)}
          availableModels={filterAgentModels(allModels)}
          primaryModel={effectiveModel}
        />
      </div>
    </div>
  )
}

// ============================================================================
// FallbackModelsPicker — multi-select compacto que permite até 3 fallbacks
// ordenados. Filtra o modelo primário (evita duplicata). Ordem importa: o
// primeiro da lista é tentado antes do segundo, etc.
// ============================================================================
function FallbackModelsPicker({
  value,
  onChange,
  availableModels,
  primaryModel,
}: {
  value: string[]
  onChange: (models: string[]) => void
  availableModels: ModelCatalogEntry[]
  primaryModel: string
}) {
  const MAX_FALLBACKS = 3
  const [open, setOpen] = useState(false)

  const selectableModels = availableModels.filter(
    (m) => m.model_id !== primaryModel && !value.includes(m.model_id)
  )

  const addModel = (modelId: string) => {
    if (value.length >= MAX_FALLBACKS) return
    onChange([...value, modelId])
    setOpen(false)
  }

  const removeModel = (modelId: string) => {
    onChange(value.filter((m) => m !== modelId))
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...value]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  const moveDown = (index: number) => {
    if (index === value.length - 1) return
    const next = [...value]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  const getModelInfo = (modelId: string) =>
    availableModels.find((m) => m.model_id === modelId)

  return (
    <div className="space-y-2">
      {/* Lista ordenada de fallbacks selecionados */}
      {value.length > 0 ? (
        <div className="space-y-1.5">
          {value.map((modelId, index) => {
            const info = getModelInfo(modelId)
            const tierInfo = info ? TIER_CONFIG[info.tier as ModelTier] : null
            return (
              <div
                key={modelId}
                className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
              >
                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {info?.display_name || modelId}
                  </div>
                  {info && (
                    <div className="text-xs text-muted-foreground truncate">
                      {formatModelCost(info.input_cost_per_1m)}
                    </div>
                  )}
                </div>
                {tierInfo && (
                  <Badge
                    variant="outline"
                    className={`text-xs px-1 py-0 shrink-0 ${tierInfo.badgeClass}`}
                  >
                    {tierInfo.label}
                  </Badge>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={index === 0}
                    onClick={() => moveUp(index)}
                    aria-label="Mover para cima"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={index === value.length - 1}
                    onClick={() => moveDown(index)}
                    aria-label="Mover para baixo"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeModel(modelId)}
                    aria-label="Remover"
                  >
                    ×
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Nenhum fallback configurado — o sistema usará a cadeia padrão global.
        </p>
      )}

      {/* Botão de adicionar — só aparece se ainda houver slots */}
      {value.length < MAX_FALLBACKS && selectableModels.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <ChevronsUpDown className="w-3 h-3" />
              Adicionar fallback ({value.length}/{MAX_FALLBACKS})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar modelo..." />
              <CommandList>
                <CommandEmpty>Nenhum modelo encontrado</CommandEmpty>
                <CommandGroup>
                  {selectableModels.map((model) => (
                    <CommandItem
                      key={model.model_id}
                      value={model.model_id}
                      onSelect={() => addModel(model.model_id)}
                    >
                      <ModelOption model={model} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
