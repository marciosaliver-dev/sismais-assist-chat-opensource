import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface ContactSearchResult {
  id: string
  name: string
  email: string | null
  phone: string | null
  linked_clients: number
}

export function useContactSearch(query: string) {
  return useQuery({
    queryKey: ['contact-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const pattern = `%${query}%`
      const { data, error } = await supabase
        .from('contacts' as any)
        .select('id, name, email, phone')
        .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .limit(10)
      if (error) throw error
      return (data || []) as ContactSearchResult[]
    },
    enabled: !!query && query.length >= 2,
    staleTime: 30 * 1000,
  })
}
