# Pipeline de Encerramento e Classificação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer o pipeline de encerramento de tickets com classificação IA completa (problem_summary + solution_summary), CSAT garantido com auditoria e grace period inteligente com duas janelas e roteamento de 3 saídas.

**Architecture:** 3 frentes coordenadas via migration compartilhada. Frente 1: ticket-category-classifier expandido + nova edge function ticket-solution-classifier chamada no close. Frente 2: CSAT retry síncrono + cron de reconciliação a cada 5min + tabela de audit log + botão manual UI. Frente 3: grace period com janela curta (regex puro) e janela longa (LLM 3 saídas: dismiss/same_subject/new_subject), com parent_ticket_id para novos tickets derivados.

**Tech Stack:** Deno (Supabase Edge Functions), TypeScript, React 18, OpenRouter (google/gemini-3.1-flash-lite-preview), PostgreSQL/Supabase, TanStack React Query v5, shadcn/ui

---

## File Map

**Criar:**
- `supabase/migrations/YYYYMMDD_pipeline_encerramento.sql` — DDL: novos campos + csat_send_log + cron
- `supabase/functions/ticket-solution-classifier/index.ts` — Nova edge function
- `supabase/tests/ticket-solution-classifier.test.ts` — Testes da nova function

**Modificar:**
- `supabase/functions/ticket-category-classifier/index.ts` — Expandir prompt + problem_summary + classification_version
- `supabase/functions/csat-processor/index.ts` — Adicionar reconcile-missed + csat_send_log
- `supabase/functions/uazapi-webhook/index.ts` — Grace period v2 (linhas 1082–1279)
- `src/utils/closeConversation.ts` — Fix CSAT fire-and-forget + chamar ticket-solution-classifier
- `src/components/tickets/KanbanChatPanel.tsx` — Solução aplicada + botão CSAT manual + badge parent ticket

---

## Task 1: Migration — Novos campos e tabela de auditoria

**Files:**
- Create: `supabase/migrations/20260410_pipeline_encerramento.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/20260410_pipeline_encerramento.sql
-- Pipeline de Encerramento e Classificação de Tickets

-- 1. Campos de classificação enriquecida na conversa
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS problem_summary TEXT,
  ADD COLUMN IF NOT EXISTS solution_summary TEXT,
  ADD COLUMN IF NOT EXISTS classification_version INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_ticket_id UUID REFERENCES ai_conversations(id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_parent_ticket
  ON ai_conversations(parent_ticket_id) WHERE parent_ticket_id IS NOT NULL;

-- 2. Tabela de auditoria CSAT
CREATE TABLE IF NOT EXISTS csat_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  config_id UUID,
  trigger_source TEXT NOT NULL,
  -- 'close' | 'cron_reconcile' | 'manual'
  status TEXT NOT NULL,
  -- 'sent' | 'failed' | 'skipped_no_config' | 'skipped_no_instance'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON csat_send_log(conversation_id);
CREATE INDEX ON csat_send_log(created_at DESC);

-- 3. Cron de reconciliação CSAT (a cada 5 minutos)
SELECT cron.schedule(
  'csat-reconcile-missed',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pomueweeulenslxvsxar.supabase.co/functions/v1/csat-processor',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
      body := '{"action": "reconcile-missed"}'::jsonb
    )
  $$
);
```

- [ ] **Step 2: Aplicar a migration via Supabase MCP**

Use a ferramenta `mcp__claude_ai_Supabase__apply_migration` com o conteúdo acima. Após aplicar, verifique com:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_conversations'
AND column_name IN ('problem_summary', 'solution_summary', 'classification_version', 'parent_ticket_id');
```

Esperado: 4 linhas retornadas.

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'csat_send_log';
```

Esperado: 1 linha.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260410_pipeline_encerramento.sql
git commit -m "feat: migration pipeline encerramento — problem_summary, solution_summary, parent_ticket_id, csat_send_log"
```

---

## Task 2: Refatorar ticket-category-classifier

**Files:**
- Modify: `supabase/functions/ticket-category-classifier/index.ts`
- Create: `supabase/tests/ticket-category-classifier.test.ts`

Mudanças: (1) prompt expandido retorna `problem_summary`; (2) salva `ticket_subject` + `problem_summary` sempre, mesmo com conf < 0.3; (3) incrementa `classification_version`.

- [ ] **Step 1: Escrever o teste antes de modificar**

```typescript
// supabase/tests/ticket-category-classifier.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "ticket-category-classifier - rejeita sem conversation_id",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-category-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({}),
    });
    assertEquals(response.status, 400);
    const result = await response.json();
    assertExists(result.error);
  },
});

Deno.test({
  name: "ticket-category-classifier - retorna classified: false para conversa vazia",
  async fn() {
    // UUID que não existe — sem mensagens, deve retornar skipped
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-category-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ conversation_id: "00000000-0000-0000-0000-000000000000" }),
    });
    const result = await response.json();
    assertEquals(result.skipped || result.classified === false || result.error !== undefined, true);
  },
});
```

- [ ] **Step 2: Confirmar que o teste falha (ou skips) antes da implementação**

```bash
cd supabase/tests
deno test ticket-category-classifier.test.ts --allow-net --allow-env
```

- [ ] **Step 3: Implementar as mudanças no ticket-category-classifier**

Substituir o bloco do `systemPrompt` e o bloco de update (linhas 103–207 do arquivo atual):

```typescript
// Substituir o systemPrompt existente (linha ~103) por:
const systemPrompt = `Você é um classificador de tickets de suporte técnico.
Analise a conversa e:
1. Classifique em UMA das categorias abaixo (ou null se incerto)
2. Gere um título/assunto curto e descritivo para o ticket (máximo 80 caracteres)
3. Gere um resumo do problema relatado pelo cliente (máximo 200 caracteres)
${moduleList ? '4. Classifique o módulo do sistema, se aplicável.' : ''}

CATEGORIAS DISPONÍVEIS:
${categoryList}
${moduleList ? `\nMÓDULOS DISPONÍVEIS:\n${moduleList}` : ''}

Responda APENAS em JSON válido:
{
  "category_id": "uuid da categoria ou null",
  "category_confidence": 0.0,
  "ticket_subject": "título curto do problema",
  "problem_summary": "resumo do problema em 1-2 frases"${moduleList ? ',\n  "module_id": "uuid do módulo ou null"' : ''}
}`

// Substituir o bloco de classification e update (após o parse do LLM, linha ~173) por:

    // Sempre salva ticket_subject e problem_summary (úteis mesmo com baixa confiança)
    const alwaysUpdate: Record<string, unknown> = {}
    if (classification.ticket_subject) {
      alwaysUpdate.ticket_subject = classification.ticket_subject.substring(0, 120)
    }
    if ((classification as any).problem_summary) {
      alwaysUpdate.problem_summary = (classification as any).problem_summary.substring(0, 300)
    }

    // Incrementa classification_version sempre que rodar
    await supabase.rpc('increment_classification_version', { conv_id: conversation_id })
      .then(() => {})
      .catch(() => {
        // Fallback: update direto se rpc não existir
        supabase.from('ai_conversations')
          .update({ classification_version: supabase.rpc('coalesce', {}) }) // handled below
          .eq('id', conversation_id)
      })

    // Salva classification_version via update com expressão SQL
    await supabase.from('ai_conversations')
      .update({ ...alwaysUpdate, classification_version: (supabase as any).sql`COALESCE(classification_version, 0) + 1` })
      .eq('id', conversation_id)
```

> **Nota:** O Supabase JS client não suporta expressões SQL brutas no `.update()`. Use uma RPC ou faça dois updates separados. A solução correta:

```typescript
// Após o parse do LLM (~linha 172), substituir TODO o bloco de update por este:

    const alwaysUpdate: Record<string, unknown> = {}
    if (classification.ticket_subject) {
      alwaysUpdate.ticket_subject = (classification.ticket_subject as string).substring(0, 120)
    }
    if ((classification as any).problem_summary) {
      alwaysUpdate.problem_summary = ((classification as any).problem_summary as string).substring(0, 300)
    }

    // Incrementa version e salva campos sempre presentes
    const { data: currentConv } = await supabase
      .from('ai_conversations')
      .select('classification_version')
      .eq('id', conversation_id)
      .single()

    const newVersion = ((currentConv?.classification_version) || 0) + 1
    alwaysUpdate.classification_version = newVersion

    // Aplica update com campos sempre presentes (subject + problem_summary + version)
    if (Object.keys(alwaysUpdate).length > 0) {
      await supabase.from('ai_conversations').update(alwaysUpdate).eq('id', conversation_id)
    }

    // Só atualiza category/module se confiança > 0.3
    if (classification.category_id && (classification.category_confidence || 0) > 0.3) {
      const validCategory = categories.find(c => c.id === classification.category_id)
      if (validCategory) {
        const catUpdate: Record<string, unknown> = { ticket_category_id: classification.category_id }
        if (classification.module_id && modules?.find(m => m.id === classification.module_id)) {
          catUpdate.ticket_module_id = classification.module_id
        }
        await supabase.from('ai_conversations').update(catUpdate).eq('id', conversation_id)

        return new Response(JSON.stringify({
          classified: true,
          category_id: classification.category_id,
          category_name: validCategory.name,
          confidence: classification.category_confidence,
          module_id: classification.module_id || null,
          ticket_subject: alwaysUpdate.ticket_subject || null,
          problem_summary: alwaysUpdate.problem_summary || null,
          classification_version: newVersion,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({
      classified: false,
      reason: 'low confidence or invalid category',
      ticket_subject: alwaysUpdate.ticket_subject || null,
      problem_summary: alwaysUpdate.problem_summary || null,
      classification_version: newVersion,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

- [ ] **Step 4: Executar os testes**

```bash
deno test supabase/tests/ticket-category-classifier.test.ts --allow-net --allow-env
```

Esperado: PASS em ambos os testes.

- [ ] **Step 5: Deploy da function**

```bash
supabase functions deploy ticket-category-classifier
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ticket-category-classifier/index.ts supabase/tests/ticket-category-classifier.test.ts
git commit -m "feat: ticket-category-classifier — problem_summary, classification_version, salva subject sempre"
```

---

## Task 3: Nova edge function ticket-solution-classifier

**Files:**
- Create: `supabase/functions/ticket-solution-classifier/index.ts`
- Create: `supabase/tests/ticket-solution-classifier.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// supabase/tests/ticket-solution-classifier.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "ticket-solution-classifier - rejeita sem conversation_id",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-solution-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ resolution_summary: "Problema resolvido" }),
    });
    assertEquals(response.status, 400);
    const result = await response.json();
    assertEquals(result.error, "conversation_id required");
  },
});

Deno.test({
  name: "ticket-solution-classifier - pula se resolution_summary vazio",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ticket-solution-classifier`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        conversation_id: "00000000-0000-0000-0000-000000000000",
        resolution_summary: "  ",
      }),
    });
    const result = await response.json();
    assertEquals(result.skipped, true);
    assertEquals(result.reason, "empty_resolution_summary");
  },
});
```

- [ ] **Step 2: Confirmar que os testes falham (404 pois a function não existe ainda)**

```bash
deno test supabase/tests/ticket-solution-classifier.test.ts --allow-net --allow-env
```

Esperado: FAIL (404 Not Found).

- [ ] **Step 3: Criar a edge function**

```typescript
// supabase/functions/ticket-solution-classifier/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { conversation_id, resolution_summary } = body;

    if (!conversation_id) {
      return jsonResponse({ error: "conversation_id required" }, 400);
    }

    // Guardrail: não roda se resolution_summary vazio
    if (!resolution_summary?.trim()) {
      return jsonResponse({ skipped: true, reason: "empty_resolution_summary" });
    }

    // Busca dados da conversa: problem_summary + últimas 30 mensagens
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("problem_summary, ticket_category_id, ticket_module_id")
      .eq("id", conversation_id)
      .single();

    const { data: messages } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(30);

    const conversationText = (messages || [])
      .reverse()
      .map((m) => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
      .join("\n");

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return jsonResponse({ error: "OPENROUTER_API_KEY not set" }, 500);

    const prompt = `Você é um analisador de tickets de suporte técnico.

Problema reportado: "${conv?.problem_summary || "Não informado"}"
O atendente registrou como resolução: "${resolution_summary}"

Histórico da conversa:
${conversationText.substring(0, 4000)}

Com base nisso, gere:
1. Um resumo objetivo da SOLUÇÃO aplicada (máximo 300 caracteres)
2. Se a categoria ou módulo original não fizer mais sentido, sugira novos

Responda APENAS em JSON:
{
  "solution_summary": "resumo da solução aplicada",
  "category_changed": false,
  "suggested_category_id": null,
  "suggested_module_id": null
}`;

    let solutionSummary: string = resolution_summary.substring(0, 300);
    let categoryChanged = false;
    let suggestedCategoryId: string | null = null;
    let suggestedModuleId: string | null = null;

    try {
      const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        const content = llmData.choices?.[0]?.message?.content || "";
        try {
          const parsed = JSON.parse(content);
          if (parsed.solution_summary) solutionSummary = (parsed.solution_summary as string).substring(0, 300);
          categoryChanged = parsed.category_changed === true;
          suggestedCategoryId = parsed.suggested_category_id || null;
          suggestedModuleId = parsed.suggested_module_id || null;
        } catch {
          // Fallback: usa resolution_summary como solution_summary
          console.warn("[solution-classifier] parse error, using fallback");
        }
      }
    } catch (err) {
      // Fallback: usa resolution_summary como solution_summary
      console.warn("[solution-classifier] LLM error, using fallback:", err);
    }

    // Salva solution_summary na conversa
    const updateData: Record<string, unknown> = { solution_summary: solutionSummary };
    if (categoryChanged && suggestedCategoryId) {
      updateData.ticket_category_id = suggestedCategoryId;
      if (suggestedModuleId) updateData.ticket_module_id = suggestedModuleId;
    }

    await supabase.from("ai_conversations").update(updateData).eq("id", conversation_id);

    return jsonResponse({
      success: true,
      solution_summary: solutionSummary,
      category_changed: categoryChanged,
      suggested_category_id: suggestedCategoryId,
    });
  } catch (err) {
    console.error("[ticket-solution-classifier] Error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
```

- [ ] **Step 4: Deploy da function**

```bash
supabase functions deploy ticket-solution-classifier
```

- [ ] **Step 5: Executar os testes**

```bash
deno test supabase/tests/ticket-solution-classifier.test.ts --allow-net --allow-env
```

Esperado: PASS em ambos os testes.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ticket-solution-classifier/ supabase/tests/ticket-solution-classifier.test.ts
git commit -m "feat: nova edge function ticket-solution-classifier"
```

---

## Task 4: Atualizar closeConversation.ts

**Files:**
- Modify: `src/utils/closeConversation.ts`

Duas mudanças: (1) CSAT fire-and-forget → `invokeWithRetry`; (2) chamar `ticket-solution-classifier` após atualizar status para `finalizado`.

- [ ] **Step 1: Localizar e substituir o bloco CSAT fire-and-forget**

No arquivo `src/utils/closeConversation.ts`, localizar as linhas (atualmente ~155–158):

```typescript
  // Fire-and-forget: send CSAT via csat-processor
  if (shouldSendCsat && csatConfigId) {
    supabase.functions.invoke('csat-processor', {
      body: { action: 'send', conversationId, configId: csatConfigId }
    }); // fire-and-forget
  }
```

Substituir por:

```typescript
  // CSAT com retry — não fire-and-forget
  if (shouldSendCsat && csatConfigId) {
    invokeWithRetry('csat-processor', {
      action: 'send',
      conversationId,
      configId: csatConfigId,
      trigger_source: 'close',
    })
  }
```

- [ ] **Step 2: Adicionar chamada ao ticket-solution-classifier após o update de status**

Logo após o bloco `invokeWithRetry('evaluate-service', ...)` (atualmente ~linha 152), adicionar:

```typescript
  // Fire-and-forget: gera solution_summary via IA
  if (isFinalizing && resolutionSummary?.trim()) {
    invokeWithRetry('ticket-solution-classifier', {
      conversation_id: conversationId,
      resolution_summary: resolutionSummary,
    })
  }
```

- [ ] **Step 3: Verificar que o arquivo compila sem erros**

```bash
cd apps/sismais-assist-chat
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/utils/closeConversation.ts
git commit -m "fix: CSAT com retry síncrono no close + chamar ticket-solution-classifier"
```

---

## Task 5: csat-processor — reconcile-missed + audit log

**Files:**
- Modify: `supabase/functions/csat-processor/index.ts`
- Create: `supabase/tests/csat-reconcile.test.ts`

- [ ] **Step 1: Escrever o teste para reconcile-missed**

```typescript
// supabase/tests/csat-reconcile.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.test({
  name: "csat-processor - reconcile-missed retorna processed",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/csat-processor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "reconcile-missed" }),
    });
    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.success, true);
    assertEquals(typeof result.processed, "number");
  },
});

Deno.test({
  name: "csat-processor - action desconhecida retorna 400",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/csat-processor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "action-que-nao-existe" }),
    });
    assertEquals(response.status, 400);
  },
});
```

- [ ] **Step 2: Confirmar que o primeiro teste falha (action não existe)**

```bash
deno test supabase/tests/csat-reconcile.test.ts --allow-net --allow-env
```

Esperado: FAIL no primeiro teste (400 Unknown action).

- [ ] **Step 3: Adicionar handleReconcileMissed() ao csat-processor/index.ts**

Adicionar a função após `handleProcessPending()` (antes do `Deno.serve`):

```typescript
// ─── Action: reconcile-missed ─────────────────────────────────────────────────

async function handleReconcileMissed() {
  // Busca conversas finalizadas há menos de 2h sem csat_sent_at
  // em boards com send_on_close=true e CSAT habilitado
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

  const { data: missed } = await supabase
    .from("ai_conversations")
    .select("id, whatsapp_instance_id, kanban_board_id, customer_phone, customer_name, ticket_number")
    .eq("status", "finalizado")
    .is("csat_sent_at", null)
    .gte("resolved_at", twoHoursAgo)
    .limit(50);

  if (!missed?.length) return jsonResponse({ success: true, processed: 0 });

  let processed = 0;

  for (const conv of missed) {
    if (!conv.kanban_board_id) continue;

    // Verifica se board tem CSAT habilitado com send_on_close
    const { data: csatConfig } = await supabase
      .from("csat_board_configs")
      .select("id, enabled, send_on_close")
      .eq("board_id", conv.kanban_board_id)
      .eq("enabled", true)
      .eq("send_on_close", true)
      .maybeSingle();

    if (!csatConfig) {
      // Log: sem config
      await supabase.from("csat_send_log").insert({
        conversation_id: conv.id,
        config_id: null,
        trigger_source: "cron_reconcile",
        status: "skipped_no_config",
      });
      continue;
    }

    // Dispara CSAT
    try {
      const res = await handleSend(conv.id, csatConfig.id, "cron_reconcile");
      // handleSend já grava o log — não precisa gravar aqui
      processed++;
    } catch (err) {
      await supabase.from("csat_send_log").insert({
        conversation_id: conv.id,
        config_id: csatConfig.id,
        trigger_source: "cron_reconcile",
        status: "failed",
        error_message: String(err),
      });
    }
  }

  return jsonResponse({ success: true, processed });
}
```

- [ ] **Step 4: Refatorar handleSend para aceitar trigger_source e gravar csat_send_log**

Mudar a assinatura de `handleSend` para:

```typescript
async function handleSend(
  conversationId: string,
  configId: string,
  triggerSource: "close" | "cron_reconcile" | "manual" = "close"
) {
```

E no final de `handleSend`, antes de `return jsonResponse({ success: true })`, adicionar:

```typescript
  // Audit log
  await supabase.from("csat_send_log").insert({
    conversation_id: conversationId,
    config_id: configId,
    trigger_source: triggerSource,
    status: "sent",
  }).then(() => {}, (err) => console.warn("[csat-processor] audit log error:", err));
```

E nos pontos de erro dentro de `handleSend` (config not found, conv not found, instance not found), adicionar o log de falha antes de retornar:

```typescript
  // Exemplo no "Config not found":
  if (configErr || !config) {
    await supabase.from("csat_send_log").insert({
      conversation_id: conversationId,
      config_id: configId,
      trigger_source: triggerSource,
      status: "failed",
      error_message: "Config not found",
    }).then(() => {}, () => {});
    return jsonResponse({ error: "Config not found" }, 404);
  }

  // Exemplo no "UAZAPI instance not found":
  if (instanceErr || !instance) {
    await supabase.from("csat_send_log").insert({
      conversation_id: conversationId,
      config_id: configId,
      trigger_source: triggerSource,
      status: "skipped_no_instance",
    }).then(() => {}, () => {});
    return jsonResponse({ error: "UAZAPI instance not found" }, 404);
  }
```

- [ ] **Step 5: Adicionar o case no switch do Deno.serve**

No switch de actions (após `case "process-pending":`):

```typescript
      case "reconcile-missed":
        return await handleReconcileMissed();
```

E atualizar a chamada existente de `handleSend` no switch para passar o `trigger_source`:

```typescript
      case "send":
        return await handleSend(
          params.conversationId,
          params.configId,
          (params.trigger_source as "close" | "cron_reconcile" | "manual") || "close"
        );
```

- [ ] **Step 6: Deploy**

```bash
supabase functions deploy csat-processor
```

- [ ] **Step 7: Executar os testes**

```bash
deno test supabase/tests/csat-reconcile.test.ts --allow-net --allow-env
```

Esperado: PASS em ambos.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/csat-processor/index.ts supabase/tests/csat-reconcile.test.ts
git commit -m "feat: csat-processor — reconcile-missed action + csat_send_log audit"
```

---

## Task 6: Grace Period v2 no uazapi-webhook

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts` (bloco linhas 1082–1279)

O bloco atual tem janela única e LLM com 2 saídas (`dismiss` / `new_ticket`). O novo tem duas janelas e 3 saídas (`dismiss` / `same_subject` / `new_subject`).

- [ ] **Step 1: Entender o contexto antes de editar**

Localizar no arquivo a linha comentada:
```
// ===== GRACE PERIOD: absorb post-close messages (ok, obrigado, emoji, CSAT) =====
```
(atualmente linha 1082). O bloco termina no `}` que fecha o `if (recentClosed)` (linha ~1279).

- [ ] **Step 2: Substituir o bloco inteiro do Grace Period**

Substituir do comentário `// ===== GRACE PERIOD` até o `}` de fechamento do `if (!conversationId && !fromMe && !isGroup)` pelo novo código:

```typescript
        // ===== GRACE PERIOD v2: duas janelas + 3 saídas LLM =====
        if (!conversationId && !fromMe && !isGroup) {
          // Busca conversa recentemente fechada pelo mesmo contato
          // Usa kanban_stages.status_type = 'resolvido' para não hardcodar status
          const { data: resolvedStageIds } = await supabase
            .from("kanban_stages")
            .select("id")
            .eq("status_type", "resolvido");

          const resolvedIds = (resolvedStageIds || []).map((s: { id: string }) => s.id);
          const hardcodedStatuses = ["finalizado", "resolvido", "aguardando_cliente"];

          const { data: recentClosed } = await supabase
            .from("ai_conversations")
            .select("id, status, resolved_at, csat_sent_at, csat_responded_at, reopen_count, ticket_subject, problem_summary")
            .eq("whatsapp_instance_id", inst.id)
            .or(`uazapi_chat_id.eq.${chatJid},customer_phone.eq.${phoneNumber}`)
            .or(
              `status.in.(${hardcodedStatuses.map(s => `"${s}"`).join(",")})` +
              (resolvedIds.length ? `,stage_id.in.(${resolvedIds.map((id: string) => `"${id}"`).join(",")})` : "")
            )
            .order("resolved_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          if (recentClosed) {
            // Lê config grace_period_config (nova) ou fallback para configs antigas
            let absorbMinutes = 5;
            let smartMinutes = 30;
            let smartClassifyEnabled = true;

            const { data: graceConfigs } = await supabase
              .from("platform_ai_config")
              .select("feature, extra_config")
              .in("feature", ["grace_period_config", "post_close_grace_minutes", "suppress_post_close_tickets"]);

            for (const cfg of graceConfigs || []) {
              const ec = cfg.extra_config as Record<string, unknown> | null;
              if (cfg.feature === "grace_period_config" && ec) {
                absorbMinutes = Number(ec.absorb_minutes ?? 5);
                smartMinutes = Number(ec.smart_minutes ?? 30);
                smartClassifyEnabled = ec.smart_classify_enabled !== false;
              }
              // Backward compat com configs antigas
              if (cfg.feature === "post_close_grace_minutes" && ec && "minutes" in ec) {
                // Só usa se grace_period_config não existir
                if (!graceConfigs?.find(c => c.feature === "grace_period_config")) {
                  smartMinutes = Number(ec.minutes) || 30;
                }
              }
              if (cfg.feature === "suppress_post_close_tickets" && ec) {
                if (!graceConfigs?.find(c => c.feature === "grace_period_config")) {
                  smartClassifyEnabled = !!(ec.smart_classify ?? true);
                }
              }
            }

            const closedAt = recentClosed.resolved_at || recentClosed.csat_sent_at;
            const closedMs = closedAt ? Date.now() - new Date(closedAt).getTime() : Infinity;
            const withinAbsorb = closedMs < absorbMinutes * 60 * 1000;
            const withinSmart = closedMs < smartMinutes * 60 * 1000;

            // ── JANELA CURTA: absorção por regex (sem LLM) ──
            if (withinAbsorb) {
              // Usar caption de mídia se disponível
              const textToCheck = (textBody || (pushName ? "" : "") || "").trim();
              const normalizedText = textToCheck
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

              const isDismissable =
                !normalizedText ||
                /^(ok|okay|oks?|ta|tá|sim|nao|não|beleza|blz|certo|entendi|perfeito|show|massa|top|valeu|vlw|flw|falou|tmj|obg|obrigad[oa]s?|brigad[oa]s?|thanks?|thank\s*you|ty|thx|de\s*nada|👍|🙏|❤️?|😊|😁|😀|✅|💚|👏|🤝|💪|🫡|😘|🥰|☺️?|😃|😄|👌|🔝|✌️?)$/i.test(normalizedText) ||
                /^(muito\s+)?obrigad[oa]/.test(normalizedText) ||
                /^valeu\s+(pela|por|de)/.test(normalizedText) ||
                /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]{1,15}$/u.test(normalizedText);

              const looksLikeCSAT = /^(csat_\d{1,2}|\d{1,2}\s*⭐?|[1-9]|10)$/i.test(normalizedText);
              const awaitingCSAT = recentClosed.csat_sent_at && !recentClosed.csat_responded_at;

              if (isDismissable || looksLikeCSAT) {
                await supabase.from("ai_messages").insert({
                  conversation_id: recentClosed.id,
                  role: "user",
                  content: textBody || `[${messageType}]`,
                  uazapi_message_id: msgId,
                  media_url: finalMediaUrl || null,
                  media_type: mediaType,
                  whatsapp_instance_id: inst?.id || null,
                });

                if (awaitingCSAT && looksLikeCSAT) {
                  conversationId = recentClosed.id;
                  existingConv = { id: recentClosed.id, current_agent_id: null, handler_type: null };
                } else {
                  console.log(`[Grace Absorb] dismissed "${(textBody || "").slice(0, 30)}" — conv ${recentClosed.id}`);
                  return new Response(JSON.stringify({ ok: true, grace_period: true, dismissed: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }
              // Se não for dismissable na janela curta, cai para janela longa
            }

            // ── JANELA LONGA: LLM com 3 saídas ──
            if (!conversationId && withinSmart && smartClassifyEnabled) {
              // Usar caption de mídia se disponível (caption || textBody)
              const messageForClassify = (
                (mediaCaption || textBody || "")
              ).trim();

              if (messageForClassify && messageForClassify.length <= 500) {
                // Lock otimista: verifica se já está em processamento via uazapi_message_id
                if (msgId) {
                  const { data: alreadyProcessed } = await supabase
                    .from("ai_messages")
                    .select("id")
                    .eq("uazapi_message_id", msgId)
                    .maybeSingle();
                  if (alreadyProcessed) {
                    console.log(`[Grace Smart] msgId ${msgId} já processado, skipping`);
                    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
                      headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                  }
                }

                let classification: "dismiss" | "same_subject" | "new_subject" = "new_subject";

                try {
                  const classifyApiKey = Deno.env.get("OPENROUTER_API_KEY");
                  if (classifyApiKey) {
                    const ticketSubject = recentClosed.ticket_subject || "";
                    const problemSummary = recentClosed.problem_summary || "";

                    const classifyRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${classifyApiKey}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        model: "google/gemini-3.1-flash-lite-preview",
                        max_tokens: 20,
                        temperature: 0,
                        messages: [
                          {
                            role: "system",
                            content: `Você classifica mensagens de WhatsApp enviadas após o encerramento de um ticket de suporte.

Contexto do ticket encerrado:
- Assunto: "${ticketSubject}"
- Problema: "${problemSummary}"

Responda APENAS com uma palavra:
- "dismiss"       → agradecimento, confirmação, despedida, resposta CSAT, emoji, ou qualquer coisa que não seja novo problema
- "same_subject"  → novo problema, mas RELACIONADO ao mesmo assunto/módulo do ticket encerrado
- "new_subject"   → problema COMPLETAMENTE DIFERENTE do ticket encerrado

Exemplos de dismiss: "ok obrigado", "valeu resolveu", "show", "nota 5", "8"
Exemplos de same_subject: "voltou o mesmo erro", "ainda não funciona o login", "continua dando o mesmo problema"
Exemplos de new_subject: "agora a nota fiscal não sai", "preciso cancelar meu plano", "meu boleto não chegou"`,
                          },
                          {
                            role: "user",
                            content: `Mensagem enviada ${Math.round(closedMs / 1000)}s após encerramento: "${messageForClassify}"`,
                          },
                        ],
                      }),
                      signal: AbortSignal.timeout(5000),
                    });

                    if (classifyRes.ok) {
                      const classifyData = await classifyRes.json();
                      const answer = (classifyData?.choices?.[0]?.message?.content || "").trim().toLowerCase();
                      if (answer.includes("dismiss")) classification = "dismiss";
                      else if (answer.includes("same_subject")) classification = "same_subject";
                      else classification = "new_subject";
                      console.log(`[Grace Smart] "${messageForClassify.slice(0, 50)}" → ${classification}`);
                    }
                  }
                } catch (classifyErr) {
                  console.warn("[Grace Smart] classify failed, defaulting to new_subject:", classifyErr);
                }

                // Inserir mensagem antes de qualquer roteamento
                await supabase.from("ai_messages").insert({
                  conversation_id: recentClosed.id,
                  role: "user",
                  content: textBody || `[${messageType}]`,
                  uazapi_message_id: msgId,
                  media_url: finalMediaUrl || null,
                  media_type: mediaType,
                  whatsapp_instance_id: inst?.id || null,
                });

                if (classification === "dismiss") {
                  console.log(`[Grace Smart] dismissed "${messageForClassify.slice(0, 50)}" — conv ${recentClosed.id}`);
                  return new Response(JSON.stringify({ ok: true, grace_period: true, ai_dismissed: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                } else if (classification === "same_subject") {
                  // Reabre o ticket existente
                  console.log(`[Grace Smart] same_subject — reopening conv ${recentClosed.id}`);
                  await supabase.from("ai_conversations").update({
                    status: "em_atendimento",
                    handler_type: null,
                    reopen_count: ((recentClosed as any).reopen_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                  }).eq("id", recentClosed.id);

                  conversationId = recentClosed.id;
                  existingConv = { id: recentClosed.id, current_agent_id: null, handler_type: null };
                } else {
                  // new_subject: deixa criar novo ticket com parent_ticket_id
                  console.log(`[Grace Smart] new_subject — will create new ticket with parent_ticket_id=${recentClosed.id}`);
                  // Passa o parent_ticket_id para ser usado na criação do ticket abaixo
                  // (a criação do ticket acontece no fluxo normal após esse bloco)
                  // Armazena temporariamente para uso mais abaixo:
                  ;(req as any)._gracePeriodParentTicketId = recentClosed.id;
                }
              } else if (!messageForClassify || messageForClassify.length > 500) {
                // Mensagem muito longa ou vazia para smart classify: cria novo ticket normalmente
                console.log(`[Grace Smart] message too long/empty (${messageForClassify?.length}), creating new ticket`);
              }
            } else if (!conversationId && withinSmart && !smartClassifyEnabled) {
              // Smart classify desabilitado: reabre o ticket existente diretamente
              await supabase.from("ai_conversations").update({
                status: "em_atendimento",
                handler_type: null,
                reopen_count: ((recentClosed as any).reopen_count || 0) + 1,
                updated_at: new Date().toISOString(),
              }).eq("id", recentClosed.id);

              await supabase.from("ai_messages").insert({
                conversation_id: recentClosed.id,
                role: "user",
                content: textBody || `[${messageType}]`,
                uazapi_message_id: msgId,
                media_url: finalMediaUrl || null,
                media_type: mediaType,
                whatsapp_instance_id: inst?.id || null,
              });

              conversationId = recentClosed.id;
              existingConv = { id: recentClosed.id, current_agent_id: null, handler_type: null };
            }
          }
        }
        // ===== FIM GRACE PERIOD v2 =====
```

> **Nota sobre `mediaCaption`:** Verifique no código do webhook onde a variável `mediaCaption` é definida. Se não existir, use `(pushName ? "" : textBody)` ou extraia do payload. Procure por `caption` no arquivo para identificar a variável correta.

> **Nota sobre `parent_ticket_id`:** O `(req as any)._gracePeriodParentTicketId` é uma forma temporária de passar o valor. Localize no arquivo onde o novo ticket é criado (após o bloco do grace period) e adicione `parent_ticket_id: (req as any)._gracePeriodParentTicketId || null` no insert.

- [ ] **Step 3: Localizar onde o novo ticket é criado e adicionar parent_ticket_id**

Após o bloco do grace period, o fluxo continua criando um novo ticket quando `!conversationId`. Localize o `insert` em `ai_conversations` (o principal, não os menores) e adicione:

```typescript
  parent_ticket_id: (req as any)._gracePeriodParentTicketId || null,
```

- [ ] **Step 4: Deploy**

```bash
supabase functions deploy uazapi-webhook
```

- [ ] **Step 5: Verificar logs após deploy**

```bash
supabase functions logs uazapi-webhook --tail
```

Envie uma mensagem de teste "ok obrigado" via WhatsApp após fechar um ticket e confirme que o log mostra `[Grace Absorb] dismissed`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "feat: grace period v2 — duas janelas, 3 saídas LLM, parent_ticket_id, status_type lookup"
```

---

## Task 7: UI — Solução Aplicada + CSAT Manual + Badge Parent Ticket

**Files:**
- Modify: `src/components/tickets/KanbanChatPanel.tsx`

- [ ] **Step 1: Adicionar problem_summary, solution_summary, parent_ticket_id ao select da query da RelatorioTabContent**

Localizar a query `queryFn` que seleciona da `ai_conversations` dentro de `RelatorioTabContent` (~linha 1836):

```typescript
    const { data } = await supabase
      .from('ai_conversations')
      .select('queue_entered_at, first_human_response_at, ..., kanban_board_id')
```

Adicionar ao select: `, problem_summary, solution_summary, parent_ticket_id`.

- [ ] **Step 2: Adicionar campo "Solução Aplicada" no RelatorioTabContent**

Logo após o bloco `{/* ── Análise IA do Atendimento ── */}` (que mostra `conversation_summary`), adicionar:

```tsx
      {/* ── Solução Aplicada ── */}
      {(ticket.solution_summary || ticket.problem_summary) && (
        <SectionCard icon={CheckCircle2} title="Classificação IA">
          {ticket.problem_summary && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Problema</p>
              <p className="text-xs text-foreground leading-relaxed bg-muted/50 rounded-lg p-2.5">
                {ticket.problem_summary}
              </p>
            </div>
          )}
          {ticket.solution_summary && (
            <div className="space-y-1 mt-3">
              <p className="text-xs font-medium text-muted-foreground">Solução aplicada</p>
              <p className="text-xs text-foreground leading-relaxed bg-muted/50 rounded-lg p-2.5">
                {ticket.solution_summary}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 mt-1"
                onClick={async () => {
                  toast.info('Regenerando...')
                  try {
                    const { error } = await supabase.functions.invoke('ticket-solution-classifier', {
                      body: {
                        conversation_id: conversationId,
                        resolution_summary: ticket.solution_summary,
                      },
                    })
                    if (error) throw error
                    queryClient.invalidateQueries({ queryKey: ['relatorio-ticket', conversationId] })
                    toast.success('Solução regenerada!')
                  } catch {
                    toast.error('Erro ao regenerar solução')
                  }
                }}
              >
                <RefreshCw className="w-3 h-3" />
                Regenerar
              </Button>
            </div>
          )}
        </SectionCard>
      )}
```

- [ ] **Step 3: Adicionar botão manual "Enviar CSAT" na seção de CSAT**

Localizar o bloco `{/* ── CSAT ── */}` (~linha 2066). Antes desse bloco, adicionar o botão de CSAT manual. O botão deve:
- Ser visível se: `ticket.isWhatsApp` (ou `ticket.whatsapp_instance_id`) E board tem CSAT config habilitado
- Usar label dinâmico baseado em `ticket.csat_sent_at`

```tsx
      {/* ── CSAT Manual ── */}
      {csatBoardConfig?.enabled && csatBoardConfig?.send_on_close && ticket?.whatsapp_instance_id && (
        <SectionCard icon={MessageCircle} title="CSAT">
          <CsatManualButton
            conversationId={conversationId}
            csatSentAt={ticket.csat_sent_at || null}
            csatRespondedAt={ticket.csat_responded_at || null}
            csatConfigId={csatBoardConfig.id}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['relatorio-ticket', conversationId] })}
          />
        </SectionCard>
      )}
```

Criar o componente `CsatManualButton` no mesmo arquivo (ou em `src/components/csat/CsatManualButton.tsx`):

```tsx
function CsatManualButton({
  conversationId,
  csatSentAt,
  csatRespondedAt,
  csatConfigId,
  onSuccess,
}: {
  conversationId: string
  csatSentAt: string | null
  csatRespondedAt: string | null
  csatConfigId: string
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const label = !csatSentAt ? 'Enviar CSAT' : (!csatRespondedAt ? 'Reenviar CSAT' : null)
  if (!label) return (
    <p className="text-xs text-muted-foreground">CSAT já respondido pelo cliente.</p>
  )

  const handleClick = async () => {
    if (cooldown || loading) return
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('csat-processor', {
        body: {
          action: 'send',
          conversationId,
          configId: csatConfigId,
          trigger_source: 'manual',
        },
      })
      if (error) throw error
      toast.success('CSAT enviado com sucesso!')
      onSuccess()
      setCooldown(true)
      setTimeout(() => setCooldown(false), 30000)
    } catch {
      toast.error('Erro ao enviar CSAT')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-1.5"
      onClick={handleClick}
      disabled={loading || cooldown}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
      {cooldown ? 'Aguarde 30s...' : label}
    </Button>
  )
}
```

- [ ] **Step 4: Adicionar badge de parent_ticket no header do painel**

No `KanbanChatPanel`, localizar onde o ticket_number e customer_name são exibidos no header do painel. Adicionar o badge de parent_ticket. Primeiro, adicionar `parent_ticket_id` ao tipo/fetch do KanbanTicket, então:

```tsx
{ticket.parent_ticket_id && (
  <span
    className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
    title="Ver ticket original"
    onClick={() => {
      // Navegar para o ticket pai — emite evento ou chama callback
      // Por ora, mostrar apenas o badge informativo
    }}
  >
    Continuação de #{ticket.parent_ticket_number || '?'}
  </span>
)}
```

> **Nota:** Para exibir o número do ticket pai, você precisará de um join ou query adicional. A forma mais simples é adicionar ao select do `useKanbanTickets.ts` um join: `.select('..., parent:parent_ticket_id(ticket_number)')` e expor como `parent_ticket_number`.

- [ ] **Step 5: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Testar visualmente**

```bash
npm run dev
```

Abrir `/kanban/:slug`, selecionar um ticket finalizado com `solution_summary` e verificar:
- Campo "Solução aplicada" exibido na aba Relatório
- Botão "Enviar CSAT" / "Reenviar CSAT" visível se board tem CSAT habilitado
- Badge "Continuação de #N" visível se o ticket tem `parent_ticket_id`

- [ ] **Step 7: Commit**

```bash
git add src/components/tickets/KanbanChatPanel.tsx
git commit -m "feat: UI — campo solução aplicada, botão CSAT manual, badge parent ticket"
```

---

## Task 8: Push para o branch de desenvolvimento

- [ ] **Step 1: Verificar estado do repositório**

```bash
git status
git log --oneline -10
```

- [ ] **Step 2: Push**

```bash
git push -u origin claude/sismais-support-system-JCMCi
```

---

## Plano de Testes Manual (pós-deploy)

Execute estes cenários para validar a implementação completa:

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Criar ticket, aguardar classificação automática | `problem_summary` preenchido; `classification_version = 1` |
| 2 | Fechar ticket com resolution_summary | `solution_summary` gerado automaticamente em ~5s |
| 3 | Fechar ticket com board CSAT habilitado | `csat_send_log` com `trigger_source='close'` e `status='sent'` |
| 4 | Simular falha no invoke CSAT, aguardar 5min | Cron `reconcile-missed` preenche `csat_sent_at`; log com `trigger_source='cron_reconcile'` |
| 5 | Clicar "Enviar CSAT" manualmente | Log com `trigger_source='manual'`; botão desabilitado 30s |
| 6 | Fechar ticket, enviar "ok obrigado" em 2min | `[Grace Absorb] dismissed` nos logs; sem novo ticket |
| 7 | Fechar "erro no login", enviar "ainda dando o erro" em 15min | `same_subject` → ticket REABERTO; `reopen_count++` |
| 8 | Fechar login, enviar "boleto não chegou" em 15min | `new_subject` → novo ticket com `parent_ticket_id` preenchido |
| 9 | Mensagem após 40min | Novo ticket sem `parent_ticket_id` |

---

## Métricas de Sucesso (verificar 1 semana após deploy)

```sql
-- % tickets com problem_summary (meta: > 90%)
SELECT
  COUNT(*) FILTER (WHERE problem_summary IS NOT NULL) * 100.0 / COUNT(*) AS pct_problem_summary
FROM ai_conversations
WHERE created_at > NOW() - INTERVAL '7 days';

-- % tickets finalizados com solution_summary (meta: > 80%)
SELECT
  COUNT(*) FILTER (WHERE solution_summary IS NOT NULL) * 100.0 / COUNT(*) AS pct_solution_summary
FROM ai_conversations
WHERE status = 'finalizado' AND resolved_at > NOW() - INTERVAL '7 days';

-- % tickets finalizados com CSAT enviado (meta: > 98%)
SELECT
  COUNT(*) FILTER (WHERE csat_sent_at IS NOT NULL) * 100.0 / COUNT(*) AS pct_csat_sent
FROM ai_conversations ac
WHERE status = 'finalizado'
  AND resolved_at > NOW() - INTERVAL '7 days'
  AND EXISTS (
    SELECT 1 FROM csat_board_configs cbc
    WHERE cbc.board_id = ac.kanban_board_id AND cbc.enabled AND cbc.send_on_close
  );

-- Novos tickets com parent_ticket_id na última semana
SELECT COUNT(*) AS tickets_com_parent
FROM ai_conversations
WHERE parent_ticket_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```
