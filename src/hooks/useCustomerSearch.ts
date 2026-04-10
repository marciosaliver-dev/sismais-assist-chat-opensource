import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

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

export function useCustomerSearch() {
  const [results, setResults] = useState<CustomerProfile[]>([])
  const [searching, setSearching] = useState(false)

  const search = async (query: string) => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const normalizedQuery = query.replace(/\D/g, '')
      const isNumeric = normalizedQuery.length > 0 && normalizedQuery === query.replace(/[\s\-().+]/g, '')

      let data: CustomerProfile[] = []

      if (isNumeric && normalizedQuery.length >= 4) {
        // Search by phone or documento (CNPJ/CPF)
        const { data: phoneResults } = await supabase
          .from('customer_profiles')
          .select('*')
          .or(`phone.ilike.%${normalizedQuery}%,documento.ilike.%${normalizedQuery}%`)
          .limit(10)
        data = (phoneResults as CustomerProfile[]) || []
      } else {
        // Search by name or email
        const { data: nameResults } = await supabase
          .from('customer_profiles')
          .select('*')
          .or(`nome.ilike.%${query}%,email.ilike.%${query}%,fantasia.ilike.%${query}%`)
          .limit(10)
        data = (nameResults as CustomerProfile[]) || []
      }

      setResults(data)
    } catch (err) {
      console.error('Customer search error:', err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const clear = () => setResults([])

  return { results, searching, search, clear }
}

export function useAssociateCustomer(conversationId?: string) {
  const queryClient = useQueryClient()

  const associate = useMutation({
    mutationFn: async (profile: CustomerProfile) => {
      if (!conversationId) throw new Error('No conversation')

      const { error } = await supabase
        .from('ai_conversations')
        .update({
          customer_name: profile.nome || profile.fantasia || profile.phone,
          customer_email: profile.email,
        })
        .eq('id', conversationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Cliente associado ao ticket')
    },
    onError: () => toast.error('Erro ao associar cliente'),
  })

  return associate
}

export function useLookupExternalCustomer() {
  return useMutation({
    mutationFn: async ({ phone, documento, nome, email, fantasia }: { phone?: string; documento?: string; nome?: string; email?: string; fantasia?: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const payload: Record<string, string> = { action: 'lookup' }
      if (phone) payload.phone = phone.replace(/\D/g, '')
      if (documento) payload.documento = documento.replace(/\D/g, '')
      if (nome) payload.nome = nome.trim()
      if (email) payload.email = email.trim()
      if (fantasia) payload.fantasia = fantasia.trim()

      console.log('[useLookupExternalCustomer] Sending payload:', JSON.stringify(payload))
      const resp = await supabase.functions.invoke('sismais-client-lookup', { body: payload })

      if (resp.error) throw resp.error
      return resp.data
    },
  })
}

export interface Contract {
  id: string
  nome?: string
  descricao?: string
  status?: string
  valor?: number
  data_inicio?: string
  data_fim?: string
  plano?: string
  tipo?: string
  [key: string]: unknown
}

export function useLookupContracts() {
  return useMutation({
    mutationFn: async ({ phone, documento, external_id }: { phone?: string; documento?: string; external_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const payload: Record<string, string> = { action: 'contracts' }
      if (phone) payload.phone = phone.replace(/\D/g, '')
      if (documento) payload.documento = documento.replace(/\D/g, '')
      if (external_id) payload.external_id = external_id

      console.log('[useLookupContracts] Sending payload:', JSON.stringify(payload))
      const resp = await supabase.functions.invoke('sismais-client-lookup', { body: payload })

      if (resp.error) throw resp.error
      return resp.data as { success: boolean; contracts: Contract[]; found: boolean }
    },
  })
}
