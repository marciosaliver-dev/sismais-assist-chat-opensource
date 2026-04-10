import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export interface QueueTicket {
  id: string
  ticket_number: number
  customer_name: string | null
  customer_phone: string
  priority: string | null
  communication_channel: string | null
  queue_entered_at: string | null
  started_at: string | null
  status: string | null
  helpdesk_client_id: string | null
  ticket_category_id: string | null
  ticket_module_id: string | null
  human_agent_id: string | null
  client_name: string | null
  subscribed_product: string | null
  category_name: string | null
  module_name: string | null
  avatar_url: string | null
}

export function useQueueTickets() {
  const queryClient = useQueryClient()
  const { user } = useSupabaseAuth()
  const navigate = useNavigate()

  // Fetch queue tickets
  const { data: tickets, isLoading, isError, error } = useQuery({
    queryKey: ['queue-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select(`
          id, ticket_number, customer_name, customer_phone, priority,
          communication_channel, queue_entered_at, started_at, status,
          helpdesk_client_id, ticket_category_id, ticket_module_id, human_agent_id,
          helpdesk_clients!ai_conversations_helpdesk_client_id_fkey(name, subscribed_product),
          ticket_categories!ai_conversations_ticket_category_id_fkey(name),
          ticket_modules!ai_conversations_ticket_module_id_fkey(name)
        `)
        .eq('status', 'aguardando')
        .or('is_merged.is.null,is_merged.eq.false')
        .order('queue_entered_at', { ascending: true, nullsFirst: false })
        .order('started_at', { ascending: true })

      if (error) throw error

      // Fetch contact avatars from customer_profiles
      const phones = [...new Set((data || []).map((c: any) => c.customer_phone).filter(Boolean))]
      const avatarMap = new Map<string, string>()
      if (phones.length > 0) {
        const { data: profiles } = await supabase
          .from('customer_profiles')
          .select('phone, avatar_url')
          .in('phone', phones)
          .not('avatar_url', 'is', null)
        for (const p of profiles || []) {
          if (p.avatar_url) avatarMap.set(p.phone, p.avatar_url)
        }
      }

      return (data || []).map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number,
        customer_name: t.customer_name,
        customer_phone: t.customer_phone,
        priority: t.priority,
        communication_channel: t.communication_channel,
        queue_entered_at: t.queue_entered_at,
        started_at: t.started_at,
        status: t.status,
        helpdesk_client_id: t.helpdesk_client_id,
        ticket_category_id: t.ticket_category_id,
        ticket_module_id: t.ticket_module_id,
        human_agent_id: t.human_agent_id,
        client_name: t.helpdesk_clients?.name || null,
        subscribed_product: t.helpdesk_clients?.subscribed_product || null,
        category_name: t.ticket_categories?.name || null,
        module_name: t.ticket_modules?.name || null,
        avatar_url: avatarMap.get(t.customer_phone) || null,
      })) as QueueTicket[]
    },
    refetchInterval: 10000,
  })

  // Fetch online agents count
  const { data: onlineAgentsCount } = useQuery({
    queryKey: ['online-agents-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('human_agents')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .neq('is_active', false)
      if (error) throw error
      return count || 0
    },
    refetchInterval: 30000,
  })

  const assumeTicket = useMutation({
    mutationFn: async (ticket: QueueTicket) => {
      if (!user) throw new Error('Usuário não autenticado')

      // Find human agent for logged user
      const { data: agent, error: agentErr } = await supabase
        .from('human_agents')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (agentErr || !agent) throw new Error('Agente humano não encontrado para este usuário')

      const now = new Date().toISOString()
      const queueEnteredAt = ticket.queue_entered_at || ticket.started_at
      const responseSeconds = queueEnteredAt
        ? Math.round((Date.now() - new Date(queueEnteredAt).getTime()) / 1000)
        : null

      // Update conversation (trigger handles timestamps)
      const { error: updateErr } = await supabase
        .from('ai_conversations')
        .update({
          status: 'em_atendimento',
          human_agent_id: agent.id,
          handler_type: 'human',
        })
        .eq('id', ticket.id)

      if (updateErr) throw updateErr

      // Create agent assignment
      const { error: assignErr } = await supabase
        .from('agent_assignments')
        .insert({
          conversation_id: ticket.id,
          agent_type: 'human',
          human_agent_id: agent.id,
        })

      if (assignErr) throw assignErr

      return ticket.id
    },
    onSuccess: (ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['queue-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Atendimento assumido com sucesso!')
      navigate(`/kanban/support?ticket=${ticketId}`)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao assumir atendimento')
    },
  })

  return {
    tickets: tickets || [],
    isLoading,
    isError,
    error,
    onlineAgentsCount: onlineAgentsCount || 0,
    assumeTicket,
  }
}
