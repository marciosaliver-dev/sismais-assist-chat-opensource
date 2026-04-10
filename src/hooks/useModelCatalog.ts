import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────

export type ModelTier = 'nano' | 'economic' | 'standard' | 'premium' | 'enterprise'

export interface ModelCatalogEntry {
  id: string
  model_id: string
  display_name: string
  provider: string
  tier: ModelTier
  description: string | null
  input_cost_per_1m: number
  output_cost_per_1m: number
  max_context_window: number
  max_output_tokens: number
  input_modalities: string[]
  output_modalities: string[]
  capabilities: string[]
  recommended_for: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type ModelCatalogInsert = Omit<ModelCatalogEntry, 'id' | 'created_at' | 'updated_at'>
export type ModelCatalogUpdate = Partial<ModelCatalogInsert>

export interface ModelsByTier {
  nano: ModelCatalogEntry[]
  economic: ModelCatalogEntry[]
  standard: ModelCatalogEntry[]
  premium: ModelCatalogEntry[]
  enterprise: ModelCatalogEntry[]
}

// ─── Tier metadata ───────────────────────────────────────────────────

export const TIER_CONFIG: Record<ModelTier, { label: string; color: string; badgeClass: string }> = {
  nano: { label: 'Nano', color: '#6b7280', badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  economic: { label: 'Econômico', color: '#22c55e', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  standard: { label: 'Padrão', color: '#3b82f6', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  premium: { label: 'Premium', color: '#a855f7', badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  enterprise: { label: 'Enterprise', color: '#f59e0b', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useModelCatalog(filters?: {
  tier?: ModelTier
  provider?: string
  capability?: string
  recommendedFor?: string
  activeOnly?: boolean
}) {
  return useQuery({
    queryKey: ['model-catalog', filters],
    queryFn: async () => {
      let query = (supabase as any).from('ai_model_catalog')
        .select('*')
        .order('sort_order', { ascending: true })

      if (filters?.activeOnly !== false) {
        query = query.eq('is_active', true)
      }
      if (filters?.tier) {
        query = query.eq('tier', filters.tier)
      }
      if (filters?.provider) {
        query = query.eq('provider', filters.provider)
      }
      if (filters?.capability) {
        query = query.contains('capabilities', [filters.capability])
      }
      if (filters?.recommendedFor) {
        query = query.contains('recommended_for', [filters.recommendedFor])
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as ModelCatalogEntry[]
    },
  })
}

export function useModelsByTier() {
  const { data: models, ...rest } = useModelCatalog({ activeOnly: true })

  const grouped: ModelsByTier = {
    nano: [],
    economic: [],
    standard: [],
    premium: [],
    enterprise: [],
  }

  if (models) {
    for (const m of models) {
      const tier = m.tier as ModelTier
      if (grouped[tier]) {
        grouped[tier].push(m)
      }
    }
  }

  return { data: grouped, models, ...rest }
}

export function useModelsByRecommendation(specialty: string) {
  const { data: allModels } = useModelCatalog({ activeOnly: true })

  if (!allModels || !specialty) return { recommended: [], others: [] }

  const recommended = allModels.filter(m => m.recommended_for.includes(specialty))
  const others = allModels.filter(m => !m.recommended_for.includes(specialty))

  return { recommended, others }
}

export function useModelPricing(modelId: string | undefined) {
  const { data: models } = useModelCatalog({ activeOnly: false })

  if (!models || !modelId) return null

  return models.find(m => m.model_id === modelId) || null
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateModel() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (model: ModelCatalogInsert) => {
      const { data, error } = await (supabase as any).from('ai_model_catalog')
        .insert(model)
        .select()
        .single()
      if (error) throw error
      return data as ModelCatalogEntry
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['model-catalog'] })
      toast.success('Modelo adicionado ao catálogo')
    },
    onError: (e: Error) => toast.error(`Erro ao adicionar modelo: ${e.message}`),
  })
}

export function useUpdateModel() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & ModelCatalogUpdate) => {
      const { data, error } = await (supabase as any).from('ai_model_catalog')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ModelCatalogEntry
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['model-catalog'] })
      toast.success('Modelo atualizado')
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  })
}

export function useDeleteModel() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('ai_model_catalog')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['model-catalog'] })
      toast.success('Modelo removido do catálogo')
    },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  })
}

export function useToggleModelActive() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from('ai_model_catalog')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['model-catalog'] })
    },
  })
}

export function useSyncOpenRouterModels() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (options?: { provider?: string; only_update_pricing?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('sync-openrouter-models', {
        body: options || {},
      })
      if (error) throw error
      return data as { success: boolean; total_from_openrouter: number; created: number; updated: number; skipped: number }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['model-catalog'] })
      toast.success(`Sincronizado: ${data.created} novos, ${data.updated} atualizados`)
    },
    onError: (e: Error) => toast.error(`Erro na sincronização: ${e.message}`),
  })
}

// ─── Utilities ───────────────────────────────────────────────────────

export function estimateCostPer1kMessages(model: ModelCatalogEntry, avgInputTokens = 500, avgOutputTokens = 300): number {
  const inputCost = (avgInputTokens * model.input_cost_per_1m) / 1_000_000
  const outputCost = (avgOutputTokens * model.output_cost_per_1m) / 1_000_000
  return (inputCost + outputCost) * 1000
}

export function formatModelCost(costPer1M: number): string {
  if (costPer1M === 0) return 'Grátis'
  if (costPer1M < 0.01) return `$${costPer1M.toFixed(4)}/1M`
  if (costPer1M < 1) return `$${costPer1M.toFixed(2)}/1M`
  return `$${costPer1M.toFixed(2)}/1M`
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return `${tokens}`
}

export function useOpenRouterCredits() {
  return useQuery({
    queryKey: ['openrouter-credits'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('openrouter-credits')
      if (error) throw error
      return data?.data as {
        label?: string
        usage?: number
        limit?: number | null
        limit_remaining?: number | null
        is_free_tier?: boolean
        rate_limit?: { requests: number; interval: string }
        usage_daily?: number
        usage_weekly?: number
        usage_monthly?: number
        // Account-level credits
        total_credits?: number | null
        total_usage?: number | null
        balance?: number | null
      } | null
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useConsumptionHistory(days = 30) {
  return useQuery({
    queryKey: ['consumption-history', days],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data, error } = await (supabase as any)
        .from('ai_messages')
        .select('model_used, cost_usd, prompt_tokens, completion_tokens, created_at')
        .gte('created_at', since.toISOString())
        .not('cost_usd', 'is', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as {
        model_used: string | null
        cost_usd: number | null
        prompt_tokens: number | null
        completion_tokens: number | null
        created_at: string
      }[]
    },
  })
}

export const SPECIALTY_LABELS: Record<string, { label: string; color: string }> = {
  triage: { label: 'Triagem', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  support: { label: 'Suporte', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  copilot: { label: 'Copiloto', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  analytics: { label: 'Analytics', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  sales: { label: 'Vendas', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300' },
  financial: { label: 'Financeiro', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  sdr: { label: 'SDR', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
}
