import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

export type BuilderMode = 'agent' | 'skill'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type BuilderPhase = {
  current: number
  label: string
  total: number
}

export type BuilderState = 'idle' | 'chatting' | 'loading' | 'preview'

export function useAIBuilder(mode: BuilderMode) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [state, setState] = useState<BuilderState>('idle')
  const [phase, setPhase] = useState<BuilderPhase>({ current: 0, label: '', total: mode === 'agent' ? 4 : 3 })
  const [partialConfig, setPartialConfig] = useState<Record<string, any>>({})
  const [finalConfig, setFinalConfig] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrainAgentId, setRetrainAgentId] = useState<string | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }

    setMessages(prev => [...prev, userMsg])
    setState('loading')
    setError(null)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-builder', {
        body: {
          mode,
          messages: history,
          ...(retrainAgentId ? { retrain: true, existing_config: partialConfig } : {}),
        },
      })

      if (fnError) throw fnError

      if (data.type === 'error') {
        setError(data.message)
        setState('chatting')
        return
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
      }
      setMessages(prev => [...prev, aiMsg])

      if (data.type === 'config') {
        setFinalConfig(data.config)
        setPartialConfig(data.config)
        setState('preview')
      } else {
        // type === 'question'
        if (data.phase) {
          setPhase({ current: data.phase, label: data.phase_label || '', total: phase.total })
        }
        if (data.partial_config) {
          setPartialConfig(prev => ({ ...prev, ...data.partial_config }))
        }
        setState('chatting')
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao comunicar com a IA')
      setState('chatting')
    }
  }, [messages, mode, phase.total, retrainAgentId, partialConfig])

  const reset = useCallback(() => {
    setMessages([])
    setState('idle')
    setPhase({ current: 0, label: '', total: mode === 'agent' ? 4 : 3 })
    setPartialConfig({})
    setFinalConfig(null)
    setError(null)
  }, [mode])

  const startFromTemplate = useCallback((description: string) => {
    sendMessage(description)
  }, [sendMessage])

  // Inicializar modo retrain com agente existente
  const initFromAgent = useCallback((agent: Record<string, any>) => {
    setRetrainAgentId(agent.id)
    setPartialConfig({
      name: agent.name,
      description: agent.description,
      specialty: agent.specialty,
      system_prompt: agent.system_prompt,
      tone: agent.tone,
      language: agent.language,
      color: agent.color,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      rag_enabled: agent.rag_enabled,
      confidence_threshold: agent.confidence_threshold,
      priority: agent.priority,
      support_config: agent.support_config || {},
      prompt_methods: agent.prompt_methods || [],
    })

    const welcomeMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Olá! Estou aqui para ajudar a melhorar o agente **${agent.name}** (${agent.specialty}).\n\nO que gostaria de ajustar? Por exemplo:\n- Comportamento de saudação\n- Tom de voz\n- Regras de escalação\n- Respostas padrão\n- Prompt do sistema\n- Qualquer outro aspecto`,
    }
    setMessages([welcomeMsg])
    setState('chatting')
    setPhase({ current: 1, label: 'Retreinamento', total: 2 })
  }, [])

  return {
    messages,
    state,
    phase,
    partialConfig,
    finalConfig,
    error,
    retrainAgentId,
    sendMessage,
    reset,
    startFromTemplate,
    initFromAgent,
  }
}
