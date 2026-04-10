import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface Campaign {
  id: string
  name: string
  description: string | null
  campaign_type: 'follow_up' | 'billing' | 'onboarding' | 'reactivation' | 'health_check'
  approval_mode: 'auto' | 'approval_required'
  schedule_cron: string | null
  schedule_timezone: string
  next_run_at: string | null
  last_run_at: string | null
  target_rules: any[]
  message_mode: 'ai_generated' | 'template'
  message_template: string | null
  message_prompt: string | null
  agent_id: string | null
  whatsapp_instance_id: string | null
  steps: any[]
  max_contacts_per_run: number
  max_contacts_per_day: number
  min_hours_between_contacts: number
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignExecution {
  id: string
  campaign_id: string
  status: 'pending' | 'approved' | 'running' | 'completed' | 'cancelled' | 'failed'
  requires_approval: boolean
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  total_targets: number
  contacted: number
  replied: number
  converted: number
  failed: number
  skipped: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CampaignContact {
  id: string
  execution_id: string
  campaign_id: string
  helpdesk_client_id: string | null
  contact_phone: string
  contact_name: string | null
  current_step: number
  status: string
  conversation_id: string | null
  message_sent: string | null
  sent_at: string | null
  replied_at: string | null
  ai_context: any
  error_message: string | null
  created_at: string
}

export interface CampaignInsert {
  name: string
  description?: string
  campaign_type: Campaign['campaign_type']
  approval_mode?: Campaign['approval_mode']
  schedule_cron?: string
  target_rules?: any[]
  message_mode?: Campaign['message_mode']
  message_template?: string
  message_prompt?: string
  agent_id?: string
  whatsapp_instance_id?: string
  steps?: any[]
  max_contacts_per_run?: number
  max_contacts_per_day?: number
  min_hours_between_contacts?: number
}

// Cast supabase to any for tables not yet in generated types
const db = supabase as any

export function useCampaigns() {
  const queryClient = useQueryClient()

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await db
        .from('proactive_campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Campaign[]
    },
    placeholderData: keepPreviousData,
  })

  const createCampaign = useMutation({
    mutationFn: async (campaign: CampaignInsert) => {
      const autoTypes = ['follow_up', 'onboarding', 'health_check']
      const defaultApproval = autoTypes.includes(campaign.campaign_type) ? 'auto' : 'approval_required'

      const { data, error } = await db
        .from('proactive_campaigns')
        .insert({
          name: campaign.name,
          description: campaign.description || null,
          campaign_type: campaign.campaign_type,
          approval_mode: campaign.approval_mode || defaultApproval,
          schedule_cron: campaign.schedule_cron || null,
          target_rules: campaign.target_rules || [],
          message_mode: campaign.message_mode || 'ai_generated',
          message_template: campaign.message_template || null,
          message_prompt: campaign.message_prompt || null,
          agent_id: campaign.agent_id || null,
          whatsapp_instance_id: campaign.whatsapp_instance_id || null,
          steps: campaign.steps || [{ delay_hours: 0, message_prompt: 'Initial outreach' }],
          max_contacts_per_run: campaign.max_contacts_per_run ?? 50,
          max_contacts_per_day: campaign.max_contacts_per_day ?? 200,
          min_hours_between_contacts: campaign.min_hours_between_contacts ?? 24,
          status: 'draft',
          is_active: false,
        })
        .select()
        .single()

      if (error) throw error
      return data as Campaign
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campanha criada!')
    },
    onError: (err: any) => toast.error(`Erro ao criar campanha: ${err.message}`),
  })

  const updateCampaign = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CampaignInsert & { status: string; is_active: boolean }> }) => {
      const { data, error } = await db
        .from('proactive_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Campaign
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campanha atualizada!')
    },
    onError: (err: any) => toast.error(`Erro ao atualizar: ${err.message}`),
  })

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('proactive_campaigns')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campanha excluída!')
    },
  })

  const toggleCampaign = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db
        .from('proactive_campaigns')
        .update({
          is_active: active,
          status: active ? 'active' : 'paused',
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })

  return { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign, toggleCampaign }
}

export function useCampaignExecutions(campaignId?: string) {
  return useQuery({
    queryKey: ['campaign-executions', campaignId],
    queryFn: async () => {
      let query = db
        .from('campaign_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (campaignId) {
        query = query.eq('campaign_id', campaignId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as CampaignExecution[]
    },
    enabled: true,
  })
}

export function useCampaignContacts(executionId?: string) {
  return useQuery({
    queryKey: ['campaign-contacts', executionId],
    queryFn: async () => {
      if (!executionId) return []
      const { data, error } = await db
        .from('campaign_contacts')
        .select('*')
        .eq('execution_id', executionId)
        .order('created_at')

      if (error) throw error
      return (data || []) as CampaignContact[]
    },
    enabled: !!executionId,
  })
}

export function usePendingApprovals() {
  const queryClient = useQueryClient()

  const { data: pendingExecutions, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const { data, error } = await db
        .from('campaign_executions')
        .select('*, proactive_campaigns(name, campaign_type, description)')
        .eq('status', 'pending')
        .eq('requires_approval', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    refetchInterval: 30000,
  })

  const approveExecution = useMutation({
    mutationFn: async (executionId: string) => {
      const { error } = await db
        .from('campaign_executions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', executionId)

      if (error) throw error

      await supabase.functions.invoke('proactive-campaign-executor', {
        body: { execution_id: executionId }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-executions'] })
      toast.success('Execução aprovada e iniciada!')
    },
    onError: (err: any) => toast.error(`Erro ao aprovar: ${err.message}`),
  })

  const rejectExecution = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await db
        .from('campaign_executions')
        .update({
          status: 'cancelled',
          rejection_reason: reason || 'Rejeitada pelo supervisor',
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-executions'] })
      toast.success('Execução rejeitada')
    },
  })

  return { pendingExecutions, isLoading, approveExecution, rejectExecution }
}

export function useCampaignStats() {
  return useQuery({
    queryKey: ['campaign-stats'],
    queryFn: async () => {
      const { data: campaigns } = await db
        .from('proactive_campaigns')
        .select('id, status, is_active, campaign_type')

      const { data: executions } = await db
        .from('campaign_executions')
        .select('status, contacted, replied, converted, failed')

      const { count: pendingCount } = await db
        .from('campaign_executions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('requires_approval', true)

      const totalCampaigns = campaigns?.length ?? 0
      const activeCampaigns = campaigns?.filter((c: any) => c.is_active).length ?? 0
      const totalContacted = executions?.reduce((s: number, e: any) => s + (e.contacted ?? 0), 0) ?? 0
      const totalReplied = executions?.reduce((s: number, e: any) => s + (e.replied ?? 0), 0) ?? 0
      const totalConverted = executions?.reduce((s: number, e: any) => s + (e.converted ?? 0), 0) ?? 0
      const totalFailed = executions?.reduce((s: number, e: any) => s + (e.failed ?? 0), 0) ?? 0

      return {
        totalCampaigns,
        activeCampaigns,
        totalContacted,
        totalReplied,
        totalConverted,
        totalFailed,
        pendingApprovals: pendingCount ?? 0,
        responseRate: totalContacted > 0 ? ((totalReplied / totalContacted) * 100).toFixed(1) : '0',
      }
    },
    refetchInterval: 60000,
  })
}
