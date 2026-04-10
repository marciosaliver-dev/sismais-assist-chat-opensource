# CSAT Parametrizado por Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar pesquisas CSAT parametrizadas por Kanban Board com IA classificadora, reenvio automático e dashboard analítico.

**Architecture:** Duas novas tabelas (`csat_board_configs`, `csat_surveys`), uma edge function dedicada (`csat-processor`) com 3 actions (send, classify, process-pending), interceptação no webhook antes do orchestrator, UI de config por board e dashboard na Evaluations.

**Tech Stack:** Supabase (PostgreSQL + Edge Functions Deno), React 18 + TypeScript, TanStack Query v5, shadcn/ui, OpenRouter (Gemini Flash) para classificação IA.

**Spec:** `docs/superpowers/specs/2026-03-21-csat-board-parametrizado-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/functions/csat-processor/index.ts` | Edge function: send, classify, process-pending |
| `src/components/csat/CSATBoardConfigForm.tsx` | Formulário de config CSAT por board |
| `src/components/csat/CSATQuestionBuilder.tsx` | Builder de perguntas adicionais |
| `src/components/csat/CSATMessagePreview.tsx` | Preview ao vivo da mensagem |
| `src/components/csat/CSATDashboardTab.tsx` | Tab CSAT na página Evaluations |
| `src/hooks/useCSATBoardConfig.ts` | Hook: query + mutation config por board |
| `src/hooks/useCSATSurveys.ts` | Hook: surveys para dashboard |

### Modified Files
| File | Change |
|------|--------|
| `supabase/functions/uazapi-webhook/index.ts` | Check CSAT response antes do orchestrator (~L1700) |
| `src/utils/closeConversation.ts` | Substituir lógica CSAT por chamada ao csat-processor |
| `src/components/inbox/CloseConversationDialog.tsx` | Ajustar toggle CSAT para usar config do board |
| `src/pages/Evaluations.tsx` | Adicionar 4ª aba "CSAT" |
| `src/components/settings/KanbanAndStagesTab.tsx` | Adicionar botão "Config CSAT" por board |

---

## Task 1: Migration SQL — Tabelas e Índices

**Files:**
- Create: migration SQL (aplicar via Supabase MCP)

- [ ] **Step 1: Criar tabela `csat_board_configs`**

```sql
CREATE TABLE csat_board_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL UNIQUE REFERENCES kanban_boards(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  scale_type text NOT NULL DEFAULT 'stars_1_5'
    CHECK (scale_type IN ('stars_1_5', 'thumbs', 'nps_0_10', 'emoji')),
  message_template text NOT NULL DEFAULT '📊 *Pesquisa de Satisfação — {{board}}*

Olá {{nome}}! Seu atendimento (protocolo {{protocolo}}) foi concluído.

Como você avalia nosso suporte?

1 ⭐ — Muito insatisfeito
2 ⭐⭐ — Insatisfeito
3 ⭐⭐⭐ — Regular
4 ⭐⭐⭐⭐ — Satisfeito
5 ⭐⭐⭐⭐⭐ — Muito satisfeito

Responda com o número ou envie um comentário. Obrigado! 🙏',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  send_on_close boolean NOT NULL DEFAULT true,
  delay_minutes integer NOT NULL DEFAULT 0,
  resend_enabled boolean NOT NULL DEFAULT false,
  resend_after_hours integer NOT NULL DEFAULT 4,
  max_resends integer NOT NULL DEFAULT 1,
  response_window_hours integer NOT NULL DEFAULT 48,
  ai_dimensions jsonb NOT NULL DEFAULT '["resolucao","tempo","cordialidade"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE csat_board_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON csat_board_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_all" ON csat_board_configs FOR ALL TO service_role USING (true);
CREATE POLICY "authenticated_write" ON csat_board_configs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON csat_board_configs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete" ON csat_board_configs FOR DELETE TO authenticated USING (true);
```

- [ ] **Step 2: Criar tabela `csat_surveys`**

```sql
CREATE TABLE csat_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES csat_board_configs(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  instance_id uuid NOT NULL REFERENCES uazapi_instances(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'resent', 'processing', 'answered', 'expired')),
  response_window_hours integer NOT NULL DEFAULT 48,
  sent_at timestamptz,
  sent_message_id text,
  resend_count integer NOT NULL DEFAULT 0,
  next_action_at timestamptz,
  score integer,
  raw_response text,
  ai_analysis jsonb,
  answers jsonb,
  responded_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_csat_surveys_phone_status
  ON csat_surveys (customer_phone, instance_id, status);
CREATE INDEX idx_csat_surveys_next_action
  ON csat_surveys (next_action_at)
  WHERE status IN ('pending', 'sent', 'resent');
CREATE INDEX idx_csat_surveys_conversation
  ON csat_surveys (conversation_id);

-- RLS
ALTER TABLE csat_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON csat_surveys FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_all" ON csat_surveys FOR ALL TO service_role USING (true);
```

- [ ] **Step 3: Trigger updated_at para csat_board_configs**

```sql
CREATE TRIGGER set_csat_board_configs_updated_at
  BEFORE UPDATE ON csat_board_configs
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

- [ ] **Step 4: Aplicar migration via Supabase MCP**

Run: `mcp__claude_ai_Supabase__apply_migration` com o SQL combinado acima.

- [ ] **Step 5: Gerar tipos TypeScript atualizados**

Run: `mcp__claude_ai_Supabase__generate_typescript_types` e atualizar `src/integrations/supabase/types.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat(db): add csat_board_configs and csat_surveys tables"
```

---

## Task 2: Edge Function `csat-processor` — Action `send`

**Files:**
- Create: `supabase/functions/csat-processor/index.ts`

- [ ] **Step 1: Scaffold edge function com CORS e routing**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();

    switch (action) {
      case "send":
        return await handleSend(supabaseAdmin, params);
      case "classify":
        return await handleClassify(supabaseAdmin, params);
      case "process-pending":
        return await handleProcessPending(supabaseAdmin);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("csat-processor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Implementar `handleSend`**

Lógica:
1. Buscar config do board via `config_id`
2. Buscar dados da conversa (customer_phone, customer_name, ticket_number, instance_id)
3. Montar mensagem substituindo variáveis `{{nome}}`, `{{protocolo}}`, `{{board}}`
4. Se `delay_minutes > 0`: criar survey com `status=pending`, `next_action_at = now + delay`
5. Se `delay_minutes = 0`: enviar via uazapi-proxy, criar survey com `status=sent`, gravar `sent_message_id`

```typescript
async function handleSend(supabaseAdmin, params) {
  const { conversationId, configId } = params;

  // Buscar config
  const { data: config } = await supabaseAdmin
    .from("csat_board_configs")
    .select("*, board:kanban_boards(name)")
    .eq("id", configId)
    .single();

  if (!config || !config.enabled) {
    return jsonResponse({ success: false, reason: "config_disabled" });
  }

  // Buscar conversa
  const { data: conversation } = await supabaseAdmin
    .from("ai_conversations")
    .select("customer_phone, customer_name, ticket_number, uazapi_instance_id")
    .eq("id", conversationId)
    .single();

  if (!conversation?.customer_phone) {
    return jsonResponse({ success: false, reason: "no_phone" });
  }

  // Montar mensagem
  const message = config.message_template
    .replace(/\{\{nome\}\}/g, conversation.customer_name || "Cliente")
    .replace(/\{\{protocolo\}\}/g, conversation.ticket_number || conversationId.slice(0, 8))
    .replace(/\{\{board\}\}/g, config.board?.name || "Atendimento");

  const surveyData = {
    conversation_id: conversationId,
    config_id: configId,
    customer_phone: conversation.customer_phone,
    instance_id: conversation.uazapi_instance_id,
    response_window_hours: config.response_window_hours,
  };

  if (config.delay_minutes > 0) {
    // Agendado para envio futuro
    const nextAction = new Date(Date.now() + config.delay_minutes * 60 * 1000).toISOString();
    await supabaseAdmin.from("csat_surveys").insert({
      ...surveyData,
      status: "pending",
      next_action_at: nextAction,
    });
    return jsonResponse({ success: true, scheduled: true });
  }

  // Envio imediato via uazapi-proxy
  const { data: instance } = await supabaseAdmin
    .from("uazapi_instances")
    .select("api_url, api_token")
    .eq("id", conversation.uazapi_instance_id)
    .single();

  const sendResult = await fetch(`${instance.api_url}/message/sendText/${instance.api_token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: conversation.customer_phone,
      message: message,
    }),
  });

  const sendData = await sendResult.json();
  const sentMsgId = sendData?.key?.id || sendData?.messageId || null;

  const nextAction = config.resend_enabled
    ? new Date(Date.now() + config.resend_after_hours * 3600 * 1000).toISOString()
    : null;

  await supabaseAdmin.from("csat_surveys").insert({
    ...surveyData,
    status: "sent",
    sent_at: new Date().toISOString(),
    sent_message_id: sentMsgId,
    next_action_at: nextAction,
  });

  // Atualizar conversa
  await supabaseAdmin
    .from("ai_conversations")
    .update({ csat_sent_at: new Date().toISOString() })
    .eq("id", conversationId);

  return jsonResponse({ success: true, sent: true, messageId: sentMsgId });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/csat-processor/index.ts
git commit -m "feat(edge): add csat-processor edge function with send action"
```

---

## Task 3: Edge Function `csat-processor` — Action `classify`

**Files:**
- Modify: `supabase/functions/csat-processor/index.ts`

- [ ] **Step 1: Implementar `handleClassify`**

```typescript
async function handleClassify(supabaseAdmin, params) {
  const { surveyId, message, quotedMsgId } = params;

  // Buscar survey com config
  const { data: survey } = await supabaseAdmin
    .from("csat_surveys")
    .select("*, config:csat_board_configs(*)")
    .eq("id", surveyId)
    .single();

  if (!survey) {
    return jsonResponse({ error: "Survey not found", is_csat_response: false }, 404);
  }

  const isDirectReply = quotedMsgId && quotedMsgId === survey.sent_message_id;

  // Chamar LLM para classificar
  const scaleDescriptions = {
    stars_1_5: "Escala de 1 a 5 estrelas (1=muito insatisfeito, 5=muito satisfeito)",
    thumbs: "Escala binária: 👍 (positivo=2) ou 👎 (negativo=1)",
    nps_0_10: "Net Promoter Score de 0 a 10",
    emoji: "Escala de emojis: 😡=1, 😕=2, 😐=3, 🙂=4, 😍=5",
  };

  const questionsContext = survey.config.questions?.length
    ? `\nPerguntas adicionais configuradas:\n${survey.config.questions.map((q) => `- ${q.key}: "${q.label}" (tipo: ${q.type})`).join("\n")}`
    : "";

  const dimensionsContext = survey.config.ai_dimensions?.length
    ? `Dimensões para avaliar: ${survey.config.ai_dimensions.join(", ")}`
    : "";

  const prompt = `Você é um classificador de pesquisas de satisfação (CSAT).
Analise a resposta do cliente a uma pesquisa de satisfação de atendimento.

${scaleDescriptions[survey.config.scale_type] || scaleDescriptions.stars_1_5}
${dimensionsContext}
${questionsContext}

${isDirectReply ? "O cliente respondeu DIRETAMENTE à mensagem da pesquisa (citou a mensagem original)." : "O cliente enviou esta mensagem enquanto havia uma pesquisa pendente. Determine se é uma resposta à pesquisa ou um assunto diferente."}

Resposta do cliente: "${message}"

Retorne APENAS o JSON (sem markdown):
{
  "is_csat_response": boolean,
  "score": number | null,
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "dimensions": { ${(survey.config.ai_dimensions || []).map((d) => `"${d}": number`).join(", ")} },
  "tags": ["string"],
  "summary": "resumo em 1 frase",
  "answers": null
}

Se não for resposta à pesquisa, retorne is_csat_response=false e os demais campos como null.`;

  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  const llmData = await llmResponse.json();
  const content = llmData.choices?.[0]?.message?.content || "{}";

  let analysis;
  try {
    analysis = JSON.parse(content);
  } catch {
    // Fallback: se direct reply, assume CSAT com parsing simples
    if (isDirectReply) {
      const numMatch = message.match(/\d+/);
      analysis = {
        is_csat_response: true,
        score: numMatch ? parseInt(numMatch[0]) : null,
        sentiment: "neutral",
        dimensions: {},
        tags: ["parse_fallback"],
        summary: "Resposta classificada por fallback",
      };
    } else {
      analysis = { is_csat_response: false };
    }
  }

  if (analysis.is_csat_response) {
    // Gravar resultado
    await supabaseAdmin
      .from("csat_surveys")
      .update({
        status: "answered",
        score: analysis.score,
        raw_response: message,
        ai_analysis: {
          sentiment: analysis.sentiment,
          dimensions: analysis.dimensions,
          tags: analysis.tags,
          summary: analysis.summary,
        },
        answers: analysis.answers,
        responded_at: new Date().toISOString(),
      })
      .eq("id", surveyId);

    // Sincronizar ai_conversations.csat_score
    if (analysis.score != null) {
      await supabaseAdmin
        .from("ai_conversations")
        .update({
          csat_score: analysis.score,
          csat_responded_at: new Date().toISOString(),
          csat_comment: analysis.summary,
        })
        .eq("id", survey.conversation_id);
    }
  } else {
    // Não é CSAT — reverter status será feito pelo webhook caller
  }

  return jsonResponse({
    is_csat_response: analysis.is_csat_response,
    score: analysis.score,
    surveyId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/csat-processor/index.ts
git commit -m "feat(edge): add classify action to csat-processor"
```

---

## Task 4: Edge Function `csat-processor` — Action `process-pending`

**Files:**
- Modify: `supabase/functions/csat-processor/index.ts`

- [ ] **Step 1: Implementar `handleProcessPending`**

```typescript
async function handleProcessPending(supabaseAdmin) {
  const now = new Date();
  const results = { expired: 0, resent: 0, sent: 0 };

  // 1. EXPIRAR surveys que ultrapassaram response_window_hours
  const { data: toExpire } = await supabaseAdmin
    .from("csat_surveys")
    .select("id, created_at, response_window_hours")
    .in("status", ["sent", "resent"])
    .order("created_at", { ascending: true });

  for (const survey of toExpire || []) {
    const windowEnd = new Date(
      new Date(survey.created_at).getTime() + survey.response_window_hours * 3600 * 1000
    );
    if (now >= windowEnd) {
      await supabaseAdmin
        .from("csat_surveys")
        .update({ status: "expired", expired_at: now.toISOString() })
        .eq("id", survey.id)
        .in("status", ["sent", "resent"]); // Optimistic lock
      results.expired++;
    }
  }

  // 2. REENVIAR surveys com next_action_at vencido (e não expiradas)
  const { data: toResend } = await supabaseAdmin
    .from("csat_surveys")
    .select("*, config:csat_board_configs(*, board:kanban_boards(name))")
    .in("status", ["sent", "resent"])
    .lte("next_action_at", now.toISOString())
    .order("next_action_at", { ascending: true })
    .limit(50);

  for (const survey of toResend || []) {
    if (!survey.config?.resend_enabled) continue;
    if (survey.resend_count >= (survey.config.max_resends || 1)) {
      await supabaseAdmin
        .from("csat_surveys")
        .update({ status: "expired", expired_at: now.toISOString() })
        .eq("id", survey.id);
      results.expired++;
      continue;
    }

    // Buscar conversa e instância para reenviar
    const { data: conversation } = await supabaseAdmin
      .from("ai_conversations")
      .select("customer_name, ticket_number")
      .eq("id", survey.conversation_id)
      .single();

    const { data: instance } = await supabaseAdmin
      .from("uazapi_instances")
      .select("api_url, api_token")
      .eq("id", survey.instance_id)
      .single();

    if (!instance) continue;

    const message = survey.config.message_template
      .replace(/\{\{nome\}\}/g, conversation?.customer_name || "Cliente")
      .replace(/\{\{protocolo\}\}/g, conversation?.ticket_number || "")
      .replace(/\{\{board\}\}/g, survey.config.board?.name || "Atendimento");

    const resendMessage = `🔔 *Lembrete*\n\n${message}`;

    try {
      const sendResult = await fetch(
        `${instance.api_url}/message/sendText/${instance.api_token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: survey.customer_phone, message: resendMessage }),
        }
      );
      const sendData = await sendResult.json();

      const nextAction = new Date(
        now.getTime() + survey.config.resend_after_hours * 3600 * 1000
      ).toISOString();

      await supabaseAdmin
        .from("csat_surveys")
        .update({
          status: "resent",
          resend_count: survey.resend_count + 1,
          sent_message_id: sendData?.key?.id || sendData?.messageId || survey.sent_message_id,
          next_action_at: nextAction,
        })
        .eq("id", survey.id);

      results.resent++;
    } catch (e) {
      console.error(`Failed to resend survey ${survey.id}:`, e);
    }
  }

  // 3. ENVIAR surveys pendentes com delay vencido
  const { data: toSend } = await supabaseAdmin
    .from("csat_surveys")
    .select("*, config:csat_board_configs(*, board:kanban_boards(name))")
    .eq("status", "pending")
    .lte("next_action_at", now.toISOString())
    .order("next_action_at", { ascending: true })
    .limit(50);

  for (const survey of toSend || []) {
    const { data: conversation } = await supabaseAdmin
      .from("ai_conversations")
      .select("customer_name, ticket_number")
      .eq("id", survey.conversation_id)
      .single();

    const { data: instance } = await supabaseAdmin
      .from("uazapi_instances")
      .select("api_url, api_token")
      .eq("id", survey.instance_id)
      .single();

    if (!instance) continue;

    const message = survey.config.message_template
      .replace(/\{\{nome\}\}/g, conversation?.customer_name || "Cliente")
      .replace(/\{\{protocolo\}\}/g, conversation?.ticket_number || "")
      .replace(/\{\{board\}\}/g, survey.config.board?.name || "Atendimento");

    try {
      const sendResult = await fetch(
        `${instance.api_url}/message/sendText/${instance.api_token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: survey.customer_phone, message }),
        }
      );
      const sendData = await sendResult.json();

      const nextAction = survey.config.resend_enabled
        ? new Date(now.getTime() + survey.config.resend_after_hours * 3600 * 1000).toISOString()
        : null;

      await supabaseAdmin
        .from("csat_surveys")
        .update({
          status: "sent",
          sent_at: now.toISOString(),
          sent_message_id: sendData?.key?.id || sendData?.messageId || null,
          next_action_at: nextAction,
        })
        .eq("id", survey.id);

      results.sent++;
    } catch (e) {
      console.error(`Failed to send survey ${survey.id}:`, e);
    }
  }

  return jsonResponse({ success: true, processed: results });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/csat-processor/index.ts
git commit -m "feat(edge): add process-pending action to csat-processor"
```

---

## Task 5: Interceptar CSAT no Webhook

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts` (~line 1700, antes do process-incoming-message)

- [ ] **Step 1: Adicionar função helper `looksLikeCSATResponse`**

Adicionar no topo do arquivo (após imports):

```typescript
function looksLikeCSATResponse(text: string, config: any): boolean {
  if (!text || text.trim().length === 0) return false;
  const trimmed = text.trim();

  // Número dentro da escala
  const num = parseInt(trimmed);
  if (!isNaN(num)) {
    if (config.scale_type === 'stars_1_5' && num >= 1 && num <= 5) return true;
    if (config.scale_type === 'nps_0_10' && num >= 0 && num <= 10) return true;
    if (config.scale_type === 'thumbs' && (num === 1 || num === 2)) return true;
    if (config.scale_type === 'emoji' && num >= 1 && num <= 5) return true;
  }

  // Emoji único mapeado
  const csatEmojis = ['⭐', '👍', '👎', '😡', '😕', '😐', '🙂', '😍', '❤️', '💚', '👏'];
  if (csatEmojis.some(e => trimmed.includes(e)) && trimmed.length < 20) return true;

  // Texto curto (provável comentário)
  const words = trimmed.split(/\s+/).length;
  if (words <= 15) {
    // Excluir saudações
    const greetings = ['bom dia', 'boa tarde', 'boa noite', 'olá', 'oi', 'oie', 'opa'];
    const lower = trimmed.toLowerCase();
    if (greetings.some(g => lower.startsWith(g))) return false;
    // Excluir perguntas
    if (trimmed.endsWith('?')) return false;
    return true;
  }

  return false;
}
```

- [ ] **Step 2: Adicionar check CSAT antes do orchestrator**

Localizar a seção onde `process-incoming-message` é invocado (~line 1700) e inserir ANTES:

```typescript
// --- CSAT Response Check ---
if (!fromMe) {
  const { data: pendingSurvey } = await supabaseAdmin
    .from('csat_surveys')
    .select('*, config:csat_board_configs(*)')
    .eq('customer_phone', senderPhone)
    .eq('instance_id', instanceId)
    .in('status', ['sent', 'resent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingSurvey) {
    const windowEnd = new Date(
      new Date(pendingSurvey.created_at).getTime() +
      pendingSurvey.response_window_hours * 3600 * 1000
    );

    if (new Date() < windowEnd) {
      const isDirectReply = quotedMsgId === pendingSurvey.sent_message_id;
      if (isDirectReply || looksLikeCSATResponse(messageText, pendingSurvey.config)) {
        // Optimistic lock
        const { data: locked } = await supabaseAdmin
          .from('csat_surveys')
          .update({ status: 'processing' })
          .eq('id', pendingSurvey.id)
          .in('status', ['sent', 'resent'])
          .select()
          .maybeSingle();

        if (locked) {
          try {
            const classifyResponse = await supabaseAdmin.functions.invoke('csat-processor', {
              body: { action: 'classify', surveyId: locked.id, message: messageText, quotedMsgId }
            });

            const classifyResult = classifyResponse.data;
            if (classifyResult?.is_csat_response) {
              console.log(`[CSAT] Survey ${locked.id} answered with score ${classifyResult.score}`);
              // Se não tem conversa ativa, não precisa seguir pro orchestrator
              if (!conversationId) {
                return new Response(JSON.stringify({ success: true, csat_handled: true }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              // Se tem conversa ativa, continua normalmente
            } else {
              // Não é CSAT — reverter status
              await supabaseAdmin
                .from('csat_surveys')
                .update({ status: pendingSurvey.status })
                .eq('id', locked.id);
            }
          } catch (e) {
            console.error('[CSAT] classify error, reverting:', e);
            await supabaseAdmin
              .from('csat_surveys')
              .update({ status: pendingSurvey.status })
              .eq('id', locked.id);
          }
        }
      }
    }
  }
}
// --- End CSAT Check ---
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "feat(webhook): intercept CSAT responses before orchestrator"
```

---

## Task 6: Atualizar `closeConversation.ts`

**Files:**
- Modify: `src/utils/closeConversation.ts`

- [ ] **Step 1: Adicionar busca de config CSAT do board**

No `closeConversation()`, substituir a lógica atual de CSAT (que seta `csat_sent_at` diretamente) por:

```typescript
// Antes da atualização de status, buscar config CSAT do board
let shouldSendCsat = false;
let csatConfigId: string | null = null;

if (sendCsat && isWhatsApp) {
  // Buscar board_id da conversa
  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('kanban_board_id')
    .eq('id', conversationId)
    .single();

  if (conv?.kanban_board_id) {
    const { data: csatConfig } = await supabase
      .from('csat_board_configs')
      .select('id, enabled, send_on_close')
      .eq('board_id', conv.kanban_board_id)
      .eq('enabled', true)
      .maybeSingle();

    if (csatConfig?.send_on_close) {
      shouldSendCsat = true;
      csatConfigId = csatConfig.id;
    }
  }
}
```

Depois, na seção de chamada de edge functions, substituir o set direto de `csat_sent_at` por:

```typescript
if (shouldSendCsat && csatConfigId) {
  supabase.functions.invoke('csat-processor', {
    body: { action: 'send', conversationId, configId: csatConfigId }
  }); // fire-and-forget
}
```

E manter o `targetStatus` como `'aguardando_cliente'` quando CSAT está ativo.

- [ ] **Step 2: Commit**

```bash
git add src/utils/closeConversation.ts
git commit -m "feat: route CSAT send through csat-processor edge function"
```

---

## Task 7: Hook `useCSATBoardConfig`

**Files:**
- Create: `src/hooks/useCSATBoardConfig.ts`

- [ ] **Step 1: Implementar hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CSATBoardConfig {
  id: string;
  board_id: string;
  enabled: boolean;
  scale_type: 'stars_1_5' | 'thumbs' | 'nps_0_10' | 'emoji';
  message_template: string;
  questions: Array<{ key: string; label: string; type: 'scale' | 'text' | 'yes_no' }>;
  send_on_close: boolean;
  delay_minutes: number;
  resend_enabled: boolean;
  resend_after_hours: number;
  max_resends: number;
  response_window_hours: number;
  ai_dimensions: string[];
  created_at: string;
  updated_at: string;
}

const DEFAULT_CONFIG: Partial<CSATBoardConfig> = {
  enabled: false,
  scale_type: 'stars_1_5',
  message_template: `📊 *Pesquisa de Satisfação — {{board}}*\n\nOlá {{nome}}! Seu atendimento (protocolo {{protocolo}}) foi concluído.\n\nComo você avalia nosso suporte?\n\n1 ⭐ — Muito insatisfeito\n2 ⭐⭐ — Insatisfeito\n3 ⭐⭐⭐ — Regular\n4 ⭐⭐⭐⭐ — Satisfeito\n5 ⭐⭐⭐⭐⭐ — Muito satisfeito\n\nResponda com o número ou envie um comentário. Obrigado! 🙏`,
  questions: [],
  send_on_close: true,
  delay_minutes: 0,
  resend_enabled: false,
  resend_after_hours: 4,
  max_resends: 1,
  response_window_hours: 48,
  ai_dimensions: ['resolucao', 'tempo', 'cordialidade'],
};

export function useCSATBoardConfig(boardId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['csat-board-config', boardId],
    queryFn: async () => {
      if (!boardId) return null;
      const { data, error } = await supabase
        .from('csat_board_configs')
        .select('*')
        .eq('board_id', boardId)
        .maybeSingle();

      if (error) throw error;
      return data as CSATBoardConfig | null;
    },
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000,
  });

  const upsert = useMutation({
    mutationFn: async (config: Partial<CSATBoardConfig>) => {
      if (!boardId) throw new Error('No board ID');

      const payload = { ...config, board_id: boardId };

      const { data, error } = await supabase
        .from('csat_board_configs')
        .upsert(payload, { onConflict: 'board_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csat-board-config', boardId] });
      toast.success('Configuração CSAT salva');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar CSAT: ${err.message}`);
    },
  });

  return {
    config: query.data,
    defaults: DEFAULT_CONFIG,
    isLoading: query.isLoading,
    save: upsert.mutate,
    isSaving: upsert.isPending,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCSATBoardConfig.ts
git commit -m "feat: add useCSATBoardConfig hook"
```

---

## Task 8: Hook `useCSATSurveys`

**Files:**
- Create: `src/hooks/useCSATSurveys.ts`

- [ ] **Step 1: Implementar hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CSATSurveyRow {
  id: string;
  conversation_id: string;
  customer_phone: string;
  status: string;
  score: number | null;
  raw_response: string | null;
  ai_analysis: {
    sentiment?: string;
    dimensions?: Record<string, number>;
    tags?: string[];
    summary?: string;
  } | null;
  responded_at: string | null;
  created_at: string;
  conversation: {
    ticket_number: string | null;
    customer_name: string | null;
    kanban_board_id: string | null;
    human_agent_id: string | null;
  } | null;
  config: {
    board: { name: string; slug: string } | null;
  } | null;
}

export interface CSATMetrics {
  avgScore: number;
  responseRate: number;
  totalSent: number;
  sentimentBreakdown: Record<string, number>;
}

export function useCSATSurveys(filters?: {
  boardId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['csat-surveys', filters],
    queryFn: async () => {
      let query = supabase
        .from('csat_surveys')
        .select(`
          *,
          conversation:ai_conversations(ticket_number, customer_name, kanban_board_id, human_agent_id),
          config:csat_board_configs(board:kanban_boards(name, slug))
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.boardId) {
        query = query.eq('config.board_id', filters.boardId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      const surveys = (data || []) as CSATSurveyRow[];

      // Calcular métricas
      const totalSent = surveys.filter(s => s.status !== 'pending').length;
      const answered = surveys.filter(s => s.status === 'answered');
      const avgScore = answered.length
        ? answered.reduce((sum, s) => sum + (s.score || 0), 0) / answered.length
        : 0;

      const sentimentBreakdown: Record<string, number> = {};
      answered.forEach(s => {
        const sent = s.ai_analysis?.sentiment || 'unknown';
        sentimentBreakdown[sent] = (sentimentBreakdown[sent] || 0) + 1;
      });

      const metrics: CSATMetrics = {
        avgScore: Math.round(avgScore * 10) / 10,
        responseRate: totalSent ? Math.round((answered.length / totalSent) * 100) : 0,
        totalSent,
        sentimentBreakdown,
      };

      return { surveys, metrics };
    },
    staleTime: 2 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCSATSurveys.ts
git commit -m "feat: add useCSATSurveys hook with metrics"
```

---

## Task 9: UI — CSATBoardConfigForm

**Files:**
- Create: `src/components/csat/CSATBoardConfigForm.tsx`
- Create: `src/components/csat/CSATQuestionBuilder.tsx`
- Create: `src/components/csat/CSATMessagePreview.tsx`

- [ ] **Step 1: Criar CSATMessagePreview**

Componente simples que renderiza preview da mensagem com dados de exemplo.

```typescript
// src/components/csat/CSATMessagePreview.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  template: string;
  boardName?: string;
}

export function CSATMessagePreview({ template, boardName = 'Suporte' }: Props) {
  const preview = template
    .replace(/\{\{nome\}\}/g, 'João Silva')
    .replace(/\{\{protocolo\}\}/g, '#12345')
    .replace(/\{\{board\}\}/g, boardName);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Preview da mensagem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
          {preview}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Criar CSATQuestionBuilder**

```typescript
// src/components/csat/CSATQuestionBuilder.tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface Question {
  key: string;
  label: string;
  type: 'scale' | 'text' | 'yes_no';
}

interface Props {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

const TYPE_LABELS = {
  scale: 'Escala (1-5)',
  text: 'Texto livre',
  yes_no: 'Sim / Não',
};

export function CSATQuestionBuilder({ questions, onChange }: Props) {
  const addQuestion = () => {
    onChange([
      ...questions,
      { key: `q${questions.length + 1}`, label: '', type: 'scale' },
    ]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'label') {
      updated[index].key = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .slice(0, 30);
    }
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Perguntas adicionais</label>
        <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma pergunta adicional. A pesquisa usará apenas a escala principal.
        </p>
      )}

      {questions.map((q, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
          <GripVertical className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Ex: A resolução foi satisfatória?"
              value={q.label}
              onChange={(e) => updateQuestion(i, 'label', e.target.value)}
            />
            <Select
              value={q.type}
              onValueChange={(v) => updateQuestion(i, 'type', v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeQuestion(i)}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Criar CSATBoardConfigForm principal**

```typescript
// src/components/csat/CSATBoardConfigForm.tsx
import { useState, useEffect } from 'react';
import { useCSATBoardConfig, CSATBoardConfig } from '@/hooks/useCSATBoardConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CSATQuestionBuilder } from './CSATQuestionBuilder';
import { CSATMessagePreview } from './CSATMessagePreview';
import { Save } from 'lucide-react';

interface Props {
  boardId: string;
  boardName: string;
}

const SCALE_OPTIONS = [
  { value: 'stars_1_5', label: 'Estrelas 1-5 ⭐' },
  { value: 'thumbs', label: 'Positivo/Negativo 👍👎' },
  { value: 'nps_0_10', label: 'NPS 0-10' },
  { value: 'emoji', label: 'Emojis 😡😕😐🙂😍' },
];

export function CSATBoardConfigForm({ boardId, boardName }: Props) {
  const { config, defaults, isLoading, save, isSaving } = useCSATBoardConfig(boardId);
  const [form, setForm] = useState<Partial<CSATBoardConfig>>({});

  useEffect(() => {
    setForm(config || defaults);
  }, [config]);

  const update = <K extends keyof CSATBoardConfig>(key: K, value: CSATBoardConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    save(form);
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Ativar */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Pesquisa CSAT</Label>
          <p className="text-sm text-muted-foreground">
            Enviar pesquisa de satisfação ao finalizar conversas neste board
          </p>
        </div>
        <Switch checked={form.enabled || false} onCheckedChange={(v) => update('enabled', v)} />
      </div>

      {form.enabled && (
        <>
          <Separator />

          {/* Escala */}
          <div className="space-y-2">
            <Label>Tipo de escala</Label>
            <Select value={form.scale_type} onValueChange={(v) => update('scale_type', v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template da mensagem */}
          <div className="space-y-2">
            <Label>Mensagem da pesquisa</Label>
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {'{{nome}}'}, {'{{protocolo}}'}, {'{{board}}'}
            </p>
            <Textarea
              value={form.message_template || ''}
              onChange={(e) => update('message_template', e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>

          {/* Preview */}
          <CSATMessagePreview template={form.message_template || ''} boardName={boardName} />

          <Separator />

          {/* Timing */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Envio e Timing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enviar ao fechar conversa</Label>
                <Switch
                  checked={form.send_on_close ?? true}
                  onCheckedChange={(v) => update('send_on_close', v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Delay antes do envio (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.delay_minutes ?? 0}
                    onChange={(e) => update('delay_minutes', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Janela de resposta (horas)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.response_window_hours ?? 48}
                    onChange={(e) => update('response_window_hours', parseInt(e.target.value) || 48)}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Label>Reenviar se sem resposta</Label>
                <Switch
                  checked={form.resend_enabled || false}
                  onCheckedChange={(v) => update('resend_enabled', v)}
                />
              </div>

              {form.resend_enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Reenviar após (horas)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.resend_after_hours ?? 4}
                      onChange={(e) => update('resend_after_hours', parseInt(e.target.value) || 4)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Máximo de reenvios</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={form.max_resends ?? 1}
                      onChange={(e) => update('max_resends', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Perguntas adicionais */}
          <CSATQuestionBuilder
            questions={(form.questions as any[]) || []}
            onChange={(q) => update('questions', q as any)}
          />

          <Separator />

          {/* Dimensões IA */}
          <div className="space-y-2">
            <Label>Dimensões para classificação IA</Label>
            <p className="text-xs text-muted-foreground">
              Separadas por vírgula. A IA avaliará cada dimensão na resposta do cliente.
            </p>
            <Input
              value={(form.ai_dimensions || []).join(', ')}
              onChange={(e) =>
                update(
                  'ai_dimensions',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                )
              }
              placeholder="resolucao, tempo, cordialidade"
            />
          </div>
        </>
      )}

      {/* Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/csat/
git commit -m "feat(ui): add CSAT board config form with question builder and preview"
```

---

## Task 10: UI — Integrar Config CSAT no Settings do Board

**Files:**
- Modify: `src/components/settings/KanbanAndStagesTab.tsx`

- [ ] **Step 1: Adicionar botão "CSAT" nos cards de board**

Na seção `BoardsSection` (~line 132), ao lado do botão "Configurar Etapas", adicionar:

```typescript
import { CSATBoardConfigForm } from '@/components/csat/CSATBoardConfigForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3 } from 'lucide-react';

// State no componente pai:
const [csatBoardId, setCsatBoardId] = useState<string | null>(null);
const [csatBoardName, setCsatBoardName] = useState('');

// Botão no card do board (ao lado de "Configurar Etapas"):
<Button
  variant="outline"
  size="sm"
  className="gap-1"
  onClick={() => {
    setCsatBoardId(board.id);
    setCsatBoardName(board.name);
  }}
>
  <BarChart3 className="h-3 w-3" /> CSAT
</Button>

// Dialog:
<Dialog open={!!csatBoardId} onOpenChange={(open) => !open && setCsatBoardId(null)}>
  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Configuração CSAT — {csatBoardName}</DialogTitle>
    </DialogHeader>
    {csatBoardId && (
      <CSATBoardConfigForm boardId={csatBoardId} boardName={csatBoardName} />
    )}
  </DialogContent>
</Dialog>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/KanbanAndStagesTab.tsx
git commit -m "feat(ui): add CSAT config button on board cards"
```

---

## Task 11: UI — Dashboard CSAT na Evaluations

**Files:**
- Create: `src/components/csat/CSATDashboardTab.tsx`
- Modify: `src/pages/Evaluations.tsx`

- [ ] **Step 1: Criar CSATDashboardTab**

```typescript
// src/components/csat/CSATDashboardTab.tsx
import { useState } from 'react';
import { useCSATSurveys } from '@/hooks/useCSATSurveys';
import { useKanbanBoards } from '@/hooks/useKanbanBoards';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Send, SmilePlus } from 'lucide-react';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  neutral: 'bg-gray-100 text-gray-700',
  negative: 'bg-red-100 text-red-700',
  mixed: 'bg-yellow-100 text-yellow-700',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positivo',
  neutral: 'Neutro',
  negative: 'Negativo',
  mixed: 'Misto',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviada',
  resent: 'Reenviada',
  processing: 'Processando',
  answered: 'Respondida',
  expired: 'Expirada',
};

export function CSATDashboardTab() {
  const [boardFilter, setBoardFilter] = useState<string>('all');
  const { data: boardsData } = useKanbanBoards();
  const boards = boardsData || [];

  const { data, isLoading } = useCSATSurveys(
    boardFilter !== 'all' ? { boardId: boardFilter } : undefined
  );

  const metrics = data?.metrics;
  const surveys = data?.surveys || [];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex gap-3">
        <Select value={boardFilter} onValueChange={setBoardFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por board" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os boards</SelectItem>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics?.avgScore || '—'}</p>
              <p className="text-xs text-muted-foreground">Score médio</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics?.responseRate || 0}%</p>
              <p className="text-xs text-muted-foreground">Taxa de resposta</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics?.totalSent || 0}</p>
              <p className="text-xs text-muted-foreground">Pesquisas enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <SmilePlus className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {metrics?.sentimentBreakdown
                  ? Object.entries(metrics.sentimentBreakdown)
                      .sort(([, a], [, b]) => b - a)[0]?.[0]
                      ? SENTIMENT_LABELS[
                          Object.entries(metrics.sentimentBreakdown).sort(([, a], [, b]) => b - a)[0][0]
                        ] || '—'
                      : '—'
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Sentimento predominante</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : surveys.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma pesquisa CSAT encontrada.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conversa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Board</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Sentimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    {s.conversation?.ticket_number || s.conversation_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{s.conversation?.customer_name || s.customer_phone}</TableCell>
                  <TableCell>{s.config?.board?.name || '—'}</TableCell>
                  <TableCell>
                    {s.score != null ? (
                      <span className="font-semibold">{s.score}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {s.ai_analysis?.sentiment ? (
                      <Badge variant="secondary" className={SENTIMENT_COLORS[s.ai_analysis.sentiment]}>
                        {SENTIMENT_LABELS[s.ai_analysis.sentiment]}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABELS[s.status] || s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar aba CSAT na Evaluations**

No arquivo `src/pages/Evaluations.tsx`, adicionar a 4ª tab:

```typescript
import { CSATDashboardTab } from '@/components/csat/CSATDashboardTab';

// Na lista de tabs (~line 255), adicionar:
<TabsTrigger value="csat">CSAT</TabsTrigger>

// No conteúdo das tabs (~line 487), adicionar:
<TabsContent value="csat">
  <CSATDashboardTab />
</TabsContent>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/csat/CSATDashboardTab.tsx src/pages/Evaluations.tsx
git commit -m "feat(ui): add CSAT dashboard tab in Evaluations page"
```

---

## Task 12: Ajustar CloseConversationDialog

**Files:**
- Modify: `src/components/inbox/CloseConversationDialog.tsx`

- [ ] **Step 1: Usar config CSAT do board para controlar visibilidade do toggle**

O toggle CSAT só deve aparecer se o board da conversa tem CSAT ativo. Adicionar prop `boardId` e usar `useCSATBoardConfig`:

```typescript
import { useCSATBoardConfig } from '@/hooks/useCSATBoardConfig';

// Adicionar prop:
interface Props {
  // ... existentes
  boardId?: string;
}

// Dentro do componente:
const { config: csatConfig } = useCSATBoardConfig(boardId);
const csatAvailable = isWhatsApp && csatConfig?.enabled && csatConfig?.send_on_close;

// Substituir a condição do toggle:
// De: {isWhatsApp && (...toggle...)}
// Para: {csatAvailable && (...toggle...)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inbox/CloseConversationDialog.tsx
git commit -m "feat(ui): CSAT toggle respects board-level config"
```

---

## Task 13: Deploy da Edge Function

**Files:**
- Deploy: `supabase/functions/csat-processor`

- [ ] **Step 1: Deploy via Supabase MCP**

```
mcp__claude_ai_Supabase__deploy_edge_function
  name: csat-processor
```

- [ ] **Step 2: Configurar pg_cron para process-pending**

Via Supabase MCP execute SQL:

```sql
SELECT cron.schedule(
  'csat-process-pending',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/csat-processor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"action": "process-pending"}'::jsonb
  )$$
);
```

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: complete CSAT board-parameterized survey system"
```
