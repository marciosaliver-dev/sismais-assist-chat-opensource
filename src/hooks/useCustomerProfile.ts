import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface CustomerProfile {
  id: string
  phone: string
  external_id: string | null
  nome: string | null
  documento: string | null
  email: string | null
  fantasia: string | null
  dados_cadastrais: Record<string, unknown>
  dados_financeiros: Record<string, unknown>
  dados_servico: Record<string, unknown>
  raw_data: Record<string, unknown>
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export function useCustomerProfile(phone?: string) {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-profile', phone],
    queryFn: async () => {
      if (!phone) return null

      // Try local cache first
      const cleanPhone = phone.replace(/\D/g, '')
      const { data } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle()

      return (data as CustomerProfile) || null
    },
    enabled: !!phone,
  })

  const lookupMutation = useMutation({
    mutationFn: async (lookupPhone: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const resp = await supabase.functions.invoke('sismais-client-lookup', {
        body: { action: 'lookup', phone: lookupPhone.replace(/\D/g, '') },
      })

      if (resp.error) throw resp.error
      return resp.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile', phone] })
    },
  })

  const refreshProfile = () => {
    if (phone) {
      lookupMutation.mutate(phone)
    }
  }

  return {
    profile,
    isLoading,
    refreshProfile,
    isRefreshing: lookupMutation.isPending,
    lookupError: lookupMutation.error,
  }
}
