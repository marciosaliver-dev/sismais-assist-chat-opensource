import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface AgentConfig {
  name: string
  specialty: string
  description: string
  tone: string
  language: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  confidence_threshold: number
  rag_enabled: boolean
  rag_top_k: number
  rag_similarity_threshold: number
  knowledge_base_filter: { products?: string[]; categories?: string[]; tags?: string[] }
  skills: string[]
  tools: string[]
  whatsapp_instances: string[]
  color: string
  priority: number
  is_active: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const DEFAULT_CONFIG: AgentConfig = {
  name: '',
  specialty: 'support',
  description: '',
  tone: 'empathetic',
  language: 'pt-BR',
  system_prompt: '',
  model: 'google/gemini-3.1-flash-lite-preview',
  temperature: 0.3,
  max_tokens: 1200,
  confidence_threshold: 0.70,
  rag_enabled: true,
  rag_top_k: 5,
  rag_similarity_threshold: 0.75,
  knowledge_base_filter: {},
  skills: [],
  tools: [],
  whatsapp_instances: [],
  color: '#45E5E5',
  priority: 50,
  is_active: true,
}

export function useAgentBuilder(agentId?: string) {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const { data: builderContext } = useQuery({
    queryKey: ['agent-builder-context'],
    queryFn: async () => {
      const [skillsRes, toolsRes, productsRes, instancesRes] = await Promise.all([
        supabase.from('ai_agent_skills').select('id, name, description, category').eq('is_active', true),
        supabase.from('ai_agent_tools').select('id, name, display_name, description').eq('is_active', true),
        supabase.from('knowledge_products').select('id, name, slug').eq('is_active', true),
        (supabase as any).from('uazapi_instances_public').select('id, instance_name, phone_number').eq('is_active', true),
      ])
      return {
        available_skills: skillsRes.data || [],
        available_tools: toolsRes.data || [],
        available_products: productsRes.data || [],
        available_instances: instancesRes.data || [],
      }
    },
  })

  useQuery({
    queryKey: ['agent-builder-load', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId!)
        .single()
      if (agent) {
        setConfig({
          name: agent.name || '',
          specialty: agent.specialty || 'support',
          description: agent.description || '',
          tone: (agent as any).tone || 'empathetic',
          language: (agent as any).language || 'pt-BR',
          system_prompt: agent.system_prompt || '',
          model: agent.model || 'google/gemini-3.1-flash-lite-preview',
          temperature: Number(agent.temperature) || 0.3,
          max_tokens: agent.max_tokens || 1200,
          confidence_threshold: Number(agent.confidence_threshold) || 0.70,
          rag_enabled: agent.rag_enabled ?? true,
          rag_top_k: agent.rag_top_k || 5,
          rag_similarity_threshold: Number(agent.rag_similarity_threshold) || 0.75,
          knowledge_base_filter: (agent.knowledge_base_filter as any) || {},
          skills: [],
          tools: [],
          whatsapp_instances: (agent as any).whatsapp_instances || [],
          color: (agent as any).color || '#45E5E5',
          priority: agent.priority || 50,
          is_active: agent.is_active ?? true,
        })
        setChatMessages([{
          id: 'loaded',
          role: 'assistant',
          content: `Agente **${agent.name}** carregado para edição. O que você gostaria de ajustar?`,
          timestamp: new Date(),
        }])
      }
      return agent
    },
  })

  const sendMessage = useCallback(async (userMessage: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMsg])
    setIsGenerating(true)

    try {
      const isFirstMessage = chatMessages.length === 0 || (chatMessages.length === 1 && chatMessages[0].id === 'welcome')
      const action = isFirstMessage && !agentId ? 'generate' : 'adjust'

      const { data, error } = await supabase.functions.invoke('agent-builder-ai', {
        body: {
          action,
          description: action === 'generate' ? userMessage : undefined,
          instruction: action === 'adjust' ? userMessage : undefined,
          current_config: action === 'adjust' ? config : undefined,
          context: builderContext,
        }
      })

      if (error) throw new Error(error.message)

      if (action === 'generate' && data?.config) {
        setConfig(prev => ({ ...prev, ...data.config }))
      } else if (action === 'adjust' && data?.changes) {
        setConfig(prev => ({ ...prev, ...data.changes }))
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.explanation || 'Configuração atualizada.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, assistantMsg])

      if (data?.suggestions?.length > 0) {
        const sugMsg: ChatMessage = {
          id: `suggestion-${Date.now()}`,
          role: 'assistant',
          content: `**Sugestões:**\n${data.suggestions.map((s: string) => `- ${s}`).join('\n')}`,
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, sugMsg])
      }
    } catch (err) {
      toast.error('Erro ao processar: ' + (err as Error).message)
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Desculpe, tive um problema ao processar. Pode tentar de novo?',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMsg])
    } finally {
      setIsGenerating(false)
    }
  }, [chatMessages, config, builderContext, agentId])

  const askExplanation = useCallback(async (question: string) => {
    setIsGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('agent-builder-ai', {
        body: { action: 'explain', question, context: builderContext }
      })
      if (error) throw new Error(error.message)

      const msg: ChatMessage = {
        id: `explain-${Date.now()}`,
        role: 'assistant',
        content: data?.explanation || 'Sem explicação disponível.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, msg])
    } catch (err) {
      toast.error('Erro: ' + (err as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }, [builderContext])

  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const toggleSkill = useCallback((skillId: string) => {
    setConfig(prev => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter(id => id !== skillId)
        : [...prev.skills, skillId],
    }))
  }, [])

  const toggleTool = useCallback((toolId: string) => {
    setConfig(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(id => id !== toolId)
        : [...prev.tools, toolId],
    }))
  }, [])

  const toggleInstance = useCallback((instanceId: string) => {
    setConfig(prev => ({
      ...prev,
      whatsapp_instances: prev.whatsapp_instances.includes(instanceId)
        ? prev.whatsapp_instances.filter(id => id !== instanceId)
        : [...prev.whatsapp_instances, instanceId],
    }))
  }, [])

  const saveAgent = useMutation({
    mutationFn: async () => {
      const payload = {
        name: config.name,
        specialty: config.specialty,
        description: config.description,
        system_prompt: config.system_prompt,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        confidence_threshold: config.confidence_threshold,
        rag_enabled: config.rag_enabled,
        rag_top_k: config.rag_top_k,
        rag_similarity_threshold: config.rag_similarity_threshold,
        knowledge_base_filter: config.knowledge_base_filter,
        whatsapp_instances: config.whatsapp_instances,
        color: config.color,
        priority: config.priority,
        is_active: config.is_active,
        channel_type: 'whatsapp',
        tone: config.tone,
        language: config.language,
      }

      if (agentId) {
        const { error } = await supabase.from('ai_agents').update(payload).eq('id', agentId)
        if (error) throw error
        return agentId
      } else {
        const { data, error } = await supabase.from('ai_agents').insert(payload).select('id').single()
        if (error) throw error
        return data.id
      }
    },
    onSuccess: () => {
      toast.success(agentId ? 'Agente atualizado!' : 'Agente criado e publicado!')
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + err.message)
    },
  })

  return {
    config,
    chatMessages,
    isGenerating,
    isTesting,
    setIsTesting,
    builderContext,
    sendMessage,
    askExplanation,
    updateConfig,
    toggleSkill,
    toggleTool,
    toggleInstance,
    saveAgent,
    setChatMessages,
  }
}
