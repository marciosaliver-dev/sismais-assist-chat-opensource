# Meta WhatsApp Cycle 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Meta WhatsApp instance management page, 24h window enforcement with UAZAPI fallback, and channel indicators in Inbox.

**Architecture:** Expand existing `/whatsapp-instances` page with tabs (UAZAPI | Meta Cloud API). Add `last_customer_message_at` field to track 24h window server-side. Enforce window in `meta-whatsapp-proxy` before sending. Frontend shows window status and offers UAZAPI fallback when window is closed.

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, shadcn/ui, Supabase (PostgreSQL + Edge Functions/Deno), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-25-meta-whatsapp-cycle1-design.md`

---

## File Structure

### Create
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260325150000_meta_24h_window.sql` | Migration: `last_customer_message_at`, `related_conversation_id`, indexes |
| `supabase/functions/_shared/meta-24h-window.ts` | Shared helper: `check24hWindow()` function |
| `src/hooks/useChannelInstances.ts` | Hook: query/mutate `channel_instances` table |
| `src/hooks/useMetaWindow.ts` | Hook: compute 24h window status with auto-refresh |
| `src/components/whatsapp/MetaInstanceCard.tsx` | Card component for a single Meta instance |
| `src/components/whatsapp/MetaInstanceForm.tsx` | Dialog form to create/edit Meta instance |
| `src/components/whatsapp/MetaInstancesTab.tsx` | Tab content: list + add button for Meta instances |
| `src/components/inbox/ChannelBadge.tsx` | Reusable badge showing channel type (UAZAPI/Meta) |
| `src/components/inbox/MetaWindowIndicator.tsx` | 24h window countdown badge |
| `src/components/inbox/WindowClosedComposer.tsx` | Replacement composer when Meta window is closed |
| `src/components/inbox/SwitchToUazapiDialog.tsx` | Modal to select UAZAPI instance for fallback |

### Modify
| File | Change |
|------|--------|
| `supabase/functions/_shared/channel-router.ts` | Update `last_customer_message_at` on incoming customer message |
| `supabase/functions/meta-whatsapp-proxy/index.ts` | Validate 24h window before `sendMessage` (skip for templates) |
| `src/pages/WhatsAppInstances.tsx` | Wrap existing content in tab system, add Meta tab |
| `src/components/inbox/ChatArea.tsx` | Integrate ChannelBadge, MetaWindowIndicator, WindowClosedComposer |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260325150000_meta_24h_window.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Meta WhatsApp 24h Window + Related Conversations
-- Adds fields for tracking the 24h messaging window (Meta policy)
-- and cross-channel conversation linking (UAZAPI fallback)

-- 1. Campo para tracking da janela de 24h
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;

-- 2. Campo para conversas relacionadas (fallback UAZAPI ↔ Meta)
ALTER TABLE ai_conversations
ADD COLUMN IF NOT EXISTS related_conversation_id UUID REFERENCES ai_conversations(id);

-- 3. Índice para busca de conversas por número + canal
CREATE INDEX IF NOT EXISTS idx_conversations_channel_chat
ON ai_conversations(channel_chat_id, communication_channel);

-- 4. Índice parcial para janela de 24h (apenas conversas Meta)
CREATE INDEX IF NOT EXISTS idx_conversations_last_customer_msg
ON ai_conversations(last_customer_message_at)
WHERE communication_channel = 'meta_whatsapp';

-- 5. Backfill: setar last_customer_message_at para conversas Meta existentes
-- usando a última mensagem do cliente (role='user') como referência
UPDATE ai_conversations ac
SET last_customer_message_at = (
  SELECT MAX(created_at)
  FROM ai_messages am
  WHERE am.conversation_id = ac.id
    AND am.role = 'user'
)
WHERE ac.communication_channel = 'meta_whatsapp'
  AND ac.last_customer_message_at IS NULL;
```

- [ ] **Step 2: Apply migration**

Run via Supabase MCP tool `apply_migration` or:
```bash
# If using Supabase CLI locally:
supabase db push
```

- [ ] **Step 3: Verify columns exist**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_conversations'
  AND column_name IN ('last_customer_message_at', 'related_conversation_id');
```

Expected: 2 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260325150000_meta_24h_window.sql
git commit -m "feat(db): add last_customer_message_at and related_conversation_id for Meta 24h window"
```

---

## Task 2: Backend — 24h Window Helper

**Files:**
- Create: `supabase/functions/_shared/meta-24h-window.ts`

- [ ] **Step 1: Create the shared helper**

```typescript
/**
 * Meta WhatsApp 24h Window Helper
 *
 * Per Meta Business Policy, businesses can only send free-form messages
 * within 24 hours of the last customer message. Outside this window,
 * only approved HSM templates are allowed.
 */

export interface WindowStatus {
  isOpen: boolean;
  expiresAt: string | null;
  remainingMs: number;
  requiresTemplate: boolean;
}

export function check24hWindow(lastCustomerMessageAt: string | null): WindowStatus {
  if (!lastCustomerMessageAt) {
    return { isOpen: false, expiresAt: null, remainingMs: 0, requiresTemplate: true };
  }
  const expiry = new Date(lastCustomerMessageAt).getTime() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = Math.max(0, expiry - now);
  return {
    isOpen: remainingMs > 0,
    expiresAt: new Date(expiry).toISOString(),
    remainingMs,
    requiresTemplate: remainingMs <= 0,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/meta-24h-window.ts
git commit -m "feat(shared): add Meta 24h window check helper"
```

---

## Task 3: Backend — Update channel-router to track last customer message

**Files:**
- Modify: `supabase/functions/_shared/channel-router.ts`

- [ ] **Step 1: Add import at top of file**

After the existing import block (line 20), add:

```typescript
import { check24hWindow } from './meta-24h-window.ts'
```

Note: `check24hWindow` is not used directly in channel-router but the import validates it compiles. The actual field update is what matters here.

Actually, we don't need the import. We just need to update `last_customer_message_at` after resolving the conversation.

- [ ] **Step 2: Add last_customer_message_at update after conversation resolution**

After the conversation is found or created (after line 99 — `log('conversation_created', { conversationId })`), and before section 2 (saving message), add:

```typescript
  // ── 1b. Atualizar timestamp da última mensagem do cliente (janela 24h Meta) ──
  if (!message.fromMe) {
    await supabase
      .from('ai_conversations')
      .update({ last_customer_message_at: new Date().toISOString() })
      .eq('id', conversationId)
  }
```

Insert this block right before the line `// ── 2. Salvar mensagem na tabela unificada ──────────────────────────` (line 101).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/channel-router.ts
git commit -m "feat(channel-router): update last_customer_message_at on incoming customer message"
```

---

## Task 4: Backend — Enforce 24h window in meta-whatsapp-proxy

**Files:**
- Modify: `supabase/functions/meta-whatsapp-proxy/index.ts`

- [ ] **Step 1: Add import at top of file**

After the `createClient` import (line 13), add:

```typescript
import { check24hWindow } from '../_shared/meta-24h-window.ts'
```

- [ ] **Step 2: Add window validation before sendMessage**

Inside the `if (action === 'sendMessage')` block (after line 77 where `recipient`, `type`, `text`, etc. are destructured), add this validation before the recipient cleaning:

```typescript
      // ── Validar janela de 24h (Meta Business Policy) ──
      // Templates HSM são permitidos fora da janela
      if (!templateName) {
        // Buscar last_customer_message_at da conversa
        const { data: convData } = await supabase
          .from('ai_conversations')
          .select('last_customer_message_at')
          .eq('channel_instance_id', instanceId)
          .eq('customer_phone', (recipient || '').replace(/@.*$/, '').replace(/\D/g, ''))
          .in('status', ['aguardando', 'em_atendimento', 'nova'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const windowStatus = check24hWindow(convData?.last_customer_message_at || null)

        if (!windowStatus.isOpen) {
          return new Response(JSON.stringify({
            error: 'WINDOW_CLOSED',
            message: 'A janela de 24h expirou. Use um template HSM ou continue via UAZAPI.',
            requiresTemplate: true,
            expiresAt: windowStatus.expiresAt,
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
```

Insert this right after the destructuring line (line 77) and before the `const cleanRecipient` line (line 80).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/meta-whatsapp-proxy/index.ts supabase/functions/_shared/meta-24h-window.ts
git commit -m "feat(meta-proxy): enforce 24h window validation before sendMessage"
```

---

## Task 5: Frontend — useChannelInstances hook

**Files:**
- Create: `src/hooks/useChannelInstances.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useChannelInstances(channelType: 'meta_whatsapp' | 'uazapi' | 'instagram') {
  const queryClient = useQueryClient()

  const instances = useQuery({
    queryKey: ['channel-instances', channelType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_instances')
        .select('*')
        .eq('channel_type', channelType)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: 15000,
  })

  const upsertInstance = useMutation({
    mutationFn: async (instance: {
      id?: string
      channel_type: string
      display_name: string
      phone_number: string
      is_active?: boolean
      config: Record<string, unknown>
      kanban_board_id?: string | null
    }) => {
      const { data, error } = await supabase
        .from('channel_instances')
        .upsert(instance as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] })
      toast.success('Instância salva com sucesso')
    },
    onError: (e: Error) => toast.error('Erro ao salvar instância: ' + e.message),
  })

  const testConnection = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke('meta-whatsapp-proxy', {
        body: { action: 'getStatus', instanceId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: (_data, instanceId) => {
      // Update status to connected
      supabase
        .from('channel_instances')
        .update({ status: 'connected' } as any)
        .eq('id', instanceId)
        .then(() => queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] }))
      toast.success('Conexão verificada com sucesso!')
    },
    onError: (e: Error) => toast.error('Erro ao testar conexão: ' + e.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ instanceId, isActive }: { instanceId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('channel_instances')
        .update({ is_active: isActive } as any)
        .eq('id', instanceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] })
      toast.success('Status atualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const { error } = await supabase
        .from('channel_instances')
        .delete()
        .eq('id', instanceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-instances', channelType] })
      toast.success('Instância excluída')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    instances: instances.data ?? [],
    isLoading: instances.isLoading,
    upsertInstance,
    testConnection,
    toggleActive,
    deleteInstance,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useChannelInstances.ts
git commit -m "feat(hooks): add useChannelInstances for Meta WhatsApp instance management"
```

---

## Task 6: Frontend — useMetaWindow hook

**Files:**
- Create: `src/hooks/useMetaWindow.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useMemo } from 'react'

export interface WindowStatus {
  isOpen: boolean
  expiresAt: string | null
  remainingMs: number
  requiresTemplate: boolean
}

export function check24hWindow(lastCustomerMessageAt: string | null): WindowStatus {
  if (!lastCustomerMessageAt) {
    return { isOpen: false, expiresAt: null, remainingMs: 0, requiresTemplate: true }
  }
  const expiry = new Date(lastCustomerMessageAt).getTime() + 24 * 60 * 60 * 1000
  const now = Date.now()
  const remainingMs = Math.max(0, expiry - now)
  return {
    isOpen: remainingMs > 0,
    expiresAt: new Date(expiry).toISOString(),
    remainingMs,
    requiresTemplate: remainingMs <= 0,
  }
}

export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'expirada'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}m`
  return `${minutes}m`
}

/**
 * Hook that computes the Meta 24h window status and auto-refreshes every minute.
 * Only active for meta_whatsapp conversations.
 */
export function useMetaWindow(
  channelType: string | null | undefined,
  lastCustomerMessageAt: string | null | undefined,
): WindowStatus & { formattedRemaining: string } {
  const [tick, setTick] = useState(0)

  const isMetaChannel = channelType === 'meta_whatsapp'

  useEffect(() => {
    if (!isMetaChannel) return
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [isMetaChannel])

  const status = useMemo(
    () => check24hWindow(lastCustomerMessageAt ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastCustomerMessageAt, tick],
  )

  const formattedRemaining = useMemo(
    () => formatRemainingTime(status.remainingMs),
    [status.remainingMs],
  )

  return { ...status, formattedRemaining }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useMetaWindow.ts
git commit -m "feat(hooks): add useMetaWindow for 24h window status tracking"
```

---

## Task 7: Frontend — ChannelBadge component

**Files:**
- Create: `src/components/inbox/ChannelBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Badge } from '@/components/ui/badge'
import { Smartphone, ShieldCheck } from 'lucide-react'

interface ChannelBadgeProps {
  channelType: string | null | undefined
  size?: 'sm' | 'default'
}

export function ChannelBadge({ channelType, size = 'default' }: ChannelBadgeProps) {
  if (channelType === 'meta_whatsapp') {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-green-300 bg-green-50 text-green-700 ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs'
        }`}
      >
        <ShieldCheck className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        Meta WA
      </Badge>
    )
  }

  if (channelType === 'uazapi' || !channelType) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-slate-300 bg-slate-50 text-slate-600 ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs'
        }`}
      >
        <Smartphone className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        UAZAPI
      </Badge>
    )
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inbox/ChannelBadge.tsx
git commit -m "feat(inbox): add ChannelBadge component for channel type display"
```

---

## Task 8: Frontend — MetaWindowIndicator component

**Files:**
- Create: `src/components/inbox/MetaWindowIndicator.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle } from 'lucide-react'
import { useMetaWindow } from '@/hooks/useMetaWindow'

interface MetaWindowIndicatorProps {
  channelType: string | null | undefined
  lastCustomerMessageAt: string | null | undefined
}

export function MetaWindowIndicator({ channelType, lastCustomerMessageAt }: MetaWindowIndicatorProps) {
  const { isOpen, formattedRemaining } = useMetaWindow(channelType, lastCustomerMessageAt)

  if (channelType !== 'meta_whatsapp') return null

  if (isOpen) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-green-300 bg-green-50 text-green-700 text-xs"
      >
        <Clock className="h-3 w-3" />
        Janela aberta · {formattedRemaining}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-yellow-400 bg-yellow-50 text-yellow-800 text-xs"
    >
      <AlertTriangle className="h-3 w-3" />
      Janela fechada
    </Badge>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inbox/MetaWindowIndicator.tsx
git commit -m "feat(inbox): add MetaWindowIndicator for 24h window countdown"
```

---

## Task 9: Frontend — WindowClosedComposer component

**Files:**
- Create: `src/components/inbox/WindowClosedComposer.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileText, MessageSquare } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface WindowClosedComposerProps {
  onSwitchToUazapi: () => void
}

export function WindowClosedComposer({ onSwitchToUazapi }: WindowClosedComposerProps) {
  return (
    <div className="border-t border-border bg-yellow-50/50 p-4">
      <div className="flex items-center gap-2 mb-3 text-yellow-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          Janela de 24h encerrada. Escolha uma opção:
        </span>
      </div>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="gap-2 opacity-60"
            >
              <FileText className="h-4 w-4" />
              Enviar Template HSM
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disponível em breve (Ciclo 2)</TooltipContent>
        </Tooltip>

        <Button
          variant="default"
          size="sm"
          onClick={onSwitchToUazapi}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Continuar via UAZAPI
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inbox/WindowClosedComposer.tsx
git commit -m "feat(inbox): add WindowClosedComposer with HSM placeholder and UAZAPI fallback"
```

---

## Task 10: Frontend — SwitchToUazapiDialog component

**Files:**
- Create: `src/components/inbox/SwitchToUazapiDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { MessageSquare, Loader2 } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface SwitchToUazapiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metaConversationId: string
  customerPhone: string
  customerName: string
  onSwitched: (conversationId: string) => void
}

export function SwitchToUazapiDialog({
  open,
  onOpenChange,
  metaConversationId,
  customerPhone,
  customerName,
  onSwitched,
}: SwitchToUazapiDialogProps) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')

  // Buscar instâncias UAZAPI ativas
  const { data: uazapiInstances = [] } = useQuery({
    queryKey: ['uazapi-instances-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uazapi_instances')
        .select('id, instance_name, status')
        .eq('status', 'connected')
      if (error) throw error
      return data
    },
    enabled: open,
  })

  const switchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInstanceId) throw new Error('Selecione uma instância')

      // Formatar telefone como JID UAZAPI
      const cleanPhone = customerPhone.replace(/\D/g, '')
      const chatJid = `${cleanPhone}@s.whatsapp.net`

      // Verificar se já existe conversa UAZAPI com esse número
      const { data: existingConv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('communication_channel', 'uazapi')
        .eq('uazapi_chat_id', chatJid)
        .eq('whatsapp_instance_id', selectedInstanceId)
        .in('status', ['aguardando', 'em_atendimento', 'nova'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingConv) {
        // Vincular conversas se ainda não vinculadas
        await supabase
          .from('ai_conversations')
          .update({ related_conversation_id: metaConversationId } as any)
          .eq('id', existingConv.id)
        await supabase
          .from('ai_conversations')
          .update({ related_conversation_id: existingConv.id } as any)
          .eq('id', metaConversationId)
        return existingConv.id
      }

      // Criar nova conversa UAZAPI
      const { data: newConv, error } = await supabase
        .from('ai_conversations')
        .insert({
          customer_name: customerName || 'Cliente',
          customer_phone: cleanPhone,
          communication_channel: 'uazapi',
          uazapi_chat_id: chatJid,
          whatsapp_instance_id: selectedInstanceId,
          channel_instance_id: null,
          channel_chat_id: chatJid,
          status: 'em_atendimento',
          handler_type: 'human',
          related_conversation_id: metaConversationId,
        } as any)
        .select('id')
        .single()

      if (error) throw error

      // Vincular conversa Meta → UAZAPI
      await supabase
        .from('ai_conversations')
        .update({ related_conversation_id: newConv.id } as any)
        .eq('id', metaConversationId)

      return newConv.id
    },
    onSuccess: (conversationId) => {
      toast.success('Conversa UAZAPI criada. Redirecionando...')
      onOpenChange(false)
      onSwitched(conversationId)
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Continuar via UAZAPI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            A janela de 24h da Meta expirou. Selecione uma instância UAZAPI para
            continuar a conversa com <strong>{customerName || customerPhone}</strong>.
          </p>

          <div className="space-y-2">
            <Label>Instância UAZAPI</Label>
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância..." />
              </SelectTrigger>
              <SelectContent>
                {uazapiInstances.map((inst: any) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uazapiInstances.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma instância UAZAPI conectada disponível.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => switchMutation.mutate()}
              disabled={!selectedInstanceId || switchMutation.isPending}
            >
              {switchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Iniciar conversa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inbox/SwitchToUazapiDialog.tsx
git commit -m "feat(inbox): add SwitchToUazapiDialog for UAZAPI fallback when Meta window closed"
```

---

## Task 11: Frontend — Integrate Inbox components into ChatArea

**Files:**
- Modify: `src/components/inbox/ChatArea.tsx`

- [ ] **Step 1: Add imports at top of ChatArea.tsx**

After the existing imports (around line 56-57), add:

```typescript
import { ChannelBadge } from './ChannelBadge'
import { MetaWindowIndicator } from './MetaWindowIndicator'
import { WindowClosedComposer } from './WindowClosedComposer'
import { SwitchToUazapiDialog } from './SwitchToUazapiDialog'
import { useMetaWindow } from '@/hooks/useMetaWindow'
```

- [ ] **Step 2: Add state and hook in component body**

Inside the ChatArea component function, after the existing `isMetaWhatsAppConversation` check (around line 1591-1592), add:

```typescript
  const metaWindow = useMetaWindow(
    (conversation as Record<string, unknown>)?.communication_channel as string,
    (conversation as Record<string, unknown>)?.last_customer_message_at as string,
  )
  const [showSwitchToUazapi, setShowSwitchToUazapi] = useState(false)
```

- [ ] **Step 3: Add ChannelBadge and MetaWindowIndicator in the conversation header**

Find the header area where the contact name and phone are displayed. Add the badges after the phone number display. The exact location depends on the header JSX structure. Look for the area near the contact name in the header and add:

```tsx
{/* Canal + Janela 24h */}
<ChannelBadge channelType={(conversation as any)?.communication_channel} size="sm" />
<MetaWindowIndicator
  channelType={(conversation as any)?.communication_channel}
  lastCustomerMessageAt={(conversation as any)?.last_customer_message_at}
/>
```

- [ ] **Step 4: Replace composer when Meta window is closed**

Find the composer/input section at the bottom of the chat. Wrap it with a conditional:

```tsx
{isMetaWhatsAppConversation && !metaWindow.isOpen ? (
  <WindowClosedComposer onSwitchToUazapi={() => setShowSwitchToUazapi(true)} />
) : (
  {/* existing composer JSX */}
)}
```

- [ ] **Step 5: Add SwitchToUazapiDialog at the end of the component JSX**

Before the closing fragment/div of the component's return, add:

```tsx
<SwitchToUazapiDialog
  open={showSwitchToUazapi}
  onOpenChange={setShowSwitchToUazapi}
  metaConversationId={conversation?.id || ''}
  customerPhone={(conversation as any)?.customer_phone || ''}
  customerName={conversation?.customer_name || ''}
  onSwitched={(convId) => {
    // Navigate to the new UAZAPI conversation
    // Use the onSelectConversation prop or URL navigation
    window.location.href = `/inbox?conversation=${convId}`
  }}
/>
```

- [ ] **Step 6: Verify build compiles**

```bash
npm run build
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/inbox/ChatArea.tsx
git commit -m "feat(inbox): integrate channel badge, 24h window indicator, and UAZAPI fallback in ChatArea"
```

---

## Task 12: Frontend — MetaInstanceCard component

**Files:**
- Create: `src/components/whatsapp/MetaInstanceCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Pencil, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MetaInstanceCardProps {
  instance: {
    id: string
    display_name: string
    phone_number: string
    is_active: boolean
    status: string
    config: Record<string, unknown>
    messages_sent_count: number
    messages_received_count: number
    last_message_at: string | null
  }
  onEdit: (instance: any) => void
  onTestConnection: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
  isTestingConnection: boolean
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  connected: { label: 'Conectado', color: 'border-green-300 bg-green-50 text-green-700', icon: CheckCircle },
  disconnected: { label: 'Desconectado', color: 'border-red-300 bg-red-50 text-red-700', icon: XCircle },
  error: { label: 'Erro', color: 'border-yellow-400 bg-yellow-50 text-yellow-800', icon: AlertTriangle },
  pending_setup: { label: 'Pendente', color: 'border-slate-300 bg-slate-50 text-slate-600', icon: AlertTriangle },
}

function CopyableField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado!') }}
        className="flex items-center gap-1 font-mono text-foreground hover:text-primary transition-colors"
      >
        {value}
        <Copy className="h-3 w-3 opacity-50" />
      </button>
    </div>
  )
}

export function MetaInstanceCard({
  instance,
  onEdit,
  onTestConnection,
  onToggleActive,
  isTestingConnection,
}: MetaInstanceCardProps) {
  const config = instance.config || {}
  const status = statusConfig[instance.status] || statusConfig.pending_setup
  const StatusIcon = status.icon

  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{instance.display_name}</h3>
            <p className="text-xs text-muted-foreground">{instance.phone_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`gap-1 text-xs ${status.color}`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  checked={instance.is_active}
                  onCheckedChange={(checked) => onToggleActive(instance.id, checked)}
                />
              </TooltipTrigger>
              <TooltipContent>{instance.is_active ? 'Desativar' : 'Ativar'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* IDs */}
        <div className="space-y-1 border-t border-border pt-2">
          <CopyableField label="WABA ID" value={String(config.waba_id || '-')} />
          <CopyableField label="Phone Number ID" value={String(config.phone_number_id || '-')} />
        </div>

        {/* Counters */}
        <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-2">
          <span>Enviadas: <strong className="text-foreground">{instance.messages_sent_count}</strong></span>
          <span>Recebidas: <strong className="text-foreground">{instance.messages_received_count}</strong></span>
          {instance.last_message_at && (
            <span>
              Última: {formatDistanceToNow(new Date(instance.last_message_at), { locale: ptBR, addSuffix: true })}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border pt-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(instance)} className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTestConnection(instance.id)}
            disabled={isTestingConnection}
            className="gap-1"
          >
            {isTestingConnection ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Testar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/MetaInstanceCard.tsx
git commit -m "feat(whatsapp): add MetaInstanceCard component"
```

---

## Task 13: Frontend — MetaInstanceForm component

**Files:**
- Create: `src/components/whatsapp/MetaInstanceForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'

interface MetaInstanceFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingInstance?: {
    id: string
    display_name: string
    phone_number: string
    config: Record<string, unknown>
    kanban_board_id?: string | null
  } | null
  onSave: (data: {
    id?: string
    channel_type: string
    display_name: string
    phone_number: string
    is_active: boolean
    status: string
    config: Record<string, unknown>
    kanban_board_id?: string | null
  }) => void
  isSaving: boolean
}

export function MetaInstanceForm({ open, onOpenChange, editingInstance, onSave, isSaving }: MetaInstanceFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [graphVersion, setGraphVersion] = useState('v21.0')
  const [boardId, setBoardId] = useState<string>('')

  const { data: boards = [] } = useKanbanBoards()

  useEffect(() => {
    if (editingInstance) {
      setDisplayName(editingInstance.display_name || '')
      setPhoneNumber(editingInstance.phone_number || '')
      setPhoneNumberId(String(editingInstance.config?.phone_number_id || ''))
      setWabaId(String(editingInstance.config?.waba_id || ''))
      setAccessToken(String(editingInstance.config?.access_token || ''))
      setVerifyToken(String(editingInstance.config?.webhook_verify_token || ''))
      setGraphVersion(String(editingInstance.config?.graph_api_version || 'v21.0'))
      setBoardId(editingInstance.kanban_board_id || '')
    } else {
      setDisplayName('')
      setPhoneNumber('')
      setPhoneNumberId('')
      setWabaId('')
      setAccessToken('')
      setVerifyToken('sismais_meta_verify_' + new Date().getFullYear())
      setGraphVersion('v21.0')
      setBoardId('')
    }
  }, [editingInstance, open])

  const handleSubmit = () => {
    if (!displayName.trim() || !phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      return
    }
    onSave({
      ...(editingInstance ? { id: editingInstance.id } : {}),
      channel_type: 'meta_whatsapp',
      display_name: displayName.trim(),
      phone_number: phoneNumber.trim(),
      is_active: true,
      status: 'pending_setup',
      config: {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim(),
        access_token: accessToken.trim(),
        webhook_verify_token: verifyToken.trim(),
        graph_api_version: graphVersion,
        display_name: displayName.trim(),
      },
      kanban_board_id: boardId || null,
    })
  }

  const isValid = displayName.trim() && phoneNumberId.trim() && wabaId.trim() && accessToken.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingInstance ? 'Editar Instância Meta' : 'Nova Instância Meta WhatsApp'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="meta-display-name">Display Name *</Label>
            <Input
              id="meta-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Suporte Sismais"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-phone">Número de Telefone</Label>
            <Input
              id="meta-phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+5577999991234"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-phone-id">Phone Number ID *</Label>
            <Input
              id="meta-phone-id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Da Meta Developer Console"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-waba-id">WABA ID *</Label>
            <Input
              id="meta-waba-id"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="WhatsApp Business Account ID"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-token">Access Token *</Label>
            <Input
              id="meta-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Token do System User (permanente)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-verify">Webhook Verify Token</Label>
            <Input
              id="meta-verify"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Token de verificação do webhook"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Graph API Version</Label>
              <Select value={graphVersion} onValueChange={setGraphVersion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v21.0">v21.0</SelectItem>
                  <SelectItem value="v20.0">v20.0</SelectItem>
                  <SelectItem value="v19.0">v19.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kanban Board</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {boards.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingInstance ? 'Salvar' : 'Criar Instância'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/MetaInstanceForm.tsx
git commit -m "feat(whatsapp): add MetaInstanceForm dialog for creating/editing Meta instances"
```

---

## Task 14: Frontend — MetaInstancesTab component

**Files:**
- Create: `src/components/whatsapp/MetaInstancesTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useChannelInstances } from '@/hooks/useChannelInstances'
import { MetaInstanceCard } from './MetaInstanceCard'
import { MetaInstanceForm } from './MetaInstanceForm'
import { TooltipProvider } from '@/components/ui/tooltip'

export function MetaInstancesTab() {
  const {
    instances,
    isLoading,
    upsertInstance,
    testConnection,
    toggleActive,
  } = useChannelInstances('meta_whatsapp')

  const [formOpen, setFormOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<any>(null)

  const handleEdit = (instance: any) => {
    setEditingInstance(instance)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditingInstance(null)
    setFormOpen(true)
  }

  const handleSave = (data: any) => {
    upsertInstance.mutate(data, {
      onSuccess: () => {
        setFormOpen(false)
        setEditingInstance(null)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Carregando instâncias...
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Instâncias Meta Cloud API</h3>
            <p className="text-xs text-muted-foreground">
              Gerencie números WhatsApp conectados via API oficial da Meta
            </p>
          </div>
          <Button onClick={handleNew} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Nova Instância
          </Button>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <p className="text-sm">Nenhuma instância Meta WhatsApp configurada</p>
            <Button variant="link" onClick={handleNew} className="mt-2">
              Adicionar primeira instância
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {instances.map((inst: any) => (
              <MetaInstanceCard
                key={inst.id}
                instance={inst}
                onEdit={handleEdit}
                onTestConnection={(id) => testConnection.mutate(id)}
                onToggleActive={(id, active) => toggleActive.mutate({ instanceId: id, isActive: active })}
                isTestingConnection={testConnection.isPending && testConnection.variables === inst.id}
              />
            ))}
          </div>
        )}

        <MetaInstanceForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editingInstance={editingInstance}
          onSave={handleSave}
          isSaving={upsertInstance.isPending}
        />
      </div>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/MetaInstancesTab.tsx
git commit -m "feat(whatsapp): add MetaInstancesTab with list, create, edit, test connection"
```

---

## Task 15: Frontend — Add tab system to WhatsAppInstances page

**Files:**
- Modify: `src/pages/WhatsAppInstances.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add after the existing imports:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
import { MetaInstancesTab } from "@/components/whatsapp/MetaInstancesTab";
```

- [ ] **Step 2: Wrap existing content in Tabs**

Find the main `return` statement of the `WhatsAppInstances` component. The current structure is something like:

```tsx
return (
  <div className="space-y-6 p-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Instâncias WhatsApp</h1>
        ...
      </div>
      <Dialog ...>
        {/* Add UAZAPI instance dialog */}
      </Dialog>
    </div>
    {/* Instance cards grid */}
    ...
  </div>
)
```

Wrap everything inside the outer div with a `Tabs` component. The structure should become:

```tsx
return (
  <div className="space-y-6 p-6">
    <div>
      <h1 className="text-2xl font-bold">Instâncias WhatsApp</h1>
      <p className="text-muted-foreground text-sm">Gerencie suas conexões WhatsApp</p>
    </div>

    <Tabs defaultValue="uazapi" className="space-y-4">
      <TabsList>
        <TabsTrigger value="uazapi" className="gap-1">
          <Smartphone className="h-4 w-4" />
          UAZAPI
        </TabsTrigger>
        <TabsTrigger value="meta" className="gap-1">
          <ShieldCheck className="h-4 w-4" />
          Meta Cloud API
        </TabsTrigger>
      </TabsList>

      <TabsContent value="uazapi">
        {/* Move ALL existing UAZAPI content here — the add button, dialog, cards grid, etc. */}
        {/* This is the existing content, just moved inside this tab */}
        ...existing UAZAPI JSX...
      </TabsContent>

      <TabsContent value="meta">
        <MetaInstancesTab />
      </TabsContent>
    </Tabs>
  </div>
)
```

The key change: move the existing UAZAPI-specific JSX (add button, dialog, instance cards grid) into `<TabsContent value="uazapi">`, and add the new `<MetaInstancesTab />` in `<TabsContent value="meta">`. The page title stays outside the tabs.

- [ ] **Step 3: Verify build compiles**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/WhatsAppInstances.tsx
git commit -m "feat(whatsapp): add tab system with UAZAPI and Meta Cloud API tabs"
```

---

## Task 16: Deploy edge functions and verify

- [ ] **Step 1: Deploy updated functions**

```bash
supabase functions deploy meta-whatsapp-proxy
supabase functions deploy agent-executor  # if channel-router is used via import
```

Or use the Supabase MCP `deploy_edge_function` tool for each function.

Note: `channel-router.ts` and `meta-24h-window.ts` are in `_shared/` and get bundled automatically with any function that imports them.

- [ ] **Step 2: Apply migration**

Use Supabase MCP `apply_migration` tool or push via CLI.

- [ ] **Step 3: Verify frontend runs**

```bash
npm run dev
```

Navigate to `/whatsapp-instances` and verify:
- Two tabs appear: UAZAPI and Meta Cloud API
- Meta tab shows the 2 existing instances
- Test Connection button works
- Edit form opens with correct data

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(meta-whatsapp): complete Cycle 1 — config page, 24h window, channel badges"
```
