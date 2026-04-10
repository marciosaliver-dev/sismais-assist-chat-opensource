import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

type WhatsAppAccount = Tables<'whatsapp_business_accounts'>
type WhatsAppAccountInsert = TablesInsert<'whatsapp_business_accounts'>

export function useWhatsAppBusiness() {
  const queryClient = useQueryClient()

  const { data: account, isLoading } = useQuery({
    queryKey: ['whatsapp-account'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_business_accounts')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as WhatsAppAccount | null
    }
  })

  const saveAccount = useMutation({
    mutationFn: async (accountData: WhatsAppAccountInsert) => {
      if (account?.id) {
        const { data, error } = await supabase
          .from('whatsapp_business_accounts')
          .update(accountData)
          .eq('id', account.id)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('whatsapp_business_accounts')
          .insert(accountData)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-account'] })
      toast.success('Configuração salva com sucesso!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`)
    }
  })

  const testConnection = useMutation({
    mutationFn: async (accountData: { phone_number_id: string; access_token: string }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-test-connection', {
        body: accountData
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      toast.success(`✅ Conectado! Quality: ${data.quality_rating || 'N/A'}`)
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`)
    }
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!account?.id) return
      const { error } = await supabase
        .from('whatsapp_business_accounts')
        .update({ is_active: false })
        .eq('id', account.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-account'] })
      toast.success('WhatsApp desconectado')
    }
  })

  return { account, isLoading, saveAccount, testConnection, disconnect }
}
