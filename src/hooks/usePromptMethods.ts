import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const db = supabase as any

export interface PromptMethod {
  id: string
  name: string
  label: string
  description: string | null
  recommended_specialties: string[]
  prompt_template: string
  is_active: boolean
  sort_order: number
}

export function usePromptMethods() {
  const { data, isLoading } = useQuery({
    queryKey: ['prompt-methods'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ai_prompt_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return (data ?? []) as PromptMethod[]
    },
  })

  return { methods: data ?? [], isLoading }
}
