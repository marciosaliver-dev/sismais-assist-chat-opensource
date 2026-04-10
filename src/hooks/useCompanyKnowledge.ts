import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/components/ui/sonner'

export interface CompanyKnowledgeSource {
  id: string
  tenant_id: string
  name: string
  source_type: 'pdf' | 'image' | 'docx' | 'website' | 'social' | 'confluence' | 'zoho'
  config: Record<string, any>
  status: 'pending' | 'processing' | 'indexed' | 'error'
  chunks_count: number
  pages_count: number
  last_synced_at: string | null
  next_sync_at: string | null
  sync_frequency: 'daily' | 'weekly' | 'monthly' | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export function useCompanyKnowledge() {
  const qc = useQueryClient()

  const sources = useQuery({
    queryKey: ['company-knowledge-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_knowledge_sources' as any)
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as CompanyKnowledgeSource[]
    },
  })

  const createSource = useMutation({
    mutationFn: async (source: Partial<CompanyKnowledgeSource>) => {
      const { data, error } = await supabase
        .from('company_knowledge_sources' as any)
        .insert(source as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-knowledge-sources'] })
      toast.success('Fonte adicionada com sucesso')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar fonte'),
  })

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_knowledge_sources' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-knowledge-sources'] })
      toast.success('Fonte removida')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover fonte'),
  })

  const reindexSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('company-knowledge-ingest', {
        body: { source_id: id, action: 'reindex' },
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-knowledge-sources'] })
      toast.success('Re-indexação iniciada')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao re-indexar'),
  })

  return { sources, createSource, deleteSource, reindexSource }
}
