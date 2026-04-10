import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useClientAnnotations(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-annotations', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('helpdesk_client_annotations')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })
}
