# Spec: Saudação Inteligente com Calendário

**Data:** 2026-03-26
**Branch:** `claude/sismais-support-system-JCMCi`

---

## Objetivo

Enriquecer o sistema de saudação dos agentes IA para:
1. Usar o nome do contato quando disponível
2. Aplicar "Bom dia / Boa tarde / Boa noite" correto por horário de Brasília
3. Injetar instruções de personalidade configuradas pelo usuário (`support_config.greeting`)
4. Contextualizar feriados e datas especiais na saudação
5. Usar feriados na mensagem de escalação/fora-do-expediente

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-executor/index.ts` | Substituir bloco `[PRIMEIRA MENSAGEM]` por bloco enriquecido |
| `src/components/agents/form-tabs/AgentGreeting.tsx` | Atualizar UI com descrição e chips de exemplo |

Nenhuma mudança de schema no banco de dados.

---

## Design Detalhado

### 1. `agent-executor/index.ts` — Bloco de saudação enriquecida

#### Primeira mensagem (`isFirstMessage === true`)

Substituir o bloco atual por um único bloco consolidado que inclui:

```
[SAUDAÇÃO — PRIMEIRA MENSAGEM]
Saudação por horário: "<Bom dia|Boa tarde|Boa noite>" (hora atual: HH:MM, horário de Brasília)
Nome do cliente: <nome | "não disponível">
Instrução de personalidade: "<support_config.greeting | vazio>"
Data atual: <dayName>, <dia> de <mês> de <ano>
Feriado hoje: <nome do feriado | "nenhum">

INSTRUÇÕES OBRIGATÓRIAS:
- Use a saudação por horário correta (NUNCA "Bom dia" se for tarde/noite)
- Se o nome estiver disponível, cumprimente pelo PRIMEIRO nome
- Apresente-se como "<agentName>"
- Aplique o tom e estilo das instruções de personalidade acima
- Se hoje for feriado, mencione levemente de forma acolhedora (ex: "Feliz Páscoa!")
- Mantenha a saudação concisa: máximo 2 frases antes de perguntar como pode ajudar
```

#### Continuação de conversa (`isFirstMessage === false`)

Manter o bloco atual `[CONTINUAÇÃO DE CONVERSA]` sem alterações.

---

### 2. `agent-executor/index.ts` — Escalação fora do expediente com feriado

Quando `isBusinessHours` retornar `isOpen: false` com razão contendo "Feriado", enriquecer o bloco de fora-de-horário:

```
[FORA DO EXPEDIENTE — FERIADO: <nome do feriado>]
Hoje é feriado: <nome do feriado>.
O suporte retoma em: <getNextBusinessDay()>.
INSTRUÇÃO: Informe ao cliente com tom acolhedor e comemorativo.
Não prometa SLA normal para hoje. Oriente o cliente a retornar no próximo dia útil.
```

Quando `isOpen: false` por horário normal (sem feriado), manter comportamento atual.

**Implementação:** o `checkHoliday()` já é chamado dentro de `isBusinessHours()`. Para evitar dupla consulta ao banco, passar o resultado de `checkHoliday` para fora ou chamar `checkHoliday` separadamente antes de `isBusinessHours` e reutilizar o resultado.

---

### 3. `AgentGreeting.tsx` — UI atualizada

Substituir o componente simples atual por:

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label>Instruções de Saudação</Label>
    <Textarea
      placeholder="Ex: Use um tom descontraído e amigável. Pergunte como o cliente está antes de ir direto ao assunto..."
      value={data.greeting || ''}
      onChange={(e) => onChange({ greeting: e.target.value })}
      className="min-h-[120px]"
    />
    <p className="text-xs text-muted-foreground">
      Essas instruções guiam o tom e estilo da saudação gerada pela IA.
      A IA usará automaticamente o nome do contato, a saudação correta por horário
      e mencionará feriados quando aplicável.
    </p>
  </div>

  {/* Chips de exemplo */}
  <div className="space-y-1">
    <p className="text-xs font-medium text-muted-foreground">Exemplos de instrução:</p>
    <div className="flex flex-wrap gap-2">
      <Chip onClick={() => onChange({ greeting: 'Use tom descontraído e amigável, como se fosse um amigo prestativo.' })} />
      <Chip onClick={() => onChange({ greeting: 'Seja formal e profissional. Trate o cliente com "você" e mantenha linguagem técnica.' })} />
      <Chip onClick={() => onChange({ greeting: 'Tom acolhedor e empático. Pergunte como o cliente está antes de ir ao assunto.' })} />
    </div>
  </div>

  {/* Info de variáveis automáticas */}
  <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
    <p className="font-medium text-foreground">Injetado automaticamente pela IA:</p>
    <ul className="space-y-0.5 list-disc list-inside">
      <li>Nome do contato (quando disponível)</li>
      <li>Saudação por horário (Bom dia / Boa tarde / Boa noite)</li>
      <li>Feriados e datas especiais</li>
    </ul>
  </div>
</div>
```

---

## Fluxo de Dados

```
agent-executor recebe mensagem
  ↓
checkHoliday(supabase) → holidayInfo { isHoliday, name }
  ↓
isFirstMessage?
  → SIM → montar [SAUDAÇÃO — PRIMEIRA MENSAGEM] com:
             getGreetingByTime()
             linkedClient.name
             support_config.greeting
             formatBrazilDateTime()
             holidayInfo
  → NÃO → manter [CONTINUAÇÃO DE CONVERSA]
  ↓
isBusinessHours fora do expediente?
  → feriado → [FORA DO EXPEDIENTE — FERIADO] com getNextBusinessDay()
  → horário  → comportamento atual
```

---

## Critérios de Aceite

- [ ] Saudação usa "Bom dia/Boa tarde/Boa noite" correto pelo horário de Brasília
- [ ] Nome do cliente é usado quando disponível, omitido graciosamente quando não
- [ ] Instrução de `support_config.greeting` é injetada no prompt da primeira mensagem
- [ ] Feriado do dia é mencionado na saudação quando aplicável
- [ ] Escalação fora do expediente em feriado informa o nome do feriado e próximo dia útil
- [ ] Continuação de conversa não é afetada (sem saudação repetida)
- [ ] UI do `AgentGreeting.tsx` explica claramente o papel do campo
- [ ] Chips de exemplo funcionam e preenchem o textarea
