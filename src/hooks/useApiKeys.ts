import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  plan: string
  organization_name: string | null
  contact_email: string | null
  rate_limit_rpm: number
  rate_limit_rpd: number
  is_active: boolean
  expires_at: string | null
  request_count: number
  last_used_at: string | null
  created_at: string
}

interface CreateApiKeyParams {
  name: string
  organization_name: string
  contact_email: string
  plan: string
  scopes: string[]
  expires_at?: string | null
}

async function invokeApiKeysManage(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('api-keys-manage', {
    body: { action, ...params },
  })
  if (error) throw new Error(error.message || 'Request failed')
  if (data?.error) throw new Error(data.error)
  return data
}

export function useApiKeysList() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => invokeApiKeysManage('list') as Promise<ApiKey[]>,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: CreateApiKeyParams) => invokeApiKeysManage('create', params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar chave: ${err.message}`)
    },
  })
}

export function useToggleApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      invokeApiKeysManage(is_active ? 'deactivate' : 'activate', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`)
    },
  })
}

export interface ApiKeyStats {
  total_keys: number
  active_keys: number
  total_requests: number
  requests_today: number
  keys: ApiKey[]
  hourly_usage: { hour: string; count: number }[]
}

export function useApiKeyStats() {
  return useQuery({
    queryKey: ['api-keys-stats'],
    queryFn: () => invokeApiKeysManage('stats') as Promise<ApiKeyStats>,
    refetchInterval: 60_000,
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeApiKeysManage('delete', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('Chave revogada')
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`)
    },
  })
}
