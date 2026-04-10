# Agent System Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 critical bugs (IA silence, fake high-demand msg, no AI resume, static priority) and add monitoring, feedback CTA, and senior-level agent prompts.

**Architecture:** Backend-first fixes in Edge Functions (agent-executor, process-incoming-message, check-inactive-conversations), new DB tables for monitoring and corrections, enriched summarization, then frontend components.

**Tech Stack:** Deno Edge Functions, Supabase PostgreSQL, React 18 + TypeScript, shadcn/ui, TanStack Query, OpenRouter (gemini-2.5-flash-preview)

**Spec:** `docs/superpowers/specs/2026-04-02-agent-system-overhaul-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/_shared/dead-letter.ts` | Dead letter handler — ensures client always gets a response |
| `supabase/functions/_shared/queue-analyzer.ts` | Analyzes real queue state before sending demand messages |
| `supabase/functions/_shared/action-logger.ts` | Logs all agent actions to ai_action_logs |
| `src/components/conversation/ResponseFeedback.tsx` | CTA button + popover for marking AI responses as incorrect |
| `src/components/monitoring/MonitoringPanel.tsx` | Real-time monitoring panel for agent actions |
| `src/components/monitoring/ActionTimeline.tsx` | Timeline feed of agent events |
| `src/components/monitoring/ModelHealthIndicator.tsx` | Model status indicators |
| `src/components/monitoring/ErrorAlertBadge.tsx` | Header badge for unread errors |
| `src/hooks/useActionLogs.ts` | Hook for fetching/subscribing to ai_action_logs |
| `src/hooks/useResponseCorrections.ts` | Hook for CRUD on ai_response_corrections |

### Modified Files
| File | Change |
|------|--------|
| `supabase/functions/agent-executor/index.ts:707-720` | Use callOpenRouterWithFallback + dead letter handler |
| `supabase/functions/process-incoming-message/index.ts:919-933` | Replace hardcoded queue msg with real queue analysis |
| `supabase/functions/check-inactive-conversations/index.ts:8-11` | Reduce timeouts to 3/7 min for human handler |
| `supabase/functions/summarize-conversation/index.ts:113-160` | Enrich output with suggestions + satisfaction score |
| `supabase/functions/_shared/openrouter-client.ts:48-71` | Extend logApiCall to also write ai_action_logs |
| `src/components/conversation/MessageList.tsx:12-42` | Add feedback button on AI messages |
| `src/pages/Dashboard.tsx:214-303` | Add Monitoring tab |
| `src/components/layout/Header.tsx` | Add ErrorAlertBadge |

---

## Phase 1: Database Migrations (foundation)

### Task 1: Create ai_action_logs table

**Files:**
- Create: migration via Supabase MCP

- [ ] **Step 1: Apply migration for ai_action_logs**

```sql
CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success',
  model TEXT,
  duration_ms INTEGER,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_read BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_action_logs_created ON public.ai_action_logs(created_at DESC);
CREATE INDEX idx_action_logs_status ON public.ai_action_logs(status, created_at DESC);
CREATE INDEX idx_action_logs_conversation ON public.ai_action_logs(conversation_id, created_at DESC);
CREATE INDEX idx_action_logs_errors ON public.ai_action_logs(created_at DESC) WHERE status IN ('error', 'timeout');
CREATE INDEX idx_action_logs_unread ON public.ai_action_logs(notification_read, created_at DESC) WHERE notification_read = false AND status IN ('error', 'timeout');

ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read action logs"
  ON public.ai_action_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert action logs"
  ON public.ai_action_logs FOR INSERT TO service_role WITH CHECK (true);
```

- [ ] **Step 2: Verify table created**

Run: query `SELECT count(*) FROM ai_action_logs` — should return 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): create ai_action_logs table for monitoring"
```

---

### Task 2: Create ai_response_corrections table

**Files:**
- Create: migration via Supabase MCP

- [ ] **Step 1: Apply migration for ai_response_corrections**

```sql
CREATE TABLE IF NOT EXISTS public.ai_response_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_id UUID NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  corrected_by UUID NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN (
    'incorrect_info', 'wrong_tone', 'missed_question', 'hallucination', 'other'
  )),
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  notes TEXT,
  applied_to_training BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_corrections_agent ON public.ai_response_corrections(agent_id, created_at DESC);
CREATE INDEX idx_corrections_conversation ON public.ai_response_corrections(conversation_id);
CREATE INDEX idx_corrections_type ON public.ai_response_corrections(error_type);

ALTER TABLE public.ai_response_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read corrections"
  ON public.ai_response_corrections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and leaders can insert corrections"
  ON public.ai_response_corrections FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'leader')
    )
  );
```

- [ ] **Step 2: Verify table and RLS**

Run: query `SELECT count(*) FROM ai_response_corrections` — should return 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): create ai_response_corrections table for feedback CTA"
```

---

## Phase 2: Shared Utilities (backend building blocks)

### Task 3: Create action-logger.ts

**Files:**
- Create: `supabase/functions/_shared/action-logger.ts`

- [ ] **Step 1: Create the action logger utility**

```typescript
// supabase/functions/_shared/action-logger.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export type ActionType =
  | 'llm_call'
  | 'llm_fallback'
  | 'tool_call'
  | 'orchestrator_decision'
  | 'escalation'
  | 'dead_letter'
  | 'priority_change'
  | 'automation_trigger'
  | 'human_takeover'
  | 'ai_resume'

export interface LogActionParams {
  conversationId?: string
  actionType: ActionType
  agentId?: string
  status: 'success' | 'error' | 'timeout' | 'fallback'
  model?: string
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  errorMessage?: string
  details?: Record<string, unknown>
}

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key)
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const sb = getSupabase()
    if (!sb) return

    await sb.from('ai_action_logs').insert({
      conversation_id: params.conversationId || null,
      action_type: params.actionType,
      agent_id: params.agentId || null,
      status: params.status,
      model: params.model || null,
      duration_ms: params.durationMs || null,
      tokens_in: params.tokensIn || 0,
      tokens_out: params.tokensOut || 0,
      cost_usd: params.costUsd || 0,
      error_message: params.errorMessage || null,
      details: params.details || {},
      notification_sent: params.status === 'error' || params.status === 'timeout',
    })
  } catch (err) {
    console.warn('[action-logger] Failed to log:', (err as Error).message)
  }
}

/** Log and return — convenience for fire-and-forget */
export function logActionAsync(params: LogActionParams): void {
  logAction(params).catch(() => {})
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/action-logger.ts
git commit -m "feat(shared): add action-logger for monitoring all agent actions"
```

---

### Task 4: Create queue-analyzer.ts

**Files:**
- Create: `supabase/functions/_shared/queue-analyzer.ts`

- [ ] **Step 1: Create the queue analyzer utility**

```typescript
// supabase/functions/_shared/queue-analyzer.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface QueueState {
  waitingCount: number
  inProgressCount: number
  availableAgents: number
  totalOnlineAgents: number
  estimatedWaitMinutes: number
  demandLevel: 'low' | 'medium' | 'high'
}

export interface QueueMessage {
  text: string
  demandLevel: QueueState['demandLevel']
}

const AVG_SERVICE_MINUTES = 15

export async function analyzeQueue(supabase: ReturnType<typeof createClient>): Promise<QueueState> {
  const [queueResult, agentsResult] = await Promise.all([
    supabase
      .from('ai_conversations')
      .select('id, status', { count: 'exact', head: false })
      .eq('handler_type', 'human')
      .eq('is_discarded', false)
      .in('status', ['aguardando', 'em_atendimento']),

    supabase
      .from('human_agents')
      .select('id, current_conversations_count, max_concurrent_conversations')
      .eq('is_online', true)
      .eq('is_active', true),
  ])

  const conversations = queueResult.data || []
  const agents = agentsResult.data || []

  const waitingCount = conversations.filter(c => c.status === 'aguardando').length
  const inProgressCount = conversations.filter(c => c.status === 'em_atendimento').length

  const availableAgents = agents.filter(
    a => (a.current_conversations_count || 0) < (a.max_concurrent_conversations || 5)
  ).length

  const totalOnlineAgents = agents.length

  const estimatedWaitMinutes = availableAgents > 0
    ? Math.ceil(waitingCount / availableAgents) * AVG_SERVICE_MINUTES
    : waitingCount * AVG_SERVICE_MINUTES

  let demandLevel: QueueState['demandLevel'] = 'low'
  if (waitingCount >= 6 || availableAgents === 0) demandLevel = 'high'
  else if (waitingCount >= 3) demandLevel = 'medium'

  return {
    waitingCount,
    inProgressCount,
    availableAgents,
    totalOnlineAgents,
    estimatedWaitMinutes,
    demandLevel,
  }
}

export function buildQueueMessage(state: QueueState): QueueMessage {
  if (state.availableAgents === 0 && state.totalOnlineAgents === 0) {
    return {
      text: '🕐 Nosso time está sendo acionado. Enquanto isso, continue comigo que vou te ajudando!',
      demandLevel: 'high',
    }
  }

  if (state.demandLevel === 'low') {
    return {
      text: '✅ Você será atendido em instantes! Enquanto isso, posso te ajudar com algo?',
      demandLevel: 'low',
    }
  }

  if (state.demandLevel === 'medium') {
    return {
      text: `⏳ Nosso time já está ciente do seu chamado. Tempo estimado: ~${state.estimatedWaitMinutes} minutos.`,
      demandLevel: 'medium',
    }
  }

  return {
    text: `⏳ Estamos com volume acima do normal no momento. Tempo estimado: ~${state.estimatedWaitMinutes} minutos. Agradecemos a paciência!`,
    demandLevel: 'high',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/queue-analyzer.ts
git commit -m "feat(shared): add queue-analyzer for real demand verification"
```

---

### Task 5: Create dead-letter.ts

**Files:**
- Create: `supabase/functions/_shared/dead-letter.ts`

- [ ] **Step 1: Create the dead letter handler**

```typescript
// supabase/functions/_shared/dead-letter.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { logAction } from "./action-logger.ts"

const DEAD_LETTER_MESSAGE =
  'Recebi sua mensagem! 😊 Estou verificando internamente e já retorno com a resposta. Um momento, por favor!'

/**
 * Called when the entire LLM pipeline fails.
 * Ensures the client ALWAYS gets a response, even on total failure.
 */
export async function handleDeadLetter(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  customerPhone: string,
  chatId: string | null,
  instanceId: string | null,
  channel: string | null,
  channelInstanceId: string | null,
  errors: string[],
  agentId?: string,
): Promise<void> {
  console.error(`[dead-letter] Pipeline failed for conversation ${conversationId}. Errors:`, errors)

  // 1. Log to monitoring as CRITICAL
  await logAction({
    conversationId,
    actionType: 'dead_letter',
    agentId,
    status: 'error',
    errorMessage: errors.join(' | '),
    details: { errors, timestamp: new Date().toISOString() },
  })

  // 2. Save a system message so the conversation isn't empty
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: DEAD_LETTER_MESSAGE,
    intent: 'dead_letter',
  }).catch(err => console.error('[dead-letter] Failed to save message:', err))

  // 3. Send message to client via WhatsApp
  // Import sendTextViaWhatsApp dynamically to avoid circular deps
  try {
    const { sendTextViaWhatsApp } = await import("./channel-router.ts")
    await sendTextViaWhatsApp(
      supabase,
      customerPhone,
      chatId,
      DEAD_LETTER_MESSAGE,
      'dead-letter',
      instanceId,
      channel,
      channelInstanceId,
      conversationId,
    )
  } catch (err) {
    console.error('[dead-letter] Failed to send WhatsApp message:', err)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/dead-letter.ts
git commit -m "feat(shared): add dead-letter handler — no more silent failures"
```

---

## Phase 3: Backend Pipeline Fixes

### Task 6: Fix agent-executor — use fallback chain + dead letter

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts:707-720`

- [ ] **Step 1: Add imports at top of agent-executor**

At the top of `supabase/functions/agent-executor/index.ts`, add after existing imports:

```typescript
import { logAction, logActionAsync } from "../_shared/action-logger.ts"
import { handleDeadLetter } from "../_shared/dead-letter.ts"
```

- [ ] **Step 2: Replace direct callOpenRouter with fallback chain**

Replace lines 707-720 (the LLM call section):

**Old code (lines 707-720):**
```typescript
    // 7. Chamar LLM via OpenRouter — modelo do agente ou fallback do DB
    const fallbackConfig = await getModelConfig(supabase, 'agent_executor', 'google/gemini-2.0-flash-lite-001')
    const activeModel = agent.model || fallbackConfig.model

    console.log(`[agent-executor] Calling LLM (${activeModel}), ${llmMessages.length} messages, ${ragDocuments.length} RAG docs`)

    const llmResult = await callOpenRouter({
      model: activeModel,
      messages: llmMessages,
      temperature: agent.temperature || 0.3,
      max_tokens: agent.max_tokens || 1000,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    })
```

**New code:**
```typescript
    // 7. Chamar LLM via OpenRouter — cadeia de fallback para NUNCA falhar silenciosamente
    const primaryModel = agent.model || 'google/gemini-2.5-flash-preview'
    const fallbackModels = [
      primaryModel,
      'google/gemini-2.0-flash-lite-001',
      'anthropic/claude-haiku-4-5-20251001',
    ]
    // Deduplicate (if primary is already in the list)
    const uniqueModels = [...new Set(fallbackModels)]

    console.log(`[agent-executor] Calling LLM chain [${uniqueModels.join(' → ')}], ${llmMessages.length} msgs, ${ragDocuments.length} RAG docs`)

    const llmStartTime = Date.now()
    let llmResult: ChatResult
    try {
      llmResult = await callOpenRouterWithFallback({
        models: uniqueModels,
        messages: llmMessages,
        temperature: agent.temperature || 0.3,
        max_tokens: agent.max_tokens || 1000,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        _logContext: { edgeFunction: 'agent-executor', conversationId: conversation_id, agentId: agent_id },
      })

      // Log which model was actually used
      if (llmResult.model_used !== primaryModel) {
        logActionAsync({
          conversationId: conversation_id,
          actionType: 'llm_fallback',
          agentId: agent_id,
          status: 'fallback',
          model: llmResult.model_used,
          durationMs: Date.now() - llmStartTime,
          details: { primary_model: primaryModel, used_model: llmResult.model_used },
        })
      }

      logActionAsync({
        conversationId: conversation_id,
        actionType: 'llm_call',
        agentId: agent_id,
        status: 'success',
        model: llmResult.model_used,
        durationMs: Date.now() - llmStartTime,
        tokensIn: llmResult.usage.prompt_tokens,
        tokensOut: llmResult.usage.completion_tokens,
        costUsd: llmResult.cost_usd,
      })
    } catch (pipelineError) {
      // ALL models failed — dead letter handler
      console.error(`[agent-executor] All models failed for ${conversation_id}:`, pipelineError)

      await handleDeadLetter(
        supabase,
        conversation_id,
        conversationData?.customer_phone || '',
        conversationData?.uazapi_chat_id || null,
        conversationData?.whatsapp_instance_id || null,
        conversationData?.communication_channel || null,
        conversationData?.channel_instance_id || null,
        [(pipelineError as Error).message],
        agent_id,
      )

      return new Response(JSON.stringify({
        action: 'dead_letter',
        reason: 'All LLM models failed',
        message_sent: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
```

- [ ] **Step 3: Add import for callOpenRouterWithFallback**

At the top of agent-executor, ensure this import exists:

```typescript
import { callOpenRouter, callOpenRouterWithFallback, type ChatResult } from "../_shared/openrouter-client.ts"
```

- [ ] **Step 4: Test by deploying and sending a test message**

Run: `supabase functions deploy agent-executor`
Test: Send a WhatsApp message and verify the agent responds.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "fix(agent-executor): use fallback chain + dead letter — never silent"
```

---

### Task 7: Fix process-incoming-message — real queue analysis

**Files:**
- Modify: `supabase/functions/process-incoming-message/index.ts:919-933`

- [ ] **Step 1: Add import at top of process-incoming-message**

```typescript
import { analyzeQueue, buildQueueMessage } from "../_shared/queue-analyzer.ts"
import { logActionAsync } from "../_shared/action-logger.ts"
```

- [ ] **Step 2: Replace hardcoded queue message**

Replace lines 919-933 (the queue notice section):

**Old code:**
```typescript
          // Mensagem de tempo de espera na fila
          const queueNotice = '⏳ Estamos com alta demanda no momento, mas fique tranquilo — ' +
            'em breve um de nossos atendentes vai te responder. Agradecemos a paciência!'

          await sendTextViaWhatsApp(
            supabase,
            conversation.customer_phone,
            conversation.uazapi_chat_id,
            queueNotice,
            'process-incoming/queue-wait-notice',
            conversation.whatsapp_instance_id,
            conversation.communication_channel,
            conversation.channel_instance_id,
            conversation_id
          ).catch(err => console.error('[process-incoming] Queue notice send error:', err))
```

**New code:**
```typescript
          // Analisar fila REAL antes de enviar mensagem de demanda
          const queueState = await analyzeQueue(supabase)
          const queueMsg = buildQueueMessage(queueState)

          logActionAsync({
            conversationId: conversation_id,
            actionType: 'escalation',
            status: 'success',
            details: {
              queue_waiting: queueState.waitingCount,
              queue_in_progress: queueState.inProgressCount,
              available_agents: queueState.availableAgents,
              demand_level: queueState.demandLevel,
              estimated_wait: queueState.estimatedWaitMinutes,
            },
          })

          await sendTextViaWhatsApp(
            supabase,
            conversation.customer_phone,
            conversation.uazapi_chat_id,
            queueMsg.text,
            'process-incoming/queue-wait-notice',
            conversation.whatsapp_instance_id,
            conversation.communication_channel,
            conversation.channel_instance_id,
            conversation_id
          ).catch(err => console.error('[process-incoming] Queue notice send error:', err))
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/process-incoming-message/index.ts
git commit -m "fix(pipeline): verify real queue state before sending demand message"
```

---

### Task 8: Fix check-inactive-conversations — AI resume after human absence

**Files:**
- Modify: `supabase/functions/check-inactive-conversations/index.ts:8-11, 39-44`

- [ ] **Step 1: Update default timeouts**

Replace lines 8-11:

**Old:**
```typescript
const DEFAULT_FIRST_FOLLOWUP_MINUTES = 15
const DEFAULT_SECOND_FOLLOWUP_MINUTES = 45
const DEFAULT_CLOSE_MINUTES = 120
```

**New:**
```typescript
const DEFAULT_FIRST_FOLLOWUP_MINUTES = 3
const DEFAULT_SECOND_FOLLOWUP_MINUTES = 7
const DEFAULT_CLOSE_MINUTES = 120
```

- [ ] **Step 2: Add query for human-handler conversations awaiting response**

After the existing AI conversation query (line 44), add a new section to handle conversations waiting for human:

```typescript
    // Buscar conversas aguardando humano que não receberam resposta
    const { data: humanWaitConvs } = await supabase
      .from('ai_conversations')
      .select('id, customer_phone, uazapi_chat_id, current_agent_id, started_at, queue_entered_at, whatsapp_instance_id, communication_channel, channel_instance_id')
      .eq('status', 'aguardando')
      .eq('handler_type', 'human')
      .eq('is_discarded', false)

    if (humanWaitConvs && humanWaitConvs.length > 0) {
      const now = new Date()
      for (const conv of humanWaitConvs) {
        const queueTime = conv.queue_entered_at ? new Date(conv.queue_entered_at) : new Date(conv.started_at)
        const waitMinutes = (now.getTime() - queueTime.getTime()) / 60000

        if (waitMinutes >= DEFAULT_SECOND_FOLLOWUP_MINUTES) {
          // 7+ min: IA retoma completamente
          console.log(`[check-inactive] AI resuming conversation ${conv.id} after ${Math.round(waitMinutes)}min without human response`)

          await supabase
            .from('ai_conversations')
            .update({ handler_type: 'ai', status: 'em_atendimento' })
            .eq('id', conv.id)

          // Enviar mensagem de retomada
          const resumeMsg = 'Vou continuar te auxiliando enquanto nosso time se organiza. 😊 Como posso te ajudar?'
          await sendFollowupMessage(supabase, conv, resumeMsg)

          actioned++
        } else if (waitMinutes >= DEFAULT_FIRST_FOLLOWUP_MINUTES) {
          // 3+ min: IA oferece ajuda enquanto aguarda
          const offerMsg = 'Nosso time já recebeu seu chamado! Enquanto aguardamos, posso te ajudar com algo? 😊'
          await sendFollowupMessage(supabase, conv, offerMsg)

          actioned++
        }
      }
    }
```

- [ ] **Step 3: Add import for action logger**

```typescript
import { logActionAsync } from "../_shared/action-logger.ts"
```

At the AI resume section, add logging:

```typescript
          logActionAsync({
            conversationId: conv.id,
            actionType: 'ai_resume',
            status: 'success',
            details: { wait_minutes: Math.round(waitMinutes), reason: 'human_timeout' },
          })
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/check-inactive-conversations/index.ts
git commit -m "fix(inactive): AI resumes after 3/7min human absence — no more stuck conversations"
```

---

### Task 9: Enrich summarize-conversation with suggestions + satisfaction

**Files:**
- Modify: `supabase/functions/summarize-conversation/index.ts:113-160`

- [ ] **Step 1: Update the summarization prompt**

Replace the system prompt section (around line 113-114):

**Old:**
```typescript
    const systemPrompt = 'Resuma a conversa de suporte em 2-4 frases...'
```

**New:**
```typescript
    const systemPrompt = `Você é um analista de suporte sênior. Analise a conversa e retorne um JSON com:

{
  "summary": "Resumo de 2-4 frases do problema e status atual",
  "satisfaction_score": 0.0,
  "suggested_responses": ["sugestão 1", "sugestão 2", "sugestão 3"],
  "next_steps": "Próximo passo recomendado",
  "customer_emotion": "neutral"
}

Regras:
- satisfaction_score: -1.0 (muito irritado) a 1.0 (muito satisfeito). Baseie-se no tom das mensagens do cliente.
- suggested_responses: 3 respostas concretas que o agente poderia usar agora. Não genéricas — baseadas no contexto real.
- customer_emotion: "frustrated", "angry", "neutral", "satisfied", "happy"
- next_steps: ação específica recomendada baseada no contexto
- Retorne APENAS o JSON, sem markdown.`
```

- [ ] **Step 2: Parse the enriched response**

After the LLM call, replace the summary extraction with JSON parsing:

```typescript
    let enrichedSummary = {
      summary: '',
      satisfaction_score: 0,
      suggested_responses: [] as string[],
      next_steps: '',
      customer_emotion: 'neutral',
    }

    try {
      const rawContent = summaryResult.content || ''
      // Try to parse as JSON, fall back to plain text
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      enrichedSummary = JSON.parse(cleaned)
    } catch {
      // If LLM returned plain text, use it as summary
      enrichedSummary.summary = summaryResult.content || previousSummary || ''
    }
```

- [ ] **Step 3: Auto-escalate priority on dissatisfaction**

After saving the summary, add priority escalation:

```typescript
    // Auto-escalate priority if customer is dissatisfied
    if (enrichedSummary.satisfaction_score < -0.3) {
      const newPriority = enrichedSummary.satisfaction_score < -0.7 ? 'critical' : 'high'
      const newScore = enrichedSummary.satisfaction_score < -0.7 ? 90 : 75

      await supabase
        .from('ai_conversations')
        .update({
          priority: newPriority,
          priority_score: newScore,
          tags: supabase.rpc('array_append_unique', {
            arr: 'tags',
            val: 'insatisfeito',
          }),
        })
        .eq('id', conversation_id)
        .lt('priority_score', newScore) // Only escalate, never downgrade

      logActionAsync({
        conversationId: conversation_id,
        actionType: 'priority_change',
        status: 'success',
        details: {
          new_priority: newPriority,
          new_score: newScore,
          satisfaction_score: enrichedSummary.satisfaction_score,
          customer_emotion: enrichedSummary.customer_emotion,
        },
      })
    }
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/summarize-conversation/index.ts
git commit -m "feat(summary): enrich with suggestions, satisfaction score, auto-priority"
```

---

## Phase 4: Agent Prompts & Config Updates

### Task 10: Update agent models and priorities via SQL

**Files:**
- Execute via Supabase MCP

- [ ] **Step 1: Update all agent models to gemini-2.5-flash-preview**

```sql
-- Update active agents to new model
UPDATE ai_agents
SET model = 'google/gemini-2.5-flash-preview'
WHERE is_active = true
  AND channel_type = 'whatsapp';

-- Update copilots too
UPDATE ai_agents
SET model = 'google/gemini-2.5-flash-preview'
WHERE name IN ('AXEL', 'ORION');

-- Fix priorities (Renan retention = 85, MAX = 80, Maya onboarding = 60, KIRA financial = 70)
UPDATE ai_agents SET priority = 85 WHERE name = 'Renan';
UPDATE ai_agents SET priority = 80 WHERE name = 'MAX';
UPDATE ai_agents SET priority = 60 WHERE name = 'Maya';

-- Reactivate KIRA with new priority
UPDATE ai_agents
SET is_active = true, priority = 70, model = 'google/gemini-2.5-flash-preview'
WHERE name = 'KIRA';
```

- [ ] **Step 2: Verify updates**

```sql
SELECT name, specialty, is_active, priority, model
FROM ai_agents
ORDER BY priority DESC;
```

Expected: Lino(90), Renan(85), MAX(80), KIRA(70), Maya(60), AXEL(50), ORION(50).

- [ ] **Step 3: Commit migration note**

```bash
git commit --allow-empty -m "chore(agents): update models to gemini-2.5-flash, fix priorities, reactivate KIRA"
```

---

### Task 11: Update agent prompts with senior expertise + cordialidade

**Files:**
- Execute via Supabase MCP (UPDATE ai_agents SET system_prompt)

- [ ] **Step 1: Build the shared prompt blocks**

These blocks will be PREPENDED to each agent's existing system_prompt:

```sql
-- Bloco de cordialidade (será adicionado a TODOS os agentes WhatsApp)
-- Salvar em variável para reuso
DO $$
DECLARE
  cordialidade_block TEXT := '
## REGRAS DE CORDIALIDADE (INVIOLÁVEIS)

1. **PRIMEIRA MENSAGEM** — sempre cumprimente pelo nome (se disponível), pergunte como pode ajudar, e demonstre genuíno interesse.
   Exemplo: "Olá, [Nome]! Que bom falar com você! 😊 Como posso te ajudar hoje?"

2. **DURANTE O ATENDIMENTO** — seja paciente, nunca demonstre irritação, reconheça frustrações do cliente, use linguagem positiva e empática. Se o cliente repetir uma pergunta, responda com a mesma boa vontade.

3. **ENCERRAMENTO** — sempre agradeça, pergunte se há mais algo, e deseje algo positivo.
   Exemplo: "Foi um prazer te ajudar! Se precisar de qualquer coisa, é só me chamar. Tenha um ótimo dia! 😊"

4. **NUNCA** deixe o cliente sem resposta. Se não souber, diga que vai verificar. Se o sistema falhar, avise que está investigando.

5. **ADAPTE** o tom ao humor do cliente — se frustrado, reconheça primeiro ("Entendo sua frustração..."). Se animado, compartilhe o entusiasmo.

## EXPERTISE DE AGENTE SÊNIOR (20+ ANOS)

1. **CONHECIMENTO PROFUNDO** — você conhece cada funcionalidade, atalho e limitação dos produtos Sismais. Quando a KB não tem a resposta, use seu conhecimento para guiar o cliente.

2. **ANÁLISE DE HISTÓRICO** — SEMPRE revise o histórico da conversa e tickets anteriores ANTES de responder. Não peça informações que o cliente já forneceu.

3. **DIAGNÓSTICO PROATIVO** — não espere o cliente descrever tudo. Faça perguntas diagnósticas inteligentes. Antecipe problemas relacionados.

4. **RESOLUÇÃO NA PRIMEIRA INTERAÇÃO** — priorize resolver sem escalar. Escale apenas para: bug confirmado, acesso a sistema que não tem, decisão financeira/jurídica.

5. **FOLLOW-UP** — se o problema é complexo, informe os próximos passos claros e prazos realistas.

6. **EMPATIA GENUÍNA** — entenda que o cliente pode estar perdendo dinheiro ou tempo. Trate com a urgência apropriada.

## IDENTIFICAÇÃO DO CLIENTE (PRIMEIRA INTERAÇÃO)
Se o cliente ainda não foi identificado, peça CNPJ ou nome da empresa de forma natural:
"Para eu te ajudar melhor, pode me informar o CNPJ ou nome da sua empresa?"
';

  senior_block TEXT;
BEGIN
  -- Lino: prepend ao prompt existente
  UPDATE ai_agents
  SET system_prompt = cordialidade_block || E'\n\n' || system_prompt
  WHERE name = 'Lino' AND system_prompt NOT LIKE '%REGRAS DE CORDIALIDADE%';

  -- MAX: prepend ao prompt existente
  UPDATE ai_agents
  SET system_prompt = cordialidade_block || E'\n\n' || system_prompt
  WHERE name = 'MAX' AND system_prompt NOT LIKE '%REGRAS DE CORDIALIDADE%';

  -- Maya: prepend ao prompt existente
  UPDATE ai_agents
  SET system_prompt = cordialidade_block || E'\n\n' || system_prompt
  WHERE name = 'Maya' AND system_prompt NOT LIKE '%REGRAS DE CORDIALIDADE%';

  -- Renan: prepend ao prompt existente
  UPDATE ai_agents
  SET system_prompt = cordialidade_block || E'\n\n' || system_prompt
  WHERE name = 'Renan' AND system_prompt NOT LIKE '%REGRAS DE CORDIALIDADE%';

  -- KIRA: prepend ao prompt existente
  UPDATE ai_agents
  SET system_prompt = cordialidade_block || E'\n\n' || system_prompt
  WHERE name = 'KIRA' AND system_prompt NOT LIKE '%REGRAS DE CORDIALIDADE%';
END $$;
```

- [ ] **Step 2: Verify prompts updated**

```sql
SELECT name, LEFT(system_prompt, 100) as prompt_start
FROM ai_agents
WHERE name IN ('Lino', 'MAX', 'Maya', 'Renan', 'KIRA');
```

All should start with "REGRAS DE CORDIALIDADE".

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat(prompts): add senior expertise + cordialidade blocks to all agents"
```

---

## Phase 5: Frontend — Response Feedback CTA

### Task 12: Create ResponseFeedback component

**Files:**
- Create: `src/components/conversation/ResponseFeedback.tsx`

- [ ] **Step 1: Create the feedback popover component**

```tsx
// src/components/conversation/ResponseFeedback.tsx
import { useState } from "react"
import { ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"

interface ResponseFeedbackProps {
  messageId: string
  conversationId: string
  agentId?: string
  originalResponse: string
  canCorrect: boolean // true for admin/leader roles
}

const ERROR_TYPES = [
  { value: "incorrect_info", label: "Informação incorreta" },
  { value: "wrong_tone", label: "Tom inadequado" },
  { value: "missed_question", label: "Não respondeu a pergunta" },
  { value: "hallucination", label: "Inventou dados (alucinação)" },
  { value: "other", label: "Outro" },
] as const

export function ResponseFeedback({
  messageId,
  conversationId,
  agentId,
  originalResponse,
  canCorrect,
}: ResponseFeedbackProps) {
  const [open, setOpen] = useState(false)
  const [errorType, setErrorType] = useState<string>("")
  const [correctedResponse, setCorrectedResponse] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!canCorrect) return null

  const handleSubmit = async () => {
    if (!errorType || !correctedResponse.trim()) {
      toast.error("Preencha o tipo do erro e a resposta correta")
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from("ai_response_corrections").insert({
        message_id: messageId,
        conversation_id: conversationId,
        agent_id: agentId || null,
        corrected_by: (await supabase.auth.getUser()).data.user?.id,
        error_type: errorType,
        original_response: originalResponse,
        corrected_response: correctedResponse.trim(),
      })

      if (error) throw error

      toast.success("Correção salva! O agente vai aprender com isso.")
      setOpen(false)
      setErrorType("")
      setCorrectedResponse("")
    } catch (err) {
      toast.error("Erro ao salvar correção")
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
          title="Marcar resposta como incorreta"
        >
          <ThumbsDown className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Corrigir resposta do agente</h4>

          <RadioGroup value={errorType} onValueChange={setErrorType}>
            {ERROR_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <RadioGroupItem value={type.value} id={type.value} />
                <Label htmlFor={type.value} className="text-xs">
                  {type.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Textarea
            placeholder="Resposta correta..."
            value={correctedResponse}
            onChange={(e) => setCorrectedResponse(e.target.value)}
            rows={3}
            className="text-xs"
          />

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !errorType || !correctedResponse.trim()}
            className="w-full"
          >
            {submitting ? "Salvando..." : "Salvar correção"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/conversation/ResponseFeedback.tsx
git commit -m "feat(ui): add ResponseFeedback CTA for correcting AI responses"
```

---

### Task 13: Integrate ResponseFeedback into MessageList

**Files:**
- Modify: `src/components/conversation/MessageList.tsx`

- [ ] **Step 1: Update MessageList to include feedback button on AI messages**

Replace the entire `MessageList.tsx`:

```tsx
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types/ticket"
import { ResponseFeedback } from "./ResponseFeedback"

interface MessageListProps {
  messages: Message[]
  canCorrectResponses?: boolean
  conversationId?: string
}

export function MessageList({ messages, canCorrectResponses = false, conversationId }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-background/50">
      {messages.map((message) => {
        const isAgent = message.sender === "agent"
        const isAI = isAgent && message.senderType === "ai"

        return (
          <div
            key={message.id}
            className={cn(
              "flex group",
              isAgent ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[70%] px-4 py-2.5 animate-fade-in",
                isAgent
                  ? "message-outgoing"
                  : "message-incoming shadow-sm"
              )}
            >
              {isAgent && message.senderName && (
                <p className="text-xs font-medium text-primary mb-1">
                  {message.senderName}
                </p>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {message.content}
              </p>
              <div className="flex items-center justify-end gap-1 mt-1">
                {isAI && canCorrectResponses && conversationId && (
                  <ResponseFeedback
                    messageId={message.id}
                    conversationId={conversationId}
                    agentId={message.agentId}
                    originalResponse={message.content}
                    canCorrect={canCorrectResponses}
                  />
                )}
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{message.timestamp}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/conversation/MessageList.tsx
git commit -m "feat(ui): integrate feedback button on AI messages in chat"
```

---

## Phase 6: Frontend — Monitoring Panel

### Task 14: Create useActionLogs hook

**Files:**
- Create: `src/hooks/useActionLogs.ts`

- [ ] **Step 1: Create the hook**

```tsx
// src/hooks/useActionLogs.ts
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface ActionLog {
  id: string
  created_at: string
  conversation_id: string | null
  action_type: string
  agent_id: string | null
  status: string
  model: string | null
  duration_ms: number | null
  tokens_in: number
  tokens_out: number
  cost_usd: number
  error_message: string | null
  details: Record<string, unknown>
  notification_read: boolean
}

export function useActionLogs(limit = 50) {
  return useQuery({
    queryKey: ["action-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as ActionLog[]
    },
    refetchInterval: 10000, // Refresh every 10s
  })
}

export function useUnreadErrors() {
  return useQuery({
    queryKey: ["unread-errors"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ai_action_logs")
        .select("*", { count: "exact", head: true })
        .eq("notification_read", false)
        .in("status", ["error", "timeout"])
      if (error) throw error
      return count || 0
    },
    refetchInterval: 15000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useActionLogs.ts
git commit -m "feat(hooks): add useActionLogs and useUnreadErrors for monitoring"
```

---

### Task 15: Create ErrorAlertBadge for header

**Files:**
- Create: `src/components/monitoring/ErrorAlertBadge.tsx`

- [ ] **Step 1: Create the badge component**

```tsx
// src/components/monitoring/ErrorAlertBadge.tsx
import { AlertTriangle } from "lucide-react"
import { useUnreadErrors } from "@/hooks/useActionLogs"
import { cn } from "@/lib/utils"

export function ErrorAlertBadge() {
  const { data: count = 0 } = useUnreadErrors()

  if (count === 0) return null

  return (
    <div className="relative">
      <AlertTriangle className={cn("w-5 h-5", count > 0 ? "text-destructive" : "text-muted-foreground")} />
      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
        {count > 99 ? "99+" : count}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/monitoring/ErrorAlertBadge.tsx
git commit -m "feat(ui): add ErrorAlertBadge for header error notifications"
```

---

### Task 16: Create MonitoringPanel component

**Files:**
- Create: `src/components/monitoring/MonitoringPanel.tsx`

- [ ] **Step 1: Create the monitoring panel**

```tsx
// src/components/monitoring/MonitoringPanel.tsx
import { useActionLogs } from "@/hooks/useActionLogs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Sucesso" },
  error: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Erro" },
  timeout: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Timeout" },
  fallback: { icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10", label: "Fallback" },
} as const

export function MonitoringPanel() {
  const { data: logs = [], isLoading } = useActionLogs(100)

  const errorCount = logs.filter(l => l.status === "error" || l.status === "timeout").length
  const successRate = logs.length > 0
    ? ((logs.filter(l => l.status === "success").length / logs.length) * 100).toFixed(1)
    : "0"
  const avgLatency = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / logs.length)
    : 0
  const totalCost = logs.reduce((sum, l) => sum + (l.cost_usd || 0), 0)

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Taxa de sucesso</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="text-xs text-muted-foreground">Erros recentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{avgLatency}ms</div>
            <div className="text-xs text-muted-foreground">Latência média</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">Custo total</div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Timeline de Ações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const config = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.success
                  const Icon = config.icon

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg text-xs",
                        config.bg
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.action_type}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {config.label}
                          </Badge>
                          {log.model && (
                            <span className="text-muted-foreground truncate">{log.model}</span>
                          )}
                        </div>
                        {log.error_message && (
                          <p className="text-destructive mt-0.5 truncate">{log.error_message}</p>
                        )}
                        <div className="flex gap-3 mt-0.5 text-muted-foreground">
                          {log.duration_ms && <span>{log.duration_ms}ms</span>}
                          {(log.tokens_in > 0 || log.tokens_out > 0) && (
                            <span>{log.tokens_in}→{log.tokens_out} tokens</span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/monitoring/MonitoringPanel.tsx
git commit -m "feat(ui): add MonitoringPanel with KPIs and action timeline"
```

---

### Task 17: Add Monitoring tab to Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Import MonitoringPanel and add tab**

Add import at top:

```tsx
import { MonitoringPanel } from "@/components/monitoring/MonitoringPanel"
```

Add a new tab in the tabs list (around line 217-233):

```tsx
{ value: "monitoring", label: "Monitoramento", icon: Activity }
```

Add the tab content after the last TabsContent:

```tsx
<TabsContent value="monitoring" className="mt-4">
  <MonitoringPanel />
</TabsContent>
```

- [ ] **Step 2: Import Activity icon**

Ensure `Activity` is imported from `lucide-react`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add Monitoring tab with real-time agent actions"
```

---

## Phase 7: Deploy & Verify

### Task 18: Deploy all modified Edge Functions

**Files:**
- Deploy via Supabase CLI

- [ ] **Step 1: Deploy agent-executor**

```bash
supabase functions deploy agent-executor
```

- [ ] **Step 2: Deploy process-incoming-message**

```bash
supabase functions deploy process-incoming-message
```

- [ ] **Step 3: Deploy check-inactive-conversations**

```bash
supabase functions deploy check-inactive-conversations
```

- [ ] **Step 4: Deploy summarize-conversation**

```bash
supabase functions deploy summarize-conversation
```

- [ ] **Step 5: Verify by sending a test WhatsApp message**

Send "Olá, preciso de ajuda" to the WhatsApp number and verify:
1. Agent responds (not silent)
2. Response is cordial and friendly
3. ai_action_logs has entries for the conversation
4. No "alta demanda" message if queue is empty

- [ ] **Step 6: Commit any deploy-related fixes**

```bash
git add -A && git commit -m "chore: deploy all edge functions post-overhaul"
```

---

### Task 19: Final integration test

- [ ] **Step 1: Test escalation flow**

Trigger an escalation (send "quero falar com um atendente") and verify:
1. Queue message reflects real demand level
2. If no human responds in 3 min → AI offers help
3. If no human responds in 7 min → AI resumes fully

- [ ] **Step 2: Test monitoring panel**

Open `/dashboard` → Monitoring tab and verify:
1. Timeline shows recent actions
2. KPI cards show correct data
3. Errors appear with red highlight

- [ ] **Step 3: Test response feedback**

As admin, hover over an AI message in chat and:
1. Click 👎 button
2. Select error type
3. Type corrected response
4. Submit → verify it appears in ai_response_corrections table

- [ ] **Step 4: Commit final state**

```bash
git add -A && git commit -m "test: verify full agent overhaul integration"
```
