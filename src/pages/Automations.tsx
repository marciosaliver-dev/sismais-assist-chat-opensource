import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Plus, Zap, GitBranch, Activity, Sparkles, ChevronDown, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutomations } from '@/hooks/useAutomations'
import { useFlowAutomations } from '@/hooks/useFlowAutomations'
import { useAutomationLogs } from '@/hooks/useAutomationLogs'
import { AutomationListCard } from '@/components/automations/AutomationListCard'
import { AutomationFilters } from '@/components/automations/AutomationFilters'
import { FlowListPage } from '@/components/flow-builder/FlowListPage'
import { AUTOMATION_TEMPLATES, CATEGORY_COLORS, TRIGGER_CATEGORY_MAP } from '@/data/automationConfig'
import { toast } from 'sonner'
import { normalizeText } from '@/lib/utils'

export default function Automations() {
  const navigate = useNavigate()
  const { automations, isLoading, createAutomation, deleteAutomation, toggleAutomation, updateAutomation } = useAutomations()
  const { flows, createFlow } = useFlowAutomations()

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [triggerFilter, setTriggerFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  // Stats
  const totalAutomations = (automations?.length ?? 0) + (flows?.length ?? 0)
  const activeCount = (automations?.filter(a => a.is_active).length ?? 0) + (flows?.filter(f => f.is_active).length ?? 0)
  const totalExec = (automations?.reduce((s, a) => s + (a.execution_count ?? 0), 0) ?? 0) + (flows?.reduce((s, f) => s + (f.execution_count ?? 0), 0) ?? 0)

  // Filter automations
  const filtered = useMemo(() => {
    let items = automations ?? []
    if (search) {
      const q = normalizeText(search)
      items = items.filter(a => normalizeText(a.name).includes(q) || normalizeText(a.description || '').includes(q))
    }
    if (triggerFilter !== 'all') items = items.filter(a => a.trigger_type === triggerFilter)
    if (categoryFilter !== 'all') {
      items = items.filter(a => {
        const cat = (a as any).category || TRIGGER_CATEGORY_MAP[a.trigger_type] || 'ticket'
        return cat === categoryFilter
      })
    }
    if (tab === 'active') items = items.filter(a => a.is_active)
    if (tab === 'inactive') items = items.filter(a => !a.is_active)
    return items
  }, [automations, search, triggerFilter, categoryFilter, tab, onlyMine])

  const handleCreateNew = () => navigate('/automations/new')

  const handleUseTemplate = (template: typeof AUTOMATION_TEMPLATES[0]) => {
    createAutomation.mutate({
      name: template.name,
      description: template.description,
      trigger_type: template.trigger_type,
      trigger_conditions: template.trigger_conditions as any,
      actions: template.actions as any,
    }, {
      onSuccess: (data: any) => {
        toast.success('Automação criada a partir do template!')
        navigate(`/automations/${data.id}`)
      }
    })
  }

  const handleDuplicate = (automation: any) => {
    createAutomation.mutate({
      name: `${automation.name} (cópia)`,
      description: automation.description,
      trigger_type: automation.trigger_type,
      trigger_conditions: automation.trigger_conditions,
      actions: automation.actions,
    })
  }

  const handleCreateFlow = () => {
    createFlow.mutate(
      { name: 'Novo Fluxo', trigger_type: 'message_received' },
      { onSuccess: (data: any) => navigate(`/flow-builder/${data.id}`) }
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-5 h-5 text-[#10293F]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Automações</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure gatilhos, filtros e ações para automatizar seus processos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCreateFlow} disabled={createFlow.isPending}>
            <GitBranch className="w-4 h-4 mr-2" /> Abrir Flow Builder
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" /> Nova Automação
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <div className="w-8 h-8 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-[#10293F]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#10293F] mt-1">{totalAutomations}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Ativas</p>
            <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#16A34A]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#16A34A] mt-1">{activeCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Execuções</p>
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#2563EB]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#2563EB] mt-1">{totalExec}</p>
        </div>
      </div>

      {/* Templates Collapsible */}
      <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-10 px-3 border border-border rounded-lg">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-primary" /> Templates de Automação
              <Badge variant="secondary" className="text-xs">{AUTOMATION_TEMPLATES.length}</Badge>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {AUTOMATION_TEMPLATES.map((t) => {
              const Icon = t.icon
              const colors = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.ticket
              return (
                <div key={t.id} className={`rounded-xl border p-4 ${colors.bg} hover:shadow-md transition-all cursor-pointer group`} onClick={() => handleUseTemplate(t)}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg ${colors.icon} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-xs">{t.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Badge variant="secondary" className="text-[9px]">{t.actions.length} ações</Badge>
                    <Badge variant="outline" className="text-[9px] capitalize">{t.category}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center gap-4 border-b border-border">
          {(['all', 'active', 'inactive', 'flows'] as const).map((t) => {
            const labels: Record<string, string> = { all: 'Todas', active: 'Ativas', inactive: 'Inativas', flows: 'Fluxos Visuais' }
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 px-1 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all',
                  tab === t
                    ? 'border-[#45E5E5] text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {labels[t]}
              </button>
            )
          })}
        </div>

        {/* Filters (not in flows tab) */}
        {tab !== 'flows' && (
          <div className="mt-4">
            <AutomationFilters
              search={search}
              onSearchChange={setSearch}
              triggerFilter={triggerFilter}
              onTriggerFilterChange={setTriggerFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              onlyMine={onlyMine}
              onOnlyMineChange={setOnlyMine}
            />
          </div>
        )}

        <TabsContent value="all" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreateNew={handleCreateNew} />
          ) : (
            filtered.map(a => (
              <div key={a.id} className={cn('rounded-xl overflow-hidden border-l-4', a.is_active ? 'border-l-[#45E5E5]' : 'border-l-[#CCCCCC]')}>
                <AutomationListCard
                  automation={a}
                  onEdit={(a) => navigate(`/automations/${a.id}`)}
                  onDuplicate={handleDuplicate}
                  onDelete={(id) => deleteAutomation.mutate(id)}
                  onToggle={(id, active) => toggleAutomation.mutate({ id, active })}
                  onViewLogs={(id) => navigate(`/automations/${id}?tab=logs`)}
                />
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreateNew={handleCreateNew} message="Nenhuma automação ativa" />
          ) : (
            filtered.map(a => (
              <div key={a.id} className="rounded-xl overflow-hidden border-l-4 border-l-[#45E5E5]">
                <AutomationListCard
                  automation={a}
                  onEdit={(a) => navigate(`/automations/${a.id}`)}
                  onDuplicate={handleDuplicate}
                  onDelete={(id) => deleteAutomation.mutate(id)}
                  onToggle={(id, active) => toggleAutomation.mutate({ id, active })}
                  onViewLogs={(id) => navigate(`/automations/${id}?tab=logs`)}
                />
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="inactive" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreateNew={handleCreateNew} message="Nenhuma automação inativa" />
          ) : (
            filtered.map(a => (
              <div key={a.id} className="rounded-xl overflow-hidden border-l-4 border-l-[#CCCCCC]">
                <AutomationListCard
                  automation={a}
                  onEdit={(a) => navigate(`/automations/${a.id}`)}
                  onDuplicate={handleDuplicate}
                  onDelete={(id) => deleteAutomation.mutate(id)}
                  onToggle={(id, active) => toggleAutomation.mutate({ id, active })}
                  onViewLogs={(id) => navigate(`/automations/${id}?tab=logs`)}
                />
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          <FlowListPage onCreateFlow={handleCreateFlow} />
        </TabsContent>
      </Tabs>
    </div>
    </div>
  )
}

function EmptyState({ onCreateNew, message }: { onCreateNew: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message || 'Nenhuma automação encontrada'}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Crie sua primeira automação ou use um template</p>
      <Button size="sm" className="mt-4" onClick={onCreateNew}>
        <Plus className="w-4 h-4 mr-2" /> Nova Automação
      </Button>
    </div>
  )
}
