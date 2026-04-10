import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  changes?: AgentChange[]
  timestamp: Date
}

interface AgentChange {
  field: string
  label: string
  before: string
  after: string
}

export function useAgentAssistant(agentData: Record<string, any>, supportConfig: Record<string, any>) {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<AgentChange[]>([])

  const sendMessage = useCallback(async (userMessage: string) => {
    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('agent-assistant', {
        body: {
          message: userMessage,
          agent_config: agentData,
          support_config: supportConfig,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
        },
      })

      if (error) throw error

      const assistantMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        changes: data.changes || [],
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
      if (data.changes?.length) {
        setPendingChanges(data.changes)
      }
    } catch (err) {
      console.error('Agent assistant error:', err)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Desculpe, tive um problema ao analisar. Tente novamente.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [agentData, supportConfig, messages])

  const analyzeAgent = useCallback(async () => {
    await sendMessage('Analise este agente e sugira melhorias.')
  }, [sendMessage])

  const clearChanges = useCallback(() => {
    setPendingChanges([])
  }, [])

  return { messages, isLoading, pendingChanges, sendMessage, analyzeAgent, clearChanges }
}
