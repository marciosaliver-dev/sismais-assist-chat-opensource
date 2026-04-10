import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface KnowledgeProduct {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface KnowledgeProductInsert {
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  color?: string | null
  is_active?: boolean
  sort_order?: number
}

export function useKnowledgeProducts() {
  const queryClient = useQueryClient()

  const { data: products, isLoading } = useQuery({
    queryKey: ['knowledge-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_products' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as unknown as KnowledgeProduct[]
    },
  })

  const createProduct = useMutation({
    mutationFn: async (product: KnowledgeProductInsert) => {
      const { data, error } = await supabase
        .from('knowledge_products' as any)
        .insert(product as any)
        .select()
        .single()

      if (error) throw error
      return data as unknown as KnowledgeProduct
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-products'] })
    },
  })

  const updateProduct = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<KnowledgeProductInsert> }) => {
      const { data, error } = await supabase
        .from('knowledge_products' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as unknown as KnowledgeProduct
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-products'] })
    },
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_products' as any)
        .update({ is_active: false } as any)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-products'] })
    },
  })

  return { products, isLoading, createProduct, updateProduct, deleteProduct }
}
