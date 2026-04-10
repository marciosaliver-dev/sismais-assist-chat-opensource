import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface ConversationMemory {
  id: string
  conversation_id: string
  agent_id: string | null
  memory_type: string
  content: string
  importance_score: number
  metadata: Record<string, any>
  created_at: string
}

export interface CustomerMemory {
  id: string
  client_id: string
  memory_type: string
  content: string
  source: string | null
  confidence_score: number
  verified: boolean
  created_at: string
}

export function useConversationMemory(conversationId: string, options?: {
  memoryTypes?: string[]
  minImportance?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['conversation-memory', conversationId, options],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conversation_memory', {
        p_conversation_id: conversationId,
        p_memory_types: options?.memoryTypes ?? null,
        p_min_importance: options?.minImportance ?? 0,
        p_limit: options?.limit ?? 50,
      })
      if (error) throw error
      return data as ConversationMemory[]
    },
    enabled: !!conversationId,
  })
}

export function useStoreConversationMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      conversation_id: string
      agent_id?: string
      memory_type: string
      content: string
      importance_score?: number
      metadata?: Record<string, any>
      expires_at?: string
    }) => {
      const { data, error } = await supabase.rpc('store_conversation_memory', {
        p_conversation_id: params.conversation_id,
        p_agent_id: params.agent_id ?? null,
        p_memory_type: params.memory_type,
        p_content: params.content,
        p_importance_score: params.importance_score ?? 0.5,
        p_metadata: params.metadata ?? {},
        p_expires_at: params.expires_at ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-memory', variables.conversation_id] })
    },
  })
}

export function useConversationSummary(conversationId: string) {
  return useQuery({
    queryKey: ['conversation-summary', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('generate_conversation_summary', {
        p_conversation_id: conversationId,
      })
      if (error) throw error
      return data as string
    },
    enabled: !!conversationId,
  })
}

export function useCustomerMemory(clientId: string, options?: {
  memoryTypes?: string[]
  minConfidence?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['customer-memory', clientId, options],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customer_memory', {
        p_client_id: clientId,
        p_memory_types: options?.memoryTypes ?? null,
        p_min_confidence: options?.minConfidence ?? 0,
        p_limit: options?.limit ?? 20,
      })
      if (error) throw error
      return data as CustomerMemory[]
    },
    enabled: !!clientId,
  })
}

export function useStoreCustomerMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      client_id: string
      memory_type: string
      content: string
      source?: string
      confidence_score?: number
      metadata?: Record<string, any>
    }) => {
      const { data, error } = await supabase.rpc('store_customer_memory', {
        p_client_id: params.client_id,
        p_memory_type: params.memory_type,
        p_content: params.content,
        p_source: params.source ?? null,
        p_confidence_score: params.confidence_score ?? 0.5,
        p_metadata: params.metadata ?? {},
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-memory', variables.client_id] })
    },
  })
}

export function useSessionContext(sessionId: string) {
  return useQuery({
    queryKey: ['session-context', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_session_context')
        .select('*')
        .eq('session_id', sessionId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!sessionId,
  })
}

export function useUpdateSessionContext() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      session_id: string
      conversation_id?: string
      agent_id?: string
      context_data?: Record<string, any>
      intent?: string
      sentiment?: string
    }) => {
      const { data, error } = await supabase.rpc('update_session_context', {
        p_session_id: params.session_id,
        p_conversation_id: params.conversation_id ?? null,
        p_agent_id: params.agent_id ?? null,
        p_context_data: params.context_data ?? null,
        p_intent: params.intent ?? null,
        p_sentiment: params.sentiment ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session-context', variables.session_id] })
    },
  })
}

export function useConversationContext(conversationId: string) {
  return useQuery({
    queryKey: ['conversation-context', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversation_context')
        .select('*')
        .eq('conversation_id', conversationId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!conversationId,
  })
}
