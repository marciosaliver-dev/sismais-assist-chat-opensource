import { useState, useCallback, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>

export interface Persona {
  id: string
  name: string
  problem: string
  sentiment: 'neutral' | 'angry' | 'negative' | 'positive'
  isVip: boolean
}

export interface PlaygroundMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    latency_ms: number
    confidence: number
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cost_usd: number
    rag_sources: Array<{ title: string; similarity: number }>
    tools_used: string[]
    model_used: string
    decision_path: Array<{ step: string; detail: string }>
  }
}

export interface SessionMetrics {
  totalMessages: number
  totalTokens: number
  totalCost: number
  avgLatency: number
  avgConfidence: number
  ragHits: number
}

export const PERSONAS: Persona[] = [
  { id: 'neutral', name: 'Maria Silva', problem: 'Dúvida sobre funcionalidade', sentiment: 'neutral', isVip: false },
  { id: 'angry', name: 'Carlos Souza', problem: 'Serviço fora do ar há 2 dias', sentiment: 'angry', isVip: false },
  { id: 'negative', name: 'Ana Costa', problem: 'Cobrança indevida no cartão', sentiment: 'negative', isVip: false },
  { id: 'vip', name: 'Roberto Lima', problem: 'Preciso de atenção especial', sentiment: 'positive', isVip: true },
]

export function usePlaygroundSession(agent: Agent | null) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>([])
  const [sending, setSending] = useState(false)
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0])

  const metrics = useMemo<SessionMetrics>(() => {
    const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.metadata)
    const totalMessages = messages.length
    const totalTokens = assistantMsgs.reduce((s, m) => s + (m.metadata?.total_tokens || 0), 0)
    const totalCost = assistantMsgs.reduce((s, m) => s + (m.metadata?.cost_usd || 0), 0)
    const avgLatency = assistantMsgs.length > 0
      ? assistantMsgs.reduce((s, m) => s + (m.metadata?.latency_ms || 0), 0) / assistantMsgs.length
      : 0
    const avgConfidence = assistantMsgs.length > 0
      ? assistantMsgs.reduce((s, m) => s + (m.metadata?.confidence || 0), 0) / assistantMsgs.length
      : 0
    const ragHits = assistantMsgs.reduce((s, m) => s + (m.metadata?.rag_sources?.length || 0), 0)
    return { totalMessages, totalTokens, totalCost, avgLatency, avgConfidence, ragHits }
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (!agent || sending) return

    const userMsg: PlaygroundMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    const startTime = Date.now()

    try {
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }))

      const { data, error } = await supabase.functions.invoke('agent-executor', {
        body: {
          mode: 'playground',
          agent_id: agent.id,
          message_content: content,
          conversation_history: conversationHistory,
          persona: activePersona,
        },
      })

      if (error) throw error

      const latency = data?.latency_ms || (Date.now() - startTime)

      const assistantMsg: PlaygroundMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.message || 'Sem resposta do agente.',
        timestamp: new Date().toISOString(),
        metadata: {
          latency_ms: latency,
          confidence: data?.confidence || 0,
          prompt_tokens: data?.usage?.prompt_tokens || 0,
          completion_tokens: data?.usage?.completion_tokens || 0,
          total_tokens: data?.usage?.total_tokens || 0,
          cost_usd: data?.usage?.cost_usd || data?.cost_usd || 0,
          rag_sources: data?.rag_sources || [],
          tools_used: data?.tools_used || [],
          model_used: data?.model_used || agent.model || 'unknown',
          decision_path: data?.decision_path || [],
        },
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: any) {
      const errorMsg: PlaygroundMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Erro: ${err.message || 'Falha ao invocar o agente'}`,
        timestamp: new Date().toISOString(),
        metadata: {
          latency_ms: Date.now() - startTime,
          confidence: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
          rag_sources: [],
          tools_used: [],
          model_used: agent.model || 'unknown',
          decision_path: [],
        },
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setSending(false)
    }
  }, [agent, sending, messages, activePersona])

  const resetSession = useCallback(() => {
    setMessages([])
  }, [])

  const exportLog = useCallback(() => {
    if (!agent) return
    const log = {
      exported_at: new Date().toISOString(),
      agent: {
        id: agent.id,
        name: agent.name,
        model: agent.model,
        specialty: agent.specialty,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
      },
      persona: { name: activePersona.name, problem: activePersona.problem, sentiment: activePersona.sentiment },
      session: {
        total_messages: metrics.totalMessages,
        total_tokens: metrics.totalTokens,
        total_cost: metrics.totalCost,
        avg_latency: metrics.avgLatency,
        avg_confidence: metrics.avgConfidence,
      },
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata || null,
      })),
    }
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `playground-${agent.name.replace(/\s+/g, '-')}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [agent, activePersona, messages, metrics])

  return {
    messages,
    sending,
    metrics,
    activePersona,
    setActivePersona,
    sendMessage,
    resetSession,
    exportLog,
  }
}
