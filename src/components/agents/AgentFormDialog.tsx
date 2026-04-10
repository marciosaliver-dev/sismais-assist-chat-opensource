import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AgentBasicInfo } from './form-tabs/AgentBasicInfo'
import { AgentChannels } from './form-tabs/AgentChannels'
import { AgentBehavior } from './form-tabs/AgentBehavior'
import { AgentLLMConfig } from './form-tabs/AgentLLMConfig'
import { AgentRAGConfig } from './form-tabs/AgentRAGConfig'
import { AgentSkills } from './form-tabs/AgentSkills'
import { AgentTools } from './form-tabs/AgentTools'
import { AgentBriefing } from './form-tabs/AgentBriefing'
import { AgentPolicies } from './form-tabs/AgentPolicies'
import { AgentGuardrails } from './form-tabs/AgentGuardrails'
import { AgentQATraining } from './form-tabs/AgentQATraining'
import { AgentKnowledgeSelector } from './form-tabs/AgentKnowledgeSelector'
import { AgentCopilotPanel } from './AgentCopilotPanel'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAgents } from '@/hooks/useAgents'
import { toast } from '@/components/ui/sonner'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { Bot, Brain, Cpu, Database, Puzzle, Building2, ShieldCheck, ShieldAlert, GraduationCap, Sparkles, ChevronRight, Check, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>
type AgentInsert = TablesInsert<'ai_agents'>

interface AgentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent?: Agent | null
  isFirstAgent?: boolean
  prefilledConfig?: { formData: Partial<AgentInsert>; supportConfig: Record<string, any> } | null
}

interface TabConfig {
  id: string
  label: string
  icon: React.ElementType
  description: string
}

const TABS: TabConfig[] = [
  { id: 'profile', label: 'Perfil', icon: Bot, description: 'Nome, especialidade e canais' },
  { id: 'behavior', label: 'Comportamento', icon: Brain, description: 'Prompt, tom, saudação e escalação' },
  { id: 'model', label: 'Modelo', icon: Cpu, description: 'LLM, temperatura e tokens' },
  { id: 'rag', label: 'RAG', icon: Database, description: 'Base de conhecimento' },
  { id: 'skills', label: 'Skills', icon: Puzzle, description: 'Habilidades e ferramentas' },
  { id: 'knowledge', label: 'Conhecimento', icon: Building2, description: 'Fontes da empresa' },
  { id: 'policies', label: 'Políticas', icon: ShieldCheck, description: 'Horários, SLA e regras' },
  { id: 'guardrails', label: 'Guardrails', icon: ShieldAlert, description: 'Segurança e limites' },
  { id: 'qa', label: 'Treinamento Q&A', icon: GraduationCap, description: 'Fine-tuning com exemplos' },
]

const ALL_TAB_IDS = TABS.map(t => t.id)

const defaultSupportConfig: Record<string, any> = {
  companyName: '',
  companyDescription: '',
  productsServices: '',
  targetCustomers: '',
  style: '',
  restrictions: '',
  greeting: '',
  diagnosticQuestions: [],
  commonIssues: [],
  escalationTriggers: [],
  escalationMessage: '',
  escalationRules: '',
  supportHours: '',
  slaResponse: '',
  warrantyPolicy: '',
  refundPolicy: '',
  standardResponses: {
    outOfHours: '',
    waitingCustomer: '',
    resolved: '',
    unresolved: '',
    needMoreInfo: '',
    thankYou: '',
  },
}

function getStepStatus(tabId: string, formData: Partial<AgentInsert>, supportConfig: Record<string, any>): 'complete' | 'incomplete' {
  switch (tabId) {
    case 'profile': return formData.name && formData.specialty ? 'complete' : 'incomplete'
    case 'behavior': return formData.system_prompt ? 'complete' : 'incomplete'
    case 'model': return formData.model ? 'complete' : 'incomplete'
    case 'rag': return 'complete'
    case 'skills': return 'complete'
    case 'knowledge': return 'complete'
    case 'policies': return supportConfig.supportHours ? 'complete' : 'incomplete'
    case 'guardrails': return 'complete'
    case 'qa': return 'complete'
    default: return 'incomplete'
  }
}

function SidebarTab({ tab, isActive, status, onClick }: { tab: TabConfig; isActive: boolean; status: 'complete' | 'incomplete'; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150 group',
        isActive
          ? 'bg-primary/10 text-primary border-l-2 border-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent'
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium leading-tight truncate', isActive && 'text-primary')}>{tab.label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight truncate">{tab.description}</p>
      </div>
      {status === 'complete' && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
    </button>
  )
}

export function AgentFormDialog({ open, onOpenChange, agent, isFirstAgent, prefilledConfig }: AgentFormDialogProps) {
  const navigate = useNavigate()
  const { createAgent, updateAgent } = useAgents()
  const [activeTab, setActiveTab] = useState<string>('profile')
  const [loading, setLoading] = useState(false)
  const [showCopilot, setShowCopilot] = useState(true)

  const [formData, setFormData] = useState<Partial<AgentInsert>>({})
  const [supportConfig, setSupportConfig] = useState<Record<string, any>>(defaultSupportConfig)

  useEffect(() => {
    if (open) {
      setActiveTab('profile')

      const pf = (!agent && prefilledConfig) ? prefilledConfig.formData : null

      setFormData({
        name: pf?.name || agent?.name || '',
        description: pf?.description || agent?.description || '',
        specialty: pf?.specialty || agent?.specialty || 'support',
        color: pf?.color || agent?.color || '#45E5E5',
        provider: pf?.provider || agent?.provider || 'openrouter',
        model: pf?.model || agent?.model || 'google/gemini-flash-1.5',
        temperature: Number(pf?.temperature ?? agent?.temperature ?? 0.3),
        max_tokens: pf?.max_tokens || agent?.max_tokens || 1000,
        system_prompt: pf?.system_prompt || agent?.system_prompt || '',
        tone: pf?.tone || agent?.tone || 'professional',
        language: pf?.language || agent?.language || 'pt-BR',
        tools: (pf?.tools || agent?.tools || []) as any,
        rag_enabled: pf?.rag_enabled ?? agent?.rag_enabled ?? true,
        rag_top_k: pf?.rag_top_k || agent?.rag_top_k || 5,
        rag_similarity_threshold: Number(pf?.rag_similarity_threshold ?? agent?.rag_similarity_threshold ?? 0.75),
        knowledge_base_filter: pf?.knowledge_base_filter || agent?.knowledge_base_filter || null,
        learning_enabled: pf?.learning_enabled ?? agent?.learning_enabled ?? true,
        confidence_threshold: Number(pf?.confidence_threshold ?? agent?.confidence_threshold ?? 0.7),
        is_active: pf?.is_active ?? agent?.is_active ?? true,
        priority: pf?.priority || agent?.priority || 0,
        channel_type: (pf as any)?.channel_type || agent?.channel_type || 'whatsapp',
        whatsapp_instances: ((pf as any)?.whatsapp_instances || (agent as any)?.whatsapp_instances || []) as any,
      })

      const pfSc = (!agent && prefilledConfig) ? prefilledConfig.supportConfig : null
      const existing = (agent as any)?.support_config
      setSupportConfig(
        pfSc ? { ...defaultSupportConfig, ...pfSc }
        : existing && typeof existing === 'object' ? { ...defaultSupportConfig, ...existing }
        : { ...defaultSupportConfig }
      )

      if (prefilledConfig && !agent) {
        setFormData(prev => ({ ...prev, ...prefilledConfig.formData }))
        if (prefilledConfig.supportConfig && Object.keys(prefilledConfig.supportConfig).length > 0) {
          setSupportConfig(prev => ({ ...prev, ...prefilledConfig.supportConfig }))
        }
      }
    }
  }, [open, agent, prefilledConfig])

  // Auto-enforce channel_type for internal-only specialties
  useEffect(() => {
    if (formData.specialty === 'copilot' || formData.specialty === 'analytics') {
      if ((formData as any).channel_type !== 'internal') {
        setFormData(prev => ({ ...prev, channel_type: 'internal' as any }))
      }
    }
  }, [formData.specialty])

  const updateFormData = (updates: Partial<AgentInsert>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const updateSupportConfig = (updates: Record<string, any>) => {
    setSupportConfig((prev) => ({ ...prev, ...updates }))
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.specialty || !formData.system_prompt) {
      toast.error('Preencha os campos obrigatórios: Nome, Especialidade e Prompt')
      return
    }

    setLoading(true)
    try {
      const { _guardrails, ...cleanFormData } = formData as any
      const payload = { ...cleanFormData, support_config: supportConfig } as any
      let savedAgentId: string | undefined
      if (agent?.id) {
        await updateAgent.mutateAsync({ id: agent.id, updates: payload })
        savedAgentId = agent.id
        toast.success('Agente atualizado com sucesso!')
      } else {
        const created = await createAgent.mutateAsync(payload as AgentInsert)
        savedAgentId = (created as any)?.id
        toast.success('Agente criado com sucesso!')
      }

      if (_guardrails && savedAgentId) {
        await supabase.from('ai_guardrails').delete().eq('agent_id', savedAgentId)
        const rules = (_guardrails as any[]).filter((r: any) => r.rule_content?.trim())
        if (rules.length > 0) {
          await supabase.from('ai_guardrails').insert(
            rules.map((r: any) => ({
              agent_id: savedAgentId,
              rule_type: r.rule_type,
              rule_content: r.rule_content,
              severity: r.severity,
              is_active: true,
            }))
          )
        }
      }

      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar agente')
    } finally {
      setLoading(false)
    }
  }

  const tabIndex = ALL_TAB_IDS.indexOf(activeTab)

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return (
        <div className="space-y-6">
          <AgentBasicInfo data={formData} onChange={updateFormData} supportConfig={supportConfig} onSupportConfigChange={updateSupportConfig} />
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3">Canais WhatsApp</h3>
            <AgentChannels data={formData} onChange={updateFormData} />
          </div>
        </div>
      )
      case 'behavior': return (
        <AgentBehavior
          data={formData}
          onChange={updateFormData}
          supportConfig={supportConfig}
          onSupportConfigChange={updateSupportConfig}
        />
      )
      case 'model': return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Modelo LLM</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure o modelo de IA e parâmetros de geração</p>
            <AgentLLMConfig data={formData} onChange={updateFormData} specialty={formData.specialty} />
          </div>
        </div>
      )
      case 'rag': return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Base de Conhecimento (RAG)</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure a busca semântica na base de conhecimento</p>
            <AgentRAGConfig data={formData} onChange={updateFormData} />
          </div>
        </div>
      )
      case 'skills': return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Skills</h3>
            <p className="text-sm text-muted-foreground mb-4">Habilidades modulares que o agente pode usar</p>
            <AgentSkills agentId={agent?.id} />
          </div>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-1">Ferramentas (Tools)</h3>
            <p className="text-sm text-muted-foreground mb-4">Function calling — ações que o agente pode executar</p>
            <AgentTools data={formData} onChange={updateFormData} />
          </div>
        </div>
      )
      case 'knowledge': return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Conhecimento da Empresa</h3>
            <p className="text-sm text-muted-foreground mb-4">Fontes externas que o agente pode consultar</p>
            <AgentKnowledgeSelector agentId={agent?.id} data={formData} onChange={updateFormData} />
          </div>
        </div>
      )
      case 'policies': return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Políticas de Atendimento</h3>
            <p className="text-sm text-muted-foreground mb-4">Horários, SLA, garantias e regras de atendimento</p>
            <AgentPolicies data={supportConfig} onChange={updateSupportConfig} />
          </div>
        </div>
      )
      case 'guardrails': return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Guardrails de Segurança</h3>
            <p className="text-sm text-muted-foreground mb-4">Regras que limitam e protegem o comportamento do agente</p>
            <AgentGuardrails agentId={agent?.id} data={formData} onChange={updateFormData} />
          </div>
        </div>
      )
      case 'qa': return (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Treinamento Q&A</h3>
            <p className="text-sm text-muted-foreground mb-4">Pares de pergunta e resposta para guiar o comportamento do agente</p>
            <AgentQATraining agentId={agent?.id} />
          </div>
        </div>
      )
      default: return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Bot className="w-5 h-5 text-primary" />
              {agent ? 'Editar Agente' : 'Criar Novo Agente'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {agent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    onOpenChange(false)
                    navigate(`/ai-builder?agent_id=${agent.id}`)
                  }}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Editar com IA
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={cn('gap-1.5 text-xs', showCopilot && 'bg-primary/10 border-primary/30 text-primary')}
                onClick={() => setShowCopilot(v => !v)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Copiloto IA
              </Button>
            </div>
          </div>
          <DialogDescription>Configure o comportamento e personalidade do agente de IA</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar navigation */}
          <div className="w-[200px] border-r border-border shrink-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-0.5">
                {TABS.map(tab => (
                  <SidebarTab
                    key={tab.id}
                    tab={tab}
                    isActive={activeTab === tab.id}
                    status={getStepStatus(tab.id, formData, supportConfig)}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-6">
                {renderTabContent()}
              </div>
            </ScrollArea>
          </div>

          {/* Copilot panel */}
          {showCopilot && (
            <AgentCopilotPanel
              agent={agent}
              formData={formData}
              supportConfig={supportConfig}
              onChange={updateFormData}
              onSupportConfigChange={updateSupportConfig}
              onClose={() => setShowCopilot(false)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-3 border-t border-border shrink-0 bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <div className="flex gap-2">
            {tabIndex > 0 && (
              <Button variant="outline" size="sm" onClick={() => setActiveTab(ALL_TAB_IDS[tabIndex - 1])}>
                Anterior
              </Button>
            )}
            {tabIndex < ALL_TAB_IDS.length - 1 && (
              <Button variant="outline" size="sm" onClick={() => setActiveTab(ALL_TAB_IDS[tabIndex + 1])}>
                Próximo
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : agent ? 'Atualizar Agente' : 'Criar Agente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
