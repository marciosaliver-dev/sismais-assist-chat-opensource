# Agent Ticket Lifecycle & Smart Greeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que agentes IA encerrem tickets (configurável), reabram tickets finalizados, cumprimentem com saudação baseada no horário, detectem/salvem dados de cliente nas mensagens, e usem histórico completo do cliente como contexto.

**Architecture:** Adicionar `canCloseTicket` ao `support_config` do agente. Melhorar o system prompt com saudação dinâmica e instrução de extração de dados. Adicionar botão "Reabrir" na UI do inbox. Enriquecer o contexto do agent-executor com dados do cliente vinculado.

**Tech Stack:** Deno Edge Functions (agent-executor, process-incoming-message), React + shadcn/ui (ChatArea, AgentSupportEditor), Supabase (ai_conversations, helpdesk_clients)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/functions/agent-executor/index.ts` | Modify | Adicionar saudação dinâmica, contexto de cliente, config canCloseTicket |
| `supabase/functions/process-incoming-message/index.ts` | Modify | Detectar primeira mensagem para saudação, extrair dados do cliente |
| `supabase/functions/_shared/brazil-timezone.ts` | Modify | Adicionar `getGreetingByTime()` |
| `src/components/agents/AgentSupportEditor.tsx` | Modify | Toggle `canCloseTicket` na UI |
| `src/components/inbox/ChatArea.tsx` | Modify | Botão "Reabrir Atendimento" |

---

### Task 1: Helper `getGreetingByTime()` no brazil-timezone

**Files:**
- Modify: `supabase/functions/_shared/brazil-timezone.ts`

- [ ] **Step 1: Adicionar função `getGreetingByTime()`**

No final do arquivo `brazil-timezone.ts`, adicionar:

```typescript
/**
 * Retorna saudação baseada no horário de Brasília:
 * 06:00–11:59 → "Bom dia", 12:00–17:59 → "Boa tarde", 18:00–05:59 → "Boa noite"
 */
export function getGreetingByTime(): string {
  const now = getNowBrazil()
  const hour = now.getHours()
  if (hour >= 6 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/brazil-timezone.ts
git commit -m "feat: add getGreetingByTime() helper for time-based agent greetings"
```

---

### Task 2: Configuração `canCloseTicket` no support_config (UI)

**Files:**
- Modify: `src/components/agents/AgentSupportEditor.tsx`

- [ ] **Step 1: Adicionar campo `canCloseTicket` ao defaultData**

No objeto `defaultData` (linha ~34), adicionar:

```typescript
canCloseTicket: true,
```

- [ ] **Step 2: Adicionar toggle na aba "Técnico" (tab `technical`)**

Localizar o render da tab `technical` no componente e adicionar um Switch:

```tsx
<div className="flex items-center justify-between">
  <div>
    <Label htmlFor="canCloseTicket">Agente pode encerrar atendimento</Label>
    <p className="text-sm text-muted-foreground">
      Permite que o agente IA finalize o ticket quando o problema for resolvido
    </p>
  </div>
  <Switch
    id="canCloseTicket"
    checked={agentData.canCloseTicket ?? true}
    onCheckedChange={(v) => update('canCloseTicket', v)}
  />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agents/AgentSupportEditor.tsx
git commit -m "feat: add canCloseTicket toggle to agent support config UI"
```

---

### Task 3: Agent-executor — respeitar `canCloseTicket` e saudação dinâmica

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`

- [ ] **Step 1: Importar `getGreetingByTime`**

Na linha 4, atualizar o import:

```typescript
import { formatBrazilDateTime, isBusinessHours, getNextBusinessDay, getGreetingByTime } from '../_shared/brazil-timezone.ts'
```

- [ ] **Step 2: Injetar saudação dinâmica no system prompt**

Após a linha `systemPrompt += timeContext` (linha ~264), adicionar:

```typescript
// Saudação dinâmica baseada no horário
const greetingTime = getGreetingByTime()
systemPrompt += `\n\n[SAUDAÇÃO]: Ao iniciar um atendimento (primeira mensagem ao cliente), cumprimente com "${greetingTime}". Adapte naturalmente ao contexto (ex: "${greetingTime}! Sou o ${supportConfig.agentName || agent.name}, como posso ajudá-lo?"). NUNCA use "Bom dia" se for à tarde/noite e vice-versa.`
```

- [ ] **Step 3: Condicionar auto-resolução ao `canCloseTicket`**

Na seção de auto-resolução (linha ~666), envolver o bloco com a verificação:

```typescript
// 11b. Auto-resolução se LLM detectou resolução explícita do problema
const canClose = supportConfig.canCloseTicket !== false // default true
if (forceResolve && resolutionSummary && canClose) {
  // ... bloco existente de auto-resolução ...
} else if (forceResolve && resolutionSummary && !canClose) {
  console.log(`[agent-executor] Agent detected resolution but canCloseTicket=false, keeping conversation open`)
  // Não fechar, mas informar que o problema parece resolvido
}
```

- [ ] **Step 4: Modificar instrução de auto-resolução baseada em canCloseTicket**

Na linha ~286 onde está a instrução `[AUTO-RESOLUÇÃO]`, condicionar:

```typescript
if (supportConfig.canCloseTicket !== false) {
  systemPrompt += `\n\n[AUTO-RESOLUÇÃO]: Quando o problema for completamente resolvido E o cliente confirmar explicitamente (ex: "resolveu", "funcionou", "obrigado era isso", "perfeito"), inicie sua resposta com: "[RESOLVED] [PROBLEMA]: {resumo breve do problema} | [SOLUÇÃO]: {resumo breve da solução aplicada}" e depois escreva a mensagem de encerramento normalmente.`
} else {
  systemPrompt += `\n\n[RESOLUÇÃO]: Você NÃO deve encerrar o atendimento. Quando o problema parecer resolvido, pergunte se há algo mais que possa ajudar, mas NÃO use o marcador [RESOLVED].`
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat: dynamic greeting by time + canCloseTicket config in agent-executor"
```

---

### Task 4: Enriquecer contexto do agente com dados do cliente vinculado

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`

- [ ] **Step 1: Buscar dados do cliente vinculado em paralelo**

No bloco de Promise.all (linha ~49), adicionar uma terceira query para buscar dados do cliente:

Após o `Promise.all` que busca `historyResult` e `convResult`, adicionar lógica para buscar cliente:

```typescript
// Buscar dados do cliente vinculado para contexto
let clientContext = ''
if (conversationData?.helpdesk_client_id) {
  const { data: client } = await supabase
    .from('helpdesk_clients')
    .select('name, company_name, email, phone, cnpj, cpf, subscribed_product, notes')
    .eq('id', conversationData.helpdesk_client_id)
    .single()

  if (client) {
    const parts = [`Nome: ${client.name}`]
    if (client.company_name) parts.push(`Empresa: ${client.company_name}`)
    if (client.cnpj) parts.push(`CNPJ: ${client.cnpj}`)
    if (client.cpf) parts.push(`CPF: ${client.cpf}`)
    if (client.email) parts.push(`Email: ${client.email}`)
    if (client.phone) parts.push(`Telefone: ${client.phone}`)
    if (client.subscribed_product) parts.push(`Produto: ${client.subscribed_product}`)
    if (client.notes) parts.push(`Observações: ${client.notes}`)
    clientContext = `\n\n[DADOS DO CLIENTE VINCULADO]:\n${parts.join('\n')}\nUse esses dados no contexto da conversa. NÃO peça dados que já possui.`
  }
}

// Buscar últimos atendimentos do cliente para histórico
if (conversationData?.helpdesk_client_id) {
  const { data: prevTickets } = await supabase
    .from('ai_conversations')
    .select('ticket_number, ticket_subject, status, resolution_summary, created_at')
    .eq('helpdesk_client_id', conversationData.helpdesk_client_id)
    .neq('id', conversation_id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (prevTickets && prevTickets.length > 0) {
    const ticketLines = prevTickets.map(t =>
      `• #${t.ticket_number} — ${t.ticket_subject || 'Sem assunto'} (${t.status}) ${t.resolution_summary ? '→ ' + t.resolution_summary : ''}`
    ).join('\n')
    clientContext += `\n\n[HISTÓRICO DE ATENDIMENTOS DO CLIENTE]:\n${ticketLines}\nUse esse histórico para entender padrões e dar contexto ao atendimento atual.`
  }
}
```

- [ ] **Step 2: Injetar clientContext no system prompt**

Após a linha que injeta `timeContext`, adicionar:

```typescript
if (clientContext) {
  systemPrompt += clientContext
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat: inject linked client data and ticket history into agent context"
```

---

### Task 5: Extração de dados do cliente nas mensagens (process-incoming-message)

**Files:**
- Modify: `supabase/functions/process-incoming-message/index.ts`

- [ ] **Step 1: Melhorar extração de dados com regex de telefone**

Após as constantes `CNPJ_REGEX`, `CPF_REGEX`, `DIGITS_ONLY_REGEX`, `EMAIL_REGEX` (linha ~157), adicionar:

```typescript
const PHONE_REGEX = /\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/
```

E adicionar função:

```typescript
function extractPhone(text: string): string | null {
  const match = text.match(PHONE_REGEX)
  if (!match) return null
  return match[0].replace(/\D/g, '')
}
```

- [ ] **Step 2: Salvar dados extraídos no cliente vinculado**

Na seção onde `justIdentified = true` (após o auto-link por identificação, ~linha 293), adicionar lógica para atualizar dados do cliente a partir de mensagens:

```typescript
// Extrair e salvar dados do cliente encontrados em mensagens
if (conversation.helpdesk_client_id) {
  const documento = extractDocumento(message_content || '')
  const email = extractEmail(message_content || '')
  const phone = extractPhone(message_content || '')

  if (documento || email || phone) {
    const updateFields: Record<string, string> = {}

    // Buscar dados atuais do cliente para não sobrescrever
    const { data: currentClient } = await supabase
      .from('helpdesk_clients')
      .select('cnpj, cpf, email, phone')
      .eq('id', conversation.helpdesk_client_id)
      .single()

    if (currentClient) {
      if (documento) {
        const cleanDoc = documento.replace(/\D/g, '')
        if (cleanDoc.length === 14 && !currentClient.cnpj) {
          updateFields.cnpj = documento
        } else if (cleanDoc.length === 11 && !currentClient.cpf) {
          updateFields.cpf = documento
        }
      }
      if (email && !currentClient.email) {
        updateFields.email = email
      }
      if (phone && !currentClient.phone) {
        updateFields.phone = phone
      }

      if (Object.keys(updateFields).length > 0) {
        console.log(`[process-incoming] Auto-saving client data: ${Object.keys(updateFields).join(', ')}`)
        await supabase
          .from('helpdesk_clients')
          .update(updateFields)
          .eq('id', conversation.helpdesk_client_id)
      }
    }
  }
}
```

Inserir este bloco **após** a seção ETAPA 0 (auto-link), antes da verificação de `handler_type === 'human'` (antes da linha ~309).

- [ ] **Step 3: Adicionar instrução ao agente para detectar dados**

No `agent-executor`, na construção do system prompt, adicionar (junto com o clientContext):

```typescript
systemPrompt += `\n\n[COLETA DE DADOS]: Quando o cliente mencionar dados como CPF, CNPJ, e-mail ou telefone na conversa, esses dados são automaticamente detectados e salvados. Antes de solicitar esses dados, verifique se já existem nos [DADOS DO CLIENTE VINCULADO]. Se o cliente ainda não está vinculado, peça gentilmente o CNPJ/CPF para localizá-lo.`
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process-incoming-message/index.ts supabase/functions/agent-executor/index.ts
git commit -m "feat: auto-extract and save client data (CPF/CNPJ/email/phone) from messages"
```

---

### Task 6: Botão "Reabrir Atendimento" no ChatArea

**Files:**
- Modify: `src/components/inbox/ChatArea.tsx`

- [ ] **Step 1: Adicionar função de reabrir conversa**

Dentro do componente ChatArea, adicionar handler:

```typescript
const handleReopenConversation = async () => {
  if (!conversation) return
  try {
    const { error } = await supabase
      .from('ai_conversations')
      .update({
        status: 'em_atendimento',
        handler_type: 'human',
        resolved_at: null,
        ai_resolved: false,
      })
      .eq('id', conversation.id)

    if (error) throw error
    toast.success('Atendimento reaberto com sucesso')
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  } catch (err) {
    toast.error('Erro ao reabrir atendimento')
    console.error(err)
  }
}
```

- [ ] **Step 2: Adicionar botão na UI quando conversa está finalizada**

Localizar onde o status da conversa é exibido (header do chat ou área de ações) e adicionar:

```tsx
{conversation && isClosedStatus(conversation.status || '') && conversation.status !== 'cancelado' && (
  <Button
    variant="outline"
    size="sm"
    onClick={handleReopenConversation}
    className="gap-1.5"
  >
    <RefreshCw className="h-4 w-4" />
    Reabrir Atendimento
  </Button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/inbox/ChatArea.tsx
git commit -m "feat: add reopen conversation button for closed tickets"
```

---

### Task 7: Instrução de horário comercial e saudação completa no agent-executor

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`

- [ ] **Step 1: Melhorar instrução de fora do expediente**

Na seção onde `!businessStatus.isOpen` (linha ~257), melhorar a mensagem:

```typescript
if (!businessStatus.isOpen) {
  const nextDay = await getNextBusinessDay(supabase)
  timeContext += `\n[STATUS EXPEDIENTE]: FORA DO EXPEDIENTE — ${businessStatus.reason}.`
  timeContext += `\nSe o cliente pedir atendimento humano ou transferência, informe com empatia que o atendimento humano funciona apenas em horário comercial e que será atendido no próximo dia útil (${nextDay}). Diga algo como: "Nosso time de atendentes está disponível em horário comercial. Seu chamado será priorizado no próximo dia útil (${nextDay}). Enquanto isso, posso ajudar no que for possível!"`
  timeContext += `\nContinue ajudando no que puder via IA.`
} else {
  timeContext += `\n[STATUS EXPEDIENTE]: Dentro do horário comercial. Transferências para atendentes humanos estão disponíveis.`
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat: improve out-of-hours messaging with next business day info"
```

---

### Task 8: Verificação e teste manual

- [ ] **Step 1: Verificar build do frontend**

```bash
cd c:/Users/Vaio/Projects/sismais-assist-chat && npm run build
```

Expected: Build sem erros.

- [ ] **Step 2: Verificar lint**

```bash
npm run lint
```

Expected: Sem erros novos.

- [ ] **Step 3: Commit final se necessário**

```bash
git add -A
git commit -m "fix: resolve any build/lint issues from agent lifecycle changes"
```
