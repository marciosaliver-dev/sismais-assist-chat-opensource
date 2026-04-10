import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, CheckCircle2, Brain, Key, ToggleLeft } from 'lucide-react'
import { toast } from 'sonner'

const db = supabase as any

type Provider = 'openai' | 'anthropic' | 'google'

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
]

const MODELS_BY_PROVIDER: Record<Provider, { value: string; label: string; costPer1k: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', costPer1k: '~US$ 0.08' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', costPer1k: '~US$ 0.12' },
  ],
  anthropic: [
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4', costPer1k: '~US$ 0.23' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', costPer1k: '~US$ 0.05' },
  ],
  google: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', costPer1k: '~US$ 0.04' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', costPer1k: '~US$ 0.01' },
  ],
}

const FEATURE_KEYS = {
  model: 'training_model',
  provider: 'training_provider',
  reviewBeforeSend: 'review_before_send',
  premiumPromptGen: 'premium_prompt_generation',
} as const

interface ConfigRow {
  feature: string
  model: string | null
  enabled: boolean
  extra_config: Record<string, unknown> | null
}

export default function TrainingModelTab() {
  const qc = useQueryClient()

  const [provider, setProvider] = useState<Provider>('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-20250514')
  const [apiKey, setApiKey] = useState('')
  const [reviewBeforeSend, setReviewBeforeSend] = useState(false)
  const [premiumPromptGen, setPremiumPromptGen] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  const { data: configs, isLoading } = useQuery({
    queryKey: ['platform-ai-config-training'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_ai_config')
        .select('*')
        .in('feature', [
          FEATURE_KEYS.model,
          FEATURE_KEYS.provider,
          FEATURE_KEYS.reviewBeforeSend,
          FEATURE_KEYS.premiumPromptGen,
          'training_api_key_openai',
          'training_api_key_anthropic',
          'training_api_key_google',
        ])
      if (error) throw error
      return (data || []) as ConfigRow[]
    },
  })

  // Sincronizar estado local com dados carregados
  useEffect(() => {
    if (!configs) return
    const map = new Map(configs.map((c) => [c.feature, c]))

    const providerRow = map.get(FEATURE_KEYS.provider)
    if (providerRow?.model) {
      setProvider(providerRow.model as Provider)
    }

    const modelRow = map.get(FEATURE_KEYS.model)
    if (modelRow?.model) {
      setModel(modelRow.model)
    }

    const reviewRow = map.get(FEATURE_KEYS.reviewBeforeSend)
    if (reviewRow) setReviewBeforeSend(reviewRow.enabled)

    const promptRow = map.get(FEATURE_KEYS.premiumPromptGen)
    if (promptRow) setPremiumPromptGen(promptRow.enabled)
  }, [configs])

  // Verificar se chave da API do provider atual está salva
  useEffect(() => {
    if (!configs) return
    const keyRow = configs.find((c) => c.feature === `training_api_key_${provider}`)
    setKeySaved(!!keyRow?.enabled)
    setApiKey('')
  }, [configs, provider])

  const upsertConfig = useMutation({
    mutationFn: async (row: { feature: string; model?: string; enabled?: boolean; extra_config?: Record<string, unknown> }) => {
      const { error } = await db
        .from('platform_ai_config')
        .upsert(
          {
            feature: row.feature,
            model: row.model ?? null,
            enabled: row.enabled ?? true,
            extra_config: row.extra_config ?? null,
          },
          { onConflict: 'feature' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-ai-config-training'] })
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`)
    },
  })

  const handleSaveModel = async () => {
    await upsertConfig.mutateAsync({ feature: FEATURE_KEYS.provider, model: provider })
    await upsertConfig.mutateAsync({ feature: FEATURE_KEYS.model, model })
    toast.success('Modelo de treinamento salvo com sucesso')
  }

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Informe a chave da API')
      return
    }
    await upsertConfig.mutateAsync({
      feature: `training_api_key_${provider}`,
      model: provider,
      enabled: true,
      extra_config: { key: apiKey.trim() },
    })
    setApiKey('')
    toast.success(`Chave da API ${provider} salva com sucesso`)
  }

  const handleToggle = async (feature: string, value: boolean) => {
    if (feature === FEATURE_KEYS.reviewBeforeSend) setReviewBeforeSend(value)
    if (feature === FEATURE_KEYS.premiumPromptGen) setPremiumPromptGen(value)
    await upsertConfig.mutateAsync({ feature, enabled: value, model })
  }

  const selectedModels = MODELS_BY_PROVIDER[provider]
  const selectedModelInfo = selectedModels.find((m) => m.value === model)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Seleção de Modelo */}
      <Card className="bg-card border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            Modelo Premium para Treinamento / Revisão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={provider}
                onValueChange={(v: Provider) => {
                  setProvider(v)
                  const firstModel = MODELS_BY_PROVIDER[v][0]
                  setModel(firstModel.value)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedModelInfo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Custo estimado por 1K mensagens:
              <Badge variant="secondary">{selectedModelInfo.costPer1k}</Badge>
            </div>
          )}

          <Button
            onClick={handleSaveModel}
            disabled={upsertConfig.isPending}
            size="sm"
          >
            {upsertConfig.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Salvar modelo
          </Button>
        </CardContent>
      </Card>

      {/* Chave da API */}
      <Card className="bg-card border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-primary" />
            Chave da API — {PROVIDERS.find((p) => p.value === provider)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder={keySaved ? '••••••••••••••••' : 'Insira a chave da API'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveApiKey}
              disabled={upsertConfig.isPending || !apiKey.trim()}
              size="sm"
            >
              {upsertConfig.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar chave
            </Button>
            {keySaved && (
              <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Chave salva
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toggles de funcionalidades */}
      <Card className="bg-card border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ToggleLeft className="h-5 w-5 text-primary" />
            Funcionalidades Premium
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Revisar respostas antes de enviar
              </Label>
              <p className="text-xs text-muted-foreground">
                Usar modelo premium para revisar respostas dos agentes IA antes de enviar ao cliente
              </p>
            </div>
            <Switch
              checked={reviewBeforeSend}
              onCheckedChange={(v) => handleToggle(FEATURE_KEYS.reviewBeforeSend, v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Gerar prompts com modelo premium
              </Label>
              <p className="text-xs text-muted-foreground">
                Usar modelo premium para gerar e otimizar prompts de sistema dos agentes IA
              </p>
            </div>
            <Switch
              checked={premiumPromptGen}
              onCheckedChange={(v) => handleToggle(FEATURE_KEYS.premiumPromptGen, v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
