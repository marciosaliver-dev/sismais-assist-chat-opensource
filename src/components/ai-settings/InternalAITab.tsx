import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Save, Bot, Brain, Mic, Image, MessageSquare, Route, Search,
  Volume2, Sparkles, Settings2, FileText, Thermometer, Hash, Globe
} from 'lucide-react'
import { usePlatformAIConfigs, useUpdatePlatformAIConfig, type AIFeature } from '@/hooks/usePlatformAIConfig'
import { useModelCatalog, type ModelCatalogEntry } from '@/hooks/useModelCatalog'
import { ModelCombobox } from '@/components/ai-settings/ModelCombobox'
import { cn } from '@/lib/utils'

// ─── Feature definitions ─────────────────────────────────────────────

interface FeatureDef {
  key: AIFeature
  label: string
  description: string
  icon: React.ElementType
  color: string
  defaultPrompt: string
  hasPrompt: boolean
  hasTemperature: boolean
  hasMaxTokens: boolean
  hasLanguage: boolean
  extraFields?: { key: string; label: string; type: 'number' | 'text' | 'boolean'; description?: string }[]
}

const INTERNAL_FEATURES: FeatureDef[] = [
  {
    key: 'orchestrator',
    label: 'Orquestrador',
    description: 'Analisa mensagens recebidas e roteia para o agente IA mais adequado com base no conteúdo, intenção e contexto da conversa.',
    icon: Route,
    color: 'text-blue-500',
    defaultPrompt: 'Você é um orquestrador inteligente. Analise a mensagem do cliente e determine qual agente especializado deve atendê-lo. Considere o histórico da conversa, intenção detectada e urgência.',
    hasPrompt: true,
    hasTemperature: true,
    hasMaxTokens: false,
    hasLanguage: false,
  },
  {
    key: 'message_analyzer',
    label: 'Analisador de Mensagens',
    description: 'Extrai sentimento, intenção, urgência e entidades de cada mensagem recebida para enriquecer o contexto do atendimento.',
    icon: Search,
    color: 'text-violet-500',
    defaultPrompt: 'Analise a mensagem do cliente e extraia: sentimento (positivo/neutro/negativo), intenção principal, urgência (baixa/média/alta) e entidades relevantes (nomes, números, datas).',
    hasPrompt: true,
    hasTemperature: true,
    hasMaxTokens: true,
    hasLanguage: false,
  },
  {
    key: 'agent_executor',
    label: 'Executor de Agentes',
    description: 'Motor principal que executa os agentes IA, gerenciando RAG, ferramentas (tools) e geração de respostas.',
    icon: Brain,
    color: 'text-emerald-500',
    defaultPrompt: '',
    hasPrompt: false,
    hasTemperature: false,
    hasMaxTokens: true,
    hasLanguage: true,
    extraFields: [
      { key: 'max_suggestions', label: 'Máx. sugestões RAG', type: 'number', description: 'Quantidade de documentos retornados pela busca semântica' },
    ],
  },
  {
    key: 'copilot',
    label: 'Copiloto',
    description: 'Oferece sugestões de resposta em tempo real para agentes humanos durante o atendimento.',
    icon: Sparkles,
    color: 'text-amber-500',
    defaultPrompt: 'Você é um assistente copiloto para agentes de suporte. Analise a conversa e sugira respostas precisas e empáticas. Use a base de conhecimento disponível para fundamentar suas sugestões.',
    hasPrompt: true,
    hasTemperature: false,
    hasMaxTokens: true,
    hasLanguage: true,
    extraFields: [
      { key: 'max_suggestions', label: 'Máx. sugestões', type: 'number', description: 'Quantidade de sugestões exibidas ao agente' },
    ],
  },
  {
    key: 'summarization',
    label: 'Resumo de Conversas',
    description: 'Gera resumos automáticos das conversas para histórico e contexto rápido.',
    icon: FileText,
    color: 'text-cyan-500',
    defaultPrompt: 'Resuma a conversa de atendimento de forma concisa, destacando: problema reportado, ações tomadas, resolução (se houver) e próximos passos pendentes.',
    hasPrompt: true,
    hasTemperature: false,
    hasMaxTokens: true,
    hasLanguage: false,
  },
  {
    key: 'audio_transcription',
    label: 'Transcrição de Áudio',
    description: 'Transcreve mensagens de áudio recebidas via WhatsApp em texto.',
    icon: Mic,
    color: 'text-rose-500',
    defaultPrompt: 'Transcreva o áudio com precisão. Mantenha a pontuação e formatação adequadas. Se houver ruído ou partes inaudíveis, indique com [inaudível].',
    hasPrompt: true,
    hasTemperature: false,
    hasMaxTokens: true,
    hasLanguage: true,
  },
  {
    key: 'image_transcription',
    label: 'Transcrição de Imagem',
    description: 'Analisa e descreve imagens recebidas, incluindo OCR de textos em prints e fotos.',
    icon: Image,
    color: 'text-pink-500',
    defaultPrompt: 'Descreva o conteúdo da imagem de forma detalhada. Se houver texto visível (prints, documentos, telas), transcreva-o. Identifique elementos relevantes para o contexto de atendimento.',
    hasPrompt: true,
    hasTemperature: false,
    hasMaxTokens: true,
    hasLanguage: true,
  },
  {
    key: 'embedding',
    label: 'Embeddings',
    description: 'Gera vetores semânticos para a base de conhecimento (RAG).',
    icon: Hash,
    color: 'text-indigo-500',
    defaultPrompt: '',
    hasPrompt: false,
    hasTemperature: true,
    hasMaxTokens: false,
    hasLanguage: false,
  },
  {
    key: 'tts',
    label: 'Texto para Fala',
    description: 'Converte respostas de texto em áudio para envio via WhatsApp.',
    icon: Volume2,
    color: 'text-teal-500',
    defaultPrompt: '',
    hasPrompt: false,
    hasTemperature: true,
    hasMaxTokens: true,
    hasLanguage: false,
    extraFields: [
      { key: 'speed', label: 'Velocidade', type: 'number', description: 'Velocidade da fala (0.5 a 2.0)' },
    ],
  },
]

// ─── Feature Config Card ──────────────────────────────────────────────

interface FeatureState {
  model: string
  enabled: boolean
  system_prompt: string
  temperature: number
  max_tokens: number
  language: string
  [key: string]: unknown
}

function FeatureConfigPanel({
  feat,
  state,
  models,
  onChange,
  onSave,
  isDirty,
  isSaving,
}: {
  feat: FeatureDef
  state: FeatureState
  models: ModelCatalogEntry[]
  onChange: (field: string, value: unknown) => void
  onSave: () => void
  isDirty: boolean
  isSaving: boolean
}) {
  const Icon = feat.icon

  return (
    <AccordionItem value={feat.key} className="border rounded-lg px-0 overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors [&[data-state=open]]:bg-muted/30">
        <div className="flex items-center gap-3 flex-1">
          <div className={cn('p-2 rounded-lg bg-muted', feat.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{feat.label}</span>
              <Badge variant={state.enabled ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
                {state.enabled ? 'Ativo' : 'Inativo'}
              </Badge>
              {isDirty && <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-400">Não salvo</Badge>}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">{feat.description}</p>
          </div>
          {state.model && (
            <Badge variant="outline" className="text-xs font-mono hidden md:inline-flex">
              {state.model.split('/').pop()}
            </Badge>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <Tabs defaultValue="model" className="mt-2">
          <TabsList className="h-8">
            <TabsTrigger value="model" className="text-xs gap-1 h-7"><Settings2 className="w-3 h-3" /> Modelo</TabsTrigger>
            {feat.hasPrompt && <TabsTrigger value="prompt" className="text-xs gap-1 h-7"><MessageSquare className="w-3 h-3" /> Prompt</TabsTrigger>}
            <TabsTrigger value="params" className="text-xs gap-1 h-7"><Thermometer className="w-3 h-3" /> Parâmetros</TabsTrigger>
          </TabsList>

          {/* Model Tab */}
          <TabsContent value="model" className="space-y-4 mt-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{state.enabled ? 'Ativo' : 'Desativado'}</span>
                <Switch checked={state.enabled} onCheckedChange={v => onChange('enabled', v)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Modelo de IA</Label>
              <ModelCombobox
                models={models}
                value={state.model}
                onChange={v => onChange('model', v)}
              />
              {state.model && (
                <p className="text-xs text-muted-foreground font-mono">{state.model}</p>
              )}
            </div>
          </TabsContent>

          {/* Prompt Tab */}
          {feat.hasPrompt && (
            <TabsContent value="prompt" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-sm">System Prompt</Label>
                <Textarea
                  rows={6}
                  placeholder={feat.defaultPrompt || 'Insira o prompt do sistema...'}
                  value={state.system_prompt || ''}
                  onChange={e => onChange('system_prompt', e.target.value)}
                  className="text-sm font-mono resize-y min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Instruções que guiam o comportamento desta IA. Deixe vazio para usar o prompt padrão.
                </p>
              </div>
              {feat.defaultPrompt && !state.system_prompt && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Prompt padrão (em uso):</p>
                  <p className="text-xs text-muted-foreground italic">{feat.defaultPrompt}</p>
                </div>
              )}
            </TabsContent>
          )}

          {/* Parameters Tab */}
          <TabsContent value="params" className="space-y-4 mt-3">
            {feat.hasTemperature && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Temperatura</Label>
                  <span className="text-xs font-mono text-muted-foreground">{(state.temperature ?? 0.4).toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.temperature ?? 0.4]}
                  onValueChange={([v]) => onChange('temperature', v)}
                  min={0}
                  max={2}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Menor = mais determinístico, maior = mais criativo.
                </p>
              </div>
            )}

            {feat.hasMaxTokens && (
              <div className="space-y-1.5">
                <Label className="text-sm">Max Tokens</Label>
                <Input
                  type="number"
                  min={100}
                  max={32000}
                  step={100}
                  value={state.max_tokens ?? 1000}
                  onChange={e => onChange('max_tokens', parseInt(e.target.value) || 1000)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Limite máximo de tokens na resposta.</p>
              </div>
            )}

            {feat.hasLanguage && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-sm">Idioma</Label>
                </div>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={state.language || 'pt-BR'}
                  onChange={e => onChange('language', e.target.value)}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            )}

            {feat.extraFields?.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-sm">{field.label}</Label>
                {field.type === 'number' ? (
                  <Input
                    type="number"
                    value={(state[field.key] as number) ?? ''}
                    onChange={e => onChange(field.key, parseFloat(e.target.value) || 0)}
                    className="w-full"
                  />
                ) : field.type === 'boolean' ? (
                  <Switch
                    checked={!!state[field.key]}
                    onCheckedChange={v => onChange(field.key, v)}
                  />
                ) : (
                  <Input
                    value={(state[field.key] as string) ?? ''}
                    onChange={e => onChange(field.key, e.target.value)}
                    className="w-full"
                  />
                )}
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!isDirty || isSaving}
            onClick={onSave}
            className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar Configuração
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

// ─── Main Component ───────────────────────────────────────────────────

export function InternalAITab() {
  const { data: configs, isLoading: loadingConfigs } = usePlatformAIConfigs()
  const { data: models = [], isLoading: loadingModels } = useModelCatalog({ activeOnly: true })
  const updateConfig = useUpdatePlatformAIConfig()

  const [localState, setLocalState] = useState<Record<string, FeatureState>>({})

  useEffect(() => {
    if (configs) {
      const state: Record<string, FeatureState> = {}
      configs.forEach(c => {
        const extra = (c.extra_config || {}) as Record<string, unknown>
        state[c.feature] = {
          model: c.model,
          enabled: c.enabled,
          system_prompt: (extra.system_prompt as string) || '',
          temperature: (extra.temperature as number) ?? 0.4,
          max_tokens: (extra.max_tokens as number) ?? 1000,
          language: (extra.language as string) || 'pt-BR',
          ...extra,
        }
      })
      setLocalState(state)
    }
  }, [configs])

  const handleChange = (feature: string, field: string, value: unknown) => {
    setLocalState(prev => ({
      ...prev,
      [feature]: {
        ...(prev[feature] || { model: '', enabled: true, system_prompt: '', temperature: 0.4, max_tokens: 1000, language: 'pt-BR' }),
        [field]: value,
      },
    }))
  }

  const handleSave = (feature: AIFeature) => {
    const s = localState[feature]
    if (!s) return

    const { model, enabled, system_prompt, temperature, max_tokens, language, ...rest } = s
    const extra_config: Record<string, unknown> = { ...rest }
    if (system_prompt) extra_config.system_prompt = system_prompt
    if (temperature !== undefined) extra_config.temperature = temperature
    if (max_tokens !== undefined) extra_config.max_tokens = max_tokens
    if (language) extra_config.language = language

    updateConfig.mutate({ feature, model, enabled, extra_config })
  }

  const isDirty = (feature: string): boolean => {
    const s = localState[feature]
    const original = configs?.find(c => c.feature === feature)
    if (!original || !s) return !!s
    const origExtra = (original.extra_config || {}) as Record<string, unknown>
    return (
      s.model !== original.model ||
      s.enabled !== original.enabled ||
      (s.system_prompt || '') !== (origExtra.system_prompt || '') ||
      s.temperature !== (origExtra.temperature ?? 0.4) ||
      s.max_tokens !== (origExtra.max_tokens ?? 1000) ||
      (s.language || 'pt-BR') !== (origExtra.language || 'pt-BR')
    )
  }

  if (loadingConfigs || loadingModels) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    )
  }

  const activeCount = INTERNAL_FEATURES.filter(f => localState[f.key]?.enabled).length

  return (
    <div className="space-y-4">
      {/* GMS-style info banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#10293F]/5 dark:bg-[#10293F]/30 border border-[#10293F]/10 dark:border-[#45E5E5]/20">
        <Settings2 className="w-5 h-5 text-[#10293F] dark:text-[#45E5E5] shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">Motor Interno do Sistema</p>
          <p className="text-xs text-muted-foreground">
            Estas IAs controlam o motor interno — orquestração, análise, embeddings, TTS. Não são agentes de atendimento.
          </p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {activeCount}/{INTERNAL_FEATURES.length} ativas
        </Badge>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {INTERNAL_FEATURES.map(feat => {
          const state = localState[feat.key] || {
            model: '', enabled: true, system_prompt: '', temperature: 0.4, max_tokens: 1000, language: 'pt-BR',
          }

          return (
            <FeatureConfigPanel
              key={feat.key}
              feat={feat}
              state={state}
              models={models}
              onChange={(field, value) => handleChange(feat.key, field, value)}
              onSave={() => handleSave(feat.key)}
              isDirty={isDirty(feat.key)}
              isSaving={updateConfig.isPending}
            />
          )
        })}
      </Accordion>
    </div>
  )
}
