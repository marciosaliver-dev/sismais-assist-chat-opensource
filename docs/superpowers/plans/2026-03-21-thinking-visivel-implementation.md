# Fase 2B — Thinking Visível Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Raciocínio" tab to the inbox side panel showing AI agent reasoning (confidence signals + LLM explanation) per message.

**Architecture:** Backend changes in agent-executor Edge Function to extract `<reasoning>` blocks from LLM output and save structured signals. Frontend adds a new tab to AIAnalysisPanel with a dashboard-style signal viewer. Migration adds two nullable columns to ai_messages.

**Tech Stack:** Supabase (PostgreSQL + Edge Functions/Deno), React 18 + TypeScript, TanStack React Query, shadcn/ui, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-21-thinking-visivel-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260321200000_reasoning_fields.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Fase 2B: Thinking Visível — campos de raciocínio
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS reasoning_text TEXT CHECK (char_length(reasoning_text) <= 2000),
  ADD COLUMN IF NOT EXISTS reasoning_signals JSONB DEFAULT '{}';

-- Índice parcial para queries da tab Raciocínio (assistant messages por conversa, desc)
CREATE INDEX IF NOT EXISTS idx_ai_messages_reasoning
  ON ai_messages (conversation_id, role, created_at DESC)
  WHERE role = 'assistant';

COMMENT ON COLUMN ai_messages.reasoning_text IS 'Explicação em linguagem natural gerada pelo LLM sobre seu raciocínio';
COMMENT ON COLUMN ai_messages.reasoning_signals IS 'Sinais estruturados de confiança: {kb_match, specialty_alignment, guardrails, hedging, tools, client_data}';
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` (or apply via Supabase dashboard SQL editor)
Expected: Migration applies successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260321200000_reasoning_fields.sql
git commit -m "feat(db): add reasoning_text and reasoning_signals to ai_messages"
```

---

### Task 2: Agent-Executor — Reasoning Extraction & Signals

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`
  - Line ~337: Add reasoning instruction to system prompt
  - Line ~456: Add extractReasoning function and call it after LLM response
  - Line ~676: Add reasoning_signals assembly after confidence calculation
  - Line ~693: Add PII sanitization for reasoning_text
  - Line ~822: Add reasoning_text and reasoning_signals to INSERT

- [ ] **Step 1: Add extractReasoning function**

Add at the top of the handler (after imports, before `Deno.serve`), around line 10:

```typescript
function extractReasoning(rawContent: string): { content: string; reasoning: string | null } {
  const match = rawContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)
  if (!match) return { content: rawContent.trim(), reasoning: null }

  const reasoning = match[1].trim().slice(0, 2000)
  const content = rawContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim()
  return { content, reasoning }
}
```

- [ ] **Step 2: Add reasoning instruction to system prompt**

At line ~337, after the `systemPrompt` is assembled (after all existing appends, before `const messages = [`), add:

```typescript
// Fase 2B: Instrução de raciocínio visível
systemPrompt += `\n\nAntes de responder, inclua um bloco <reasoning> explicando brevemente:\n- Quais documentos da base de conhecimento você consultou (se houver)\n- Que dados do cliente você usou (se disponíveis)\n- Por que escolheu essa abordagem de resposta\nMantenha o raciocínio conciso (2-4 frases). Não repita o conteúdo da resposta.`
```

- [ ] **Step 3: Extract reasoning from LLM response**

After line ~456 (`let finalMessage = choice.message?.content || ''`), add:

```typescript
// Fase 2B: Extrair raciocínio do LLM
const { content: cleanContent, reasoning: extractedReasoning } = extractReasoning(finalMessage)
finalMessage = cleanContent
```

Immediately after the extraction, declare the tracking variable:

```typescript
let latestReasoning = extractedReasoning
```

Then, inside the ReAct loop, after line ~600 (`finalMessage = iterChoice.message.content`), add:

```typescript
const { content: iterCleanContent, reasoning: iterReasoning } = extractReasoning(finalMessage)
finalMessage = iterCleanContent
if (iterReasoning) latestReasoning = iterReasoning
```

**Important:** The `let latestReasoning` MUST be declared in the outer scope (right after the first extraction at ~456), NOT inside the loop. The loop only updates it if a new reasoning block is found.

- [ ] **Step 4: Hoist maxSimilarity to outer scope and assemble reasoning_signals**

First, at line ~616, change `const maxSimilarity` to use an outer-scope variable:
- Before the `if (ragDocuments.length > 0)` block (line ~615), add: `let maxSimilarity = 0`
- Inside the block, change `const maxSimilarity = Math.max(...)` to `maxSimilarity = Math.max(...)`

Then, after line ~676 (after confidence clamp), add:

```typescript
// Fase 2B: Montar sinais de raciocínio estruturados
const reasoningSignals = {
  kb_match: {
    status: ragDocuments.length > 0
      ? (maxSimilarity >= 0.8 ? 'strong' : 'partial')
      : (agent.rag_enabled ? 'none' : 'disabled'),
    score: ragDocuments.length > 0 ? maxSimilarity : null,
    docs_count: ragDocuments.length,
    top_doc_title: ragDocuments[0]?.title || undefined,
  },
  specialty_alignment: {
    status: matchingSpecialties.length === 0 ? 'aligned'
      : matchingSpecialties.includes(agent.specialty) ? 'aligned' : 'misaligned',
    agent_specialty: agent.specialty || 'unknown',
    detected_intent: analysis?.intent || 'unknown',
  },
  guardrails: {
    violations: guardrailsTriggered.filter((g: string) => g.startsWith('PII')).length,
    warnings: guardrailsTriggered.filter((g: string) => !g.startsWith('PII')).length,
    details: guardrailsTriggered.length > 0 ? guardrailsTriggered : undefined,
  },
  hedging: {
    detected: hedgingCount > 0,
    severity: hedgingCount === 0 ? 'none' : hedgingCount === 1 ? 'light' : 'heavy',
    penalty: hedgingCount >= 2 ? -0.15 : hedgingCount === 1 ? -0.08 : 0,
  },
  tools_used: toolsUsed,
  client_data: {
    available: !!conversationData?.helpdesk_client_id,
    source: conversationData?.helpdesk_client_id ? 'sismais_gl' : undefined,
  },
}
```

- [ ] **Step 5: Sanitize PII in reasoning_text**

After line ~693 (after existing PII sanitization loop for `finalMessage`), add:

```typescript
// Fase 2B: Sanitizar PII no reasoning_text
let sanitizedReasoning = latestReasoning
if (sanitizedReasoning) {
  for (const [type, regex] of Object.entries(PII_PATTERNS)) {
    regex.lastIndex = 0
    if (regex.test(sanitizedReasoning)) {
      regex.lastIndex = 0
      sanitizedReasoning = sanitizedReasoning.replace(regex, '[DADOS PROTEGIDOS]')
    }
  }
}
```

- [ ] **Step 6: Add fields to INSERT**

At line ~822, in the `.insert({...})` call, add after `whatsapp_instance_id`:

```typescript
        reasoning_text: sanitizedReasoning || null,
        reasoning_signals: reasoningSignals,
```

- [ ] **Step 7: Test manually**

Test via Supabase Edge Function logs or by sending a test message through the WhatsApp pipeline. Verify:
1. LLM response contains `<reasoning>` block
2. `reasoning_text` is saved in ai_messages (check via SQL: `SELECT id, reasoning_text, reasoning_signals FROM ai_messages ORDER BY created_at DESC LIMIT 5`)
3. `content` field does NOT contain `<reasoning>` tags
4. PII in reasoning is masked

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat(agent-executor): extract reasoning and save confidence signals"
```

---

### Task 3: ReasoningTab Component

**Files:**
- Create: `src/components/inbox/ReasoningTab.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen, Target, Shield, AlertTriangle, Wrench, User, Info, Lightbulb
} from 'lucide-react'

interface ReasoningTabProps {
  conversationId: string
}

interface ReasoningSignals {
  kb_match?: { status: string; score: number | null; docs_count: number; top_doc_title?: string }
  specialty_alignment?: { status: string; agent_specialty: string; detected_intent: string }
  guardrails?: { violations: number; warnings: number; details?: string[] }
  hedging?: { detected: boolean; severity: string; penalty: number }
  tools_used?: string[]
  client_data?: { available: boolean; source?: string }
}

const signalConfig = [
  {
    key: 'kb_match' as const,
    icon: BookOpen,
    label: 'Knowledge Base',
    getValue: (s: ReasoningSignals) => {
      const kb = s.kb_match
      if (!kb) return { text: '—', color: 'text-muted-foreground' }
      if (kb.status === 'strong') return { text: `Match forte (${kb.score?.toFixed(2)})`, color: 'text-emerald-600' }
      if (kb.status === 'partial') return { text: `Match parcial (${kb.score?.toFixed(2)})`, color: 'text-amber-600' }
      if (kb.status === 'none') return { text: 'Sem match', color: 'text-destructive' }
      return { text: 'RAG desabilitado', color: 'text-muted-foreground' }
    },
    getBg: (s: ReasoningSignals) => {
      const st = s.kb_match?.status
      if (st === 'strong') return 'bg-emerald-50 dark:bg-emerald-950/30'
      if (st === 'partial') return 'bg-amber-50 dark:bg-amber-950/30'
      if (st === 'none') return 'bg-destructive/10'
      return 'bg-muted'
    },
  },
  {
    key: 'specialty' as const,
    icon: Target,
    label: 'Alinhamento specialty',
    getValue: (s: ReasoningSignals) => {
      const sa = s.specialty_alignment
      if (!sa) return { text: '—', color: 'text-muted-foreground' }
      const arrow = `${sa.agent_specialty} ↔ ${sa.detected_intent}`
      if (sa.status === 'aligned') return { text: arrow, color: 'text-emerald-600' }
      if (sa.status === 'misaligned') return { text: arrow, color: 'text-destructive' }
      return { text: arrow, color: 'text-amber-600' }
    },
    getBg: (s: ReasoningSignals) => {
      const st = s.specialty_alignment?.status
      if (st === 'aligned') return 'bg-emerald-50 dark:bg-emerald-950/30'
      if (st === 'misaligned') return 'bg-destructive/10'
      return 'bg-amber-50 dark:bg-amber-950/30'
    },
  },
  {
    key: 'guardrails' as const,
    icon: Shield,
    label: 'Guardrails',
    getValue: (s: ReasoningSignals) => {
      const g = s.guardrails
      if (!g) return { text: '—', color: 'text-muted-foreground' }
      if (g.violations > 0) return { text: `${g.violations} violação(ões)`, color: 'text-destructive' }
      if (g.warnings > 0) return { text: `${g.warnings} aviso(s)`, color: 'text-amber-600' }
      return { text: '0 violações', color: 'text-emerald-600' }
    },
    getBg: (s: ReasoningSignals) => {
      const g = s.guardrails
      if (g?.violations && g.violations > 0) return 'bg-destructive/10'
      if (g?.warnings && g.warnings > 0) return 'bg-amber-50 dark:bg-amber-950/30'
      return 'bg-emerald-50 dark:bg-emerald-950/30'
    },
  },
  {
    key: 'hedging' as const,
    icon: AlertTriangle,
    label: 'Hedging detectado',
    getValue: (s: ReasoningSignals) => {
      const h = s.hedging
      if (!h) return { text: '—', color: 'text-muted-foreground' }
      if (!h.detected) return { text: 'Nenhum', color: 'text-emerald-600' }
      if (h.severity === 'light') return { text: `Leve (${h.penalty})`, color: 'text-amber-600' }
      return { text: `Forte (${h.penalty})`, color: 'text-destructive' }
    },
    getBg: (s: ReasoningSignals) => {
      const h = s.hedging
      if (!h?.detected) return 'bg-emerald-50 dark:bg-emerald-950/30'
      if (h.severity === 'light') return 'bg-amber-50 dark:bg-amber-950/30'
      return 'bg-destructive/10'
    },
  },
  {
    key: 'tools' as const,
    icon: Wrench,
    label: 'Tools usadas',
    getValue: (s: ReasoningSignals) => {
      const t = s.tools_used
      if (!t || t.length === 0) return { text: 'Nenhuma', color: 'text-muted-foreground' }
      return { text: t.join(', '), color: 'text-foreground' }
    },
    getBg: () => 'bg-muted',
  },
  {
    key: 'client' as const,
    icon: User,
    label: 'Dados do cliente',
    getValue: (s: ReasoningSignals) => {
      const c = s.client_data
      if (!c) return { text: '—', color: 'text-muted-foreground' }
      if (c.available) return { text: `Disponível (${c.source || 'local'})`, color: 'text-emerald-600' }
      return { text: 'Indisponível', color: 'text-destructive' }
    },
    getBg: (s: ReasoningSignals) => {
      if (s.client_data?.available) return 'bg-emerald-50 dark:bg-emerald-950/30'
      return 'bg-destructive/10'
    },
  },
]

export function ReasoningTab({ conversationId }: ReasoningTabProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['reasoning', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_messages')
        .select('id, confidence, confidence_reason, tools_used, rag_sources, reasoning_text, reasoning_signals, created_at')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(10)
      return data || []
    },
    staleTime: 30_000,
    enabled: !!conversationId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
        <Lightbulb className="w-8 h-8 opacity-40" />
        <span className="text-sm">Nenhuma resposta da IA nesta conversa</span>
      </div>
    )
  }

  const selected = messages[selectedIdx]
  const conf = selected?.confidence ? Math.round(Number(selected.confidence) * 100) : null
  const signals: ReasoningSignals = (selected?.reasoning_signals as ReasoningSignals) || {}

  const confColor = conf === null ? 'text-muted-foreground'
    : conf < 50 ? 'text-destructive'
    : conf < 70 ? 'text-amber-600'
    : 'text-emerald-600'

  const confGradient = conf === null ? 'bg-muted'
    : conf < 50 ? 'bg-destructive'
    : conf < 70 ? 'bg-amber-500'
    : 'bg-emerald-500'

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Seletor de mensagens */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {messages.map((msg, i) => (
            <button
              key={msg.id}
              onClick={() => setSelectedIdx(i)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                i === selectedIdx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {i === 0 ? 'Última' : `#${messages.length - i}`}
            </button>
          ))}
        </div>

        {/* Bloco de confiança */}
        {conf !== null && (
          <div className="flex items-center gap-3">
            <span className={cn('text-3xl font-bold tabular-nums', confColor)}>{conf}%</span>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', confGradient)}
                  style={{ width: `${conf}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">Confiança geral</span>
            </div>
          </div>
        )}

        {/* Lista de sinais */}
        <div className="space-y-1">
          {signalConfig.map(({ key, icon: Icon, label, getValue, getBg }) => {
            const { text, color } = getValue(signals)
            const bg = getBg(signals)
            return (
              <div key={key} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', bg)}>
                  <Icon className="w-3.5 h-3.5 text-foreground/70" />
                </div>
                <span className="text-xs text-muted-foreground flex-1">{label}</span>
                <span className={cn('text-xs font-medium text-right max-w-[140px] truncate', color)}>{text}</span>
              </div>
            )
          })}
        </div>

        {/* Separador */}
        <div className="border-t border-dashed border-border" />

        {/* Explicação do agente */}
        {selected?.reasoning_text ? (
          <div>
            <span className="text-xs font-semibold text-foreground mb-1.5 block">Explicação do agente</span>
            <div className="bg-muted rounded-lg p-3 border-l-[3px] border-primary text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {selected.reasoning_text}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Info className="w-4 h-4" />
            <span className="text-xs">Raciocínio não disponível para esta mensagem</span>
          </div>
        )}

        {/* Confidence reason (fallback para mensagens antigas) */}
        {!selected?.reasoning_text && selected?.confidence_reason && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Motivo:</span> {selected.confidence_reason}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/components/inbox/ReasoningTab.tsx` or check via IDE.
Note: The `reasoning_text` and `reasoning_signals` columns may not be in the generated Supabase types yet. If so, cast with `as any` temporarily or update types first.

- [ ] **Step 3: Commit**

```bash
git add src/components/inbox/ReasoningTab.tsx
git commit -m "feat(ui): add ReasoningTab component with signals dashboard"
```

---

### Task 4: Wire ReasoningTab into AIAnalysisPanel

**Files:**
- Modify: `src/components/inbox/AIAnalysisPanel.tsx`
  - Line 14-23: Add `Lightbulb` import
  - Line 24: Add ReasoningTab import
  - Line 52: Update TabValue type
  - Line 148-157: Add tab to array
  - Line 260-263: Update tabGroups indices
  - Render section: Add `activeTab === 'reasoning'` case

- [ ] **Step 1: Add imports**

At line ~14 in the lucide-react import, add `Lightbulb` to the import list.

At line ~24 (after other component imports), add:

```typescript
import { ReasoningTab } from '@/components/inbox/ReasoningTab'
```

- [ ] **Step 2: Update TabValue type**

At line ~52, change:

```typescript
type TabValue = 'analysis' | 'cockpit' | 'ticket' | 'cliente' | 'metricas' | 'historico' | 'ia_logs' | 'tramitacao'
```

to:

```typescript
type TabValue = 'analysis' | 'cockpit' | 'reasoning' | 'ticket' | 'cliente' | 'metricas' | 'historico' | 'ia_logs' | 'tramitacao'
```

- [ ] **Step 3: Add tab to tabs array**

At line ~150 (after cockpit), add the new tab:

```typescript
    { id: 'reasoning', icon: Lightbulb, label: 'Raciocínio' },
```

So the array becomes:
```
[analysis, cockpit, reasoning, ticket, cliente, metricas, historico, ia_logs, tramitacao]
 idx 0     idx 1    idx 2      idx 3   idx 4    idx 5     idx 6     idx 7     idx 8
```

- [ ] **Step 4: Update tabGroups indices**

At line ~260, change:

```typescript
  const tabGroups = [
    { label: 'IA',  tabs: [tabs[0], tabs[1]] },
    { label: 'TKT', tabs: [tabs[2], tabs[3]] },
    { label: 'REL', tabs: [tabs[4], tabs[5], tabs[6], tabs[7]] },
  ]
```

to:

```typescript
  const tabGroups = [
    { label: 'IA',  tabs: [tabs[0], tabs[1], tabs[2]] },
    { label: 'TKT', tabs: [tabs[3], tabs[4]] },
    { label: 'REL', tabs: [tabs[5], tabs[6], tabs[7], tabs[8]] },
  ]
```

- [ ] **Step 5: Add render case for reasoning tab**

Find the section where `activeTab` is checked for rendering content (look for `activeTab === 'ia_logs'` or `activeTab === 'analysis'`). Add a new case:

```typescript
{activeTab === 'reasoning' && (
  <ReasoningTab conversationId={conversationId} />
)}
```

- [ ] **Step 6: Verify app compiles and renders**

Run: `npm run dev`
Open: http://localhost:8080/inbox
Verify: The "Raciocínio" tab appears in the IA group (3rd tab), and clicking it shows the component (may show "Nenhuma resposta da IA" if no messages yet).

- [ ] **Step 7: Commit**

```bash
git add src/components/inbox/AIAnalysisPanel.tsx
git commit -m "feat(ui): wire ReasoningTab into AIAnalysisPanel IA group"
```

---

### Task 5: Realtime Invalidation

**Files:**
- Modify: `src/components/inbox/AIAnalysisPanel.tsx` (or wherever the inbox realtime subscription lives)

- [ ] **Step 1: Find the existing realtime subscription**

Search for `supabase.channel` or `.on('postgres_changes'` in the inbox components to find where new messages trigger UI updates.

- [ ] **Step 2: Add reasoning query invalidation**

Where new ai_messages trigger a React Query invalidation (likely `queryClient.invalidateQueries`), add:

```typescript
queryClient.invalidateQueries({ queryKey: ['reasoning', conversationId] })
```

- [ ] **Step 3: Test**

Send a test message, verify the reasoning tab updates without manual refresh.

- [ ] **Step 4: Commit**

```bash
git add src/components/inbox/AIAnalysisPanel.tsx
git commit -m "feat(ui): invalidate reasoning query on new messages"
```

---

### Task 6: Build Verification & Final Commit

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: No TypeScript errors, no build failures.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Visual verification**

1. Open inbox with an existing conversation
2. Click the "Raciocínio" tab (lightbulb icon) in the IA group
3. Verify: message pills, confidence bar, signal rows render correctly
4. Verify: fallback message shows for messages without reasoning
5. Check dark mode: colors remain readable

- [ ] **Step 4: Final commit if needed**

```bash
git add src/ supabase/
git commit -m "fix: address build/lint issues from Fase 2B"
```
