# Greeting Calendar Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer o sistema de saudação dos agentes IA para usar o nome do contato, saudação por horário, instruções de personalidade do agente e contexto de feriados/calendário.

**Architecture:** Duas mudanças independentes: (1) `agent-executor/index.ts` — hoist das variáveis de feriado para fora do bloco `isOpen`, substituição do bloco `[PRIMEIRA MENSAGEM]` por bloco enriquecido com `support_config.greeting` + holiday context; (2) `AgentGreeting.tsx` — UI atualizada com descrição, chips de exemplo e painel informativo.

**Tech Stack:** Deno TypeScript (Edge Function), React 18 + TypeScript + Tailwind + shadcn/ui

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/agent-executor/index.ts` | Modify — hoist `isHoliday`/`holidayName`, substituir bloco greeting (linhas 467-480) |
| `src/components/agents/form-tabs/AgentGreeting.tsx` | Modify — UI enriquecida com chips e painel informativo |

---

### Task 1: Hoist das variáveis de feriado e enriquecimento do bloco de saudação

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts` (linhas ~444-480)

Contexto atual (linhas 444-480):
```typescript
const businessStatus = await isBusinessHours(supabase, supportConfig?.supportHours as string | undefined, conversationData?.kanban_board_id || undefined)

let timeContext = `\n\n[DATA/HORA ATUAL]: ${nowFormatted}`
if (!businessStatus.isOpen) {
  const nextDay = await getNextBusinessDay(supabase)
  const isHoliday = businessStatus.reason.startsWith('Feriado:')
  const holidayName = isHoliday ? businessStatus.reason.replace('Feriado: ', '') : null

  timeContext += `\n[STATUS EXPEDIENTE]: FORA DO EXPEDIENTE — ${businessStatus.reason}.`
  timeContext += `\n[PRÓXIMO DIA ÚTIL]: ${nextDay}`

  if (isHoliday && holidayName) {
    timeContext += `\n[FERIADO HOJE]: Hoje é feriado (${holidayName}). ...`
  }
  // ... resto do bloco fora do expediente
} else {
  timeContext += `\n[STATUS EXPEDIENTE]: Dentro do horário comercial. ...`
}
systemPrompt += timeContext

// Saudação condicional: só na primeira mensagem da conversa
const greetingTime = getGreetingByTime()
const isFirstMessage = historyMessages.length === 0
const clientFirstName = linkedClient?.name?.split(' ')[0] || ''

if (isFirstMessage) {
  if (clientFirstName) {
    systemPrompt += `\n\n[PRIMEIRA MENSAGEM — SAUDAÇÃO PERSONALIZADA]: Esta é a PRIMEIRA mensagem ao cliente. O nome do cliente é **${clientFirstName}**. Cumprimente OBRIGATORIAMENTE pelo nome: "${greetingTime}, ${clientFirstName}! Sou o ${supportConfig.agentName || agent.name}, como posso te ajudar hoje?". NUNCA use "Bom dia" se for à tarde/noite e vice-versa. Seja caloroso e pessoal.`
  } else {
    systemPrompt += `\n\n[PRIMEIRA MENSAGEM — SAUDAÇÃO]: Esta é a PRIMEIRA mensagem ao cliente. Cumprimente com "${greetingTime}" e se apresente: "${greetingTime}! Sou o ${supportConfig.agentName || agent.name}, como posso ajudá-lo?". NUNCA use "Bom dia" se for à tarde/noite e vice-versa.`
  }
} else {
  systemPrompt += `\n\n[CONTINUAÇÃO DE CONVERSA]: Esta NÃO é a primeira mensagem. PROIBIDO cumprimentar novamente, ...`
}
```

- [ ] **Step 1: Hoist `isHoliday` e `holidayName` para fora do bloco `if (!businessStatus.isOpen)`**

Localizar a linha `const businessStatus = await isBusinessHours(...)` (aprox. linha 444) e adicionar logo após:

```typescript
const businessStatus = await isBusinessHours(supabase, supportConfig?.supportHours as string | undefined, conversationData?.kanban_board_id || undefined)

// Hoist holiday info para uso na saudação e no bloco de expediente
const isHolidayToday = businessStatus.reason.startsWith('Feriado:')
const holidayNameToday = isHolidayToday ? businessStatus.reason.replace('Feriado: ', '') : null
```

- [ ] **Step 2: Atualizar bloco `if (!businessStatus.isOpen)` para usar as variáveis hoistadas**

Dentro do bloco `if (!businessStatus.isOpen)`, substituir:
```typescript
const isHoliday = businessStatus.reason.startsWith('Feriado:')
const holidayName = isHoliday ? businessStatus.reason.replace('Feriado: ', '') : null
```
por referências às variáveis hoistadas:
```typescript
if (isHolidayToday && holidayNameToday) {
  timeContext += `\n[FERIADO HOJE]: Hoje é feriado (${holidayNameToday}). Ao mencionar que está fora do expediente, DIGA o nome do feriado e informe que o atendimento humano retorna em ${nextDay}. Exemplo: "Hoje é ${holidayNameToday} 🎉, nosso time está descansando, mas eu posso te ajudar! Se precisar de um humano, será atendido em ${nextDay}."`
}
```

- [ ] **Step 3: Substituir o bloco de saudação da primeira mensagem (linhas ~467-480)**

Localizar e substituir todo o bloco `// Saudação condicional: só na primeira mensagem da conversa` até o `else` do `isFirstMessage` pelo seguinte:

```typescript
// Saudação condicional: só na primeira mensagem da conversa
const greetingTime = getGreetingByTime()
const isFirstMessage = historyMessages.length === 0
const clientFirstName = linkedClient?.name?.split(' ')[0] || ''
const agentName = supportConfig.agentName || agent.name
const greetingInstructions = (supportConfig.greeting as string | undefined) || ''

if (isFirstMessage) {
  const clientNameLine = clientFirstName
    ? `Nome do cliente: **${clientFirstName}** — use OBRIGATORIAMENTE o primeiro nome na saudação.`
    : `Nome do cliente: não disponível — cumprimente sem nome.`

  const holidayLine = isHolidayToday && holidayNameToday
    ? `Feriado hoje: **${holidayNameToday}** — mencione levemente de forma acolhedora e comemorativa (ex: "Feliz ${holidayNameToday}!").`
    : `Feriado hoje: nenhum.`

  const personalityLine = greetingInstructions
    ? `Instruções de personalidade para a saudação: "${greetingInstructions}"`
    : `Instruções de personalidade: não configuradas — use tom amigável e profissional padrão.`

  systemPrompt += `\n\n[SAUDAÇÃO — PRIMEIRA MENSAGEM]
${clientNameLine}
Saudação por horário: **${greetingTime}** (horário de Brasília) — use EXATAMENTE esta saudação, NUNCA outra.
Apresente-se como: **${agentName}**
${holidayLine}
${personalityLine}

INSTRUÇÕES OBRIGATÓRIAS:
- Inicie com "${greetingTime}" seguido do nome do cliente (se disponível)
- Apresente-se pelo nome configurado acima
- Aplique o tom das instruções de personalidade acima
- Se houver feriado, mencione de forma leve e acolhedora ANTES de perguntar como pode ajudar
- Mantenha a saudação concisa: máximo 2 frases antes de perguntar como pode ajudar
- PROIBIDO usar saudação diferente do horário atual (ex: NUNCA "Bom dia" se for tarde/noite)`
} else {
  systemPrompt += `\n\n[CONTINUAÇÃO DE CONVERSA]: Esta NÃO é a primeira mensagem. PROIBIDO cumprimentar novamente, PROIBIDO repetir seu nome ou o nome do cliente, PROIBIDO usar saudações como "Olá", "Oi", "${greetingTime}". Vá DIRETO ao ponto, continue a conversa naturalmente como se já estivesse em diálogo fluido. Responda de forma objetiva e humana.`
}
```

- [ ] **Step 4: Verificar que o TypeScript compila sem erros**

```bash
cd supabase/functions/agent-executor
deno check index.ts
```

Esperado: sem erros de compilação.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "feat(agent-executor): enrich greeting with holiday context and personality instructions"
```

---

### Task 2: Atualizar UI do AgentGreeting.tsx

**Files:**
- Modify: `src/components/agents/form-tabs/AgentGreeting.tsx`

Arquivo atual (27 linhas, componente simples com um Textarea):

```tsx
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentGreeting({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground">Saudação Inicial</Label>
        <Textarea
          className="min-h-[150px]"
          value={data.greeting || ''}
          onChange={(e) => onChange({ greeting: e.target.value })}
          placeholder="Olá! 👋 Sou a Ana, sua assistente..."
        />
        <p className="text-xs text-muted-foreground">
          Seja acolhedor e deixe claro que está pronto para ajudar
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 1: Reescrever o componente `AgentGreeting.tsx`**

Substituir o conteúdo completo do arquivo por:

```tsx
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

const EXAMPLE_CHIPS = [
  { label: 'Tom descontraído', value: 'Use tom descontraído e amigável, como se fosse um amigo prestativo. Seja leve e use emojis com moderação.' },
  { label: 'Formal e profissional', value: 'Seja formal e profissional. Trate o cliente com "você" e mantenha linguagem técnica e objetiva.' },
  { label: 'Empático e acolhedor', value: 'Tom acolhedor e empático. Demonstre que se importa com o problema do cliente antes de ir ao assunto técnico.' },
]

export function AgentGreeting({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground">Instruções de Saudação</Label>
        <Textarea
          className="min-h-[120px]"
          value={data.greeting || ''}
          onChange={(e) => onChange({ greeting: e.target.value })}
          placeholder="Ex: Use um tom descontraído e amigável. Pergunte como o cliente está antes de ir direto ao assunto..."
        />
        <p className="text-xs text-muted-foreground">
          Essas instruções guiam o tom e estilo da saudação gerada pela IA.
          A IA usará automaticamente o nome do contato, a saudação correta por horário
          e mencionará feriados quando aplicável.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Exemplos de instrução:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange({ greeting: chip.value })}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md bg-muted/40 border border-border p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Injetado automaticamente pela IA</p>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
          <li>Nome do contato (quando disponível no cadastro)</li>
          <li>Saudação por horário — Bom dia, Boa tarde ou Boa noite</li>
          <li>Feriados e datas especiais do calendário brasileiro</li>
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que o componente não tem erros de TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados a `AgentGreeting.tsx`.

- [ ] **Step 3: Verificar visualmente na UI**

```bash
npm run dev
```

Navegar para `/agents`, editar um agente, aba **Personalidade** → seção **Saudação Inicial**.

Checar:
- Textarea com placeholder novo
- 3 chips clicáveis ("Tom descontraído", "Formal e profissional", "Empático e acolhedor")
- Clicar em um chip preenche o textarea
- Painel "Injetado automaticamente pela IA" visível com ícone Sparkles
- Layout não quebra em telas menores

- [ ] **Step 4: Commit**

```bash
git add src/components/agents/form-tabs/AgentGreeting.tsx
git commit -m "feat(agents): update greeting UI with examples, chips and auto-inject info panel"
```

---

### Task 3: Smoke test manual end-to-end

- [ ] **Step 1: Abrir o Playground de um agente**

Navegar para `/agents/playground/<id-de-um-agente>`.

- [ ] **Step 2: Verificar saudação da primeira mensagem**

Enviar qualquer mensagem. A resposta do agente deve:
- Conter a saudação correta pelo horário atual (Bom dia / Boa tarde / Boa noite)
- Mencionar o nome configurado no persona (se playground tiver persona com nome)
- Aplicar o tom das instruções de saudação configuradas (se o agente tiver `support_config.greeting` preenchido)

- [ ] **Step 3: Verificar continuação da conversa**

Enviar uma segunda mensagem. A resposta NÃO deve:
- Repetir "Bom dia/Boa tarde/Boa noite"
- Repetir o nome do agente
- Usar saudações como "Olá" ou "Oi"

- [ ] **Step 4: Push para a branch de desenvolvimento**

```bash
git push -u origin claude/sismais-support-system-JCMCi
```
