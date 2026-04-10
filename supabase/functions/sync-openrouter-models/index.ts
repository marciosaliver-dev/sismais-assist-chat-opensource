import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing?: {
    prompt?: string | number
    completion?: string | number
  }
  context_length?: number
  top_provider?: {
    max_completion_tokens?: number
  }
  architecture?: {
    input_modalities?: string[]
    output_modalities?: string[]
  }
  supported_parameters?: string[]
}

// ─── Portuguese description templates ────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google', openai: 'OpenAI', anthropic: 'Anthropic', meta: 'Meta',
  mistralai: 'Mistral AI', cohere: 'Cohere', deepseek: 'DeepSeek',
  microsoft: 'Microsoft', amazon: 'Amazon', 'x-ai': 'xAI', perplexity: 'Perplexity',
  qwen: 'Alibaba Qwen', nvidia: 'NVIDIA',
}

const MODEL_DESCRIPTIONS_PT: Record<string, string> = {
  // Google
  'google/gemini-2.5-flash': 'Modelo rápido e eficiente do Google com raciocínio avançado e suporte a imagens. Excelente custo-benefício.',
  'google/gemini-2.5-pro': 'Modelo premium do Google com raciocínio profundo, visão e chamada de funções. Ideal para tarefas complexas.',
  'google/gemini-2.0-flash': 'Modelo ultra-rápido do Google com suporte a imagens e funções. Ótimo para triagem e respostas rápidas.',
  'google/gemini-2.0-flash-lite': 'Versão leve e econômica do Gemini Flash. Ideal para alto volume com baixo custo.',
  'google/gemini-pro': 'Modelo versátil do Google para geração de texto e análise.',
  // OpenAI
  'openai/gpt-4o': 'Modelo multimodal avançado da OpenAI com visão, áudio e chamada de funções.',
  'openai/gpt-4o-mini': 'Versão compacta e econômica do GPT-4o. Rápido e eficiente para tarefas cotidianas.',
  'openai/gpt-4-turbo': 'GPT-4 otimizado para velocidade com contexto de 128K tokens.',
  'openai/gpt-4.1': 'Modelo mais recente da OpenAI com melhorias em codificação e raciocínio.',
  'openai/gpt-4.1-mini': 'Versão compacta do GPT-4.1 com ótimo custo-benefício.',
  'openai/gpt-4.1-nano': 'Modelo ultra-econômico da OpenAI para tarefas simples e alto volume.',
  'openai/o1': 'Modelo de raciocínio avançado da OpenAI para problemas complexos.',
  'openai/o1-mini': 'Modelo de raciocínio compacto da OpenAI. Bom equilíbrio entre capacidade e custo.',
  'openai/o3': 'Modelo de raciocínio de última geração da OpenAI.',
  'openai/o3-mini': 'Versão compacta do o3 com raciocínio eficiente.',
  'openai/o4-mini': 'Modelo de raciocínio compacto e econômico da OpenAI.',
  // Anthropic
  'anthropic/claude-sonnet-4': 'Modelo equilibrado da Anthropic com raciocínio e segurança avançados.',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet — modelo versátil com excelente desempenho em código e análise.',
  'anthropic/claude-3.5-haiku': 'Modelo rápido e econômico da Anthropic. Ideal para atendimento em tempo real.',
  'anthropic/claude-3-opus': 'Modelo premium da Anthropic com capacidade máxima de raciocínio.',
  'anthropic/claude-3-haiku': 'Modelo ultra-rápido da Anthropic para respostas instantâneas.',
  // DeepSeek
  'deepseek/deepseek-chat': 'Modelo de conversação do DeepSeek com bom desempenho em português.',
  'deepseek/deepseek-r1': 'Modelo de raciocínio do DeepSeek com cadeia de pensamento transparente.',
  // Meta
  'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B — modelo open-source da Meta com excelente capacidade multilíngue.',
  'meta-llama/llama-4-maverick': 'Llama 4 Maverick — modelo avançado da Meta com arquitetura MoE.',
  'meta-llama/llama-4-scout': 'Llama 4 Scout — modelo eficiente da Meta com grande janela de contexto.',
  // Mistral
  'mistralai/mistral-large': 'Modelo premium da Mistral AI com forte capacidade em múltiplos idiomas.',
  'mistralai/mistral-small': 'Modelo compacto da Mistral AI, eficiente e rápido.',
  // xAI
  'x-ai/grok-3': 'Modelo avançado da xAI com amplo contexto e raciocínio.',
  'x-ai/grok-3-mini': 'Versão compacta do Grok 3 com raciocínio eficiente.',
  'x-ai/grok-2': 'Modelo multimodal da xAI com suporte a imagens.',
}

function generateDescriptionPt(model: OpenRouterModel, provider: string, capabilities: string[], tier: string, contextWindow: number): string {
  // Check exact match first
  if (MODEL_DESCRIPTIONS_PT[model.id]) return MODEL_DESCRIPTIONS_PT[model.id]

  // Check partial matches
  for (const [key, desc] of Object.entries(MODEL_DESCRIPTIONS_PT)) {
    if (model.id.startsWith(key)) return desc
  }

  // Auto-generate
  const providerName = PROVIDER_NAMES[provider] || provider
  const parts: string[] = []

  // Base
  if (capabilities.includes('reasoning')) {
    parts.push(`Modelo de raciocínio avançado de ${providerName}`)
  } else {
    parts.push(`Modelo de texto de ${providerName}`)
  }

  // Capabilities
  const caps: string[] = []
  if (capabilities.includes('vision')) caps.push('visão')
  if (capabilities.includes('function_calling')) caps.push('chamada de funções')
  if (capabilities.includes('audio')) caps.push('áudio')
  if (caps.length > 0) parts.push(`com suporte a ${caps.join(', ')}`)

  // Context
  const ctxStr = contextWindow >= 1_000_000 ? `${(contextWindow / 1_000_000).toFixed(0)}M` : `${Math.round(contextWindow / 1000)}K`
  parts.push(`Contexto de ${ctxStr} tokens.`)

  return parts.join('. ').replace(/\.\./g, '.')
}

// ─── Tier & capability inference ─────────────────────────────────────

function inferTier(inputCostPer1M: number): string {
  if (inputCostPer1M < 0.10) return 'nano'
  if (inputCostPer1M < 0.30) return 'economic'
  if (inputCostPer1M < 1.00) return 'standard'
  if (inputCostPer1M < 5.00) return 'premium'
  return 'enterprise'
}

function inferCapabilities(model: OpenRouterModel): string[] {
  const caps: string[] = ['text']
  const inputMods = model.architecture?.input_modalities || []
  const outputMods = model.architecture?.output_modalities || []
  const params = model.supported_parameters || []

  if (inputMods.includes('image')) caps.push('vision')
  if (inputMods.includes('audio')) caps.push('audio')
  if (outputMods.includes('audio')) caps.push('tts')
  if (outputMods.includes('embeddings')) caps.push('embedding')
  if (params.includes('tools')) caps.push('function_calling')
  if (params.includes('reasoning')) caps.push('reasoning')

  return [...new Set(caps)]
}

function inferRecommendedFor(capabilities: string[], inputCostPer1M: number, contextWindow: number): string[] {
  const rec: string[] = []
  const hasFunctionCalling = capabilities.includes('function_calling')
  const hasVision = capabilities.includes('vision')
  const hasReasoning = capabilities.includes('reasoning')
  const isLowCost = inputCostPer1M < 1.0
  const isMediumCost = inputCostPer1M >= 1.0 && inputCostPer1M < 5.0
  const isHighCost = inputCostPer1M >= 5.0
  const hasLargeContext = contextWindow >= 128000

  if (hasFunctionCalling && isLowCost) rec.push('triage')
  if (hasFunctionCalling && hasVision) rec.push('support')
  if (hasReasoning) { rec.push('copilot'); rec.push('analytics') }
  if ((isHighCost || isMediumCost) && hasLargeContext && hasFunctionCalling) {
    rec.push('sales'); rec.push('financial')
  }
  if (isMediumCost && hasFunctionCalling && !hasReasoning) rec.push('sdr')

  return [...new Set(rec)]
}

function extractProvider(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? parts[0] : 'unknown'
}

// ─── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json().catch(() => ({}))
    const filterProvider = body.provider as string | undefined
    const onlyUpdatePricing = body.only_update_pricing === true

    console.log('[sync-openrouter] Fetching models from OpenRouter...')

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (OPENROUTER_API_KEY) headers['Authorization'] = `Bearer ${OPENROUTER_API_KEY}`

    const response = await fetch('https://openrouter.ai/api/v1/models', { headers })
    if (!response.ok) throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`)

    const data = await response.json()
    const models: OpenRouterModel[] = data.data || []
    console.log(`[sync-openrouter] Received ${models.length} models`)

    const { data: existingModels } = await supabase
      .from('ai_model_catalog')
      .select('model_id, tier, recommended_for')

    const existingMap = new Map<string, { tier: string; recommended_for: string[] }>()
    if (existingModels) {
      for (const m of existingModels) {
        existingMap.set(m.model_id, { tier: m.tier, recommended_for: m.recommended_for || [] })
      }
    }

    let created = 0, updated = 0, skipped = 0

    for (const model of models) {
      const promptPrice = Number(model.pricing?.prompt || 0)
      const completionPrice = Number(model.pricing?.completion || 0)

      if (promptPrice <= 0 && completionPrice <= 0) { skipped++; continue }

      const provider = extractProvider(model.id)
      if (filterProvider && provider !== filterProvider) { skipped++; continue }

      const inputCostPer1M = promptPrice * 1_000_000
      const outputCostPer1M = completionPrice * 1_000_000
      const inputModalities = model.architecture?.input_modalities || ['text']
      const outputModalities = model.architecture?.output_modalities || ['text']
      const capabilities = inferCapabilities(model)
      const contextWindow = model.context_length || 128000

      const existing = existingMap.get(model.id)
      const tier = existing ? existing.tier : inferTier(inputCostPer1M)
      const recommendedFor = existing ? existing.recommended_for : inferRecommendedFor(capabilities, inputCostPer1M, contextWindow)

      // Generate Portuguese description
      const descriptionPt = generateDescriptionPt(model, provider, capabilities, tier, contextWindow)

      const upsertData = {
        model_id: model.id,
        display_name: model.name || model.id,
        provider,
        tier,
        description: descriptionPt,
        input_cost_per_1m: inputCostPer1M,
        output_cost_per_1m: outputCostPer1M,
        max_context_window: contextWindow,
        max_output_tokens: model.top_provider?.max_completion_tokens || 4096,
        input_modalities: inputModalities,
        output_modalities: outputModalities,
        capabilities,
        recommended_for: recommendedFor,
        is_active: !!existing,
      }

      if (onlyUpdatePricing && existing) {
        const { error } = await supabase.from('ai_model_catalog')
          .update({
            input_cost_per_1m: inputCostPer1M,
            output_cost_per_1m: outputCostPer1M,
            max_context_window: contextWindow,
            max_output_tokens: model.top_provider?.max_completion_tokens || 4096,
            input_modalities: inputModalities,
            output_modalities: outputModalities,
            capabilities,
            description: descriptionPt,
          })
          .eq('model_id', model.id)
        if (!error) updated++
      } else {
        const { error } = await supabase.from('ai_model_catalog')
          .upsert(upsertData, { onConflict: 'model_id' })
        if (!error) {
          if (existing) updated++
          else created++
        }
      }
    }

    console.log(`[sync-openrouter] Done: ${created} created, ${updated} updated, ${skipped} skipped`)

    return new Response(JSON.stringify({
      success: true,
      total_from_openrouter: models.length,
      created, updated, skipped,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[sync-openrouter] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
