import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface PublicKnowledgeItem {
  id: string
  title: string
  description: string | null
  content: string
  content_type: string
  category: string
  tags: string[] | null
  original_url: string | null
  media_url: string | null
  thumbnail_url: string | null
  video_url: string | null
  difficulty_level: string | null
  duration_seconds: number | null
  product_id: string | null
  group_id: string | null
  source_type: string | null
  metadata: Record<string, unknown> | null
  helpful_count: number
  not_helpful_count: number
  usage_count: number
  sort_order: number
  created_at: string
  updated_at: string
}

interface UsePublicKnowledgeOptions {
  productId?: string | null
  groupId?: string | null
  contentType?: string | null
  category?: string | null
  search?: string
  limit?: number
}

export function usePublicKnowledge(options: UsePublicKnowledgeOptions = {}) {
  const { productId, groupId, contentType, category, search, limit } = options

  const { data: items, isLoading } = useQuery({
    queryKey: ['public-knowledge', productId, groupId, contentType, category, search, limit],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_knowledge_base')
        .select('id, title, description, content, content_type, category, tags, original_url, media_url, thumbnail_url, video_url, difficulty_level, duration_seconds, product_id, group_id, source_type, metadata, helpful_count, not_helpful_count, usage_count, sort_order, created_at, updated_at')
        .eq('is_public', true)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (productId) query = query.eq('product_id', productId)
      if (groupId) query = query.eq('group_id', groupId)
      if (contentType) query = query.eq('content_type', contentType)
      if (category) query = query.eq('category', category)
      if (search && search.trim().length >= 2) {
        query = query.ilike('title', `%${search.trim()}%`)
      }
      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as PublicKnowledgeItem[]
    },
  })

  return { items: items ?? [], isLoading }
}

export function usePublicKnowledgeItem(id: string | undefined) {
  const { data: item, isLoading } = useQuery({
    queryKey: ['public-knowledge-item', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('id, title, description, content, content_type, category, tags, original_url, media_url, thumbnail_url, video_url, difficulty_level, duration_seconds, product_id, group_id, source_type, metadata, helpful_count, not_helpful_count, usage_count, sort_order, created_at, updated_at')
        .eq('id', id)
        .eq('is_public', true)
        .eq('is_active', true)
        .single()

      if (error) throw error
      return data as PublicKnowledgeItem
    },
    enabled: !!id,
  })

  return { item, isLoading }
}

export function usePublicKnowledgeCategories() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['public-knowledge-categories'],
    queryFn: async () => {
      // Get products that have public content
      const { data: productData, error: productError } = await supabase
        .from('knowledge_products')
        .select('id, name, description, color, icon, slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (productError) throw productError

      // Count public items per product
      const { data: countData } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('product_id')
        .eq('is_public', true)
        .eq('is_active', true)

      const counts: Record<string, number> = {}
      for (const item of countData ?? []) {
        if (item.product_id) {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1
        }
      }

      return (productData ?? []).map(p => ({
        ...p,
        contentCount: counts[p.id] || 0,
      })).filter(p => p.contentCount > 0)
    },
  })

  return { products: products ?? [], isLoading }
}
