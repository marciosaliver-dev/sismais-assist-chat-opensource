import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'

export type ManualArticle = Tables<'ai_knowledge_base'> & {
  product_name?: string | null
  product_color?: string | null
  product_icon?: string | null
}

interface UseManualArticlesParams {
  productId?: string
  search?: string
  productSlug?: string
}

async function resolveProductId(slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('knowledge_products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data.id
}

export function useManualArticles({ productId, search, productSlug = 'mais-simples' }: UseManualArticlesParams = {}) {
  const { data: resolvedProductId } = useQuery({
    queryKey: ['manual-product-id', productSlug],
    queryFn: () => resolveProductId(productSlug),
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
  })

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['manual-groups', resolvedProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_groups')
        .select('*')
        .eq('product_id', resolvedProductId!)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!resolvedProductId,
  })

  const {
    data: articles,
    isLoading: articlesLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['manual-articles', resolvedProductId, productId, search],
    queryFn: async () => {
      let query = supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('product_id', resolvedProductId!)
        .eq('is_active', true)

      if (productId) {
        query = query.eq('group_id', productId)
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
      }

      query = query.order('title', { ascending: true })

      const { data, error } = await query

      if (error) throw error

      return data as ManualArticle[]
    },
    enabled: !!resolvedProductId,
  })

  // Enrich articles with group info
  const enrichedArticles: ManualArticle[] = (articles ?? []).map((article) => {
    const group = (products ?? []).find((g) => g.id === article.group_id)
    return {
      ...article,
      product_name: group?.name ?? null,
      product_color: null,
      product_icon: null,
    }
  })

  // Groups with article counts, filtering out those with 0 articles
  const productsWithCount = (products ?? [])
    .map((group) => ({
      ...group,
      article_count: (articles ?? []).filter((a) => a.group_id === group.id).length,
      color: null as string | null,
    }))
    .filter((p) => p.article_count > 0)

  return {
    articles: enrichedArticles,
    products: productsWithCount,
    isLoading: articlesLoading || productsLoading,
    error,
    refetch,
  }
}

export function useManualArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['manual-article', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as ManualArticle
    },
    enabled: !!id,
  })
}

export function useManualFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const field = helpful ? 'helpful_count' : 'not_helpful_count'

      const { data: current, error: fetchError } = await supabase
        .from('ai_knowledge_base')
        .select(field)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const currentValue = (current as Record<string, number | null>)[field] ?? 0

      const { error: updateError } = await supabase
        .from('ai_knowledge_base')
        .update({ [field]: currentValue + 1 })
        .eq('id', id)

      if (updateError) throw updateError

      return { id, helpful }
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['manual-article', id] })
    },
  })
}
