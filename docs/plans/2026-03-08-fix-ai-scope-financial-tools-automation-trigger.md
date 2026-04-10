# Fix: IA Scope + Financial Tools + Automation Trigger

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 3 bugs críticos: (1) agentes IA respondendo fora do escopo definido, (2) agente financeiro KIRA iniciando cobrança sem verificar faturas existentes, e (3) automações não disparando ao fechar um ticket.

**Architecture:**
- Bug 3 (Automação): O trigger SQL `fn_trigger_flows_on_change` só observa `ticket_status_id`, mas o frontend atualiza apenas `status` (string). Fix: adicionar bloco no trigger SQL para detectar `status = 'finalizado'` e emitir evento `conversation_closed` — sem alterar frontend nem `trigger-flows`.
- Bug 2 (Financeiro): A tool built-in `customer_search` existe no agent-executor mas nunca é adicionada ao array enviado ao LLM para agentes `financial`. Fix: injetar automaticamente para agentes financeiros + adicionar instrução obrigatória no system prompt.
- Bug 1 (Escopo): O orchestrator tem bypass cego (retorna agente atual sem checar escopo) e o system_prompt não injeta o campo `restrictions` configurado na UI. Fix: fortalecer prompt do orchestrator + injetar `restrictions` no agent-executor.

**Tech Stack:** Deno TypeScript (Edge Functions), PostgreSQL/plpgsql (migration), React/TypeScript (frontend não alterado)

---

## Contexto: Arquivos Críticos

| Arquivo | Papel |
|---------|-------|
| `supabase/functions/orchestrator/index.ts` | Escolhe agente por mensagem — bypass e LLM routing |
| `supabase/functions/agent-executor/index.ts` | Executa o agente com RAG + tools + LLM |
| `supabase/functions/trigger-flows/index.ts` | Recebe eventos e executa flows (JÁ suporta `conversation_closed`, linha 135) |
| `supabase/migrations/20260222234447_5a309be9-...sql` | Trigger SQL que dispara trigger-flows (só observa `ticket_status_id`) |

---

## GRUPO A: Bug 3 — Automação não dispara ao fechar ticket

**Root cause confirmado:** O DB trigger `fn_trigger_flows_on_change` só verifica `ticket_status_id`, mas `ChatArea.tsx` atualiza apenas `status` (string 'finalizado'). `trigger-flows` já trata `conversation_closed` nativamente (linha 135, nenhum filtro necessário).

### Task A1: Migration — adicionar detecção de `status = 'finalizado'` no trigger SQL

**Files:**
- Create: `supabase/migrations/20260308120000_fix_conversation_closed_trigger.sql`

**Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/20260308120000_fix_conversation_closed_trigger.sql
-- Fix: Add conversation_closed trigger when status changes to 'finalizado'
-- Root cause: fn_trigger_flows_on_change only watched ticket_status_id,
-- but ChatArea.tsx only updates the 'status' (string) column.

CREATE OR REPLACE FUNCTION public.fn_trigger_flows_on_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://pomueweeulenslxvsxar.supabase.co'
  );
  _service_key text := current_setting('app.settings.service_role_key', true);
  _payload jsonb;
BEGIN
  -- Skip if service key is not available
  IF _service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detect ticket_status_id change (status via FK)
  IF OLD.ticket_status_id IS DISTINCT FROM NEW.ticket_status_id THEN
    _payload := jsonb_build_object(
      'trigger_type', 'status_changed',
      'conversation_id', NEW.id,
      'data', jsonb_build_object(
        'from_status', OLD.ticket_status_id,
        'to_status', NEW.ticket_status_id
      )
    );

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/trigger-flows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := _payload
    );
  END IF;

  -- [FIX BUG 3] Detect conversation closed via string status column
  -- ChatArea.tsx updates status='finalizado' but NOT ticket_status_id
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'finalizado' THEN
    _payload := jsonb_build_object(
      'trigger_type', 'conversation_closed',
      'conversation_id', NEW.id,
      'data', jsonb_build_object(
        'conversation_id', NEW.id,
        'status', NEW.status,
        'previous_status', OLD.status
      )
    );

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/trigger-flows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := _payload
    );
  END IF;

  -- Detect kanban stage change
  IF OLD.kanban_stage_id IS DISTINCT FROM NEW.kanban_stage_id THEN
    _payload := jsonb_build_object(
      'trigger_type', 'stage_changed',
      'conversation_id', NEW.id,
      'data', jsonb_build_object(
        'from_stage_id', OLD.kanban_stage_id,
        'to_stage_id', NEW.kanban_stage_id
      )
    );

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/trigger-flows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := _payload
    );
  END IF;

  RETURN NEW;
END;
$function$;
```

**Step 2: Verificar que o trigger está registrado na tabela**

O trigger `trg_flow_status_stage_change` já deve existir apontando para esta função. Verifique rodando no Supabase SQL Editor:
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'ai_conversations'
AND trigger_name = 'trg_flow_status_stage_change';
```

Expected: retornar 1 linha mostrando o trigger.

**Step 3: Aplicar a migration via Supabase MCP**

```
Usar: mcp__eb08fb98...__apply_migration
project_id: pomueweeulenslxvsxar
name: fix_conversation_closed_trigger
query: [conteúdo do arquivo acima]
```

**Step 4: Verificar que a função foi atualizada**

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'fn_trigger_flows_on_change';
```

Expected: ver o novo bloco `NEW.status = 'finalizado'` na função.

**Step 5: Teste manual**
1. No Supabase, criar uma automação com `trigger_type = 'conversation_closed'`
2. Fechar um ticket via UI (`/inbox` → fechar conversa)
3. Verificar logs da edge function `trigger-flows` no Supabase Dashboard → Functions → Logs
4. Expected: `✅ 1 fluxo(s) encontrado(s)` e `🚀 Disparando fluxo: ...`

**Step 6: Commit**

```bash
git add supabase/migrations/20260308120000_fix_conversation_closed_trigger.sql
git commit -m "fix: trigger conversation_closed automation on ticket close

O trigger fn_trigger_flows_on_change observava apenas ticket_status_id (FK),
mas ChatArea.tsx atualiza apenas status='finalizado' (string).
Adicionado bloco para detectar mudança em status para 'finalizado' e
emitir evento conversation_closed para trigger-flows."
```

---

## GRUPO B: Bug 2 — KIRA (Financeiro) cobrança indevida sem verificar faturas

**Root cause confirmado:** `agent.tools` de KIRA está vazio, então o LLM não conhece a tool `customer_search` (que existe como built-in no executor). Sem a tool disponível, KIRA não pode verificar faturas e responde com base apenas no texto.

### Task B1: Injetar `customer_search` automaticamente para agentes financeiros

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts` (após linha 262)

**Step 1: Localizar a seção de tools no agent-executor**

Encontre este bloco (linhas 251-262):
```typescript
    // 6. Preparar tools do agente (se configurados)
    let tools: Array<Record<string, unknown>> | undefined
    if (agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0) {
      tools = (agent.tools as Array<Record<string, unknown>>).map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.schema || t.parameters_schema || {}
        }
      }))
    }
```

**Step 2: Adicionar injeção automática da customer_search para specialty financial**

Após o bloco acima (após a chave `}`), adicionar:

```typescript
    // [FIX BUG 2] Para agentes financeiros, sempre injetar customer_search como tool disponível
    // Root cause: agent.tools estava vazio, LLM não sabia da tool e não podia verificar faturas
    if (agent.specialty === 'financial') {
      const customerSearchDef: Record<string, unknown> = {
        type: 'function',
        function: {
          name: 'customer_search',
          description: 'Busca dados financeiros do cliente: dívidas, faturas pendentes, contratos ativos e MRR. DEVE ser chamada antes de qualquer ação de cobrança.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Nome, CPF, CNPJ ou email do cliente'
              },
              conversation_id: {
                type: 'string',
                description: 'ID da conversa atual (opcional)'
              }
            },
            required: ['query']
          }
        }
      }
      if (!tools) tools = []
      // Evitar duplicata se já estiver configurada manualmente
      const alreadyHasCustomerSearch = tools.some(
        t => (t.function as Record<string, unknown>)?.name === 'customer_search'
      )
      if (!alreadyHasCustomerSearch) {
        tools.unshift(customerSearchDef) // Coloca primeiro para o LLM priorizar
      }
    }
```

**Step 3: Injetar instrução obrigatória no system prompt para agentes financeiros**

Localizar a linha 237 do agent-executor (após o bloco de `[AUTO-RESOLUÇÃO]`) e adicionar ANTES de `const llmMessages`:

```typescript
    // [FIX BUG 2] Para agentes financeiros, injetar instrução obrigatória de consulta prévia
    if (agent.specialty === 'financial') {
      systemPrompt += `\n\n[REGRA CRÍTICA FINANCEIRA — OBRIGATÓRIA]: ANTES de mencionar qualquer valor de dívida, iniciar cobrança, emitir segunda via ou negociar pagamento, você DEVE chamar a ferramenta "customer_search" passando o nome ou documento do cliente. Se o cliente ainda não informou o documento, pergunte antes de agir. NUNCA assuma que o cliente está inadimplente sem verificar.`
    }
```

**Step 4: Verificar posicionamento correto no arquivo**

O arquivo final deve ter esta ordem após linha 237:
```
[AUTO-RESOLUÇÃO] injection
↓
[FIX] financial specialty system prompt injection  ← NOVO
↓
const llmMessages = [...] (linha 239)
↓
[tools array build] (linha 251-262)
↓
[FIX] customer_search auto-inject for financial  ← NOVO
↓
// 7. Chamar LLM... (linha 264)
```

**Step 5: Deploy da edge function**

```
Usar: mcp__eb08fb98...__deploy_edge_function
project_id: pomueweeulenslxvsxar
name: agent-executor
entrypoint_path: index.ts
verify_jwt: true
files: [conteúdo atualizado de agent-executor/index.ts]
```

**Step 6: Teste**

No playground do agente KIRA (`/agents/playground/<id_kira>`):
1. Enviar: "Olá, meu nome é João Silva, tenho uma pendência financeira"
2. Expected: KIRA chama `customer_search` com query="João Silva" ANTES de responder
3. Verificar logs no Supabase → Functions → agent-executor: `[agent-executor] Executing built-in tool: customer_search`
4. Se customer não encontrado: KIRA deve pedir mais dados (CPF/CNPJ), NÃO iniciar cobrança

**Step 7: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "fix: inject customer_search tool for financial agents (KIRA)

Root cause: agent.tools estava vazio para KIRA, LLM não conhecia a tool
customer_search e iniciava cobranças sem verificar faturas existentes.

- Auto-inject customer_search na lista de tools para specialty=financial
- Adicionar instrução obrigatória no system prompt: verificar cliente
  antes de qualquer ação financeira
- Garante que KIRA sempre consulta dados antes de cobrar"
```

---

## GRUPO C: Bug 1 — Agentes IA respondendo fora do escopo

**Root cause confirmado (4 pontos):**
1. Bypass cego no orchestrator (linha 112): retorna agente atual sem verificar se nova mensagem está no escopo
2. Regra vaga no LLM prompt (linha 144): "escolha melhor match" sem instrução de rejeição por escopo
3. `currentAgentInfo` (linha 134) instrui LLM a "preferir manter o mesmo agente" — reforça bypass
4. Campo `restrictions` configurado na UI (`support_config.restrictions`) não é injetado no system_prompt

### Task C1: Fortalecer regras de escopo no Orchestrator

**Files:**
- Modify: `supabase/functions/orchestrator/index.ts` (linhas 133-149)

**Step 1: Localizar o bloco do system prompt do orchestrator**

Encontre este bloco (linhas 133-149):
```typescript
    const currentAgentInfo = conversation?.current_agent_id
      ? `\nAgente atual da conversa: ${conversation.current_agent_id} (prefira manter o mesmo agente se a mensagem for relevante para ele)`
      : ''

    const systemPrompt = `Você é um orquestrador de atendimento. Analise a mensagem do cliente e escolha o agente mais adequado.

Agentes disponíveis:
${agentsList}
${currentAgentInfo}

Regras:
1. Escolha o agente cuja descrição e especialidade melhor se encaixam na mensagem
2. Se o cliente já está sendo atendido por um agente e a mensagem continua no mesmo tema, mantenha o mesmo agente
3. Se nenhum agente for adequado, retorne agent_id como null
4. Se o cliente expressou raiva extrema, pediu para falar com humano ou demonstrou insatisfação severa, retorne agent_id null para escalação imediata

Responda APENAS com JSON válido, sem markdown: {"agent_id": "id_do_agente", "reason": "motivo da escolha"}`
```

**Step 2: Substituir por versão com scope enforcement**

```typescript
    // [FIX BUG 1] currentAgentInfo agora inclui specialty para permitir validação de escopo
    const currentAgentData = agents.find(a => a.id === conversation?.current_agent_id)
    const currentAgentInfo = currentAgentData
      ? `\nAgente atual: ${currentAgentData.name} (especialidade: ${currentAgentData.specialty || 'geral'})`
      : ''

    const systemPrompt = `Você é um orquestrador de atendimento. Analise a mensagem do cliente e escolha o agente mais adequado.

Agentes disponíveis:
${agentsList}
${currentAgentInfo}

Regras OBRIGATÓRIAS (siga exatamente):
1. Escolha o agente cuja especialidade REALMENTE cobre o tema da mensagem
2. Se o cliente já está com um agente E a mensagem é sobre o MESMO tema da especialidade daquele agente, mantenha-o
3. Se o cliente já está com um agente MAS a mensagem é sobre tema de OUTRA especialidade, MUDE para o agente correto (não mantenha só por continuidade)
4. Se nenhum agente cobre o tema adequadamente, retorne agent_id null
5. Se o cliente pediu para falar com humano, expressou raiva severa ou ameaçou cancelamento, retorne agent_id null imediatamente
6. NUNCA escolha um agente de triagem (triage) para responder perguntas técnicas, financeiras ou comerciais — triagem apenas direciona

Responda APENAS com JSON válido, sem markdown: {"agent_id": "id_do_agente_ou_null", "reason": "motivo_da_escolha"}`
```

**Step 3: Verificar o bypass na linha 112 — adicionar verificação de mudança de especialidade**

Localizar o bloco (linhas 104-126):
```typescript
    const needsRerouting =
      intent === 'want_human' ||
      intent === 'escalation' ||
      intent === 'transfer_request' ||
      (sentiment === 'negative' && urgency === 'critical') ||
      (sentiment === 'negative' && urgency === 'high')

    if (currentAgentId && isAiHandled && !needsRerouting) {
```

Substituir `needsRerouting` definition para:
```typescript
    // [FIX BUG 1] Adicionar topic_change como sinal de reroteamento
    // intent='topic_change' pode ser emitido pelo message-analyzer quando tema muda
    const needsRerouting =
      intent === 'want_human' ||
      intent === 'escalation' ||
      intent === 'transfer_request' ||
      intent === 'topic_change' ||
      (sentiment === 'negative' && urgency === 'critical') ||
      (sentiment === 'negative' && urgency === 'high')

    if (currentAgentId && isAiHandled && !needsRerouting) {
```

**Step 4: Deploy do orchestrator**

```
Usar: mcp__eb08fb98...__deploy_edge_function
project_id: pomueweeulenslxvsxar
name: orchestrator
```

### Task C2: Injetar campo `restrictions` no system prompt do agent-executor

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts` (após linha 234)

**Step 1: Localizar o bloco de injeção de `standardResponses` (linhas 223-234)**

```typescript
    // Injetar respostas padrão do support_config
    if (supportConfig.standardResponses) {
      // ... (código existente)
      if (srLines.length > 0) {
        systemPrompt += `\n\n[RESPOSTAS PADRÃO — use exatamente estas frases quando aplicável]:\n${srLines.join('\n')}`
      }
    }

    // Instrução de auto-resolução
    systemPrompt += `\n\n[AUTO-RESOLUÇÃO]: ...`
```

**Step 2: Adicionar injeção de `restrictions` ANTES da instrução de auto-resolução**

Após o bloco `standardResponses` e ANTES de `[AUTO-RESOLUÇÃO]`:

```typescript
    // [FIX BUG 1] Injetar restrições configuradas na UI
    // support_config.restrictions é configurado em AgentPersonality.tsx mas nunca era injetado
    if (supportConfig.restrictions && String(supportConfig.restrictions).trim()) {
      systemPrompt += `\n\n[RESTRIÇÕES E LIMITES DE ATUAÇÃO — OBRIGATÓRIO RESPEITAR]: ${String(supportConfig.restrictions).trim()}`
    }
```

**Step 3: Deploy do agent-executor (junto com a mudança do Task B1)**

As mudanças do Bug 1 e Bug 2 no `agent-executor/index.ts` devem ser feitas no mesmo arquivo antes do deploy.

**Step 4: Teste de escopo**

1. No playground do agente TRIAGE, enviar uma pergunta financeira: "Qual é minha dívida?"
2. Expected: TRIAGE deve responder "Esse assunto é com nosso time financeiro, vou te transferir" (direcionar), NÃO deve responder com valores
3. No playground de um agente com `restrictions` configuradas via UI, verificar que as restrições aparecem no comportamento

**Step 5: Commit final do agent-executor**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "fix: inject support_config.restrictions into agent system prompt

Root cause: campo restrictions configurado na UI (AgentPersonality.tsx)
nunca era injetado no system_prompt enviado ao LLM.

- Adicionar injeção de supportConfig.restrictions no system prompt
- Agentes agora respeitam os limites configurados pelo operador"
```

**Step 6: Commit do orchestrator**

```bash
git add supabase/functions/orchestrator/index.ts
git commit -m "fix: strengthen orchestrator scope rules to prevent out-of-scope responses

Root cause:
1. currentAgentInfo incentivava manter agente por continuidade sem validar escopo
2. Regra do LLM era vaga ('escolha melhor match') sem instrução de rejeição
3. intent='topic_change' não era sinal de reroteamento

- Regras explícitas: mude de agente quando tema muda de especialidade
- Triage nunca deve responder sobre finanças/técnico/comercial
- Adicionar topic_change como sinal de reroteamento"
```

---

## GRUPO D: Deploy Final e Verificação

### Task D1: Verificação end-to-end de todos os 3 bugs

**Step 1: Verificar Bug 3 (Automação)**
1. Criar automação de teste: trigger=`conversation_closed`, action=enviar mensagem interna "Ticket fechado automaticamente"
2. Fechar um ticket no Inbox
3. Verificar: a mensagem interna foi criada na conversa
4. Supabase Logs → trigger-flows: verificar `🚀 Disparando fluxo`

**Step 2: Verificar Bug 2 (KIRA Financeiro)**
1. Acessar playground da KIRA
2. Digitar: "Preciso regularizar minha situação, sou a empresa ABC Ltda"
3. Verificar logs: `[agent-executor] Executing built-in tool: customer_search`
4. KIRA deve responder com dados reais do cliente OU pedir CPF/CNPJ caso não encontre
5. KIRA NÃO deve iniciar cobrança sem confirmar existência de dívida

**Step 3: Verificar Bug 1 (Escopo)**
1. Playground do agente TRIAGE → perguntar sobre finanças → deve direcionar, não responder
2. Playground de agente com `restrictions` preenchido → verificar que restrições são respeitadas
3. Simular mudança de tema no meio de uma conversa: verificar roteamento para agente correto

### Task D2: Salvar memória de projeto

**Step 1: Criar/atualizar arquivo de memória**

Criar `C:\Users\Marcio\.claude\projects\G--Meu-Drive-0000---Cloude-Code---Programacao-sismais-assist-chat\memory\MEMORY.md` com:

```markdown
# Sismais Assist Chat — Memória de Projeto

## Bugs Corrigidos (2026-03-08)

### Bug: Automação não dispara ao fechar ticket
- Root cause: `fn_trigger_flows_on_change` só observava `ticket_status_id`, ChatArea.tsx só atualiza `status` (string)
- Fix: Migration `20260308120000_fix_conversation_closed_trigger.sql` — novo bloco para status='finalizado'
- `trigger-flows/index.ts` JÁ suporta `conversation_closed` (linha 135, sem filtros adicionais)

### Bug: KIRA (financial) cobrança indevida
- Root cause: `agent.tools` vazio, LLM não conhecia `customer_search` built-in
- Fix: `agent-executor/index.ts` — auto-inject customer_search para specialty=financial
- `customer_search` é built-in (linha 328), usa `executeCustomerSearch` (linha 661+)

### Bug: IA respondendo fora do escopo
- Root cause: bypass cego no orchestrator + `restrictions` UI não injetado no system_prompt
- Fix: orchestrator — regras explícitas de escopo; agent-executor — injetar `supportConfig.restrictions`

## Padrões Importantes
- `support_config` (JSONB em ai_agents): contém escalationTriggers, standardResponses, restrictions, etc.
- agent-executor injeta campos de support_config no system_prompt (exceto `restrictions` — corrigido)
- Trigger SQL `trg_flow_status_stage_change` → `fn_trigger_flows_on_change` → trigger-flows edge function
- `conversation_closed` trigger: não precisa de filtros em trigger-flows (linha 135)
```

---

## Ordem de Execução Recomendada

```
1. Task A1 (Migration Bug 3) — independente, sem risco de regressão
2. Task B1 (agent-executor Bug 2) + Task C2 (agent-executor Bug 1) — mesmo arquivo, fazer junto
3. Task C1 (orchestrator Bug 1) — deploy separado
4. Task D1 (verificação end-to-end)
5. Task D2 (memória)
```

**Estimativa:** 3 arquivos modificados + 1 migration criada + 2 edge function deploys.
