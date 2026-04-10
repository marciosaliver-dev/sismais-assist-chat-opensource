# Governança IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add constitutional guardrails, dual-threshold confidence, audit trail, and governance UI to the AI helpdesk.

**Architecture:** Middleware pattern inside existing agent-executor edge function. Guardrails injected into system prompt + post-response PII regex check. Audit log in new table. UI: new tab in agent config + enhanced inbox badges + admin audit page.

**Tech Stack:** Supabase (PostgreSQL + RLS), Deno edge functions, React 18 + TypeScript + shadcn/ui + TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-20-governance-ia-design.md`

**Key discovery:** The agent-executor ALREADY calculates confidence (baseline 0.75 with adjustments) and the ChatArea ALREADY renders color-coded confidence badges. This plan builds ON TOP of existing infrastructure.

---

## What already exists (DO NOT re-implement)

- `agent-executor/index.ts` lines 580-649: confidence calculation
- `agent-executor/index.ts` lines 700-721: escalation check against threshold
- `ai_messages.confidence` column: already populated
- `ai_agents.confidence_threshold` column: already exists (single threshold)
- `ChatArea.tsx` lines 2670-2699: confidence badge (green/amber/violet)

## What's new

1. `ai_guardrails` table + seed rules
2. `ai_audit_log` table
3. `ai_agents` dual thresholds (respond + warn) replacing single threshold
4. Guardrail injection in agent-executor system prompt
5. PII regex check post-response
6. `flagged_for_review` field in ai_messages
7. Audit logging in agent-executor
8. Guardrails tab in AgentFormDialog
9. Enhanced confidence badge + flagged banner in ChatArea
10. Admin audit page (`/admin/audit`)

---

## Task 1: Database migration — guardrails + audit + new columns

**Files:**
- Create: `supabase/migrations/20260320100000_governance_guardrails.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ================================================
-- Governance IA: Guardrails + Audit Trail
-- ================================================

-- 1. Guardrails table
CREATE TABLE IF NOT EXISTS ai_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('block_topic', 'require_escalation', 'sanitize_pii', 'custom')),
  rule_content TEXT NOT NULL,
  severity TEXT DEFAULT 'warn' CHECK(severity IN ('warn', 'block', 'sanitize')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for guardrails
ALTER TABLE ai_guardrails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_guardrails" ON ai_guardrails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_manage_guardrails" ON ai_guardrails
  FOR ALL TO service_role USING (true);

CREATE INDEX idx_guardrails_agent ON ai_guardrails(agent_id) WHERE is_active = true;

-- 2. Seed global guardrails (agent_id = NULL)
INSERT INTO ai_guardrails (agent_id, rule_type, rule_content, severity) VALUES
(NULL, 'sanitize_pii', 'Nunca expor CPF, cartão de crédito ou senha de outro cliente', 'block'),
(NULL, 'block_topic', 'Nunca inventar valores, preços, datas de vencimento ou dados financeiros', 'block'),
(NULL, 'block_topic', 'Nunca dar conselho jurídico, prometer garantias legais ou interpretar contratos', 'block'),
(NULL, 'require_escalation', 'Se o cliente mencionar processo judicial, Procon ou advogado, escalar para humano', 'block'),
(NULL, 'custom', 'Se não tiver certeza da resposta, diga que vai verificar em vez de inventar', 'warn');

-- 3. Audit log table
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  message_id UUID,
  agent_id UUID REFERENCES ai_agents(id),
  confidence_score NUMERIC(3,2),
  confidence_reason TEXT,
  guardrails_applied TEXT[],
  guardrails_triggered TEXT[],
  action_taken TEXT CHECK(action_taken IN ('responded', 'escalated', 'flagged_for_review', 'blocked')),
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_audit" ON ai_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_insert_audit" ON ai_audit_log
  FOR INSERT TO service_role USING (true);

CREATE INDEX idx_audit_conversation ON ai_audit_log(conversation_id);
CREATE INDEX idx_audit_agent ON ai_audit_log(agent_id);
CREATE INDEX idx_audit_action ON ai_audit_log(action_taken) WHERE action_taken != 'responded';
CREATE INDEX idx_audit_created ON ai_audit_log(created_at DESC);
CREATE INDEX idx_audit_low_confidence ON ai_audit_log(confidence_score) WHERE confidence_score < 0.70;

-- 4. New columns on ai_agents (dual thresholds replacing single)
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS confidence_threshold_respond NUMERIC(3,2) DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS confidence_threshold_warn NUMERIC(3,2) DEFAULT 0.50;

-- Migrate existing single threshold to respond threshold
UPDATE ai_agents SET confidence_threshold_respond = COALESCE(confidence_threshold, 0.70)
  WHERE confidence_threshold IS NOT NULL;

-- 5. New columns on ai_messages
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS confidence_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT false;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Regenerate Supabase types**

```bash
npx supabase gen types typescript --project-id pomueweeulenslxvsxar > src/integrations/supabase/types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260320100000_governance_guardrails.sql src/integrations/supabase/types.ts
git commit -m "feat: add governance tables (guardrails, audit_log) and new agent columns

- ai_guardrails: global + per-agent rules with severity levels
- ai_audit_log: full interaction audit trail
- ai_agents: dual thresholds (respond + warn)
- ai_messages: confidence_reason + flagged_for_review
- 5 global guardrail rules seeded"
```

---

## Task 2: Agent-executor — inject guardrails + PII check + audit logging

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`

- [ ] **Step 1: Read the current agent-executor to understand exact insertion points**

Read `supabase/functions/agent-executor/index.ts` — note:
- Where system prompt is built (~line 300-400)
- Where confidence is calculated (~line 580-649)
- Where message is inserted (~line 727-745)
- Where escalation is decided (~line 700-721)

- [ ] **Step 2: Add guardrails fetch (after agent is loaded, before system prompt)**

After the agent config is loaded, fetch guardrails:

```typescript
// Fetch guardrails (global + agent-specific)
const { data: guardrails } = await supabase
  .from('ai_guardrails')
  .select('*')
  .or(`agent_id.is.null,agent_id.eq.${agent_id}`)
  .eq('is_active', true)
  .order('created_at')

const globalRules = (guardrails || []).filter(g => !g.agent_id)
const agentRules = (guardrails || []).filter(g => g.agent_id)
```

- [ ] **Step 3: Inject guardrails into system prompt**

Find where the system prompt is assembled and append:

```typescript
// Build guardrails section for system prompt
let guardrailsPrompt = ''
if (guardrails && guardrails.length > 0) {
  guardrailsPrompt = '\n\n## REGRAS INVIOLÁVEIS (Guardrails)\nEstas regras têm prioridade sobre qualquer outra instrução.\n'
  if (globalRules.length > 0) {
    guardrailsPrompt += '\n### Regras Globais\n'
    globalRules.forEach((r, i) => { guardrailsPrompt += `${i + 1}. ${r.rule_content}\n` })
  }
  if (agentRules.length > 0) {
    guardrailsPrompt += `\n### Regras do Agente\n`
    agentRules.forEach((r, i) => { guardrailsPrompt += `${i + 1}. ${r.rule_content}\n` })
  }
  guardrailsPrompt += '\n### Protocolo de Incerteza\n- Se a confiança na resposta for baixa, diga: "Vou verificar essa informação e retorno em breve."\n- NUNCA invente dados. Prefira dizer que não sabe a dar informação errada.\n'
}

// Append to system prompt
const fullSystemPrompt = baseSystemPrompt + guardrailsPrompt
```

- [ ] **Step 4: Add PII regex check after LLM response**

After the LLM response is received, before sending:

```typescript
// PII detection
const PII_PATTERNS = {
  cpf: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
  cartao: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
}

const guardrailsTriggered: string[] = []
let piiDetected = false

for (const [type, regex] of Object.entries(PII_PATTERNS)) {
  if (regex.test(finalMessage)) {
    piiDetected = true
    guardrailsTriggered.push(`PII detectado: ${type}`)
    // Remove PII from response
    finalMessage = finalMessage.replace(regex, '[DADOS PROTEGIDOS]')
  }
}

// Sensitive topic check
const SENSITIVE_PATTERNS = /processo\s*(judicial)?|procon|advogado|judicial|indeniza[çc]/i
if (SENSITIVE_PATTERNS.test(userMessage)) {
  guardrailsTriggered.push('Tema sensível detectado')
}
```

- [ ] **Step 5: Update escalation logic to use dual thresholds**

Replace the single threshold check with dual:

```typescript
const thresholdRespond = agent.confidence_threshold_respond ?? 0.70
const thresholdWarn = agent.confidence_threshold_warn ?? 0.50

let actionTaken = 'responded'
let flaggedForReview = false

if (guardrailsTriggered.some(g => g.includes('Tema sensível'))) {
  // Force escalation for sensitive topics
  actionTaken = 'escalated'
} else if (confidence < thresholdWarn) {
  actionTaken = 'escalated'
} else if (confidence < thresholdRespond) {
  actionTaken = 'flagged_for_review'
  flaggedForReview = true
}
```

- [ ] **Step 6: Add confidence_reason and flagged_for_review to message insert**

Update the ai_messages insert to include new fields:

```typescript
// Build confidence reason
const confidenceReasons: string[] = []
if (ragDocsCount > 0 && bestRagScore > 0.8) confidenceReasons.push('KB match forte')
else if (ragDocsCount === 0) confidenceReasons.push('KB sem match')
if (!hasClientData) confidenceReasons.push('sem dados do cliente')
if (guardrailsTriggered.length > 0) confidenceReasons.push(`${guardrailsTriggered.length} guardrail(s)`)
const confidenceReason = confidenceReasons.join(', ') || 'resposta padrão'

// In the insert, add:
confidence_reason: confidenceReason,
flagged_for_review: flaggedForReview,
```

- [ ] **Step 7: Add audit log entry after message is sent**

```typescript
// Log to audit trail
await supabase.from('ai_audit_log').insert({
  conversation_id,
  message_id: insertedMessage?.id,
  agent_id,
  confidence_score: confidence,
  confidence_reason: confidenceReason,
  guardrails_applied: (guardrails || []).map(g => g.rule_content),
  guardrails_triggered: guardrailsTriggered,
  action_taken: actionTaken,
  response_time_ms: Date.now() - startTime,
})
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat: add governance middleware to agent-executor

- Fetch and inject guardrails into system prompt
- PII regex detection (CPF, cartão) with sanitization
- Sensitive topic detection (processo, procon, advogado)
- Dual threshold: respond (0.70) / warn (0.50) / escalate
- Confidence reason tracking
- flagged_for_review flag on messages
- Full audit logging to ai_audit_log"
```

---

## Task 3: Guardrails tab in agent configuration

**Files:**
- Create: `src/components/agents/form-tabs/AgentGuardrails.tsx`
- Modify: `src/components/agents/AgentFormDialog.tsx`

- [ ] **Step 1: Create AgentGuardrails.tsx**

```tsx
import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, Trash2, Lock } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface Guardrail {
  id?: string
  rule_type: string
  rule_content: string
  severity: string
  is_global?: boolean
}

interface Props {
  agentId?: string
  data: any
  onChange: (updates: any) => void
}

export function AgentGuardrails({ agentId, data, onChange }: Props) {
  const [globalRules, setGlobalRules] = useState<Guardrail[]>([])
  const [agentRules, setAgentRules] = useState<Guardrail[]>([])

  useEffect(() => {
    loadGuardrails()
  }, [agentId])

  async function loadGuardrails() {
    // Global rules
    const { data: globals } = await supabase
      .from('ai_guardrails')
      .select('*')
      .is('agent_id', null)
      .eq('is_active', true)
    setGlobalRules((globals || []).map(g => ({ ...g, is_global: true })))

    // Agent rules
    if (agentId) {
      const { data: agentG } = await supabase
        .from('ai_guardrails')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
      setAgentRules(agentG || [])
    }
  }

  function addRule() {
    setAgentRules(prev => [...prev, { rule_type: 'custom', rule_content: '', severity: 'warn' }])
  }

  function updateRule(index: number, updates: Partial<Guardrail>) {
    setAgentRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r))
  }

  function removeRule(index: number) {
    setAgentRules(prev => prev.filter((_, i) => i !== index))
  }

  const thresholdRespond = data.confidence_threshold_respond ?? 0.70
  const thresholdWarn = data.confidence_threshold_warn ?? 0.50

  return (
    <div className="space-y-6">
      {/* Thresholds */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4" /> Thresholds de Confiança
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Responder normalmente quando confiança ≥ {Math.round(thresholdRespond * 100)}%</Label>
            <Slider
              value={[thresholdRespond]}
              onValueChange={([v]) => onChange({ confidence_threshold_respond: v })}
              min={0.3} max={1} step={0.05}
              className="mt-2"
            />
          </div>
          <div>
            <Label className="text-xs">Escalar para humano quando confiança &lt; {Math.round(thresholdWarn * 100)}%</Label>
            <Slider
              value={[thresholdWarn]}
              onValueChange={([v]) => onChange({ confidence_threshold_warn: v })}
              min={0.1} max={0.7} step={0.05}
              className="mt-2"
            />
          </div>
          {/* Visual preview */}
          <div className="flex h-3 rounded-full overflow-hidden text-[8px] font-bold">
            <div className="bg-red-500 flex items-center justify-center text-white" style={{ width: `${thresholdWarn * 100}%` }}>Escalar</div>
            <div className="bg-yellow-500 flex items-center justify-center text-navy" style={{ width: `${(thresholdRespond - thresholdWarn) * 100}%` }}>Review</div>
            <div className="bg-green-500 flex items-center justify-center text-white" style={{ width: `${(1 - thresholdRespond) * 100}%` }}>OK</div>
          </div>
        </div>
      </div>

      {/* Global rules (read-only) */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Lock className="w-4 h-4" /> Regras Globais (todas os agentes)
        </h3>
        {globalRules.map((rule, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm">
            <Badge variant="outline" className="shrink-0 text-xs">{rule.severity}</Badge>
            <span className="text-muted-foreground">{rule.rule_content}</span>
          </div>
        ))}
      </div>

      {/* Agent rules (editable) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Regras do Agente</h3>
          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        {agentRules.map((rule, i) => (
          <div key={i} className="flex gap-2 p-3 rounded-lg border">
            <Select value={rule.rule_type} onValueChange={v => updateRule(i, { rule_type: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="block_topic">Bloquear tema</SelectItem>
                <SelectItem value="require_escalation">Escalar</SelectItem>
                <SelectItem value="sanitize_pii">Proteger PII</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={rule.rule_content}
              onChange={e => updateRule(i, { rule_content: e.target.value })}
              placeholder="Descreva a regra..."
              className="min-h-[40px]"
              rows={1}
            />
            <Select value={rule.severity} onValueChange={v => updateRule(i, { severity: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="block">Bloquear</SelectItem>
                <SelectItem value="sanitize">Sanitizar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => removeRule(i)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
        {agentRules.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra específica. As regras globais se aplicam.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add tab to AgentFormDialog.tsx**

In the SUPPORT_TABS array (after 'policies'), add:
```typescript
{ id: 'guardrails', label: 'Guardrails', icon: Shield, description: 'Regras de segurança e thresholds' },
```

Import Shield from lucide-react and AgentGuardrails from form-tabs.

In renderTabContent(), add case:
```typescript
case 'guardrails':
  return <AgentGuardrails agentId={editingAgent?.id} data={formData} onChange={handleChange} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agents/form-tabs/AgentGuardrails.tsx src/components/agents/AgentFormDialog.tsx
git commit -m "feat: add Guardrails tab to agent configuration

- Global rules displayed read-only
- Per-agent rules with CRUD
- Dual threshold sliders with visual preview bar
- Rule types: block_topic, require_escalation, sanitize_pii, custom"
```

---

## Task 4: Enhanced confidence badges + flagged banner in inbox

**Files:**
- Modify: `src/components/inbox/ChatArea.tsx`

- [ ] **Step 1: Read ChatArea.tsx around lines 2670-2699 for current badge code**

- [ ] **Step 2: Add flagged_for_review banner**

After the existing confidence badge (around line 2699), add:

```tsx
{/* Flagged for review banner */}
{msg.flagged_for_review && (
  <div className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
    <AlertTriangle className="w-3 h-3" />
    <span>Resposta com baixa confiança — revisar</span>
    {msg.confidence_reason && (
      <span className="text-amber-500/60 ml-1">({msg.confidence_reason})</span>
    )}
  </div>
)}
```

- [ ] **Step 3: Add tooltip with confidence_reason to existing badge**

Enhance the existing confidence badge to show reason on hover:

```tsx
{msg.confidence != null && (() => {
  const conf = Math.round(Number(msg.confidence) * 100)
  // ... existing color logic ...
  return (
    <span
      className={cn("ml-1 inline-flex items-center gap-0.5 cursor-help", confColor)}
      title={msg.confidence_reason || `Confiança: ${conf}%`}
    >
      {conf < 70 && <AlertTriangle className="w-2.5 h-2.5" />}
      {conf >= 90 && <CheckCircle2 className="w-2.5 h-2.5" />}
      {conf}%
    </span>
  )
})()}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/inbox/ChatArea.tsx
git commit -m "feat: add flagged_for_review banner and confidence tooltip in inbox

- Amber banner on flagged messages with reason
- Tooltip showing confidence_reason on badge hover"
```

---

## Task 5: Admin audit page

**Files:**
- Create: `src/pages/admin/AdminAudit.tsx`
- Create: `src/hooks/useAuditLogs.ts`
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/layout/Sidebar.tsx` (add menu item)

- [ ] **Step 1: Create useAuditLogs.ts hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface AuditFilters {
  agentId?: string
  actionTaken?: string
  dateFrom?: string
  dateTo?: string
  minConfidence?: number
  maxConfidence?: number
}

export function useAuditLogs(filters: AuditFilters, page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('ai_audit_log')
        .select(`
          *,
          ai_agents!inner(name, specialty),
          ai_conversations!inner(contact_name, contact_phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (filters.agentId) query = query.eq('agent_id', filters.agentId)
      if (filters.actionTaken) query = query.eq('action_taken', filters.actionTaken)
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo)
      if (filters.minConfidence != null) query = query.gte('confidence_score', filters.minConfidence)
      if (filters.maxConfidence != null) query = query.lte('confidence_score', filters.maxConfidence)

      const { data, count, error } = await query
      if (error) throw error
      return { data: data || [], total: count || 0 }
    }
  })
}

export function useAuditMetrics() {
  return useQuery({
    queryKey: ['audit-metrics'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]

      const { data } = await supabase
        .from('ai_audit_log')
        .select('confidence_score, action_taken, guardrails_triggered')
        .gte('created_at', today)

      const logs = data || []
      const total = logs.length
      const green = logs.filter(l => Number(l.confidence_score) >= 0.7).length
      const yellow = logs.filter(l => Number(l.confidence_score) >= 0.5 && Number(l.confidence_score) < 0.7).length
      const red = logs.filter(l => Number(l.confidence_score) < 0.5).length
      const escalated = logs.filter(l => l.action_taken === 'escalated').length
      const allTriggered = logs.flatMap(l => l.guardrails_triggered || [])
      const triggerCounts: Record<string, number> = {}
      allTriggered.forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1 })
      const topGuardrails = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

      return { total, green, yellow, red, escalated, topGuardrails }
    },
    refetchInterval: 30000
  })
}
```

- [ ] **Step 2: Create AdminAudit.tsx page**

Create `src/pages/admin/AdminAudit.tsx` with:
- Top metrics cards (total today, green/yellow/red %, escalations, top guardrails)
- Filter bar: agent dropdown, action dropdown, date range, confidence range
- Table with columns: Hora, Agente, Confiança (badge), Ação, Guardrails, Tempo
- Pagination
- Follow existing admin page patterns (AdminUsers.tsx as reference)

The component should use `useAuditLogs` and `useAuditMetrics` hooks, shadcn/ui Table, and the Sismais color palette.

- [ ] **Step 3: Add route to App.tsx**

Add lazy import and admin route:
```typescript
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"))
// In routes:
<Route path="/admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
```

- [ ] **Step 4: Add sidebar menu item**

In Sidebar.tsx, add to admin section:
```typescript
{ to: '/admin/audit', icon: Shield, label: 'Auditoria IA' }
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminAudit.tsx src/hooks/useAuditLogs.ts src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add admin audit page for AI governance

- Metrics cards: today's interactions by confidence level
- Filterable table with agent, action, date, confidence
- Top guardrails triggered
- Pagination support
- Auto-refresh every 30s"
```

---

## Task 6: Save guardrails on agent form submit

**Files:**
- Modify: `src/components/agents/AgentFormDialog.tsx` (save logic)
- Modify: `src/components/agents/form-tabs/AgentGuardrails.tsx` (expose rules for save)

- [ ] **Step 1: Update AgentGuardrails to expose rules via onChange**

Add to the component: whenever agentRules changes, call `onChange({ _guardrails: agentRules })`. The parent form will handle saving separately.

- [ ] **Step 2: Update AgentFormDialog save logic**

In the save handler, after saving the agent, save guardrails:

```typescript
// Save guardrails if tab was touched
if (formData._guardrails) {
  // Delete existing agent rules
  await supabase.from('ai_guardrails').delete().eq('agent_id', savedAgent.id)
  // Insert new ones
  const rules = formData._guardrails.filter((r: any) => r.rule_content.trim())
  if (rules.length > 0) {
    await supabase.from('ai_guardrails').insert(
      rules.map((r: any) => ({
        agent_id: savedAgent.id,
        rule_type: r.rule_type,
        rule_content: r.rule_content,
        severity: r.severity,
        is_active: true,
      }))
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agents/AgentFormDialog.tsx src/components/agents/form-tabs/AgentGuardrails.tsx
git commit -m "feat: save guardrails on agent form submit

- Delete + re-insert pattern for agent rules
- Dual thresholds saved as agent columns
- Empty rules filtered out"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Database migration (guardrails + audit + columns) | 1 migration + types regen |
| 2 | Agent-executor governance middleware | 1 edge function |
| 3 | Guardrails tab in agent config UI | 2 files (new tab + dialog) |
| 4 | Enhanced confidence badges in inbox | 1 file |
| 5 | Admin audit page | 4 files (page + hook + route + sidebar) |
| 6 | Save guardrails on form submit | 2 files |
| **Total** | | **~10 files touched** |

---

## Deferred

- **Drill-down modal** on audit table (click to see full conversation) — follow-up
- **Guardrails analytics** (trends over time, accuracy calibration) — follow-up
- **A/B testing** of guardrail rules — Fase 3
