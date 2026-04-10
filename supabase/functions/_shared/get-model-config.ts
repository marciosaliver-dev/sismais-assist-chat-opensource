/**
 * Shared helper to read model configuration from the database.
 * Used by all edge functions instead of hardcoded models.
 *
 * Includes in-memory cache with TTL to avoid repeated DB queries
 * within the same Deno isolate (edge functions reuse isolates).
 */

interface ModelConfig {
  model: string
  temperature: number
  max_tokens: number
}

interface ModelPricing {
  inputCostPer1M: number
  outputCostPer1M: number
}

// ── In-memory cache (persists across requests in same Deno isolate) ──
const CONFIG_CACHE_TTL = 60_000 // 60 seconds
const PRICING_CACHE_TTL = 300_000 // 5 minutes (pricing changes less frequently)

const configCache = new Map<string, { data: ModelConfig; ts: number }>()
const pricingCache = new Map<string, { data: ModelPricing; ts: number }>()

/**
 * Fetches model configuration from platform_ai_config for a given feature.
 * Results are cached in-memory for 60s to avoid repeated DB queries.
 * Falls back to provided defaults if DB is unavailable or feature not found.
 */
export async function getModelConfig(
  supabase: any,
  feature: string,
  fallbackModel: string,
  fallbackTemp = 0.3,
  fallbackMaxTokens = 1000
): Promise<ModelConfig> {
  // Check cache first
  const cached = configCache.get(feature)
  if (cached && Date.now() - cached.ts < CONFIG_CACHE_TTL) {
    return cached.data
  }

  const fallback: ModelConfig = { model: fallbackModel, temperature: fallbackTemp, max_tokens: fallbackMaxTokens }

  try {
    const { data } = await supabase
      .from('platform_ai_config')
      .select('model, enabled, extra_config')
      .eq('feature', feature)
      .eq('enabled', true)
      .maybeSingle()

    if (data) {
      const extra = (data.extra_config as Record<string, any>) || {}
      const result: ModelConfig = {
        model: data.model || fallbackModel,
        temperature: extra.temperature ?? fallbackTemp,
        max_tokens: extra.max_tokens ?? fallbackMaxTokens,
      }
      configCache.set(feature, { data: result, ts: Date.now() })
      return result
    }
  } catch (e) {
    console.warn(`[get-model-config] Failed to fetch config for "${feature}", using fallback`)
  }

  // Cache the fallback too to avoid retrying on every request
  configCache.set(feature, { data: fallback, ts: Date.now() })
  return fallback
}

/**
 * Fetches pricing from ai_model_catalog for a specific model.
 * Results are cached in-memory for 5 minutes.
 * Falls back to generic pricing if model not found in catalog.
 */
export async function getModelPricing(
  supabase: any,
  modelId: string
): Promise<ModelPricing> {
  // Check cache first
  const cached = pricingCache.get(modelId)
  if (cached && Date.now() - cached.ts < PRICING_CACHE_TTL) {
    return cached.data
  }

  const fallback: ModelPricing = { inputCostPer1M: 0.10, outputCostPer1M: 0.40 }

  try {
    const { data } = await supabase
      .from('ai_model_catalog')
      .select('input_cost_per_1m, output_cost_per_1m')
      .eq('model_id', modelId)
      .maybeSingle()

    if (data) {
      const result: ModelPricing = {
        inputCostPer1M: Number(data.input_cost_per_1m),
        outputCostPer1M: Number(data.output_cost_per_1m),
      }
      pricingCache.set(modelId, { data: result, ts: Date.now() })
      return result
    }
  } catch (e) {
    console.warn(`[get-model-config] Failed to fetch pricing for "${modelId}", using fallback`)
  }

  pricingCache.set(modelId, { data: fallback, ts: Date.now() })
  return fallback
}

/**
 * Calculates cost in USD given token counts and pricing.
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  pricing: ModelPricing
): number {
  return (promptTokens * pricing.inputCostPer1M + completionTokens * pricing.outputCostPer1M) / 1_000_000
}
