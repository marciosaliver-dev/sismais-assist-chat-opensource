import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface DuplicateCandidate {
  id: string
  client_a_id: string
  client_b_id: string
  match_score: number
  match_reasons: Record<string, unknown> | null
  status: string
  created_at: string
  client_a?: {
    id: string; name: string; company_name: string | null
    phone: string | null; email: string | null; cnpj: string | null
    mrr_total: number | null; health_score: number | null
  }
  client_b?: {
    id: string; name: string; company_name: string | null
    phone: string | null; email: string | null; cnpj: string | null
    mrr_total: number | null; health_score: number | null
  }
}

export function useDuplicateCandidates() {
  const qc = useQueryClient()

  const query = useQuery<DuplicateCandidate[]>({
    queryKey: ['duplicate-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_duplicate_candidates')
        .select(`
          id, client_a_id, client_b_id, match_score, match_reasons, status, created_at,
          client_a:helpdesk_clients!crm_duplicate_candidates_client_a_id_fkey(id, name, company_name, phone, email, cnpj, mrr_total, health_score),
          client_b:helpdesk_clients!crm_duplicate_candidates_client_b_id_fkey(id, name, company_name, phone, email, cnpj, mrr_total, health_score)
        `)
        .eq('status', 'pending')
        .order('match_score', { ascending: false })
        .limit(50)

      if (error) throw error
      // Supabase FK joins return single objects for unique FKs
      return ((data || []) as Record<string, unknown>[]).map(row => ({
        ...row,
        client_a: Array.isArray(row.client_a) ? row.client_a[0] : row.client_a,
        client_b: Array.isArray(row.client_b) ? row.client_b[0] : row.client_b,
      })) as unknown as DuplicateCandidate[]
    },
    staleTime: 2 * 60 * 1000,
  })

  const detectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('crm_detect_duplicates', { p_limit: 100 })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Detecção concluída!')
      qc.invalidateQueries({ queryKey: ['duplicate-candidates'] })
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  })

  const mergeMutation = useMutation({
    mutationFn: async ({ keepId, mergeId }: { keepId: string; mergeId: string }) => {
      const { error } = await supabase.rpc('crm_merge_clients', {
        p_keep_id: keepId,
        p_merge_id: mergeId,
        p_resolved_by: 'user',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Clientes mesclados com sucesso!')
      qc.invalidateQueries({ queryKey: ['duplicate-candidates'] })
      qc.invalidateQueries({ queryKey: ['client-health-metrics'] })
    },
    onError: (err: Error) => toast.error(`Erro ao mesclar: ${err.message}`),
  })

  const rejectMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from('crm_duplicate_candidates')
        .update({ status: 'rejected', resolved_by: 'user', resolved_at: new Date().toISOString() })
        .eq('id', candidateId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Duplicata rejeitada')
      qc.invalidateQueries({ queryKey: ['duplicate-candidates'] })
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  })

  return {
    candidates: query.data || [],
    isLoading: query.isLoading,
    detect: detectMutation,
    merge: mergeMutation,
    reject: rejectMutation,
  }
}
