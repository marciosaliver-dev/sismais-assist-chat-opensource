import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useChannelInstances(channelType: 'meta_whatsapp' | 'uazapi' | 'instagram') {
  const queryClient = useQueryClient()

  const instances = useQuery({
    queryKey: ['channel-instances', channelType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_instances')
        .select('*')
        .eq('channel_type', channelType)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: 15000,
  })

  const upsertInstance = useMutation({
    mutationFn: async (instance: {
      id?: string
      channel_type: string
      display_name: string
      phone_number: string
      is_active?: boolean
      config: Record<string, unknown>
      kanban_board_id?: string | null
    }) => {
      const { data, error } = await supabase
        .from('channel_instances')
        .upsert(instance as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] })
      toast.success('Instância salva com sucesso')
    },
    onError: (e: Error) => toast.error('Erro ao salvar instância: ' + e.message),
  })

  const testConnection = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke('meta-whatsapp-proxy', {
        body: { action: 'getStatus', instanceId },
      })
      if (error) throw error
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      return data
    },
    onSuccess: (_data, instanceId) => {
      supabase
        .from('channel_instances')
        .update({ status: 'connected' } as any)
        .eq('id', instanceId)
        .then(() => queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] }))
      toast.success('Conexão verificada com sucesso!')
    },
    onError: (e: Error) => toast.error('Erro ao testar conexão: ' + e.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ instanceId, isActive }: { instanceId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('channel_instances')
        .update({ is_active: isActive } as any)
        .eq('id', instanceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] })
      toast.success('Status atualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const { error } = await supabase
        .from('channel_instances')
        .delete()
        .eq('id', instanceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] })
      toast.success('Instância excluída')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    instances: instances.data ?? [],
    isLoading: instances.isLoading,
    upsertInstance,
    testConnection,
    toggleActive,
    deleteInstance,
  }
}
