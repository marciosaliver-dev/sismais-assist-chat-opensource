# AI Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified AI Builder page (`/ai-builder`) for creating agents and skills via deep conversational AI, replacing 3 existing creation paths.

**Architecture:** Split-screen page with chat panel (left, 55%) and live preview panel (right, 45%). Edge function `ai-builder` handles multi-turn conversation with Gemini 2.5 Pro. Three new database tables (`ai_agent_skills`, `ai_agent_skill_assignments`, `ai_prompt_methods`) plus one new column on `ai_agents`.

**Tech Stack:** React 18, TypeScript, TailwindCSS, shadcn/ui, Supabase (PostgreSQL + Edge Functions/Deno), OpenRouter (Gemini 2.5 Pro), TanStack React Query v5

**Spec:** `docs/superpowers/specs/2026-03-20-ai-builder-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/XXXXXX_ai_builder_tables.sql` | Create 3 tables + column + RLS + seeds |
| `supabase/functions/ai-builder/index.ts` | Edge function — conversational agent/skill creator |
| `src/pages/AIBuilder.tsx` | Page component with tabs (Criar Agente / Criar Skill / Templates) |
| `src/components/ai-builder/BuilderChat.tsx` | Left panel — phase indicator + chat messages + input |
| `src/components/ai-builder/BuilderPreview.tsx` | Right panel — routes to AgentPreviewCard or SkillPreviewCard |
| `src/components/ai-builder/AgentPreviewCard.tsx` | Live preview card for agent config |
| `src/components/ai-builder/SkillPreviewCard.tsx` | Live preview card for skill config |
| `src/components/ai-builder/MethodSelector.tsx` | Dropdown + checkboxes for prompt methods |
| `src/components/ai-builder/PhaseIndicator.tsx` | Visual progress bar (4 phases) |
| `src/components/ai-builder/TemplatesGrid.tsx` | Grid of pre-built agent templates |
| `src/components/ai-builder/ChatBubble.tsx` | Chat message bubble (user/assistant) |
| `src/hooks/useAIBuilder.ts` | Main hook — chat state, sendMessage, partial config |
| `src/hooks/usePromptMethods.ts` | Hook to fetch prompt methods from DB |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/ai-builder` route, remove `/ai-config`, `/ai-config-guide`, `/human-agents` routes |
| `src/components/layout/Sidebar.tsx` | Add AI Builder link, remove old links |
| `src/pages/Agents.tsx` | Change "Criar Agente" button to navigate to `/ai-builder` |
| `supabase/functions/agent-executor/index.ts` | Add `prompt_methods` reading + injection |

### Files to Delete

| File | Reason |
|------|--------|
| `src/pages/AIConfig.tsx` | Duplicates agent creation |
| `src/pages/AIConfigGuide.tsx` | Tutorial absorbed into builder |
| `src/pages/HumanAgents.tsx` | Dead code (already redirects) |
| `src/components/agents/SkillAgentDialog.tsx` | Absorbed by AI Builder |
| `src/components/agents/AgentSupportEditor.tsx` | Duplicates AgentFormDialog tabs |
| `src/components/agents/AgentAIConfigurator.tsx` | Absorbed by AI Builder |
| `src/components/agents/AgentTemplates.tsx` | Absorbed by Templates tab |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260320120000_ai_builder_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 1. ai_agent_skills
CREATE TABLE IF NOT EXISTS ai_agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('atendimento','financeiro','vendas','tecnico','interno','general')),
  prompt_instructions TEXT,
  trigger_keywords TEXT[] DEFAULT '{}',
  trigger_intents TEXT[] DEFAULT '{}',
  tool_ids TEXT[] DEFAULT '{}',
  auto_activate BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_agent_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_read" ON ai_agent_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "skills_write" ON ai_agent_skills FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. ai_agent_skill_assignments
CREATE TABLE IF NOT EXISTS ai_agent_skill_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES ai_agent_skills(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  custom_prompt_override TEXT,
  custom_config JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, skill_id)
);

ALTER TABLE ai_agent_skill_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_read" ON ai_agent_skill_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments_write" ON ai_agent_skill_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. ai_prompt_methods
CREATE TABLE IF NOT EXISTS ai_prompt_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  recommended_specialties TEXT[] DEFAULT '{}',
  prompt_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_prompt_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "methods_read" ON ai_prompt_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "methods_write" ON ai_prompt_methods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. New column on ai_agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS prompt_methods TEXT[] DEFAULT '{}';

-- 5. Seed prompt methods
INSERT INTO ai_prompt_methods (name, label, description, recommended_specialties, prompt_template, sort_order) VALUES
('chain_of_thought', 'Chain of Thought', 'Raciocinio passo-a-passo para diagnostico e resolucao de problemas',
 ARRAY['support'],
 E'Ao responder, pense passo a passo:\n1. Identifique o problema\n2. Analise as possiveis causas\n3. Proponha a solucao mais provavel\n4. Confirme com o cliente se resolveu', 1),

('decision_tree', 'Decision Tree', 'Classificacao rapida por fluxo de decisoes',
 ARRAY['triage'],
 E'Classifique rapidamente o assunto usando no maximo 2 perguntas. Fluxo:\n- Se financeiro → direcione para agente financeiro\n- Se tecnico → direcione para suporte\n- Se comercial → direcione para vendas\n- Se duvida → tente resolver ou escale', 2),

('pasa', 'PASA', 'Problem→Agitate→Solution→Action para cobranca persuasiva',
 ARRAY['financial'],
 E'Siga o metodo PASA:\n1. PROBLEM: Identifique a situacao do cliente\n2. AGITATE: Mostre as consequencias de nao resolver\n3. SOLUTION: Apresente a solucao disponivel\n4. ACTION: Guie para a acao concreta (pagar, parcelar)', 3),

('aida', 'AIDA', 'Attention→Interest→Desire→Action para vendas',
 ARRAY['sales', 'sdr'],
 E'Siga o funil AIDA:\n1. ATTENTION: Capture atencao com beneficio principal\n2. INTEREST: Aprofunde com dados e diferenciais\n3. DESIRE: Conecte com a necessidade especifica do lead\n4. ACTION: Conduza para proximo passo (demo, proposta)', 4),

('react', 'ReAct', 'Reasoning + Acting para copiloto de agente humano',
 ARRAY['copilot'],
 E'Para cada mensagem do cliente:\n1. REASONING: Analise o contexto e historico\n2. ACTING: Sugira a melhor resposta ou acao ao atendente\nNunca responda diretamente ao cliente. Sempre apresente como sugestao.', 5),

('structured_output', 'Structured Output', 'Dados precisos e formatados para analytics',
 ARRAY['analytics'],
 E'Sempre retorne dados em formato estruturado:\n- Use tabelas quando possivel\n- Inclua numeros absolutos e percentuais\n- Compare com periodo anterior\n- Destaque anomalias e tendencias', 6),

('emotion_method', 'Emotion Method', 'Empatia e leitura emocional do cliente',
 ARRAY['customer_success', 'support'],
 E'Antes de responder, avalie o estado emocional do cliente:\n- Frustrado → Valide o sentimento, peca desculpas, resolva rapido\n- Confuso → Simplifique, use linguagem acessivel\n- Irritado → Nao discuta, acolha, ofereca solucao concreta\n- Satisfeito → Reforce o positivo, pergunte se precisa de mais algo', 7),

('self_reflection', 'Self-Reflection', 'Revisar resposta antes de enviar',
 ARRAY['support', 'financial', 'sales'],
 E'Antes de enviar sua resposta, revise mentalmente:\n1. A resposta resolve o que foi perguntado?\n2. O tom esta adequado?\n3. Falta alguma informacao importante?\n4. Ha risco de mal-entendido?\nSe sim para qualquer item, ajuste antes de enviar.', 8),

('few_shot', 'Few-Shot Examples', 'Exemplos de conversa ideal para calibrar',
 ARRAY['support', 'financial', 'sales', 'triage'],
 E'Use os exemplos de conversa abaixo como referencia de tom, profundidade e formato de resposta. Adapte ao contexto atual mantendo o mesmo padrao de qualidade.', 9);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase migration up` or apply via Supabase MCP tool `apply_migration`.
Expected: 3 tables created, 6 RLS policies, 1 column added, 9 seed rows.

- [ ] **Step 3: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ai_agent_skill%' OR table_name = 'ai_prompt_methods';`
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260320120000_ai_builder_tables.sql
git commit -m "feat: create ai_agent_skills, ai_agent_skill_assignments, ai_prompt_methods tables"
```

---

## Task 2: Hook `usePromptMethods`

**Files:**
- Create: `src/hooks/usePromptMethods.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const db = supabase as any

export interface PromptMethod {
  id: string
  name: string
  label: string
  description: string | null
  recommended_specialties: string[]
  prompt_template: string
  is_active: boolean
  sort_order: number
}

export function usePromptMethods() {
  const { data, isLoading } = useQuery({
    queryKey: ['prompt-methods'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ai_prompt_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return (data ?? []) as PromptMethod[]
    },
  })

  return { methods: data ?? [], isLoading }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run dev` and check browser console for errors (path aliases prevent single-file tsc).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePromptMethods.ts
git commit -m "feat: add usePromptMethods hook"
```

---

## Task 3: Hook `useAIBuilder`

**Files:**
- Create: `src/hooks/useAIBuilder.ts`

- [ ] **Step 1: Create the hook**

```typescript
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
        body: { mode, messages: history },
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
  }, [messages, mode, phase.total])

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

  return {
    messages,
    state,
    phase,
    partialConfig,
    finalConfig,
    error,
    sendMessage,
    reset,
    startFromTemplate,
  }
}
```

- [ ] **Step 2: Verify it compiles**

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAIBuilder.ts
git commit -m "feat: add useAIBuilder hook for conversational agent/skill creation"
```

---

## Task 4: UI Components — ChatBubble + PhaseIndicator

**Files:**
- Create: `src/components/ai-builder/ChatBubble.tsx`
- Create: `src/components/ai-builder/PhaseIndicator.tsx`

- [ ] **Step 1: Create ChatBubble**

Reuse GMS styling. User bubbles on right (cyan bg), assistant bubbles on left (muted bg with violet avatar).

```typescript
import { cn } from '@/lib/utils'
import { User, Sparkles } from 'lucide-react'
import type { ChatMessage } from '@/hooks/useAIBuilder'

interface Props {
  msg: ChatMessage
}

export function ChatBubble({ msg }: Props) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-[#45E5E5]/20' : 'bg-violet-500/20'
      )}>
        {isUser
          ? <User className="w-4 h-4 text-[#10293F]" />
          : <Sparkles className="w-4 h-4 text-violet-500" />
        }
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]',
        isUser
          ? 'bg-[#10293F] text-white rounded-tr-sm'
          : 'bg-muted text-foreground rounded-tl-sm'
      )}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PhaseIndicator**

```typescript
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { BuilderPhase } from '@/hooks/useAIBuilder'

const AGENT_PHASES = ['Identidade', 'Comportamento', 'Conhecimento', 'Avançado']
const SKILL_PHASES = ['Definição', 'Instruções', 'Ativação']

interface Props {
  phase: BuilderPhase
  mode: 'agent' | 'skill'
}

export function PhaseIndicator({ phase, mode }: Props) {
  const labels = mode === 'agent' ? AGENT_PHASES : SKILL_PHASES

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
      {labels.map((label, i) => {
        const stepNum = i + 1
        const isDone = phase.current > stepNum
        const isCurrent = phase.current === stepNum

        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
              isDone && 'bg-[#45E5E5] text-[#10293F]',
              isCurrent && 'bg-[#10293F] text-white ring-2 ring-[#10293F]/20',
              !isDone && !isCurrent && 'bg-muted text-muted-foreground border border-border'
            )}>
              {isDone ? <Check className="w-3.5 h-3.5" /> : stepNum}
            </div>
            <span className={cn(
              'text-xs hidden sm:block',
              isCurrent && 'font-semibold text-foreground',
              isDone && 'text-[#16A34A]',
              !isDone && !isCurrent && 'text-muted-foreground'
            )}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <div className={cn(
                'h-px flex-1',
                isDone ? 'bg-[#45E5E5]' : 'bg-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Verify both compile in dev server**

- [ ] **Step 4: Commit**

```bash
git add src/components/ai-builder/ChatBubble.tsx src/components/ai-builder/PhaseIndicator.tsx
git commit -m "feat: add ChatBubble and PhaseIndicator components"
```

---

## Task 5: UI Components — MethodSelector

**Files:**
- Create: `src/components/ai-builder/MethodSelector.tsx`

- [ ] **Step 1: Create MethodSelector**

Dropdown for primary method + checkboxes for complementary methods. Uses `usePromptMethods` hook.

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { usePromptMethods } from '@/hooks/usePromptMethods'

interface Props {
  selectedMethods: string[]
  onMethodsChange: (methods: string[]) => void
  specialty?: string
}

export function MethodSelector({ selectedMethods, onMethodsChange, specialty }: Props) {
  const { methods, isLoading } = usePromptMethods()

  if (isLoading || methods.length === 0) return null

  // Recommend primary method based on specialty
  const recommended = methods.find(m =>
    specialty && m.recommended_specialties.includes(specialty)
  )

  const primary = selectedMethods[0] || recommended?.name || ''
  const complementary = selectedMethods.slice(1)

  const handlePrimaryChange = (value: string) => {
    onMethodsChange([value, ...complementary])
  }

  const handleComplementaryToggle = (name: string, checked: boolean) => {
    if (checked) {
      onMethodsChange([primary, ...complementary, name])
    } else {
      onMethodsChange([primary, ...complementary.filter(m => m !== name)])
    }
  }

  // Complementary methods = all methods except the primary
  const complementaryOptions = methods.filter(m => m.name !== primary)

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Método Principal</Label>
        <Select value={primary} onValueChange={handlePrimaryChange}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {methods.map(m => (
              <SelectItem key={m.name} value={m.name}>
                {m.label}
                {specialty && m.recommended_specialties.includes(specialty) && ' ★'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {complementaryOptions.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground">Combinar com:</Label>
          <div className="space-y-2 mt-1.5">
            {complementaryOptions.map(m => (
              <div key={m.name} className="flex items-center gap-2">
                <Checkbox
                  id={`method-${m.name}`}
                  checked={complementary.includes(m.name)}
                  onCheckedChange={(checked) => handleComplementaryToggle(m.name, !!checked)}
                />
                <label htmlFor={`method-${m.name}`} className="text-xs text-foreground cursor-pointer">
                  {m.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/ai-builder/MethodSelector.tsx
git commit -m "feat: add MethodSelector component with primary + complementary methods"
```

---

## Task 6: UI Components — AgentPreviewCard + SkillPreviewCard

**Files:**
- Create: `src/components/ai-builder/AgentPreviewCard.tsx`
- Create: `src/components/ai-builder/SkillPreviewCard.tsx`

- [ ] **Step 1: Create AgentPreviewCard**

```typescript
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, ChevronDown, ChevronUp, Settings, CheckCircle2, Loader2 } from 'lucide-react'
import { MethodSelector } from './MethodSelector'
import { cn } from '@/lib/utils'

const SPECIALTY_LABELS: Record<string, string> = {
  triage: 'Triagem', support: 'Suporte', financial: 'Financeiro',
  sales: 'Vendas', sdr: 'SDR', copilot: 'Copiloto',
  analytics: 'Analítico', customer_success: 'Sucesso do Cliente',
}
const TONE_LABELS: Record<string, string> = {
  professional: 'Profissional', casual: 'Casual', friendly: 'Amigável', formal: 'Formal',
}

interface Props {
  config: Record<string, any>
  methods: string[]
  onMethodsChange: (m: string[]) => void
  onCreateAgent: () => void
  onOpenEditor: () => void
  isCreating: boolean
  isPreview: boolean // true when finalConfig is set
}

export function AgentPreviewCard({ config, methods, onMethodsChange, onCreateAgent, onOpenEditor, isCreating, isPreview }: Props) {
  const [promptExpanded, setPromptExpanded] = useState(false)
  const hasName = !!config.name

  if (!hasName) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">O preview do agente aparecerá aqui conforme você responde as perguntas.</p>
      </div>
    )
  }

  const sc = config.support_config || {}
  const promptWords = (config.system_prompt || '').split(/\s+/).filter(Boolean).length

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_4px_6px_-1px_rgba(16,41,63,0.1)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color || '#45E5E5'}20`, color: config.color || '#45E5E5' }}>
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{config.name}</h3>
              {config.specialty && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {SPECIALTY_LABELS[config.specialty] || config.specialty}
                </Badge>
              )}
            </div>
            {config.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{config.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Config grid */}
        <div className="grid grid-cols-2 gap-3">
          {config.tone && <ConfigItem label="Tom" value={TONE_LABELS[config.tone] || config.tone} />}
          {config.language && <ConfigItem label="Idioma" value={config.language === 'pt-BR' ? 'Português' : config.language} />}
          {config.temperature != null && <ConfigItem label="Temperature" value={String(config.temperature)} />}
          {config.max_tokens && <ConfigItem label="Max Tokens" value={String(config.max_tokens)} />}
          {config.rag_enabled != null && <ConfigItem label="RAG" value={config.rag_enabled ? 'Habilitado' : 'Desabilitado'} />}
          {config.confidence_threshold != null && <ConfigItem label="Confiança" value={`${(config.confidence_threshold * 100).toFixed(0)}%`} />}
        </div>

        {/* Greeting */}
        {sc.greeting && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Saudação</p>
            <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2 italic">"{sc.greeting}"</p>
          </div>
        )}

        {/* Method selector */}
        <MethodSelector selectedMethods={methods} onMethodsChange={onMethodsChange} specialty={config.specialty} />

        {/* System prompt */}
        {config.system_prompt && (
          <div className="space-y-1">
            <button onClick={() => setPromptExpanded(p => !p)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
              System Prompt ({promptWords} palavras)
              {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {promptExpanded && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {config.system_prompt}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPreview && (
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex gap-3">
          <Button className="flex-1 gap-2" onClick={onCreateAgent} disabled={isCreating}>
            {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><CheckCircle2 className="w-4 h-4" /> Criar Agente</>}
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={onOpenEditor} disabled={isCreating}>
            <Settings className="w-4 h-4" /> Personalizar no Editor
          </Button>
        </div>
      )}
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create SkillPreviewCard**

```typescript
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, ChevronDown, ChevronUp, CheckCircle2, Loader2, Settings } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  atendimento: 'Atendimento', financeiro: 'Financeiro', vendas: 'Vendas',
  tecnico: 'Técnico', interno: 'Interno', general: 'Geral',
}

interface Props {
  config: Record<string, any>
  onCreateSkill: () => void
  onOpenEditor: () => void
  isCreating: boolean
  isPreview: boolean
}

export function SkillPreviewCard({ config, onCreateSkill, onOpenEditor, isCreating, isPreview }: Props) {
  const [instructionsExpanded, setInstructionsExpanded] = useState(false)

  if (!config.name) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">O preview da skill aparecerá aqui conforme você responde as perguntas.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_4px_6px_-1px_rgba(16,41,63,0.1)]">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color || '#6366f1'}20`, color: config.color || '#6366f1' }}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{config.name}</h3>
            {config.category && (
              <Badge variant="outline" className="text-xs mt-0.5">
                {CATEGORY_LABELS[config.category] || config.category}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}

        {/* Activation */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Ativação</p>
          <div className="flex flex-wrap gap-2">
            {config.auto_activate && <Badge variant="default" className="text-xs">Auto-ativar</Badge>}
            {(config.trigger_keywords || []).map((kw: string) => (
              <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
            ))}
            {(config.trigger_intents || []).map((intent: string) => (
              <Badge key={intent} variant="outline" className="text-xs">{intent}</Badge>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {config.prompt_instructions && (
          <div className="space-y-1">
            <button onClick={() => setInstructionsExpanded(p => !p)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
              Instruções
              {instructionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {instructionsExpanded && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {config.prompt_instructions}
              </div>
            )}
          </div>
        )}
      </div>

      {isPreview && (
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex gap-3">
          <Button className="flex-1 gap-2" onClick={onCreateSkill} disabled={isCreating}>
            {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><CheckCircle2 className="w-4 h-4" /> Criar Skill</>}
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={onOpenEditor} disabled={isCreating}>
            <Settings className="w-4 h-4" /> Editar Formulário
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify both compile**

- [ ] **Step 4: Commit**

```bash
git add src/components/ai-builder/AgentPreviewCard.tsx src/components/ai-builder/SkillPreviewCard.tsx
git commit -m "feat: add AgentPreviewCard and SkillPreviewCard with live preview"
```

---

## Task 7: UI Components — TemplatesGrid

**Files:**
- Create: `src/components/ai-builder/TemplatesGrid.tsx`

- [ ] **Step 1: Create TemplatesGrid**

Hardcoded templates absorbed from the existing `AgentTemplates.tsx` and `SkillAgentDialog.tsx` SKILL_SUGGESTIONS. Each template is a card that, on click, calls `onSelectTemplate(description)` which starts the chat flow.

Templates to include (9):
1. Triagem (triage) — icon: Filter, color: #8B5CF6
2. Suporte Técnico (support) — icon: Headphones, color: #45E5E5
3. Financeiro/Cobrança (financial) — icon: DollarSign, color: #F59E0B
4. Vendas/SDR (sales) — icon: TrendingUp, color: #10B981
5. Copiloto (copilot) — icon: Users, color: #06B6D4
6. Pós-venda (customer_success) — icon: Heart, color: #EC4899
7. Onboarding — icon: UserPlus, color: #3B82F6
8. Feedback/NPS — icon: Star, color: #F97316
9. Retenção — icon: Shield, color: #EF4444

Each card: icon + label + short description. Grid: `grid-cols-2 md:grid-cols-3` with gap-3.

- [ ] **Step 2: Verify it compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/ai-builder/TemplatesGrid.tsx
git commit -m "feat: add TemplatesGrid with 9 pre-built agent templates"
```

---

## Task 8: UI Components — BuilderChat + BuilderPreview

**Files:**
- Create: `src/components/ai-builder/BuilderChat.tsx`
- Create: `src/components/ai-builder/BuilderPreview.tsx`

- [ ] **Step 1: Create BuilderChat**

```typescript
import { useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { PhaseIndicator } from './PhaseIndicator'
import { ChatBubble } from './ChatBubble'
import type { ChatMessage, BuilderPhase, BuilderState, BuilderMode } from '@/hooks/useAIBuilder'

interface Props {
  messages: ChatMessage[]
  phase: BuilderPhase
  mode: BuilderMode
  state: BuilderState
  error: string | null
  onSendMessage: (text: string) => void
}

const WELCOME: Record<BuilderMode, string> = {
  agent: 'Olá! Sou o Arquiteto de Agentes da Sismais. Vou te guiar na criação de um agente profissional com perguntas detalhadas para garantir a melhor configuração possível.\n\nDescreva o que você precisa — qual o objetivo principal deste agente?',
  skill: 'Olá! Vou te ajudar a criar uma skill profissional para seus agentes. Skills são habilidades modulares que podem ser atribuídas a múltiplos agentes.\n\nQual habilidade você quer criar?',
}

export function BuilderChat({ messages, phase, mode, state, error, onSendMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, state])

  useEffect(() => {
    if (state === 'chatting') textareaRef.current?.focus()
  }, [state])

  const handleSend = () => {
    const text = inputRef.current.trim()
    if (!text || state === 'loading') return
    onSendMessage(text)
    inputRef.current = ''
    if (textareaRef.current) textareaRef.current.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showInput = state === 'chatting' || state === 'idle'

  return (
    <div className="flex flex-col h-full">
      <PhaseIndicator phase={phase} mode={mode} />

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Welcome message if no messages yet */}
          {messages.length === 0 && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed max-w-[85%]">
                <p className="whitespace-pre-wrap">{WELCOME[mode]}</p>
              </div>
            </div>
          )}

          {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}

          {state === 'loading' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Analisando...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showInput && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              onChange={e => { inputRef.current = e.target.value }}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? 'Descreva o que você precisa...' : 'Responda a pergunta da IA...'}
              rows={2}
              className="resize-none text-sm flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={state === 'loading'} className="h-9 w-9 shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create BuilderPreview**

```typescript
import { AgentPreviewCard } from './AgentPreviewCard'
import { SkillPreviewCard } from './SkillPreviewCard'
import type { BuilderMode, BuilderState } from '@/hooks/useAIBuilder'

interface Props {
  mode: BuilderMode
  partialConfig: Record<string, any>
  finalConfig: Record<string, any> | null
  state: BuilderState
  methods: string[]
  onMethodsChange: (m: string[]) => void
  onCreateAgent: () => void
  onCreateSkill: () => void
  onOpenEditor: () => void
  isCreating: boolean
}

export function BuilderPreview({
  mode, partialConfig, finalConfig, state, methods, onMethodsChange,
  onCreateAgent, onCreateSkill, onOpenEditor, isCreating,
}: Props) {
  const config = finalConfig || partialConfig
  const isPreview = state === 'preview'

  if (mode === 'agent') {
    return (
      <div className="p-4 h-full overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview do Agente</p>
        <AgentPreviewCard
          config={config}
          methods={methods}
          onMethodsChange={onMethodsChange}
          onCreateAgent={onCreateAgent}
          onOpenEditor={onOpenEditor}
          isCreating={isCreating}
          isPreview={isPreview}
        />
      </div>
    )
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview da Skill</p>
      <SkillPreviewCard
        config={config}
        onCreateSkill={onCreateSkill}
        onOpenEditor={onOpenEditor}
        isCreating={isCreating}
        isPreview={isPreview}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify both compile**

- [ ] **Step 4: Commit**

```bash
git add src/components/ai-builder/BuilderChat.tsx src/components/ai-builder/BuilderPreview.tsx
git commit -m "feat: add BuilderChat and BuilderPreview panels"
```

---

## Task 9: Page — AIBuilder.tsx

**Files:**
- Create: `src/pages/AIBuilder.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Wand2, Bot, Zap, LayoutGrid, PanelLeft, PanelRight } from 'lucide-react'
import { toast } from 'sonner'
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
  const [tab, setTab] = useState<string>('agent')
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'preview'>('chat')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])

  const mode: BuilderMode = tab === 'skill' ? 'skill' : 'agent'
  const builder = useAIBuilder(mode)
  const { createAgent } = useAgents()
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
        model: 'google/gemini-2.0-flash-lite-001',
        learning_enabled: true,
        is_active: true,
        support_config: sc,
        prompt_methods: selectedMethods,
      }
      await createAgent.mutateAsync(payload as AgentInsert)
      toast.success(`${c.name} criado com sucesso!`)
      navigate('/agents')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar agente')
    } finally {
      setIsCreating(false)
    }
  }, [builder.finalConfig, createAgent, navigate, selectedMethods])

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
    // Store config in sessionStorage for AgentFormDialog to pick up
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
            <h1 className="text-lg font-semibold text-foreground">AI Builder</h1>
            <p className="text-xs text-muted-foreground">Crie agentes e skills profissionais com inteligência artificial</p>
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
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders in dev server**

Run: `npm run dev` and navigate to `/ai-builder`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AIBuilder.tsx
git commit -m "feat: add AIBuilder page with tabs, split layout, and mobile support"
```

---

## Task 10: Edge Function — `ai-builder`

**Files:**
- Create: `supabase/functions/ai-builder/index.ts`

- [ ] **Step 1: Create the edge function**

Based on existing `skill-agent-creator/index.ts` but with key differences:
- Accept `mode` param ('agent' | 'skill')
- Build different system prompts for agent vs skill creation
- Deep conversational flow (10-15 questions for agent, 8 for skill)
- Return `phase`, `phase_label`, `partial_config` with each question
- Fetch available prompt methods from `ai_prompt_methods` table and include in context
- Two tools: `generate_agent` (same schema as existing `generate_skill_agent` but with `prompt_methods` field added) + `generate_skill` (new tool for skills)
- Model: `google/gemini-2.5-pro` (same as existing)

System prompt key differences from old version:
- Remove "NUNCA faça mais de 2 perguntas" rule
- Add phase tracking instructions: "Você está na fase N de M. Faça UMA pergunta por vez."
- Add method awareness: include available methods and their templates
- Add partial_config tracking: "Após cada resposta, retorne um partial_config com os campos já definidos"

Reference: `supabase/functions/skill-agent-creator/index.ts` for structure, `supabase/functions/_shared/openrouter-client.ts` for LLM calling.

The `generate_skill` tool schema:
```json
{
  "name": "string (required)",
  "slug": "string (required)",
  "description": "string",
  "icon": "string (Lucide icon name)",
  "color": "string (hex)",
  "category": "string (enum: atendimento|financeiro|vendas|tecnico|interno|general)",
  "prompt_instructions": "string (required, detailed instructions)",
  "trigger_keywords": "string[]",
  "trigger_intents": "string[]",
  "tool_ids": "string[]",
  "auto_activate": "boolean",
  "agent_assignments": "string[] (agent IDs to assign this skill to)"
}
```

Add `prompt_methods` field to existing `generate_agent` tool schema:
```json
{
  "prompt_methods": {
    "type": "array",
    "items": { "type": "string" },
    "description": "Metodos de prompt engineering selecionados (ex: ['chain_of_thought', 'emotion_method'])"
  }
}
```

- [ ] **Step 2: Test locally**

Run: `npx supabase functions serve ai-builder` and test with curl:
```bash
curl -X POST http://localhost:54321/functions/v1/ai-builder \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"agent","messages":[{"role":"user","content":"Preciso de um agente de cobranca"}]}'
```
Expected: JSON with `type: "question"`, `phase: 1`, `partial_config` with partial fields.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-builder/index.ts
git commit -m "feat: add ai-builder edge function with deep conversational flow"
```

---

## Task 11: Modify agent-executor — Inject Prompt Methods

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`

- [ ] **Step 1: Add prompt methods injection**

Find the line `// 5. Montar mensagens para LLM` and the line `let systemPrompt = agent.system_prompt + skillsPrompt + ...`. Insert the following block BETWEEN the skills try/catch block (ending with `console.warn('[agent-executor] Skills fetch error:', err)`) and the `// 5. Montar mensagens` comment:

```typescript
    // 4c. Inject prompt methods
    let methodsPrompt = ''
    if (!isPlayground) {
      try {
        const agentMethods = (agent.prompt_methods || []) as string[]
        if (agentMethods.length > 0) {
          const { data: methods } = await supabase
            .from('ai_prompt_methods')
            .select('name, label, prompt_template')
            .in('name', agentMethods)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

          if (methods && methods.length > 0) {
            const methodBlocks = methods.map((m: any) =>
              `### ${m.label}\n${m.prompt_template}`
            )
            methodsPrompt = `\n\n## MÉTODOS DE RACIOCÍNIO\n${methodBlocks.join('\n\n')}`
            console.log(`[agent-executor] Injected ${methods.length} prompt methods: ${methods.map((m: any) => m.name).join(', ')}`)
          }
        }
      } catch (err) {
        console.warn('[agent-executor] Methods fetch error:', err)
      }
    }
```

Then modify line 284:
```typescript
    let systemPrompt = agent.system_prompt + skillsPrompt + methodsPrompt + RECENCY_INSTRUCTION + ragContext
```

- [ ] **Step 2: Test with existing agent (no methods)**

Verify existing agents with `prompt_methods = '{}'` still work identically — `methodsPrompt` should be empty string.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat: inject prompt methods into agent system prompt in agent-executor"
```

---

## Task 12: Routes + Sidebar + Agents Page Updates

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/pages/Agents.tsx`

- [ ] **Step 1: Update App.tsx**

Add lazy import:
```typescript
const AIBuilder = lazy(() => import("./pages/AIBuilder"))
```

Add route (inside AdminRoute section):
```typescript
<Route path="/ai-builder" element={<AdminRoute><AIBuilder /></AdminRoute>} />
```

Remove routes:
```typescript
// DELETE these lines:
// <Route path="/ai-config" element={<AIConfig />} />
// <Route path="/ai-config-guide" element={<AIConfigGuide />} />
// <Route path="/human-agents" element={<Navigate to="/admin/users" replace />} />
```

Remove lazy imports:
```typescript
// DELETE:
// const AIConfig = lazy(() => import("./pages/AIConfig"))
// const AIConfigGuide = lazy(() => import("./pages/AIConfigGuide"))
```

- [ ] **Step 2: Update Sidebar.tsx**

Add AI Builder link in the agents section:
```typescript
{ label: 'AI Builder', path: '/ai-builder', icon: Wand2 }
```

Remove any references to `/ai-config`, `/ai-configurator` (if present in sidebar — grep confirmed none currently).

- [ ] **Step 3: Update Agents.tsx**

Change the "Criar Agente" button to navigate to `/ai-builder` instead of opening `SkillAgentDialog`:
```typescript
// Before: onClick={() => setSkillDialogOpen(true)}
// After:
import { useNavigate } from 'react-router-dom'
const navigate = useNavigate()
// onClick={() => navigate('/ai-builder')}
```

Remove `SkillAgentDialog` import and usage.

- [ ] **Step 4: Verify navigation works**

Run: `npm run dev`, go to `/agents`, click "Criar Agente" → should navigate to `/ai-builder`.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx src/pages/Agents.tsx
git commit -m "feat: add /ai-builder route, update sidebar and agents page navigation"
```

---

## Task 13: Delete Dead Code

**Files to delete:**
- `src/pages/AIConfig.tsx`
- `src/pages/AIConfigGuide.tsx`
- `src/pages/HumanAgents.tsx`
- `src/components/agents/SkillAgentDialog.tsx`
- `src/components/agents/AgentSupportEditor.tsx`
- `src/components/agents/AgentAIConfigurator.tsx`
- `src/components/agents/AgentTemplates.tsx`

- [ ] **Step 1: Check for remaining imports of these files**

Run grep for each deleted file to ensure no other file imports them. Fix any broken imports before deleting.

Files to check:
- `AgentSupportEditor` — may be imported in AgentFormDialog
- `AgentAIConfigurator` — may be imported in AgentFormDialog
- `AgentTemplates` — may be imported in SkillAgentDialog (already removed)

- [ ] **Step 2: Remove imports from consuming files**

For each broken import found, remove the import and any JSX usage. If a tab in AgentFormDialog references `AgentAIConfigurator`, remove that tab entry.

- [ ] **Step 3: Delete the files**

```bash
git rm src/pages/AIConfig.tsx
git rm src/pages/AIConfigGuide.tsx
git rm src/pages/HumanAgents.tsx
git rm src/components/agents/SkillAgentDialog.tsx
git rm src/components/agents/AgentSupportEditor.tsx
git rm src/components/agents/AgentAIConfigurator.tsx
git rm src/components/agents/AgentTemplates.tsx
```

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: No errors. All imports resolved.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: remove 7 duplicated/dead files consolidated into AI Builder"
```

---

## Task 14: Update AIConfigurator — Remove Agent Creation

**Files:**
- Modify: `src/pages/AIConfigurator.tsx`

Per spec: keep `/ai-configurator` for webhooks and automations, but remove agent creation capability.

- [ ] **Step 1: Find agent-creation code in AIConfigurator**

Grep for `context.*agent` or `agent` mode handling in AIConfigurator.tsx. The page uses contexts to determine what to configure — remove or redirect the 'agent' context.

- [ ] **Step 2: Add redirect to AI Builder**

When user tries to create an agent via AIConfigurator, show a message redirecting to `/ai-builder`:

```typescript
// In the agent context handler or agent creation section, replace with:
import { useNavigate } from 'react-router-dom'
// ...
const navigate = useNavigate()
// When agent context detected:
// Show banner: "Para criar agentes, use o AI Builder"
// Button: navigate('/ai-builder')
```

- [ ] **Step 3: Verify AIConfigurator still works for webhooks/automations**

- [ ] **Step 4: Commit**

```bash
git add src/pages/AIConfigurator.tsx
git commit -m "refactor: remove agent creation from AIConfigurator, redirect to AI Builder"
```

---

## Task 15: Deploy Edge Functionss

**Files:**
- Deploy: `supabase/functions/ai-builder/index.ts`

- [ ] **Step 1: Deploy the edge function**

Run: `npx supabase functions deploy ai-builder --project-ref pomueweeulenslxvsxar`

- [ ] **Step 2: Deploy updated agent-executor**

Run: `npx supabase functions deploy agent-executor --project-ref pomueweeulenslxvsxar`

- [ ] **Step 3: Test end-to-end**

Navigate to `/ai-builder` in the app, start creating an agent via chat, verify:
1. IA asks questions one at a time
2. Phase indicator updates
3. Preview card updates progressively
4. Method selector appears with recommendation
5. Final config generates complete agent
6. "Criar Agente" saves to database
7. Redirect to `/agents` with toast

- [ ] **Step 4: Commit any fixes**

```bash
git add supabase/functions/ai-builder/ supabase/functions/agent-executor/
git commit -m "fix: end-to-end adjustments for AI Builder"
```

---

## Task 16: Final Build Verification

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Verify deleted routes return 404**

Navigate to `/ai-config`, `/ai-config-guide`, `/human-agents` — should not render old pages (404 or redirect).

- [ ] **Step 4: Verify skills functionality works**

Go to `/agents`, edit an agent, go to "Skills" tab — should load skills from `ai_agent_skills` table (may be empty, but no errors).

- [ ] **Step 5: Final commit**

```bash
git status
# Stage only relevant files, no secrets
git commit -m "chore: final verification — AI Builder complete"
```
