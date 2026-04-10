import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface KnowledgeGroup {
  id: string
  product_id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KnowledgeGroupInsert {
  product_id: string
  name: string
  description?: string | null
  icon?: string | null
  sort_order?: number
  is_active?: boolean
}

export function useKnowledgeGroups(productId?: string | null) {
  const queryClient = useQueryClient()

  const { data: groups, isLoading } = useQuery({
    queryKey: ['knowledge-groups', productId],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_groups' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (productId) {
        query = query.eq('product_id', productId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as unknown as KnowledgeGroup[]
    },
    enabled: productId !== undefined,
  })

  const createGroup = useMutation({
    mutationFn: async (group: KnowledgeGroupInsert) => {
      const { data, error } = await supabase
        .from('knowledge_groups' as any)
        .insert(group as any)
        .select()
        .single()

      if (error) throw error
      return data as unknown as KnowledgeGroup
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] })
    },
  })

  const updateGroup = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<KnowledgeGroupInsert> }) => {
      const { data, error } = await supabase
        .from('knowledge_groups' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as unknown as KnowledgeGroup
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] })
    },
  })

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_groups' as any)
        .update({ is_active: false } as any)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-groups'] })
    },
  })

  return { groups, isLoading, createGroup, updateGroup, deleteGroup }
}
