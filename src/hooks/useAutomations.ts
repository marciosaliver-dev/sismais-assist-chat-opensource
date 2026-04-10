import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'

type Automation = Tables<'ai_automations'>

interface AutomationInsert {
  name: string
  description?: string
  trigger_type: string
  trigger_conditions?: any[]
  actions: any[]
  schedule_cron?: string
  is_active?: boolean
}

export function useAutomations() {
  const queryClient = useQueryClient()

  const { data: automations, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_automations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    placeholderData: keepPreviousData,
  })

  const createAutomation = useMutation({
    mutationFn: async (automation: AutomationInsert) => {
      const { data, error } = await supabase
        .from('ai_automations')
        .insert({
          name: automation.name,
          description: automation.description || null,
          trigger_type: automation.trigger_type,
          trigger_conditions: automation.trigger_conditions || [],
          actions: automation.actions,
          schedule_cron: automation.schedule_cron || null,
          is_active: automation.is_active ?? true,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automação criada!')
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar: ${err.message}`)
    }
  })

  const updateAutomation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AutomationInsert> }) => {
      const { data, error } = await supabase
        .from('ai_automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automação atualizada!')
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar: ${err.message}`)
    }
  })

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_automations')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automação excluída!')
    }
  })

  const toggleAutomation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('ai_automations')
        .update({ is_active: active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
    }
  })

  return {
    automations,
    isLoading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
  }
}
