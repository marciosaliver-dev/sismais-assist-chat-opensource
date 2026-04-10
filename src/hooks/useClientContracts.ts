import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useClientContracts(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-contracts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('helpdesk_client_contracts')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })
}
