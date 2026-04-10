import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useSharedRealtimeChannel } from './useSharedRealtimeChannel'
import { toast } from 'sonner'
import { triggerStageAutomations } from '@/utils/stageAutomationExecutor'
import { calculateResolutionTimes } from '@/utils/closeConversation'

export interface SLATargets {
  first_response_target_minutes: number
  resolution_target_minutes: number
}

export interface KanbanTicket {
  id: string
  ticket_number: number | null
  customer_name: string | null
  customer_phone: string
  avatar_url?: string | null
  status: string | null
  priority: string | null
  handler_type: string | null
  stage_id: string | null
  started_at: string | null
  tags: string[] | null
  current_agent_id: string | null
  csat_rating: number | null
  last_message?: string
  helpdesk_client_id: string | null
  ticket_category_id: string | null
  ticket_module_id: string | null
  helpdesk_client_name?: string | null
  helpdesk_client_email?: string | null
  helpdesk_client_cnpj?: string | null
  helpdesk_client_cpf?: string | null
  helpdesk_client_company?: string | null
  subscribed_product?: string | null
  gl_status_mais_simples?: string | null
  gl_status_maxpro?: string | null
  support_eligible?: boolean | null
  queue_entered_at: string | null
  first_human_response_at: string | null
  resolved_at: string | null
  statusType?: string
  statusName?: string
  statusColor?: string
  slaTargets?: SLATargets
  context?: Record<string, unknown> | null
  human_agent_id?: string | null
  humanAgentName?: string | null
  human_started_at?: string | null
  ai_agent_name?: string | null
  ai_messages_count?: number | null
  human_messages_count?: number | null
  priority_source?: string | null
  uazapi_chat_id?: string | null
  uazapi_unread_count?: number | null
  whatsapp_instance_id?: string | null
  whatsapp_instance_name?: string | null
  ticket_subject?: string | null
}

export interface KanbanFilters {
  agent?: string
  category?: string
  module?: string
  priority?: string
  search?: string
  humanAgent?: string
  whatsappInstance?: string
  boardId?: string
  dateFrom?: string
  dateTo?: string
}

export function useKanbanTickets(filters: KanbanFilters = {}) {
  const queryClient = useQueryClient()

  const { data: tickets = [], isLoading, isError, error } = useQuery({
    queryKey: ['kanban-tickets', filters],
    queryFn: async () => {
      let query = supabase
        .from('ai_conversations')
        .select('id, ticket_number, customer_name, customer_phone, status, priority, handler_type, stage_id, started_at, tags, current_agent_id, csat_rating, helpdesk_client_id, ticket_category_id, ticket_module_id, queue_entered_at, first_human_response_at, resolved_at, human_agent_id, human_started_at, context, kanban_board_id, ai_messages_count, human_messages_count, uazapi_chat_id, whatsapp_instance_id, ticket_subject')
        .or('is_merged.is.null,is_merged.eq.false')
        .order('started_at', { ascending: false })

      if (filters.boardId) {
        query = query.eq('kanban_board_id', filters.boardId)
      }

      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority)
      }

      if (filters.dateFrom) {
        query = query.gte('started_at', filters.dateFrom)
      }
      if (filters.dateTo) {
        // Add 1 day to include the entire end date
        const endDate = new Date(filters.dateTo)
        endDate.setDate(endDate.getDate() + 1)
        query = query.lt('started_at', endDate.toISOString().split('T')[0])
      }

      const { data: conversations, error } = await query
      if (error) throw error

      const ids = (conversations || []).map(c => c.id)

      // Prepare lookup keys
      const clientIds = [...new Set((conversations || []).map(c => c.helpdesk_client_id).filter(Boolean))] as string[]
      const aiAgentIds = [...new Set((conversations || []).map(c => c.current_agent_id).filter(Boolean))] as string[]
      const agentIds = [...new Set((conversations || []).map(c => c.human_agent_id).filter(Boolean))] as string[]
      const phones = [...new Set((conversations || []).map(c => c.customer_phone).filter(Boolean))]
      const instanceIds = [...new Set((conversations || []).map(c => c.whatsapp_instance_id).filter(Boolean))] as string[]
      const chatIds = [...new Set((conversations || []).map(c => (c as any).uazapi_chat_id).filter(Boolean))] as string[]

      // Run all independent queries in parallel for ~60-70% faster loading
      const [
        messagesResult,
        clientsResult,
        statusResult,
        slaResult,
        humanAssignmentsResult,
        aiAgentsResult,
        humanAgentsResult,
        avatarsResult,
        instancesResult,
        uazapiChatsResult,
      ] = await Promise.all([
        // Last messages
        ids.length > 0
          ? supabase.from('ai_messages').select('conversation_id, content, created_at').in('conversation_id', ids).order('created_at', { ascending: false })
          : Promise.resolve({ data: null }),
        // Helpdesk clients
        clientIds.length > 0
          ? supabase.from('helpdesk_clients').select('id, name, subscribed_product, gl_status_mais_simples, gl_status_maxpro, support_eligible, email, cnpj, cpf, company_name').in('id', clientIds)
          : Promise.resolve({ data: null }),
        // Ticket statuses
        supabase.from('ticket_statuses').select('slug, status_type, name, color'),
        // SLA config
        (supabase as any).from('ticket_sla_config').select('priority, first_response_target_minutes, resolution_target_minutes').eq('active', true),
        // Human agent assignments (conditional)
        (filters.humanAgent && filters.humanAgent !== 'all' && ids.length > 0)
          ? supabase.from('agent_assignments').select('conversation_id').eq('agent_type', 'human').eq('human_agent_id', filters.humanAgent).is('unassigned_at', null).in('conversation_id', ids)
          : Promise.resolve({ data: null }),
        // AI agent names
        aiAgentIds.length > 0
          ? supabase.from('ai_agents').select('id, name').in('id', aiAgentIds)
          : Promise.resolve({ data: null }),
        // Human agent names
        agentIds.length > 0
          ? supabase.from('human_agents').select('id, name').in('id', agentIds)
          : Promise.resolve({ data: null }),
        // Contact avatars
        phones.length > 0
          ? supabase.from('customer_profiles').select('phone, avatar_url').in('phone', phones).not('avatar_url', 'is', null)
          : Promise.resolve({ data: null }),
        // WhatsApp instance names
        instanceIds.length > 0
          ? (supabase as any).from('uazapi_instances_public').select('id, instance_name').in('id', instanceIds)
          : Promise.resolve({ data: null }),
        // UAZAPI chats (primary by chat_id)
        chatIds.length > 0
          ? supabase.from('uazapi_chats' as any).select('chat_id, unread_count, contact_picture_url, contact_phone').in('chat_id', chatIds)
          : Promise.resolve({ data: null }),
      ])

      // Process last messages
      const lastMessages = new Map<string, string>()
      for (const msg of messagesResult.data || []) {
        if (msg.conversation_id && !lastMessages.has(msg.conversation_id)) {
          lastMessages.set(msg.conversation_id, msg.content.substring(0, 80))
        }
      }

      // Process clients
      const clientMap = new Map<string, { name: string; subscribed_product: string | null; gl_status_mais_simples: string | null; gl_status_maxpro: string | null; support_eligible: boolean | null; email: string | null; cnpj: string | null; cpf: string | null; company_name: string | null }>()
      for (const c of clientsResult.data || []) {
        clientMap.set(c.id, { name: c.name, subscribed_product: c.subscribed_product, gl_status_mais_simples: (c as any).gl_status_mais_simples || null, gl_status_maxpro: (c as any).gl_status_maxpro || null, support_eligible: (c as any).support_eligible ?? null, email: c.email, cnpj: c.cnpj, cpf: c.cpf, company_name: c.company_name })
      }

      // Process statuses
      const statusTypeMap = new Map<string, string>()
      const statusNameMap = new Map<string, string>()
      const statusColorMap = new Map<string, string>()
      for (const s of statusResult.data || []) {
        statusTypeMap.set(s.slug, s.status_type)
        statusNameMap.set(s.slug, s.name)
        statusColorMap.set(s.slug, s.color)
      }

      // Process SLA
      const slaMap = new Map<string, SLATargets>()
      for (const s of slaResult.data || []) {
        slaMap.set(s.priority, {
          first_response_target_minutes: s.first_response_target_minutes,
          resolution_target_minutes: s.resolution_target_minutes,
        })
      }

      // Process human agent filter
      let humanAgentConvIds: Set<string> | null = null
      if (filters.humanAgent && filters.humanAgent !== 'all') {
        humanAgentConvIds = new Set((humanAssignmentsResult.data || []).map((a: any) => a.conversation_id).filter(Boolean) as string[])
      }

      // Process AI agent names
      const aiAgentNameMap = new Map<string, string>()
      for (const a of aiAgentsResult.data || []) aiAgentNameMap.set(a.id, a.name)

      // Process human agent names
      const agentNameMap = new Map<string, string>()
      for (const a of humanAgentsResult.data || []) agentNameMap.set(a.id, a.name)

      // Process avatars
      const avatarMap = new Map<string, string>()
      for (const p of avatarsResult.data || []) {
        if (p.avatar_url) avatarMap.set(p.phone, p.avatar_url)
      }

      // Process instance names
      const instanceNameMap = new Map<string, string>()
      for (const inst of instancesResult.data || []) {
        if (inst.id && inst.instance_name) instanceNameMap.set(inst.id, inst.instance_name)
      }

      // Process UAZAPI chats
      const unreadMap = new Map<string, number>()
      const chatPictureMap = new Map<string, string>()
      const chatIdByPhone = new Map<string, string>()

      const processUazapiChats = (rows: unknown[]) => {
        for (const ch of rows) {
          const chatId = (ch as any).chat_id as string | null
          const phone = (ch as any).contact_phone as string | null
          const unread = (ch as any).unread_count as number | null
          const pic = (ch as any).contact_picture_url as string | null
          if (chatId && unread && unread > 0) unreadMap.set(chatId, unread)
          if (chatId && phone) chatIdByPhone.set(phone, chatId)
          if (pic && phone) chatPictureMap.set(phone, pic)
        }
      }
      processUazapiChats(uazapiChatsResult.data || [])

      // Fallback lookup: by contact_phone — for conversations without uazapi_chat_id
      const allPhones = [...new Set((conversations || []).map(c => c.customer_phone).filter(Boolean))] as string[]
      const phonesNotYetMatched = allPhones.filter(p => !chatIdByPhone.has(p))
      if (phonesNotYetMatched.length > 0) {
        const { data: chatsByPhone, error: phoneUnreadError } = await supabase
          .from('uazapi_chats' as any)
          .select('chat_id, unread_count, contact_picture_url, contact_phone')
          .in('contact_phone', phonesNotYetMatched)
        if (phoneUnreadError) console.warn('[Kanban] Failed to fetch unread counts by phone:', phoneUnreadError.message)
        processUazapiChats(chatsByPhone || [])
      }

      let result: KanbanTicket[] = (conversations || []).map(c => {
        const client = c.helpdesk_client_id ? clientMap.get(c.helpdesk_client_id) : null
        return {
          ...c,
          context: (typeof c.context === 'object' && c.context !== null && !Array.isArray(c.context) ? c.context : {}) as Record<string, unknown>,
          avatar_url: avatarMap.get(c.customer_phone) || chatPictureMap.get(c.customer_phone) || null,
          last_message: lastMessages.get(c.id) || '',
          helpdesk_client_name: client?.name || null,
          helpdesk_client_email: client?.email || null,
          helpdesk_client_cnpj: client?.cnpj || null,
          helpdesk_client_cpf: client?.cpf || null,
          helpdesk_client_company: client?.company_name || null,
          subscribed_product: client?.subscribed_product || null,
          gl_status_mais_simples: client?.gl_status_mais_simples || null,
          gl_status_maxpro: client?.gl_status_maxpro || null,
          support_eligible: client?.support_eligible ?? null,
          statusType: c.status ? statusTypeMap.get(c.status) : undefined,
          statusName: c.status ? statusNameMap.get(c.status) : undefined,
          statusColor: c.status ? statusColorMap.get(c.status) : undefined,
          slaTargets: c.priority ? slaMap.get(c.priority) : undefined,
          humanAgentName: c.human_agent_id ? agentNameMap.get(c.human_agent_id) || null : null,
          ai_agent_name: c.current_agent_id ? aiAgentNameMap.get(c.current_agent_id) || null : null,
          uazapi_chat_id: (c as any).uazapi_chat_id || chatIdByPhone.get(c.customer_phone) || null,
          uazapi_unread_count: (() => {
            const directChatId = (c as any).uazapi_chat_id as string | null
            if (directChatId) return unreadMap.get(directChatId) ?? null
            const fallbackChatId = chatIdByPhone.get(c.customer_phone)
            if (fallbackChatId) return unreadMap.get(fallbackChatId) ?? null
            return null
          })(),
          whatsapp_instance_id: c.whatsapp_instance_id || null,
          whatsapp_instance_name: c.whatsapp_instance_id ? (instanceNameMap.get(c.whatsapp_instance_id) || null) : null,
        }
      })

      // Client-side filters
      if (filters.search) {
        const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const s = normalize(filters.search)
        const searchDigits = filters.search.replace(/\D/g, '')
        // Strip Brazil DDI from search term for phone matching
        const searchPhoneNorm = searchDigits.startsWith('55') && searchDigits.length >= 12
          ? searchDigits.slice(2) : searchDigits
        result = result.filter(t => {
          const fields = [
            t.customer_name,
            t.customer_phone,
            String(t.ticket_number || ''),
            t.helpdesk_client_name,
            t.helpdesk_client_email,
            t.helpdesk_client_cnpj,
            t.helpdesk_client_cpf,
            t.helpdesk_client_company,
            t.last_message,
            t.subscribed_product,
            (t.tags || []).join(' '),
          ]
          // Standard text match
          if (fields.some(f => f && normalize(f).includes(s))) return true
          // Digits-only match for phone/CNJ/CNPJ/CPF (ignores punctuation)
          if (searchDigits.length >= 3) {
            const numericFields = [
              t.customer_phone,
              t.helpdesk_client_cnpj,
              t.helpdesk_client_cpf,
            ]
            if (numericFields.some(f => {
              if (!f) return false
              const fd = f.replace(/\D/g, '')
              // Also strip DDI from stored phone for comparison
              const fdNorm = fd.startsWith('55') && fd.length >= 12 ? fd.slice(2) : fd
              return fdNorm.includes(searchPhoneNorm) || fd.includes(searchDigits)
            })) return true
          }
          return false
        })
      }
      if (filters.agent && filters.agent !== 'all') {
        result = result.filter(t =>
          t.status === 'aguardando' || t.current_agent_id === filters.agent
        )
      }
      if (filters.category && filters.category !== 'all') {
        result = result.filter(t => t.ticket_category_id === filters.category)
      }
      if (filters.module && filters.module !== 'all') {
        result = result.filter(t => t.ticket_module_id === filters.module)
      }
      if (humanAgentConvIds !== null) {
        result = result.filter(t =>
          t.status === 'aguardando' || humanAgentConvIds!.has(t.id) || t.human_agent_id === filters.humanAgent
        )
      }
      if (filters.whatsappInstance && filters.whatsappInstance !== 'all') {
        result = result.filter(t => t.whatsapp_instance_id === filters.whatsappInstance)
      }

      return result
    },
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  })

  // Realtime subscriptions — shared channels, client-side filtering by boardId
  useSharedRealtimeChannel('ai_conversations', '*', (payload) => {
    const conv = payload.new as Record<string, unknown>
    // Filtra pelo boardId se definido; caso contrário, invalida para qualquer conversa
    if (!filters.boardId || conv?.kanban_board_id === filters.boardId) {
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
    }
  })

  useSharedRealtimeChannel('ai_messages', 'INSERT', (payload) => {
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
    // Invalida reasoning da conversa específica quando chegam novas mensagens de IA
    const msg = payload.new as Record<string, unknown>
    if (msg?.conversation_id) {
      queryClient.invalidateQueries({ queryKey: ['reasoning', msg.conversation_id] })
    }
  })

  // uazapi_chats: reage a UPDATE (unread_count muda quando mensagem chega ou é lida)
  useSharedRealtimeChannel('uazapi_chats', 'UPDATE', () => {
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
  })

  // uazapi_messages: reage a INSERT para atualizar preview de última mensagem
  useSharedRealtimeChannel('uazapi_messages', 'INSERT', () => {
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
  })

  // Group tickets by stage_id
  const ticketsByStage = (stageId: string) =>
    tickets.filter(t => t.stage_id === stageId)

  // Keep legacy function for backward compat
  const ticketsByStatus = (slug: string) =>
    tickets.filter(t => t.status === slug)

  const moveTicket = useMutation({
    mutationFn: async ({ ticketId, toStageId, fromStageId, statusType }: { ticketId: string; toStageId: string; fromStageId?: string | null; statusType?: string | null }) => {
      const updateData: Record<string, unknown> = { stage_id: toStageId }
      if (statusType === 'finalizado') {
        updateData.status = 'finalizado'
        updateData.resolved_at = new Date().toISOString()
        // Fetch conversation data for resolution time + CSAT
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('started_at, human_started_at, kanban_board_id, uazapi_instance_id')
          .eq('id', ticketId)
          .single()
        if (conv) {
          const times = calculateResolutionTimes(conv.started_at, (conv as any).human_started_at)
          updateData.resolution_time_seconds = times.resolutionTimeSeconds
          updateData.resolution_seconds = times.resolutionSeconds
        }

        // Check board-level CSAT config and fire csat-processor
        if (conv?.kanban_board_id && conv?.uazapi_instance_id) {
          const { data: csatConfig } = await (supabase as any)
            .from('csat_board_configs')
            .select('id, enabled, send_on_close')
            .eq('board_id', conv.kanban_board_id)
            .eq('enabled', true)
            .maybeSingle()
          if (csatConfig?.send_on_close) {
            updateData.csat_sent_at = new Date().toISOString()
            // Fire-and-forget: send CSAT via csat-processor after DB update
            setTimeout(() => {
              supabase.functions.invoke('csat-processor', {
                body: { action: 'send', conversationId: ticketId, configId: csatConfig.id }
              }).catch((err: unknown) => console.error('[moveTicket] CSAT send failed:', err))
            }, 300)
          }
        }
      } else if (statusType === 'em_atendimento') {
        updateData.status = 'em_atendimento'
      } else if (statusType === 'aguardando') {
        updateData.status = 'aguardando'
      }
      const { error } = await supabase
        .from('ai_conversations')
        .update(updateData)
        .eq('id', ticketId)
      if (error) throw error

      // Record stage history
      await supabase
        .from('ticket_stage_history')
        .insert({
          conversation_id: ticketId,
          from_stage_id: fromStageId || null,
          to_stage_id: toStageId,
          moved_by: 'user',
        })
        .then(() => {})

      // Fire stage automations asynchronously
      if (fromStageId && fromStageId !== toStageId) {
        triggerStageAutomations(ticketId, fromStageId, toStageId).catch(() => {})
      }

      // Fire AI evaluation + summarization when ticket is finalized
      if (statusType === 'finalizado') {
        supabase.functions.invoke('evaluate-service', {
          body: { conversation_id: ticketId },
        }).then(() => {}).catch(() => {})
        supabase.functions.invoke('summarize-conversation', {
          body: { conversation_id: ticketId },
        }).then(() => {}).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Ticket movido com sucesso')
    },
    onError: () => toast.error('Erro ao mover ticket'),
  })

  const moveToBoard = useMutation({
    mutationFn: async ({ ticketId, toBoardId, fromStageId, instanceId }: { ticketId: string; toBoardId: string; fromStageId?: string | null; instanceId?: string }) => {
      // Find entry stage of destination board
      const { data: entryStages } = await (supabase as any)
        .from('kanban_stages')
        .select('id')
        .eq('board_id', toBoardId)
        .eq('is_entry', true)
        .eq('active', true)
        .limit(1)

      const entryStageId = entryStages?.[0]?.id
      if (!entryStageId) {
        // Fallback: first stage by sort_order
        const { data: fallback } = await (supabase as any)
          .from('kanban_stages')
          .select('id')
          .eq('board_id', toBoardId)
          .eq('active', true)
          .order('sort_order')
          .limit(1)
        if (!fallback?.[0]?.id) throw new Error('Board de destino não possui etapas')
        const fallbackId = fallback[0].id

        const updatePayload: Record<string, unknown> = { kanban_board_id: toBoardId, stage_id: fallbackId }
        if (instanceId) updatePayload.whatsapp_instance_id = instanceId

        const { error } = await supabase
          .from('ai_conversations')
          .update(updatePayload as any)
          .eq('id', ticketId)
        if (error) throw error

        await supabase
          .from('ticket_stage_history')
          .insert({ conversation_id: ticketId, from_stage_id: fromStageId || null, to_stage_id: fallbackId, moved_by: 'board-transfer' })
          .then(() => {})
        return
      }

      const updatePayload2: Record<string, unknown> = { kanban_board_id: toBoardId, stage_id: entryStageId }
      if (instanceId) updatePayload2.whatsapp_instance_id = instanceId

      const { error } = await supabase
        .from('ai_conversations')
        .update(updatePayload2 as any)
        .eq('id', ticketId)
      if (error) throw error

      await supabase
        .from('ticket_stage_history')
        .insert({ conversation_id: ticketId, from_stage_id: fromStageId || null, to_stage_id: entryStageId, moved_by: 'board-transfer' })
        .then(() => {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Ticket transferido para outro board')
    },
    onError: () => toast.error('Erro ao transferir para outro board'),
  })

  return { tickets, isLoading, isError, error, ticketsByStage, ticketsByStatus, moveTicket, moveToBoard }
}
