import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Wand2, Bot, Zap, LayoutGrid, PanelLeft, PanelRight } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAIBuilder, type BuilderMode } from '@/hooks/useAIBuilder'
import { useAgents } from '@/hooks/useAgents'
import { useAgentSkills } from '@/hooks/useAgentSkills'
import { BuilderChat } from '@/components/ai-builder/BuilderChat'
import { BuilderPreview } from '@/components/ai-builder/BuilderPreview'
import { TemplatesGrid } from '@/components/ai-builder/TemplatesGrid'
import type { TablesInsert } from '@/integrations/supabase/types'

type AgentInsert = TablesInsert<'ai_agents'>

export default function AIBuilder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const retrainId = searchParams.get('agent_id')
  const [tab, setTab] = useState<string>('agent')
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'preview'>('chat')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])

  const mode: BuilderMode = tab === 'skill' ? 'skill' : 'agent'
  const builder = useAIBuilder(mode)
  const { createAgent, updateAgent } = useAgents()

  // Carregar agente existente para modo retrain
  const { data: retrainAgent } = useQuery({
    queryKey: ['agent-retrain', retrainId],
    queryFn: async () => {
      if (!retrainId) return null
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', retrainId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!retrainId,
  })

  // Inicializar builder com agente existente
  useEffect(() => {
    if (retrainAgent && builder.state === 'idle') {
      builder.initFromAgent(retrainAgent as any)
      if (retrainAgent.prompt_methods) {
        setSelectedMethods(retrainAgent.prompt_methods as string[])
      }
    }
  }, [retrainAgent, builder.state])
  const { createSkill } = useAgentSkills()

  const handleTabChange = (value: string) => {
    setTab(value)
    builder.reset()
    setSelectedMethods([])
  }

  const handleCreateAgent = useCallback(async () => {
    if (!builder.finalConfig) return
    setIsCreating(true)
    try {
      const c = builder.finalConfig
      const sc = c.support_config || {}
      const payload: any = {
        name: c.name,
        description: c.description || null,
        specialty: c.specialty || 'support',
        system_prompt: c.system_prompt,
        tone: c.tone || 'professional',
        language: c.language || 'pt-BR',
        color: c.color || '#45E5E5',
        temperature: c.temperature ?? 0.3,
        max_tokens: c.max_tokens || 1000,
        rag_enabled: c.rag_enabled ?? true,
        rag_top_k: c.rag_top_k || 5,
        rag_similarity_threshold: c.rag_similarity_threshold ?? 0.75,
        confidence_threshold: c.confidence_threshold ?? 0.7,
        priority: c.priority || 50,
        provider: 'openrouter',
        model: 'google/gemini-3.1-flash-lite-preview',
        learning_enabled: true,
        is_active: true,
        support_config: sc,
        prompt_methods: selectedMethods,
      }

      if (builder.retrainAgentId) {
        // Modo retrain: atualizar agente existente
        await updateAgent.mutateAsync({ id: builder.retrainAgentId, updates: payload })
        toast.success(`${c.name} atualizado com sucesso!`)
      } else {
        // Modo criação: criar novo agente
        await createAgent.mutateAsync(payload as AgentInsert)
        toast.success(`${c.name} criado com sucesso!`)
      }
      navigate('/agents')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar agente')
    } finally {
      setIsCreating(false)
    }
  }, [builder.finalConfig, builder.retrainAgentId, createAgent, updateAgent, navigate, selectedMethods])

  const handleCreateSkill = useCallback(async () => {
    if (!builder.finalConfig) return
    setIsCreating(true)
    try {
      const c = builder.finalConfig
      await createSkill.mutateAsync({
        name: c.name,
        slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: c.description || null,
        icon: c.icon || null,
        color: c.color || null,
        category: c.category || 'general',
        prompt_instructions: c.prompt_instructions || null,
        trigger_keywords: c.trigger_keywords || [],
        trigger_intents: c.trigger_intents || [],
        auto_activate: c.auto_activate ?? false,
      })
      toast.success(`Skill "${c.name}" criada com sucesso!`)
      navigate('/agents')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar skill')
    } finally {
      setIsCreating(false)
    }
  }, [builder.finalConfig, createSkill, navigate])

  const handleOpenEditor = () => {
    if (builder.finalConfig) {
      sessionStorage.setItem('ai-builder-prefill', JSON.stringify(builder.finalConfig))
      navigate('/agents?openEditor=true')
    }
  }

  const handleTemplateSelect = (description: string) => {
    setTab('agent')
    builder.startFromTemplate(description)
  }

  // Auto-set methods from partial config
  if (builder.partialConfig.prompt_methods && selectedMethods.length === 0) {
    setSelectedMethods(builder.partialConfig.prompt_methods)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#45E5E5]/20 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-[#10293F]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {retrainId ? 'Editar Agente com IA' : 'AI Builder'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {retrainId
                ? `Editando: ${retrainAgent?.name || '...'} — descreva as mudanças que deseja`
                : 'Crie agentes e skills profissionais com inteligência artificial'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="agent" className="gap-1.5"><Bot className="w-3.5 h-3.5" /> Criar Agente</TabsTrigger>
              <TabsTrigger value="skill" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> Criar Skill</TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> Templates</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Mobile toggle */}
          <div className="flex lg:hidden gap-1">
            <Button variant={mobilePanel === 'chat' ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
              onClick={() => setMobilePanel('chat')}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <Button variant={mobilePanel === 'preview' ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
              onClick={() => setMobilePanel('preview')}>
              <PanelRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === 'templates' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <TemplatesGrid onSelectTemplate={handleTemplateSelect} />
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Chat panel */}
          <div className={`${mobilePanel === 'chat' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[55%] border-r border-border`}>
            <BuilderChat
              messages={builder.messages}
              phase={builder.phase}
              mode={mode}
              state={builder.state}
              error={builder.error}
              onSendMessage={builder.sendMessage}
            />
          </div>

          {/* Preview panel */}
          <div className={`${mobilePanel === 'preview' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[45%]`}>
            <BuilderPreview
              mode={mode}
              partialConfig={builder.partialConfig}
              finalConfig={builder.finalConfig}
              state={builder.state}
              methods={selectedMethods}
              onMethodsChange={setSelectedMethods}
              onCreateAgent={handleCreateAgent}
              onCreateSkill={handleCreateSkill}
              onOpenEditor={handleOpenEditor}
              isCreating={isCreating}
              isRetrain={!!retrainId}
            />
          </div>
        </div>
      )}
    </div>
  )
}
