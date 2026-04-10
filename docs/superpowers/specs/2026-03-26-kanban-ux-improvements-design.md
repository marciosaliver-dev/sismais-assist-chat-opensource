# Spec: Kanban UX Improvements — 4 Features

**Date:** 2026-03-26
**Branch:** claude/sismais-support-system-JCMCi

---

## Context

Agentes humanos enfrentam 4 problemas de usabilidade no Kanban:
1. Cards com mensagens não lidas são difíceis de identificar rapidamente (ring sutil demais)
2. Não fica claro qual número/instância WhatsApp originou o atendimento
3. A IA fecha tickets diretamente em "finalizado" — deveria deixar para humano validar
4. O merge de tickets atual é simplório: não permite escolher quais dados manter (diferente do Zoho Desk)

---

## Feature 1: Destaque de Cards com Mensagens Não Lidas

**Decisão:** Fundo âmbar total + borda laranja (estilo SprintHub)

**Arquivo:** `src/components/tickets/KanbanCard.tsx:330`

**Mudança:** Substituir as classes da condição `unreadCount > 0`:

```
// antes
'ring-1 ring-[#EA580C]/60 border-[#EA580C]/60 border-l-[#EA580C] bg-[#FFF0E0] animate-unread-pulse'

// depois
'ring-2 ring-[#EA580C]/50 border-[#EA580C] border-l-[#EA580C] bg-[#FFF3E0] animate-unread-pulse shadow-[0_2px_8px_rgba(234,88,12,0.12)]'
```

Adicionar micro-banner "X não lidas" após os banners de fila (~linha 376), com condicional `!isAwaitingHuman && !isQueueOver30 && !isQueueOver60`:

```tsx
{unreadCount > 0 && !isAwaitingHuman && !isQueueOver30 && !isQueueOver60 && (
  <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-2 py-1 bg-[#FFF3E0] border-b border-[#EA580C]/30 rounded-t-[calc(var(--radius)-1px)]">
    <MessageSquare className="w-3 h-3 text-[#EA580C] shrink-0" />
    <span className="text-[9px] font-bold text-[#EA580C] uppercase tracking-wider">
      {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
    </span>
  </div>
)}
```

Ajustar o `mt-5` do header (~linha 399) para incluir a condição de unread banner:
```tsx
(isAwaitingHuman || isQueueOver30 || (unreadCount > 0 && !isAwaitingHuman && !isQueueOver30 && !isQueueOver60)) && "mt-5"
```

---

## Feature 2: Exibição de Origem WhatsApp no Card

**Decisão:** Pill verde dedicado com ícone WA + nome da instância + telefone

**Arquivo:** `src/components/tickets/KanbanCard.tsx:752–762`

**Mudança:** Substituir o pill cinza da instância:

```tsx
// antes: pill cinza com Smartphone icon + só o nome da instância
// depois:
{(ticket.whatsapp_instance_name || ticket.customer_phone) && (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#166534] border border-[#25D366]/30 truncate max-w-[160px]">
        <MessageSquare className="w-3 h-3 shrink-0 text-[#25D366]" />
        <span className="truncate">
          {[ticket.whatsapp_instance_name, ticket.customer_phone].filter(Boolean).join(' · ')}
        </span>
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      WhatsApp: {ticket.whatsapp_instance_name || '—'} · {ticket.customer_phone || '—'}
    </TooltipContent>
  </Tooltip>
)}
```

Remover import `Smartphone` se não usado em mais nenhum lugar do arquivo.

---

## Feature 3: IA não fecha tickets em "Concluído"

**Problema:** Linha 1300 do `agent-executor` usa `status = 'finalizado'` como fallback quando não existe `is_ai_validation` stage no board.

**Arquivo:** `supabase/functions/agent-executor/index.ts:1298–1302`

**Mudança:** Substituir o `else` block:

```typescript
} else {
  // Sem etapa de validação — buscar stage "Resolvido" em vez de fechar direto
  let resolvidoStageId: string | null = null
  if (conversationData?.kanban_board_id) {
    const { data: resolvidoStage } = await supabase
      .from('kanban_stages')
      .select('id')
      .eq('board_id', conversationData.kanban_board_id)
      .or('slug.ilike.%resolvido%,name.ilike.%resolvido%')
      .eq('active', true)
      .maybeSingle()
    resolvidoStageId = resolvidoStage?.id || null
    console.log(`[agent-executor] Resolvido stage lookup: found=${resolvidoStageId}`)
  }
  if (resolvidoStageId) {
    updatePayload.kanban_stage_id = resolvidoStageId
    console.log(`[agent-executor] No AI validation stage, moving to Resolvido: ${resolvidoStageId}`)
  } else {
    updatePayload.status = 'resolvido'
    console.log(`[agent-executor] No Resolvido stage found, setting status=resolvido`)
  }
}
```

Requer deploy: `supabase functions deploy agent-executor`

---

## Feature 4: Merge Estilo Zoho Desk (campo a campo)

**Decisão:** Novo componente `SmartMergeDialog` — modal lado a lado, usuário escolhe campo por campo qual valor manter. Para 2 tickets → SmartMergeDialog. Para 3+ → BulkMergeDialog existente.

**Arquivo novo:** `src/components/tickets/SmartMergeDialog.tsx`

**Interface:**
```typescript
interface SmartMergeTicket {
  id: string
  ticket_number?: number | null
  customer_name?: string | null
  ticket_subject?: string | null
  status?: string | null
  agent_name?: string | null
  helpdesk_client_name?: string | null
  helpdesk_client_id?: string | null
  ticket_category_id?: string | null
  ticket_category_name?: string | null
  ticket_module_id?: string | null
  ticket_module_name?: string | null
  handler_type?: string | null
}
```

**Estado interno:**
```typescript
const [keepId, setKeepId] = useState<string>(tickets[0]?.id || '')
type FieldKey = 'ticket_subject' | 'status' | 'agent' | 'client' | 'category' | 'module'
const [fieldChoices, setFieldChoices] = useState<Record<FieldKey, string>>({
  ticket_subject: tickets[0]?.id,
  status: tickets[0]?.id,
  agent: tickets[0]?.id,
  client: tickets[0]?.id,
  category: tickets[0]?.id,
  module: tickets[0]?.id,
})
```

**Layout:** `max-w-3xl` dialog — tabela com colunas: Campo | Ticket A (cyan highlight) | Ticket B. Cada linha tem radio para selecionar qual valor manter. A linha "Ticket Principal" usa `keepId` (afeta qual ticket sobrevive ao RPC).

**Submit (2 passos):**
1. `supabase.rpc('merge_tickets', { p_keep_id: keepId, p_merge_ids: [outroId] })` — absorve histórico
2. `supabase.from('ai_conversations').update({ ticket_subject, status, ticket_category_id, ticket_module_id, helpdesk_client_id }).eq('id', keepId)` — aplica campos escolhidos

**Integração em `KanbanBoard.tsx`:**
- Importar `SmartMergeDialog`
- Adicionar estados: `smartMergeOpen`, `smartMergeTickets`
- Na lógica do botão Mesclar (onde `bulkMergeOpen` é setado): se `selectedTickets.size === 2` → abrir `SmartMergeDialog` com os dados completos dos 2 tickets; se `> 2` → continuar com `BulkMergeDialog`
- Os dados extras (subject, category, module, client_id) precisam ser passados via `selectedTickets` → buscar do array `tickets` do hook

---

## Ordem de Implementação

1. **Feature 1 + 2** — só `KanbanCard.tsx`, sem dependências, mesmo commit
2. **Feature 3** — edge function `agent-executor`, deploy separado
3. **Feature 4** — novo `SmartMergeDialog.tsx` + ajuste em `KanbanBoard.tsx`

---

## Verificação

- **F1:** Ticket com `uazapi_unread_count > 0` → card âmbar + borda laranja + banner "X não lidas". Ticket com fila urgente → só banner de fila (sem duplicar).
- **F2:** Footer do card mostra pill verde com `"Instância Principal · +5511..."`. Tooltip mostra dados completos.
- **F3:** Simular resolução de IA via playground → ticket vai para stage "Resolvido" (não "Concluído"). Verificar logs da edge function.
- **F4:** Selecionar 2 tickets → SmartMergeDialog abre. Escolher campos misturados → ticket mantido reflete as escolhas. Selecionar 3+ tickets → BulkMergeDialog antigo.
