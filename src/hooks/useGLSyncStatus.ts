import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useGLSyncStatus() {
  const licenses = useQuery({
    queryKey: ['gl-licenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gl_client_licenses' as any)
        .select('gl_id, nome, cpf_cnpj, fantasia, email, status_pessoa, sistema_utilizado, source_system, synced_at')
        .order('synced_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const syncLog = useQuery({
    queryKey: ['gl-sync-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data || []
    },
    staleTime: 60 * 1000,
  })

  const stats = {
    total: licenses.data?.length ?? 0,
    active: licenses.data?.filter((l: any) => l.status_pessoa === 'Ativo').length ?? 0,
    blocked: licenses.data?.filter((l: any) => l.status_pessoa === 'Bloqueado').length ?? 0,
    lastSync: syncLog.data?.[0]?.created_at ?? null,
  }

  return { licenses, syncLog, stats }
}
