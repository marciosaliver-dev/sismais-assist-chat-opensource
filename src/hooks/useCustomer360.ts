import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface Customer360 {
  client: {
    id: string
    name: string
    company_name: string | null
    email: string | null
    phone: string | null
    cnpj: string | null
    cpf: string | null
    subscribed_product: string | null
    subscribed_product_custom: string | null
    notes: string | null
    sistema?: string | null
    plan_level?: string | null
    customer_tier?: string | null
    lifecycle_stage?: string | null
    customer_since?: string | null
    health_score?: number | null
    engagement_score?: number | null
    churn_risk?: boolean | null
    mrr_total?: number | null
    debt_total?: number | null
    pending_invoices_count?: number | null
    active_contracts_count?: number | null
    license_status?: string | null
    avatar_url?: string | null
    last_synced_at?: string | null
  } | null
  contacts: Array<{
    id: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
    is_primary: boolean
  }>
  contracts: Array<{
    id: string
    contract_number: string | null
    plan_name: string | null
    status: string
    start_date: string | null
    end_date: string | null
    value: number | null
    notes: string | null
  }>
  conversations: Array<{
    id: string
    ticket_number: string | null
    status: string
    handler_type: string
    started_at: string | null
    resolved_at: string | null
    csat_rating: number | null
    message_count?: number
  }>
  timeline: Array<TimelineEvent>
  data_sources: Array<{
    id: string
    source_system: string
    sync_status: string
    last_synced_at: string | null
  }>
  score_history: Array<{
    id: string
    score_type: string
    score_value: number
    calculated_at: string
  }>
  companies: Array<{
    id: string
    cnpj: string
    company_name: string | null
    is_primary: boolean
  }>
}

export interface TimelineEvent {
  id: string
  event_type: string
  channel: string | null
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  actor_type: string | null
  actor_name: string | null
  occurred_at: string
  created_at: string
  conversation_id: string | null
  contract_id: string | null
}

export function useCustomer360(clientId: string | undefined, options?: { includeScores?: boolean; light?: boolean }) {
  return useQuery<Customer360>({
    queryKey: ['customer-360', clientId, options?.light, options?.includeScores],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('customer-360', {
        body: {
          client_id: clientId,
          include_scores: options?.includeScores !== false,
          include_whatsapp: !options?.light,
        },
      })
      if (error) throw error
      return data as Customer360
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  })
}
