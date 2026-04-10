# Agent Wizard Redesign + Company Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the agent form modal into a 3-panel wizard (sidebar 9 steps + form + copilot chat with preview) and create the Company Knowledge central page.

**Architecture:** Refactor `AgentFormDialog.tsx` from 2-panel (sidebar+form) to 3-panel (sidebar+form+chat). Extract the assistant tab into a permanent right panel with a collapsible preview card. Add 4 new tabs (Briefing selector, Policies, Guardrails, Q&A) that already exist as components. Create `/company-knowledge` page with source CRUD and ingest pipeline.

**Tech Stack:** React 18 + TypeScript, TailwindCSS + shadcn/ui, Supabase (PostgreSQL + Edge Functions), React Query v5

---

## File Structure

### Modified Files
- `src/components/agents/AgentFormDialog.tsx` — Refactor to 3-panel layout with 9 tabs + persistent chat panel
- `src/components/agents/form-tabs/AgentAssistantTab.tsx` — Extract into `AgentCopilotPanel.tsx` (right panel, no longer a tab)
- `src/hooks/useAgentAssistant.ts` — Add contextual suggestions per active step
- `src/App.tsx` — Add `/company-knowledge` route

### New Files
- `src/components/agents/AgentCopilotPanel.tsx` — Right panel: preview card + chat (extracted from AgentAssistantTab)
- `src/components/agents/AgentPreviewCard.tsx` — Collapsible summary card showing agent config live
- `src/components/agents/form-tabs/AgentKnowledgeSelector.tsx` — Step 6: select company knowledge sources
- `src/pages/CompanyKnowledge.tsx` — Central page for managing company knowledge sources
- `src/components/company-knowledge/SourceCard.tsx` — Card displaying a knowledge source
- `src/components/company-knowledge/AddSourceDialog.tsx` — 3-step wizard to add a new source
- `src/hooks/useCompanyKnowledge.ts` — React Query hooks for company_knowledge_sources CRUD

---

## Phase 1 — Wizard Redesign (AgentFormDialog)

### Task 1: Expand TABS array to 9 steps with status indicators

**Files:**
- Modify: `src/components/agents/AgentFormDialog.tsx:34-49`

- [ ] **Step 1: Update TABS array from 5 to 9 entries**

Replace lines 41-47 in `AgentFormDialog.tsx`:

```tsx
import { Bot, Brain, Cpu, Database, Puzzle, Building2, ShieldCheck, ShieldAlert, GraduationCap, Sparkles, ChevronRight, Check } from 'lucide-react'

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
```

- [ ] **Step 2: Add completion status helper function**

Add after the TABS const:

```tsx
function getStepStatus(tabId: string, formData: Partial<AgentInsert>, supportConfig: Record<string, any>): 'complete' | 'incomplete' {
  switch (tabId) {
    case 'profile': return formData.name && formData.specialty ? 'complete' : 'incomplete'
    case 'behavior': return formData.system_prompt ? 'complete' : 'incomplete'
    case 'model': return formData.model ? 'complete' : 'incomplete'
    case 'rag': return 'complete' // optional, always valid
    case 'skills': return 'complete' // optional
    case 'knowledge': return 'complete' // optional
    case 'policies': return supportConfig.supportHours ? 'complete' : 'incomplete'
    case 'guardrails': return 'complete' // optional
    case 'qa': return 'complete' // optional
    default: return 'incomplete'
  }
}
```

- [ ] **Step 3: Update SidebarTab to show status indicator**

Replace the `SidebarTab` component:

```tsx
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
```

- [ ] **Step 4: Update sidebar rendering to pass status**

In the sidebar map, change line ~300:

```tsx
{TABS.map(tab => (
  <SidebarTab
    key={tab.id}
    tab={tab}
    isActive={activeTab === tab.id}
    status={getStepStatus(tab.id, formData, supportConfig)}
    onClick={() => setActiveTab(tab.id)}
  />
))}
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors related to TABS or SidebarTab

- [ ] **Step 6: Commit**

```bash
git add src/components/agents/AgentFormDialog.tsx
git commit -m "refactor(agents): expand wizard to 9 steps with completion indicators"
```

---

### Task 2: Add new tab cases to renderTabContent

**Files:**
- Modify: `src/components/agents/AgentFormDialog.tsx`

- [ ] **Step 1: Add imports for existing tab components**

Add these imports at the top of `AgentFormDialog.tsx`:

```tsx
import { AgentBriefing } from './form-tabs/AgentBriefing'
import { AgentPolicies } from './form-tabs/AgentPolicies'
import { AgentGuardrails } from './form-tabs/AgentGuardrails'
import { AgentQATraining } from './form-tabs/AgentQATraining'
import { AgentKnowledgeSelector } from './form-tabs/AgentKnowledgeSelector'
```

- [ ] **Step 2: Split the old 'model' case into 'model' and 'rag'**

Replace the `case 'model'` block in `renderTabContent`:

```tsx
case 'model': return (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold mb-1">Modelo LLM</h3>
      <p className="text-sm text-muted-foreground mb-4">Configure o modelo de IA e parâmetros de geração</p>
      <AgentLLMConfig data={formData} onChange={updateFormData} specialty={formData.specialty} />
    </div>
  </div>
)
case 'rag': return (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold mb-1">Base de Conhecimento (RAG)</h3>
      <p className="text-sm text-muted-foreground mb-4">Configure a busca semântica na base de conhecimento</p>
      <AgentRAGConfig data={formData} onChange={updateFormData} />
    </div>
  </div>
)
```

- [ ] **Step 3: Add cases for knowledge, policies, guardrails, qa**

Add after the `'skills'` case:

```tsx
case 'knowledge': return (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold mb-1">Conhecimento da Empresa</h3>
      <p className="text-sm text-muted-foreground mb-4">Selecione as fontes de conhecimento que este agente pode acessar</p>
      <AgentKnowledgeSelector agentId={agent?.id} data={formData} onChange={updateFormData} />
    </div>
  </div>
)
case 'policies': return (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold mb-1">Políticas e Restrições</h3>
      <p className="text-sm text-muted-foreground mb-4">Regras de atendimento, horários e limites</p>
      <AgentPolicies data={supportConfig} onChange={updateSupportConfig} />
    </div>
  </div>
)
case 'guardrails': return (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold mb-1">Guardrails</h3>
      <p className="text-sm text-muted-foreground mb-4">Filtros de segurança, moderação e validações</p>
      <AgentGuardrails agentId={agent?.id} data={formData} onChange={updateFormData} />
    </div>
  </div>
)
case 'qa': return (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold mb-1">Treinamento Q&A</h3>
      <p className="text-sm text-muted-foreground mb-4">Perguntas e respostas para fine-tuning do agente</p>
      <AgentQATraining agentId={agent?.id} />
    </div>
  </div>
)
```

- [ ] **Step 4: Remove the old 'assistant' case** (it becomes a panel, not a tab)

Delete the `case 'assistant'` block entirely.

- [ ] **Step 5: Create stub for AgentKnowledgeSelector**

Create `src/components/agents/form-tabs/AgentKnowledgeSelector.tsx`:

```tsx
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  agentId?: string
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentKnowledgeSelector({ agentId, data, onChange }: Props) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p className="text-sm">Nenhuma fonte de conhecimento cadastrada ainda.</p>
      <Button variant="outline" size="sm" className="mt-3" asChild>
        <a href="/company-knowledge" target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4 mr-2" />
          Gerenciar Fontes
        </a>
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/components/agents/AgentFormDialog.tsx src/components/agents/form-tabs/AgentKnowledgeSelector.tsx
git commit -m "feat(agents): add 9 tab cases with knowledge selector stub"
```

---

### Task 3: Refactor layout to 3 panels (sidebar + form + copilot)

**Files:**
- Modify: `src/components/agents/AgentFormDialog.tsx:283-338`
- Create: `src/components/agents/AgentCopilotPanel.tsx`
- Create: `src/components/agents/AgentPreviewCard.tsx`

- [ ] **Step 1: Create AgentPreviewCard component**

Create `src/components/agents/AgentPreviewCard.tsx`:

```tsx
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Bot, Cpu, Database, Puzzle, Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TablesInsert } from '@/integrations/supabase/types'

interface Props {
  formData: Partial<TablesInsert<'ai_agents'>>
  supportConfig: Record<string, any>
  onNavigate: (tabId: string) => void
}

export function AgentPreviewCard({ formData, supportConfig, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const items = [
    {
      label: formData.name || 'Sem nome',
      detail: formData.specialty || '—',
      tabId: 'profile',
      done: !!(formData.name && formData.specialty),
    },
    {
      label: 'Modelo',
      detail: formData.model?.split('/').pop() || '—',
      tabId: 'model',
      done: !!formData.model,
    },
    {
      label: 'RAG',
      detail: formData.rag_enabled ? `Top ${formData.rag_top_k || 5}` : 'Desabilitado',
      tabId: 'rag',
      done: true,
    },
    {
      label: 'Prompt',
      detail: formData.system_prompt ? `${formData.system_prompt.length} chars` : 'Vazio',
      tabId: 'behavior',
      done: !!formData.system_prompt,
    },
  ]

  const completedSteps = items.filter(i => i.done).length

  return (
    <div className="border rounded-lg bg-card mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="truncate max-w-[140px]">{formData.name || 'Novo Agente'}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{completedSteps}/{items.length}</Badge>
        </div>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-1 border-t">
          {items.map(item => (
            <button
              key={item.tabId}
              onClick={() => onNavigate(item.tabId)}
              className="w-full flex items-center gap-2 text-[11px] py-1 hover:bg-muted/50 rounded px-1 transition-colors"
            >
              {item.done
                ? <Check className="w-3 h-3 text-green-500 shrink-0" />
                : <Minus className="w-3 h-3 text-muted-foreground shrink-0" />}
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="truncate font-medium">{item.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create AgentCopilotPanel component**

Create `src/components/agents/AgentCopilotPanel.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAgentAssistant } from '@/hooks/useAgentAssistant'
import { AgentPreviewCard } from './AgentPreviewCard'
import { Send, Sparkles, Check, X, Loader2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

const STEP_SUGGESTIONS: Record<string, string[]> = {
  profile: ['Sugerir nome para o agente', 'Qual especialidade combina com meu caso?'],
  behavior: ['Melhorar o prompt', 'Gerar saudação', 'Tornar mais empático'],
  model: ['Recomendar modelo ideal', 'Explicar temperatura'],
  rag: ['Configurar RAG para meu caso', 'Qual threshold usar?'],
  skills: ['Quais skills ativar?', 'Explicar function calling'],
  knowledge: ['Quais fontes preciso?', 'Como melhorar a base?'],
  policies: ['Sugerir horário de atendimento', 'Definir SLA'],
  guardrails: ['Configurar limites de segurança', 'Adicionar regra'],
  qa: ['Gerar exemplos de Q&A', 'Melhorar pares existentes'],
}

interface AgentCopilotPanelProps {
  agent?: Tables<'ai_agents'> | null
  formData: Partial<TablesInsert<'ai_agents'>>
  supportConfig: Record<string, any>
  activeStep: string
  onChange: (updates: Record<string, any>) => void
  onSupportConfigChange: (updates: Record<string, any>) => void
  onNavigate: (tabId: string) => void
}

export function AgentCopilotPanel({
  agent, formData, supportConfig, activeStep,
  onChange, onSupportConfigChange, onNavigate
}: AgentCopilotPanelProps) {
  const { messages, isLoading, pendingChanges, sendMessage, analyzeAgent, clearChanges } = useAgentAssistant(formData as Record<string, any>, supportConfig)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const applyChanges = () => {
    const formUpdates: Record<string, any> = {}
    const supportUpdates: Record<string, any> = {}
    for (const change of pendingChanges) {
      if (change.field.startsWith('support_config.')) {
        supportUpdates[change.field.replace('support_config.', '')] = change.after
      } else {
        formUpdates[change.field] = change.after
      }
    }
    if (Object.keys(formUpdates).length > 0) onChange(formUpdates)
    if (Object.keys(supportUpdates).length > 0) onSupportConfigChange(supportUpdates)
    clearChanges()
  }

  const suggestions = STEP_SUGGESTIONS[activeStep] || STEP_SUGGESTIONS.behavior

  return (
    <div className="w-[320px] border-l border-border shrink-0 flex flex-col bg-muted/10">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">Copiloto IA</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={analyzeAgent} disabled={isLoading}>
            <Wand2 className="w-3 h-3 mr-1" />
            Analisar
          </Button>
        </div>

        {/* Preview Card */}
        <AgentPreviewCard formData={formData} supportConfig={supportConfig} onNavigate={onNavigate} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
            <p className="text-xs text-muted-foreground mb-3">Me diga o que quer melhorar</p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map(s => (
                <Button key={s} variant="outline" size="sm" className="text-[11px] h-7 justify-start" onClick={() => sendMessage(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[90%] rounded-lg px-3 py-2 text-xs',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border'
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.changes && msg.changes.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t pt-2">
                  {msg.changes.map((c, i) => (
                    <div key={i} className="bg-muted/50 rounded p-1.5">
                      <Badge variant="outline" className="text-[9px] mb-0.5">{c.label}</Badge>
                      <div className="text-destructive line-through truncate text-[10px]">{c.before?.slice(0, 60) || '(vazio)'}</div>
                      <div className="text-green-600 truncate text-[10px]">{c.after?.slice(0, 60)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-lg px-3 py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Pending changes bar */}
      {pendingChanges.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border-t border-primary/20 px-3 py-1.5 shrink-0">
          <span className="text-[11px] font-medium">{pendingChanges.length} mudança(s)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={clearChanges}>
              <X className="w-3 h-3 mr-0.5" /> Descartar
            </Button>
            <Button size="sm" className="h-6 text-[10px] px-2" onClick={applyChanges}>
              <Check className="w-3 h-3 mr-0.5" /> Aplicar
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5 p-2 border-t border-border shrink-0">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Como posso ajudar?"
          className="min-h-[36px] max-h-[80px] resize-none text-xs"
          rows={1}
        />
        <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm" className="shrink-0 h-9 w-9 p-0">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Refactor AgentFormDialog layout to 3 panels**

Replace the dialog content (lines 283-338) in `AgentFormDialog.tsx`:

```tsx
import { AgentCopilotPanel } from './AgentCopilotPanel'

// ... inside the return:

return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 flex flex-col">
      <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-border">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Bot className="w-5 h-5 text-primary" />
          {agent ? 'Editar Agente' : 'Criar Novo Agente'}
        </DialogTitle>
        <DialogDescription>Configure o comportamento e personalidade do agente de IA</DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar navigation */}
        <div className="w-[200px] border-r border-border shrink-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
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
        <AgentCopilotPanel
          agent={agent}
          formData={formData}
          supportConfig={supportConfig}
          activeStep={activeTab}
          onChange={updateFormData}
          onSupportConfigChange={updateSupportConfig}
          onNavigate={setActiveTab}
        />
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
```

Note: Save button is now always visible (not only on last tab). "Próximo" shows for all non-last tabs.

- [ ] **Step 4: Remove AgentAssistantTab import** (no longer needed in AgentFormDialog)

Remove line `import { AgentAssistantTab } from './form-tabs/AgentAssistantTab'`

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/components/agents/AgentFormDialog.tsx src/components/agents/AgentCopilotPanel.tsx src/components/agents/AgentPreviewCard.tsx
git commit -m "feat(agents): 3-panel wizard layout with copilot panel and preview card"
```

---

### Task 4: Responsive breakpoints for copilot panel

**Files:**
- Modify: `src/components/agents/AgentFormDialog.tsx`
- Modify: `src/components/agents/AgentCopilotPanel.tsx`

- [ ] **Step 1: Add responsive state to AgentFormDialog**

Add inside the component, after other state:

```tsx
const [showCopilot, setShowCopilot] = useState(true)
```

Add a toggle button in the header (after DialogDescription):

```tsx
<Button
  variant="ghost"
  size="sm"
  className="absolute right-12 top-5"
  onClick={() => setShowCopilot(prev => !prev)}
>
  <Sparkles className={cn('w-4 h-4', showCopilot && 'text-primary')} />
  <span className="ml-1.5 text-xs">Copiloto IA</span>
</Button>
```

- [ ] **Step 2: Conditionally render copilot panel**

Wrap the `<AgentCopilotPanel>` in the layout:

```tsx
{showCopilot && (
  <AgentCopilotPanel ... />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agents/AgentFormDialog.tsx
git commit -m "feat(agents): toggle copilot panel visibility"
```

---

## Phase 2 — Company Knowledge Page

### Task 5: Database migration for company_knowledge_sources

**Files:**
- Create: `supabase/migrations/20260403_company_knowledge_sources.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Company Knowledge Sources — central repository for company data
CREATE TABLE IF NOT EXISTS company_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'image', 'docx', 'website', 'social', 'confluence', 'zoho')),
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'error')),
  chunks_count INT DEFAULT 0,
  pages_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_frequency TEXT CHECK (sync_frequency IN (NULL, 'daily', 'weekly', 'monthly')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add source_id to knowledge base for linking
ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES company_knowledge_sources(id) ON DELETE SET NULL;

-- Add knowledge_sources to agents for selection
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS knowledge_sources JSONB DEFAULT '[]';

-- RLS
ALTER TABLE company_knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sources" ON company_knowledge_sources FOR SELECT USING (true);
CREATE POLICY "Users can insert sources" ON company_knowledge_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sources" ON company_knowledge_sources FOR UPDATE USING (true);
CREATE POLICY "Users can delete sources" ON company_knowledge_sources FOR DELETE USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_company_knowledge_sources_type ON company_knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_source_id ON ai_knowledge_base(source_id);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use: `mcp__claude_ai_Supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260403_company_knowledge_sources.sql
git commit -m "feat(db): add company_knowledge_sources table and relations"
```

---

### Task 6: useCompanyKnowledge hook

**Files:**
- Create: `src/hooks/useCompanyKnowledge.ts`

- [ ] **Step 1: Create the hook**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/components/ui/sonner'

export interface CompanyKnowledgeSource {
  id: string
  tenant_id: string
  name: string
  source_type: 'pdf' | 'image' | 'docx' | 'website' | 'social' | 'confluence' | 'zoho'
  config: Record<string, any>
  status: 'pending' | 'processing' | 'indexed' | 'error'
  chunks_count: number
  pages_count: number
  last_synced_at: string | null
  next_sync_at: string | null
  sync_frequency: 'daily' | 'weekly' | 'monthly' | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export function useCompanyKnowledge() {
  const qc = useQueryClient()

  const sources = useQuery({
    queryKey: ['company-knowledge-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_knowledge_sources' as any)
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as CompanyKnowledgeSource[]
    },
  })

  const createSource = useMutation({
    mutationFn: async (source: Partial<CompanyKnowledgeSource>) => {
      const { data, error } = await supabase
        .from('company_knowledge_sources' as any)
        .insert(source as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-knowledge-sources'] })
      toast.success('Fonte adicionada com sucesso')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar fonte'),
  })

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_knowledge_sources' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-knowledge-sources'] })
      toast.success('Fonte removida')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover fonte'),
  })

  const reindexSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('company-knowledge-ingest', {
        body: { source_id: id, action: 'reindex' },
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-knowledge-sources'] })
      toast.success('Re-indexação iniciada')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao re-indexar'),
  })

  return { sources, createSource, deleteSource, reindexSource }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCompanyKnowledge.ts
git commit -m "feat(hooks): useCompanyKnowledge CRUD hook"
```

---

### Task 7: SourceCard component

**Files:**
- Create: `src/components/company-knowledge/SourceCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Image, Globe, Share2, Link, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import type { CompanyKnowledgeSource } from '@/hooks/useCompanyKnowledge'

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  pdf: { icon: FileText, label: 'PDF' },
  image: { icon: Image, label: 'Imagem' },
  docx: { icon: FileText, label: 'DOCX' },
  website: { icon: Globe, label: 'Website' },
  social: { icon: Share2, label: 'Rede Social' },
  confluence: { icon: Link, label: 'Confluence' },
  zoho: { icon: Link, label: 'Zoho Desk' },
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  indexed: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  indexed: 'Indexado',
  error: 'Erro',
}

interface Props {
  source: CompanyKnowledgeSource
  onReindex: (id: string) => void
  onDelete: (id: string) => void
}

export function SourceCard({ source, onReindex, onDelete }: Props) {
  const meta = TYPE_META[source.source_type] || TYPE_META.pdf
  const Icon = meta.icon

  return (
    <div className="border rounded-xl bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{source.name}</h3>
            <Badge variant="outline" className={STATUS_STYLE[source.status]}>
              {STATUS_LABEL[source.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {meta.label} • {source.pages_count} páginas • {source.chunks_count} chunks
          </p>
          {source.last_synced_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Última sync: {new Date(source.last_synced_at).toLocaleDateString('pt-BR')}
              {source.sync_frequency && ` • Auto: ${source.sync_frequency}`}
            </p>
          )}
          {source.error_message && (
            <p className="text-xs text-destructive mt-1">{source.error_message}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onReindex(source.id)}>
          <RefreshCw className="w-3 h-3 mr-1" /> Re-indexar
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => onDelete(source.id)}>
          <Trash2 className="w-3 h-3 mr-1" /> Remover
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/company-knowledge/SourceCard.tsx
git commit -m "feat(knowledge): SourceCard component"
```

---

### Task 8: AddSourceDialog component

**Files:**
- Create: `src/components/company-knowledge/AddSourceDialog.tsx`

- [ ] **Step 1: Create the 3-step dialog**

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Image, Globe, Share2, Link, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_TYPES = [
  { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Upload de documentos PDF' },
  { id: 'image', label: 'Imagem', icon: Image, desc: 'Upload com OCR/Vision' },
  { id: 'docx', label: 'DOCX/TXT', icon: FileText, desc: 'Documentos de texto' },
  { id: 'website', label: 'Website', icon: Globe, desc: 'Scraping de sites' },
  { id: 'social', label: 'Rede Social', icon: Share2, desc: 'Instagram, Facebook, LinkedIn' },
  { id: 'confluence', label: 'Confluence', icon: Link, desc: 'Atlassian Confluence' },
  { id: 'zoho', label: 'Zoho Desk', icon: Link, desc: 'Base de conhecimento Zoho' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; source_type: string; config: Record<string, any> }) => void
}

export function AddSourceDialog({ open, onOpenChange, onSubmit }: Props) {
  const [step, setStep] = useState(1)
  const [sourceType, setSourceType] = useState('')
  const [name, setName] = useState('')
  const [config, setConfig] = useState<Record<string, any>>({})

  const reset = () => { setStep(1); setSourceType(''); setName(''); setConfig({}) }

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v) }

  const handleSubmit = () => {
    onSubmit({ name, source_type: sourceType, config })
    handleClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Fonte — Passo {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {SOURCE_TYPES.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => { setSourceType(t.id); setStep(2) }}
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-muted/50 transition-colors',
                    sourceType === t.id && 'border-primary bg-primary/5'
                  )}
                >
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Nome da Fonte</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Manual do Produto v3" />
            </div>

            {(sourceType === 'pdf' || sourceType === 'image' || sourceType === 'docx') && (
              <div>
                <Label>Arquivos</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Arraste arquivos ou clique para selecionar</p>
                  <input
                    type="file"
                    multiple
                    accept={sourceType === 'pdf' ? '.pdf' : sourceType === 'image' ? 'image/*' : '.docx,.doc,.txt'}
                    className="hidden"
                    onChange={e => setConfig({ ...config, files: Array.from(e.target.files || []) })}
                  />
                </div>
              </div>
            )}

            {sourceType === 'website' && (
              <>
                <div>
                  <Label>URL Base</Label>
                  <Input value={config.url || ''} onChange={e => setConfig({ ...config, url: e.target.value })} placeholder="https://seusite.com.br" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Profundidade</Label>
                    <Input type="number" min={1} max={5} value={config.depth || 2} onChange={e => setConfig({ ...config, depth: +e.target.value })} />
                  </div>
                  <div>
                    <Label>Auto-sync</Label>
                    <Select value={config.sync_frequency || ''} onValueChange={v => setConfig({ ...config, sync_frequency: v || null })}>
                      <SelectTrigger><SelectValue placeholder="Sem sync" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem sync</SelectItem>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {sourceType === 'social' && (
              <>
                <div>
                  <Label>Plataforma</Label>
                  <Select value={config.platform || ''} onValueChange={v => setConfig({ ...config, platform: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL do Perfil</Label>
                  <Input value={config.profile_url || ''} onChange={e => setConfig({ ...config, profile_url: e.target.value })} placeholder="https://instagram.com/seupage" />
                </div>
              </>
            )}

            {sourceType === 'confluence' && (
              <>
                <div>
                  <Label>URL da Instância</Label>
                  <Input value={config.base_url || ''} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="https://seutime.atlassian.net/wiki" />
                </div>
                <div>
                  <Label>Space Key</Label>
                  <Input value={config.space_key || ''} onChange={e => setConfig({ ...config, space_key: e.target.value })} placeholder="BCON" />
                </div>
                <div>
                  <Label>API Token</Label>
                  <Input type="password" value={config.api_token || ''} onChange={e => setConfig({ ...config, api_token: e.target.value })} placeholder="Token de acesso" />
                </div>
              </>
            )}

            {sourceType === 'zoho' && (
              <>
                <div>
                  <Label>URL do Zoho Desk</Label>
                  <Input value={config.base_url || ''} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="https://desk.zoho.com" />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input type="password" value={config.api_key || ''} onChange={e => setConfig({ ...config, api_key: e.target.value })} placeholder="Chave de API" />
                </div>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!name.trim()}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/20">
              <h4 className="text-sm font-semibold mb-2">Resumo</h4>
              <p className="text-sm"><strong>Nome:</strong> {name}</p>
              <p className="text-sm"><strong>Tipo:</strong> {SOURCE_TYPES.find(t => t.id === sourceType)?.label}</p>
              {config.url && <p className="text-sm"><strong>URL:</strong> {config.url}</p>}
              {config.platform && <p className="text-sm"><strong>Plataforma:</strong> {config.platform}</p>}
              {config.space_key && <p className="text-sm"><strong>Space:</strong> {config.space_key}</p>}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={handleSubmit}>Processar e Indexar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/company-knowledge/AddSourceDialog.tsx
git commit -m "feat(knowledge): AddSourceDialog 3-step wizard"
```

---

### Task 9: CompanyKnowledge page

**Files:**
- Create: `src/pages/CompanyKnowledge.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompanyKnowledge } from '@/hooks/useCompanyKnowledge'
import { SourceCard } from '@/components/company-knowledge/SourceCard'
import { AddSourceDialog } from '@/components/company-knowledge/AddSourceDialog'
import { Plus, Search, Building2, Loader2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export default function CompanyKnowledge() {
  const { sources, createSource, deleteSource, reindexSource } = useCompanyKnowledge()
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = (sources.data || []).filter(s => {
    if (typeFilter !== 'all' && s.source_type !== typeFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Conhecimento da Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralize informações que seus agentes IA usam para responder clientes
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Fonte
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fontes..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="docx">DOCX/TXT</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="social">Rede Social</SelectItem>
            <SelectItem value="confluence">Confluence</SelectItem>
            <SelectItem value="zoho">Zoho Desk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sources.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma fonte cadastrada</p>
          <p className="text-sm mt-1">Adicione PDFs, sites ou integrações para alimentar seus agentes</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeira fonte
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(source => (
            <SourceCard
              key={source.id}
              source={source}
              onReindex={id => reindexSource.mutate(id)}
              onDelete={id => deleteSource.mutate(id)}
            />
          ))}
        </div>
      )}

      <AddSourceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={data => createSource.mutate(data as any)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Add route to App.tsx**

Find the routes section and add:

```tsx
import CompanyKnowledge from '@/pages/CompanyKnowledge'

// Inside the router, alongside other routes:
<Route path="/company-knowledge" element={<CompanyKnowledge />} />
```

- [ ] **Step 3: Add sidebar menu item**

Find the sidebar navigation config and add an entry for "Conhecimento da Empresa" with icon `Building2` linking to `/company-knowledge`, in the AI/Settings section.

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/pages/CompanyKnowledge.tsx src/App.tsx
git commit -m "feat(knowledge): company knowledge page with CRUD and routing"
```

---

### Task 10: Wire AgentKnowledgeSelector to real data

**Files:**
- Modify: `src/components/agents/form-tabs/AgentKnowledgeSelector.tsx`

- [ ] **Step 1: Replace stub with real selector**

```tsx
import { ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCompanyKnowledge, CompanyKnowledgeSource } from '@/hooks/useCompanyKnowledge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface Props {
  agentId?: string
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentKnowledgeSelector({ agentId, data, onChange }: Props) {
  const { sources } = useCompanyKnowledge()
  const selected: string[] = (data.knowledge_sources as string[]) || []

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id]
    onChange({ knowledge_sources: next })
  }

  if (sources.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  const indexed = (sources.data || []).filter(s => s.status === 'indexed')

  if (indexed.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Nenhuma fonte de conhecimento indexada.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <a href="/company-knowledge" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Gerenciar Fontes
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        {indexed.map(source => (
          <button
            key={source.id}
            onClick={() => toggle(source.id)}
            className={cn(
              'flex items-center gap-3 p-3 border rounded-lg text-left transition-all',
              selected.includes(source.id)
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded border flex items-center justify-center shrink-0',
              selected.includes(source.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
            )}>
              {selected.includes(source.id) && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{source.name}</p>
              <p className="text-xs text-muted-foreground">{source.chunks_count} chunks</p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{source.source_type.toUpperCase()}</Badge>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-muted-foreground">{selected.length} fonte(s) selecionada(s)</span>
        <Button variant="link" size="sm" className="text-xs h-auto p-0" asChild>
          <a href="/company-knowledge" target="_blank" rel="noopener noreferrer">
            Gerenciar fontes →
          </a>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/agents/form-tabs/AgentKnowledgeSelector.tsx
git commit -m "feat(agents): wire knowledge selector to company sources data"
```

---

### Task 11: Final cleanup and verification

**Files:**
- Modify: `src/components/agents/AgentFormDialog.tsx` (remove dead code)

- [ ] **Step 1: Remove unused AgentAssistantTab import if still present**

Verify no dead imports remain in `AgentFormDialog.tsx`.

- [ ] **Step 2: Full build verification**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Manual test checklist**

Run: `npm run dev`

Verify:
- [ ] Agent form opens with 9 tabs in sidebar
- [ ] Each tab shows correct content
- [ ] Copilot panel shows on right with preview card
- [ ] Preview card updates when form changes
- [ ] Chat suggestions change per active step
- [ ] Save button works from any tab
- [ ] `/company-knowledge` page loads
- [ ] Add source dialog opens with 3 steps

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(agents): wizard redesign complete — 9 steps, copilot panel, company knowledge"
```
