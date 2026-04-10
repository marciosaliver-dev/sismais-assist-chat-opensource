import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface ClientContact {
  id: string
  client_id: string
  contact_id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean
  created_at: string
}

export function useClientContacts(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      // Query the compatibility view that joins client_contact_links + contacts
      const { data, error } = await supabase
        .from('v_client_contacts' as any)
        .select('*')
        .eq('client_id', clientId!)
        .order('is_primary', { ascending: false })
      if (error) throw error
      return (data || []) as ClientContact[]
    },
    enabled: !!clientId,
  })
}
