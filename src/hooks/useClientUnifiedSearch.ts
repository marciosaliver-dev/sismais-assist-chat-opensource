import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface KpiCounts {
  total: number
  ativos: number
  bloqueados: number
  trial: number
  inativos: number
}

export interface Pagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface UnifiedSearchParams {
  query?: string
  limit?: number
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  filterStatus?: string
  filterSegmento?: string
  filterDateRange?: string
}

export interface UnifiedSearchResult {
  id: string
  name: string
  company: string | null
  cnpj: string | null
  phone: string | null
  email: string | null
  source: 'local' | 'gl' | 'contact'
  gl_status_mais_simples: string | null
  gl_status_maxpro: string | null
  license_status: string | null
  mrr_total: number | null
  health_score: number | null
  customer_tier: string | null
  is_linked: boolean
  data_cadastro: string | null
  ultimo_login: string | null
  qtd_logins: number | null
  segmento: string | null
  dias_de_uso: number | null
  engajamento: string | null
  tag: string | null
  dias_status_atual: number | null
  dias_assinatura: number | null
  ltv_dias: number | null
  dt_inicio_assinatura: string | null
  cidade: string | null
  uf: string | null
  sistema_utilizado: string | null
  id_plano: number | null
  dias_instalacao: number | null
  ultima_verificacao: string | null
}

export function useClientUnifiedSearch(params: UnifiedSearchParams = {}) {
  const {
    query = '',
    limit = 50,
    offset = 0,
    sortBy = 'name',
    sortDir = 'asc',
    filterStatus = '',
    filterSegmento = '',
    filterDateRange = '',
  } = params

  return useQuery({
    queryKey: ['client-unified-search', query, limit, offset, sortBy, sortDir, filterStatus, filterSegmento, filterDateRange],
    queryFn: async (): Promise<{ results: UnifiedSearchResult[]; kpiCounts: KpiCounts; pagination: Pagination }> => {
      const { data, error } = await supabase.functions.invoke('client-unified-search', {
        body: { query, limit, offset, sortBy, sortDir, filterStatus, filterSegmento, filterDateRange },
      })
      if (error) throw error
      return data
    },
    enabled: true,
    staleTime: 30_000,
  })
}
