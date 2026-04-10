# Calendário de Feriados — Design Spec

**Data:** 2026-04-02
**Status:** Aprovado

---

## Objetivo

Implantar controle de calendário de feriados para que agentes IA informem sobre indisponibilidade do time humano em feriados, com importação de feriados nacionais (fixos e móveis), estaduais (Bahia), e CRUD para gestão manual.

## Contexto

O sistema já possui:
- Tabela `business_holidays` (name, date, scope, state_code, city_name, recurring, is_active)
- Função `checkHoliday()` em `_shared/brazil-timezone.ts`
- `isBusinessHours()` retorna `"Feriado: {nome}"` quando detecta feriado
- `getNextBusinessDay()` pula feriados e fins de semana
- Agent-executor injeta contexto de horário comercial no prompt

O que falta: dados na tabela, UI de gestão, instrução explícita nos prompts, e bloqueio de escalação em feriado.

---

## 1. Migration — Seed de Feriados

### 1.1 Feriados Nacionais Fixos (`recurring: true`, `scope: 'national'`)

| Data | Nome |
|------|------|
| 01-01 | Confraternização Universal |
| 04-21 | Tiradentes |
| 05-01 | Dia do Trabalho |
| 09-07 | Independência do Brasil |
| 10-12 | Nossa Senhora Aparecida |
| 11-02 | Finados |
| 11-15 | Proclamação da República |
| 11-20 | Dia da Consciência Negra |
| 12-25 | Natal |

### 1.2 Feriados Nacionais Móveis (`recurring: false`, `scope: 'national'`)

Pré-calculados para 2026-2030 (baseados na Páscoa):

| Ano | Carnaval (seg) | Carnaval (ter) | Sexta-feira Santa | Corpus Christi |
|-----|---------------|----------------|-------------------|----------------|
| 2026 | 2026-02-16 | 2026-02-17 | 2026-04-03 | 2026-06-04 |
| 2027 | 2027-02-08 | 2027-02-09 | 2027-03-26 | 2027-05-27 |
| 2028 | 2028-02-28 | 2028-02-29 | 2028-04-14 | 2028-06-15 |
| 2029 | 2029-02-12 | 2029-02-13 | 2029-03-30 | 2029-05-31 |
| 2030 | 2030-03-04 | 2030-03-05 | 2030-04-19 | 2030-06-20 |

### 1.3 Feriado Estadual da Bahia (`recurring: true`, `scope: 'state'`, `state_code: 'BA'`)

| Data | Nome |
|------|------|
| 07-02 | Independência da Bahia |

### 1.4 Regra

Migration é `INSERT ... ON CONFLICT DO NOTHING` para ser idempotente. Usa constraint `(name, date)` ou verifica existência antes de inserir.

---

## 2. UI — Aba "Feriados" em Settings

### 2.1 Localização

Nova aba `Feriados` na página `/settings` existente, ao lado das abas atuais.

### 2.2 Componentes

**Tabela principal:**
- Colunas: Nome, Data, Escopo (badge), Recorrente (ícone), Ativo (switch)
- Ordenação padrão: por data ASC
- Filtros: select de Ano (2026-2030) + select de Escopo (Todos, Nacional, Estadual, Municipal)
- Toggle de ativo inline (mutation direta)

**Botão "Novo Feriado":**
- Abre Dialog com campos:
  - Nome (text, obrigatório)
  - Data (date picker, obrigatório)
  - Escopo (select: Nacional, Estadual, Municipal)
  - Estado (select, visível se escopo = Estadual)
  - Cidade (text, visível se escopo = Municipal)
  - Recorrente (switch, default: false)
  - Ativo (switch, default: true)

**Ações por linha:**
- Editar (abre mesmo Dialog preenchido)
- Excluir (confirmação antes)

**Badges de escopo:**
- Nacional → `badge-navy`
- Estadual → `badge-info`
- Municipal → `badge-warning`

### 2.3 Queries

- `useQuery(['business_holidays', filters])` — lista com filtros
- `useMutation` para insert/update/delete com `invalidateQueries`

---

## 3. support_config — Campo holidayEscalation

### 3.1 Novo campo

Adicionar `holidayEscalation` dentro de `standardResponses` no `support_config` JSON dos agentes:

```json
{
  "standardResponses": {
    "holidayEscalation": "Hoje é feriado ({holidayName}), nosso time de atendimento retorna no próximo dia útil ({nextBusinessDay}). Enquanto isso, posso tentar ajudar! 😊",
    ...existing fields...
  }
}
```

### 3.2 Variáveis de template

- `{holidayName}` — nome do feriado (ex: "Natal")
- `{nextBusinessDay}` — próximo dia útil formatado (ex: "segunda-feira, 27/12/2026")

### 3.3 Fallback padrão

Se `holidayEscalation` não estiver configurado no agente:
> "Hoje é feriado ({holidayName}), nosso time de atendimento retorna no próximo dia útil ({nextBusinessDay}). Enquanto isso, posso tentar ajudar! 😊"

---

## 4. Agent-Executor — Injeção de Contexto de Feriado

### 4.1 System prompt

Quando `isBusinessHours()` retorna feriado, injetar no prompt:

```
[FERIADO HOJE]: {nome do feriado}
[PRÓXIMO DIA ÚTIL]: {data formatada}
[INSTRUÇÃO]: Hoje é feriado e não há agentes humanos disponíveis. Se o cliente solicitar atendimento humano, informe educadamente usando a mensagem de feriado configurada. NÃO marque [ESCALATE] — em vez disso, ofereça ajuda e informe que um atendente retornará no próximo dia útil.
```

### 4.2 Lógica no agent-executor

No ponto onde o agent-executor detecta `[ESCALATE]` na resposta do LLM:

```
SE é feriado:
  1. NÃO escalar para humano
  2. Substituir resposta por mensagem de holidayEscalation (com variáveis preenchidas)
  3. Criar ticket no Kanban (board padrão do agente ou board de follow-up)
     - Título: "Follow-up feriado: {resumo da conversa}"
     - Prioridade: média
     - Stage: primeira coluna (Aberto)
     - Metadata: conversation_id, holiday_name, customer_phone
  4. Registrar no ai_messages que escalação foi bloqueada por feriado
SENÃO:
  escalar normalmente
```

---

## 5. Criação de Ticket Kanban para Follow-up

### 5.1 Dados do ticket

| Campo | Valor |
|-------|-------|
| board_id | board padrão da conversa ou board geral de suporte |
| stage_id | primeira stage do board (Aberto/Novo) |
| title | `"[Feriado] Follow-up: {resumo}"` |
| priority | `media` |
| description | Resumo da conversa + motivo da escalação + nome do feriado |
| metadata | `{ conversation_id, holiday_name, next_business_day, customer_phone }` |

### 5.2 Vinculação

O ticket deve ser vinculado à conversa (`ai_conversations.id`) para que o agente humano tenha contexto ao retornar.

---

## 6. Escopo NÃO incluído

- Cálculo automático de Páscoa (feriados móveis são pré-calculados no seed)
- Feriados municipais pré-populados (apenas Bahia estadual; municipais via cadastro manual)
- Notificação push/email sobre tickets de feriado
- Horário especial de véspera de feriado

---

## 7. Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/XXXX_seed_holidays.sql` | Criar — seed de feriados |
| `src/pages/Settings.tsx` | Modificar — adicionar aba Feriados |
| `src/components/settings/HolidaysTab.tsx` | Criar — componente da aba |
| `src/components/settings/HolidayFormDialog.tsx` | Criar — dialog de cadastro/edição |
| `supabase/functions/agent-executor/index.ts` | Modificar — lógica de feriado na escalação |
| `supabase/functions/_shared/brazil-timezone.ts` | Verificar — confirmar que checkHoliday/getNextBusinessDay funcionam corretamente |
