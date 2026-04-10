import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wand2, Bot, Loader2, GitBranch, Users, BarChart3, HeadphonesIcon, Palette,
  Shield, Megaphone, TrendingUp, Workflow, ChevronDown, ChevronUp, X, LayoutTemplate,
} from 'lucide-react'
import { useAgents } from '@/hooks/useAgents'
import { useAgentMetrics } from '@/hooks/useAgentMetrics'
import { AgentCard } from '@/components/agent-hub/AgentCard'
import { AgentAnalytics } from '@/components/agent-hub/AgentAnalytics'
import { TemplateSelector } from '@/components/agent-hub/TemplateSelector'
import { AgentFormDialog } from '@/components/agents/AgentFormDialog'
import { AgentFlowPipeline } from '@/components/agents/AgentFlowPipeline'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>

// Map specialty -> role tab
const SPECIALTY_ROLE: Record<string, string> = {
  triage: 'triagem',
  support: 'atendimento',
  financial: 'atendimento',
  sales: 'atendimento',
  sdr: 'atendimento',
  analysis: 'analitico',
  analyst: 'analitico',
  analytics: 'analitico',
  copilot: 'copiloto',
  customer_success: 'sucesso',
  onboarding: 'sucesso',
  retention: 'sucesso',
  feedback: 'sucesso',
  upsell: 'receita',
  revenue: 'receita',
  qa: 'interno',
  knowledge_manager: 'interno',
  scheduler: 'atendimento',
  proactive: 'proativo',
  ux_designer: 'design',
  ui_designer: 'design',
  design_system: 'design',
  frontend_qa: 'design',
}

const ROLES = [
  { id: 'todos', label: 'Todos', icon: Bot, color: 'text-foreground' },
  { id: 'atendimento', label: 'Atendimento', icon: HeadphonesIcon, color: 'text-[#2563EB]', description: 'Respondem diretamente ao cliente via WhatsApp' },
  { id: 'triagem', label: 'Triagem', icon: GitBranch, color: 'text-[#7C3AED]', description: 'Roteiam para o agente certo' },
  { id: 'sucesso', label: 'Customer Success', icon: Shield, color: 'text-[#16A34A]', description: 'Onboarding, retencao, NPS e sucesso do cliente' },
  { id: 'receita', label: 'Receita', icon: TrendingUp, color: 'text-[#FFB800]', description: 'Upsell, cross-sell e inteligencia de receita' },
  { id: 'proativo', label: 'Proativo', icon: Megaphone, color: 'text-[#DC2626]', description: 'Iniciam contato com clientes (campanhas, reengajamento)' },
  { id: 'copiloto', label: 'Copiloto', icon: Users, color: 'text-[#45E5E5]', description: 'Auxiliam agentes humanos em tempo real' },
  { id: 'analitico', label: 'Analitico', icon: BarChart3, color: 'text-[#10293F]', description: 'Geram metricas, relatorios e insights' },
  { id: 'interno', label: 'Interno', icon: Palette, color: 'text-[#666666]', description: 'Funcionam dentro do app (QA, gestao de conhecimento)' },
]

export default function Agents() {
  const navigate = useNavigate()
  const { agents, isLoading, deleteAgent, updateAgent } = useAgents()
  const { data: agentMetrics = [] } = useAgentMetrics()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [activeRole, setActiveRole] = useState('todos')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [prefilledConfig, setPrefilledConfig] = useState<{ formData: Partial<TablesInsert<'ai_agents'>>; supportConfig: Record<string, any> } | null>(null)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  const handleEdit = (agent: Agent) => { setSelectedAgent(agent); setPrefilledConfig(null); setDialogOpen(true) }

  const handleDelete = (id: string) => { setDeleteId(id) }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteAgent.mutateAsync(deleteId)
      toast.success('Agente excluído com sucesso!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir agente')
    } finally {
      setDeleteId(null)
    }
  }

  const handleTest = (agent: Agent) => navigate(`/agents/playground/${agent.id}`)
  const handleRetrain = (agent: Agent) => navigate(`/ai-builder?agent_id=${agent.id}`)

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await updateAgent.mutateAsync({ id, updates: { is_active: active } })
      toast.success(active ? 'Agente ativado' : 'Agente desativado')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar agente')
    }
  }

  // Merge agent data with metrics
  const agentsWithMetrics = agents.map(agent => {
    const metrics = agentMetrics.find(m => m.agent_id === agent.id)
    return { ...agent, ...(metrics || {}) }
  })

  // Filter by role tab
  const filteredAgents = activeRole === 'todos'
    ? agentsWithMetrics
    : agentsWithMetrics.filter(a => (SPECIALTY_ROLE[a.specialty] || 'atendimento') === activeRole)

  // Count per role
  const roleCounts = ROLES.reduce((acc, role) => {
    acc[role.id] = role.id === 'todos'
      ? agents.length
      : agents.filter(a => (SPECIALTY_ROLE[a.specialty] || 'atendimento') === role.id).length
    return acc
  }, {} as Record<string, number>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Agentes de IA</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {agents.filter(a => a.is_active).length} ativos · Orquestrador distribui automaticamente
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPipelineOpen(v => !v)}
              className="gap-2 text-xs"
            >
              <Workflow className="w-3.5 h-3.5" />
              Pipeline
              {pipelineOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplateOpen(true)}
              className="gap-2 text-xs"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              Usar Template
            </Button>
            <Button onClick={() => navigate('/ai-builder')} className="gap-2">
              <Wand2 className="w-4 h-4" />
              Novo Agente
            </Button>
          </div>
        </div>

        {/* Orchestrator pipeline - Collapsible */}
        {pipelineOpen && (
          <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-[#10293F]/5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0">
                  <Workflow className="w-3.5 h-3.5 text-[#10293F]" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-[#10293F]">Pipeline de Atendimento IA</h2>
                  <p className="text-[10px] text-muted-foreground">Fluxo de roteamento de mensagens entre agentes</p>
                </div>
              </div>
              <button
                onClick={() => setPipelineOpen(false)}
                className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Fechar pipeline"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AgentFlowPipeline
              agents={agents}
              agentMetrics={agentMetrics.map(m => ({ id: m.agent_id, conversations: m.conversations_today || 0, successRate: m.resolution_rate || 0 }))}
              onEdit={handleEdit}
              onTest={handleTest}
            />
          </div>
        )}

        {/* Main tabs: Agents / Performance */}
        <Tabs defaultValue="agents" className="space-y-0">
          <TabsList className="h-9 bg-muted/50">
            <TabsTrigger value="agents" className="text-sm gap-2">
              <Bot className="w-4 h-4" />
              Agentes
              {agents.length > 0 && (
                <span className="text-[10px] font-semibold bg-[#45E5E5]/20 text-[#10293F] px-1.5 py-0 rounded-full">
                  {agents.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-sm gap-2">
              <BarChart3 className="w-4 h-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          {/* ── Agents tab ─────────────────────────────── */}
          <TabsContent value="agents" className="mt-4 space-y-4">
            {/* Role filter tabs */}
            <div>
              <div className="flex items-center gap-1 border-b border-border overflow-x-auto pb-0 -mx-1 px-1">
                {ROLES.map(role => {
                  const Icon = role.icon
                  const count = roleCounts[role.id]
                  return (
                    <button
                      key={role.id}
                      onClick={() => setActiveRole(role.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all rounded-t-md',
                        activeRole === role.id
                          ? 'border-[#45E5E5] text-foreground bg-[#45E5E5]/5'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', activeRole === role.id ? role.color : '')} />
                      {role.label}
                      {count > 0 && (
                        <span className={cn(
                          'text-[10px] font-semibold min-w-[18px] h-[18px] rounded-full inline-flex items-center justify-center px-1',
                          activeRole === role.id
                            ? 'bg-[#45E5E5]/20 text-[#10293F]'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {activeRole !== 'todos' && (
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  {ROLES.find(r => r.id === activeRole)?.description}
                </p>
              )}
            </div>

            {/* Agent grid */}
            {filteredAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAgents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
                {activeRole === 'todos' ? (
                  <>
                    <p className="text-lg font-medium text-foreground">Nenhum agente criado ainda</p>
                    <p className="text-muted-foreground text-sm">Descreva a habilidade que precisa e a IA cria o agente</p>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="outline" onClick={() => setTemplateOpen(true)} className="gap-2">
                        <LayoutTemplate className="w-4 h-4" /> Usar Template
                      </Button>
                      <Button onClick={() => navigate('/ai-builder')} className="gap-2">
                        <Wand2 className="w-4 h-4" /> Criar Agente
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">Nenhum agente do tipo "{ROLES.find(r => r.id === activeRole)?.label}".</p>
                    <Button variant="outline" onClick={() => setActiveRole('todos')}>Ver todos</Button>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Performance tab ─────────────────────────── */}
          <TabsContent value="performance" className="mt-4">
            <AgentAnalytics metrics={agentMetrics} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <AgentFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setPrefilledConfig(null)
          }}
          agent={selectedAgent}
          isFirstAgent={agents.length === 0}
          prefilledConfig={prefilledConfig}
        />
        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Excluir agente"
          description="Esta acao nao pode ser desfeita. O agente sera removido permanentemente junto com suas configuracoes."
          confirmLabel="Excluir"
          onConfirm={confirmDelete}
          loading={deleteAgent.isPending}
        />
        <TemplateSelector
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
        />
      </div>
    </div>
  )
}
