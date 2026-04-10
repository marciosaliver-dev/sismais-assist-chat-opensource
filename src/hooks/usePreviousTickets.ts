import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'

type Message = Tables<'ai_messages'> & {
  ai_agents?: { name: string; color: string; specialty: string } | null
}

interface PreviousTicket {
  id: string
  ticket_number: number
  started_at: string | null
  status: string | null
  resolved_at: string | null
  conversation_summary: string | null
}

interface PreviousTicketWithMessages {
  ticket: PreviousTicket
  messages: Message[]
}

export function usePreviousTickets(
  conversationId: string | undefined,
  uazapiChatId: string | null | undefined,
  customerPhone: string | undefined
) {
  return useQuery({
    queryKey: ['previous-tickets', conversationId, uazapiChatId, customerPhone],
    queryFn: async (): Promise<PreviousTicketWithMessages[]> => {
      if (!conversationId) return []

      // Find all tickets for the same contact
      let query = supabase
        .from('ai_conversations')
        .select('id, ticket_number, started_at, status, resolved_at, conversation_summary')
        .neq('id', conversationId)
        .order('started_at', { ascending: true })
        .limit(10)

      // Buscar por uazapi_chat_id OR customer_phone para encontrar conversas
      // mesmo quando o ID do WhatsApp mudou (ex: LID vs JID)
      const orFilters: string[] = []
      if (uazapiChatId) orFilters.push(`uazapi_chat_id.eq.${uazapiChatId}`)
      if (customerPhone) orFilters.push(`customer_phone.eq.${customerPhone}`)
      if (orFilters.length === 0) return []
      query = query.or(orFilters.join(','))

      const { data: tickets, error } = await query
      if (error || !tickets?.length) return []

      // Fetch messages for all previous tickets in one query
      const ticketIds = tickets.map(t => t.id)
      const { data: allMessages } = await supabase
        .from('ai_messages')
        .select('*, ai_agents(name, color, specialty)')
        .in('conversation_id', ticketIds)
        .order('created_at', { ascending: true })
        .limit(500)

      const messagesByConv = new Map<string, Message[]>()
      for (const msg of (allMessages || []) as Message[]) {
        if (!msg.conversation_id) continue
        if (!messagesByConv.has(msg.conversation_id)) messagesByConv.set(msg.conversation_id, [])
        messagesByConv.get(msg.conversation_id)!.push(msg)
      }

      return tickets.map(ticket => ({
        ticket,
        messages: messagesByConv.get(ticket.id) || [],
      }))
    },
    enabled: !!conversationId && !!(uazapiChatId || customerPhone),
    staleTime: 60000,
  })
}
