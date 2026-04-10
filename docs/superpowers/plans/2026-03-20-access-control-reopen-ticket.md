# Controle de Acesso Admin + Reabertura de Tickets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict admin pages to admin role, reorganize sidebar, and add ticket reopen functionality for admins.

**Architecture:** Extend existing role/permission system in `auth.ts`. Use existing `AdminRoute`/`PermissionRoute` wrappers in `App.tsx` for route protection. Add Edge Function for server-side validated ticket reopening. New `ai_conversation_reopens` table for event history.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL + Edge Functions/Deno), shadcn/ui, TanStack React Query

**Spec:** `docs/superpowers/specs/2026-03-20-access-control-reopen-ticket-design.md`

---

### Task 1: Update permissions map in auth.ts

**Files:**
- Modify: `src/types/auth.ts`

- [ ] **Step 1: Add `reopenTickets` and `manageAgents` to `RolePermissions` interface**

```typescript
// In RolePermissions interface, add after manageSettings:
export interface RolePermissions {
  // Tickets
  viewAllTickets: boolean;
  viewLeadTickets: boolean;
  manageTickets: boolean;
  changeTicketStatus: boolean;
  reopenTickets: boolean;     // NEW

  // AI
  useAICopilot: boolean;

  // Knowledge Base
  viewKnowledgeBase: boolean;
  viewFullKnowledgeBase: boolean;
  manageKnowledgeBase: boolean;

  // Admin
  manageUsers: boolean;
  manageSettings: boolean;
  manageAgents: boolean;      // NEW
  viewReports: boolean;
}
```

- [ ] **Step 2: Update rolePermissions map for all 3 roles**

```typescript
export const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    viewAllTickets: true,
    viewLeadTickets: true,
    manageTickets: true,
    changeTicketStatus: true,
    reopenTickets: true,        // NEW
    useAICopilot: true,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: true,
    manageKnowledgeBase: true,
    manageUsers: true,
    manageSettings: true,
    manageAgents: true,         // NEW
    viewReports: true,
  },
  suporte: {
    viewAllTickets: true,
    viewLeadTickets: false,
    manageTickets: true,
    changeTicketStatus: true,
    reopenTickets: false,       // NEW
    useAICopilot: true,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: true,
    manageKnowledgeBase: true,  // CHANGED from false
    manageUsers: false,
    manageSettings: false,
    manageAgents: false,        // NEW
    viewReports: true,          // CHANGED from false
  },
  comercial: {
    viewAllTickets: false,
    viewLeadTickets: true,
    manageTickets: false,
    changeTicketStatus: false,
    reopenTickets: false,       // NEW
    useAICopilot: false,
    viewKnowledgeBase: true,
    viewFullKnowledgeBase: false,
    manageKnowledgeBase: false,
    manageUsers: false,
    manageSettings: false,
    manageAgents: false,        // NEW
    viewReports: true,          // CHANGED from false
  },
};
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build 2>&1 | head -30`
Expected: May show errors in files that reference RolePermissions — that's expected, we'll fix in next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types/auth.ts
git commit -m "feat: add reopenTickets and manageAgents permissions to role system"
```

---

### Task 2: Protect routes with proper permissions in App.tsx

**Files:**
- Modify: `src/App.tsx:173-208` (route definitions)

The codebase already has `AdminRoute` (line 114, checks `role === 'admin'`) and `PermissionRoute` (line 120, checks `hasPermission`). We need to wrap non-admin routes that should be admin-only.

- [ ] **Step 1: Wrap admin-only routes that currently lack protection**

Routes to wrap with `<AdminRoute>`:
- `/agents` (line 173)
- `/automations` (line 179)
- `/automations/new` (line 180)
- `/automations/:id` (line 181)
- `/flow-builder` (line 182)
- `/flow-builder/:id` (line 183)
- `/whatsapp-instances` (line 184)
- `/ai-settings` (line 191)
- `/ai-consumption` (line 187)
- `/supervisor` (line 208)
- `/campaigns` (line 203)
- `/skills` (line 204)
- `/agents/playground/:agentId` (line 188)
- `/automations/playground/:id` (line 189)
- `/flow-builder/playground/:id` (line 190)

Example change:
```tsx
// Before:
<Route path="/agents" element={<Agents />} />
// After:
<Route path="/agents" element={<AdminRoute><Agents /></AdminRoute>} />
```

Apply the same pattern for all routes listed above.

- [ ] **Step 2: Verify build compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: protect admin-only routes with AdminRoute wrapper"
```

---

### Task 3: Reorganize Sidebar — move items between sections

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:66-129`

- [ ] **Step 1: Move Agentes IA, Supervisão, Automações, Skills, Campanhas to admin section**

Move these items from `menuCategories` (the "IA & Automação" category) to `adminMenuItems`:

```typescript
const adminMenuItems: MenuItem[] = [
  // Agentes & IA (admin)
  { icon: Bot, label: 'Agentes IA', path: '/agents' },
  { icon: Headphones, label: 'Agentes Humanos', path: '/admin/users' },
  { icon: ShieldCheck, label: 'Supervisão', path: '/supervisor' },
  { icon: Zap, label: 'Automações', path: '/automations' },
  { icon: PlayCircle, label: 'Skills', path: '/skills' },
  { icon: Megaphone, label: 'Campanhas', path: '/campaigns' },
  // Configuração (admin)
  { icon: Settings, label: 'Geral', path: '/settings' },
  { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp-instances' },
  { icon: Settings2, label: 'Config. IA', path: '/ai-settings' },
  { icon: BarChart3, label: 'Consumo IA', path: '/ai-consumption' },
  // Admin original
  { icon: Plug, label: 'Integrações', path: '/admin/integrations' },
  { icon: Key, label: 'API Parceiros', path: '/admin/api-keys' },
  { icon: HelpCircle, label: 'Central do Cliente', path: '/admin/help' },
]
```

- [ ] **Step 2: Simplify menuCategories — remove admin-only items, keep team items**

The "IA & Automação" category should only keep `Macros` (accessible to all). Remove the category if only Macros remains and move Macros elsewhere (e.g., into "Atendimento").

The "Configuração" category should be removed entirely (all items moved to admin).

Keep: Atendimento, Clientes, Conhecimento, Relatórios. Add Macros and Feriados/Central de Ajuda to appropriate sections.

Updated `menuCategories`:
```typescript
const menuCategories: MenuCategory[] = [
  {
    category: 'Atendimento',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: MessageSquare, label: 'Inbox', path: '/inbox' },
      { icon: ListTodo, label: 'Avaliações', path: '/evaluations' },
      { icon: FileText, label: 'Macros', path: '/macros' },
    ],
  },
  {
    category: 'Clientes',
    items: [
      { icon: Users2, label: 'Clientes', path: '/clients' },
      { icon: Contact, label: 'Contatos', path: '/contacts' },
    ],
  },
  {
    category: 'Conhecimento',
    items: [
      { icon: Library, label: 'Base de Conhecimento', path: '/knowledge', permission: 'viewKnowledgeBase' },
      { icon: Package, label: 'Catálogo de Serviços', path: '/service-catalog' },
    ],
  },
  {
    category: 'Relatórios',
    permission: 'viewReports',
    items: [
      { icon: FileSearch, label: 'Tickets', path: '/reports/tickets', permission: 'viewReports' },
      { icon: Building2, label: 'Volume por Empresa', path: '/reports/company-volume', permission: 'viewReports' },
      { icon: PieChart, label: 'Executivo', path: '/reports/executive', permission: 'viewReports' },
    ],
  },
]
```

- [ ] **Step 3: Update admin section label from "Admin" to "Administração"**

In the Sidebar render (line 329), change:
```tsx
// Before:
<p className="...">Admin</p>
// After:
<p className="...">Administração</p>
```

- [ ] **Step 4: Verify build compiles and sidebar renders correctly**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: reorganize sidebar — admin section for management, team access for KB/clients/reports"
```

---

### Task 4: Database migration — reopen events table + conversation fields

**Files:**
- Create: `supabase/migrations/20260320_add_reopen_support.sql` (local reference only)

This migration must be applied via Supabase MCP tool `apply_migration`.

- [ ] **Step 1: Apply migration**

Use MCP tool `mcp__claude_ai_Supabase__apply_migration` with:

```sql
-- Tabela de eventos de reabertura
CREATE TABLE IF NOT EXISTS ai_conversation_reopens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  reopened_at timestamptz NOT NULL DEFAULT now(),
  reopened_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  destination_type text NOT NULL CHECK (destination_type IN ('orchestrator', 'human', 'ai')),
  destination_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca por conversa
CREATE INDEX idx_conversation_reopens_conv ON ai_conversation_reopens(conversation_id);

-- Cache desnormalizado em ai_conversations
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reopened_by uuid REFERENCES auth.users(id);
```

- [ ] **Step 2: Regenerate Supabase types**

Run: `npx supabase gen types typescript --project-id pomueweeulenslxvsxar > src/integrations/supabase/types.ts`

Or use MCP tool `mcp__claude_ai_Supabase__generate_typescript_types`.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add ai_conversation_reopens table and reopen_count fields"
```

---

### Task 5: Edge Function — reopen-conversation (server-side validation)

**Files:**
- Create: `supabase/functions/reopen-conversation/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Client autenticado como o usuário
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Client admin para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar role admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem reabrir tickets' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse body
    const { conversation_id, reason, destination_type, destination_id } = await req.json()

    if (!conversation_id || !reason || !destination_type) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: conversation_id, reason, destination_type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (reason.length < 10) {
      return new Response(JSON.stringify({ error: 'O motivo deve ter pelo menos 10 caracteres' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!['orchestrator', 'human', 'ai'].includes(destination_type)) {
      return new Response(JSON.stringify({ error: 'destination_type inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar conversa existe e está finalizada/resolvida
    const { data: conv, error: convError } = await supabaseAdmin
      .from('ai_conversations')
      .select('id, status')
      .eq('id', conversation_id)
      .single()

    if (convError || !conv) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!['finalizado', 'resolvido'].includes(conv.status || '')) {
      return new Response(JSON.stringify({ error: 'Apenas atendimentos finalizados ou resolvidos podem ser reabertos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Inserir evento de reabertura
    const { error: insertError } = await supabaseAdmin
      .from('ai_conversation_reopens')
      .insert({
        conversation_id,
        reopened_by: user.id,
        reason,
        destination_type,
        destination_id: destination_id || null,
      })

    if (insertError) {
      console.error('Erro ao inserir reopen event:', insertError)
      return new Response(JSON.stringify({ error: 'Erro ao registrar reabertura' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Montar update da conversa
    const updateData: Record<string, unknown> = {
      reopen_count: (conv as any).reopen_count ? (conv as any).reopen_count + 1 : 1,
      last_reopened_at: new Date().toISOString(),
      last_reopened_by: user.id,
    }

    if (destination_type === 'orchestrator') {
      updateData.status = 'aguardando'
      updateData.handler_type = null
      updateData.assigned_agent_id = null
      updateData.human_agent_id = null
    } else if (destination_type === 'human') {
      updateData.status = 'em_atendimento'
      updateData.handler_type = 'human'
      updateData.human_agent_id = destination_id
      updateData.assigned_agent_id = null
    } else if (destination_type === 'ai') {
      updateData.status = 'em_atendimento'
      updateData.handler_type = 'ai'
      updateData.assigned_agent_id = destination_id
      updateData.human_agent_id = null
    }

    // Atualizar conversa
    const { error: updateError } = await supabaseAdmin
      .from('ai_conversations')
      .update(updateData)
      .eq('id', conversation_id)

    if (updateError) {
      console.error('Erro ao atualizar conversa:', updateError)
      return new Response(JSON.stringify({ error: 'Erro ao reabrir conversa' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar nome do admin para mensagem de sistema
    const { data: agentData } = await supabaseAdmin
      .from('human_agents')
      .select('name')
      .eq('user_id', user.id)
      .single()

    const adminName = agentData?.name || user.email || 'Admin'

    // Inserir mensagem de sistema
    await supabaseAdmin
      .from('ai_messages')
      .insert({
        conversation_id,
        role: 'system',
        content: `Ticket reaberto por ${adminName} — Motivo: ${reason}`,
      })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Erro inesperado em reopen-conversation:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

- [ ] **Step 2: Deploy Edge Function**

Use MCP tool `mcp__claude_ai_Supabase__deploy_edge_function` with name `reopen-conversation`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/reopen-conversation/index.ts
git commit -m "feat: add reopen-conversation Edge Function with server-side role validation"
```

---

### Task 6: ReopenTicketModal component

**Files:**
- Create: `src/components/inbox/ReopenTicketModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface ReopenTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  onSuccess?: () => void
}

export function ReopenTicketModal({ open, onOpenChange, conversationId, onSuccess }: ReopenTicketModalProps) {
  const [reason, setReason] = useState('')
  const [destinationType, setDestinationType] = useState<string>('')
  const [destinationId, setDestinationId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  // Buscar agentes humanos ativos
  const { data: humanAgents = [] } = useQuery({
    queryKey: ['human-agents-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('human_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      return data || []
    },
    enabled: open,
  })

  // Buscar agentes IA ativos
  const { data: aiAgents = [] } = useQuery({
    queryKey: ['ai-agents-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      return data || []
    },
    enabled: open,
  })

  const handleSubmit = async () => {
    if (!reason || reason.length < 10) {
      toast.error('O motivo deve ter pelo menos 10 caracteres')
      return
    }
    if (!destinationType) {
      toast.error('Selecione o destino do ticket')
      return
    }
    if (destinationType !== 'orchestrator' && !destinationId) {
      toast.error('Selecione o agente de destino')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('reopen-conversation', {
        body: {
          conversation_id: conversationId,
          reason,
          destination_type: destinationType,
          destination_id: destinationType !== 'orchestrator' ? destinationId : null,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Ticket reaberto com sucesso')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      setReason('')
      setDestinationType('')
      setDestinationId('')
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reabrir ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setReason('')
      setDestinationType('')
      setDestinationId('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Reabrir Atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="reopen-reason">Motivo da reabertura *</Label>
            <Textarea
              id="reopen-reason"
              placeholder="Descreva o motivo para reabrir este atendimento (mín. 10 caracteres)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={submitting}
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-destructive">Mínimo 10 caracteres ({reason.length}/10)</p>
            )}
          </div>

          {/* Destino */}
          <div className="space-y-2">
            <Label>Destino *</Label>
            <Select value={destinationType} onValueChange={(v) => { setDestinationType(v); setDestinationId('') }} disabled={submitting}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o destino..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orchestrator">Fila do orquestrador (IA redistribui)</SelectItem>
                <SelectItem value="human">Agente humano</SelectItem>
                <SelectItem value="ai">Agente IA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de agente (quando não é orchestrator) */}
          {destinationType === 'human' && (
            <div className="space-y-2">
              <Label>Agente humano *</Label>
              <Select value={destinationId} onValueChange={setDestinationId} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente..." />
                </SelectTrigger>
                <SelectContent>
                  {humanAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {destinationType === 'ai' && (
            <div className="space-y-2">
              <Label>Agente IA *</Label>
              <Select value={destinationId} onValueChange={setDestinationId} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente IA..." />
                </SelectTrigger>
                <SelectContent>
                  {aiAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || reason.length < 10 || !destinationType}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reabrir Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/inbox/ReopenTicketModal.tsx
git commit -m "feat: add ReopenTicketModal component"
```

---

### Task 7: Add reopen button to ChatArea finalized banner

**Files:**
- Modify: `src/components/inbox/ChatArea.tsx`

- [ ] **Step 1: Add import for ReopenTicketModal and state**

At the top of ChatArea.tsx, add:
```tsx
import { ReopenTicketModal } from './ReopenTicketModal'
```

Inside the component function, add state:
```tsx
const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
```

Also get `hasPermission` from the existing `useAuth()` call (check if already destructured — the file imports `useAuth` at line 40).

- [ ] **Step 2: Add reopen button to the finalized banner**

Find the finalized banner (around line 2244):
```tsx
{isFinalized && (
  <div className="px-6 py-4 border-b border-emerald-200 ...">
```

Add the reopen button inside this banner, after the text section and before the closing `</div>`. Only show for admins and non-cancelled tickets:

```tsx
{hasPermission('reopenTickets') && conversation?.status !== 'cancelado' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setReopenDialogOpen(true)}
    className="gap-2 shrink-0"
  >
    <RefreshCw className="w-4 h-4" />
    Reabrir
  </Button>
)}
```

Also add `RefreshCw` to the lucide-react import if not already there.

- [ ] **Step 3: Add ReopenTicketModal render**

After the finalized banner div, add:
```tsx
{conversation && (
  <ReopenTicketModal
    open={reopenDialogOpen}
    onOpenChange={setReopenDialogOpen}
    conversationId={conversation.id}
    onSuccess={() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }}
  />
)}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/inbox/ChatArea.tsx
git commit -m "feat: add reopen button in finalized ticket banner (admin only)"
```

---

### Task 8: Final build verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build/lint issues from access control + reopen implementation"
```
