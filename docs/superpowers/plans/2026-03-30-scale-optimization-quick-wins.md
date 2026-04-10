# Scale Optimization — Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize sismais-assist-chat to handle 5K+ users, 1K tickets/day, 10K messages/month, 100K leads — reducing message processing latency by 70%.

**Architecture:** Four independent fronts: (1) database indexes via migration, (2) shared cache module for Edge Functions, (3) parallelized queries in 5 critical Edge Functions, (4) Realtime subscription pooling in frontend hooks. Each front is independently deployable and testable.

**Tech Stack:** Supabase (PostgreSQL + Edge Functions/Deno), React + TanStack Query, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-30-scale-optimization-quick-wins-design.md`

---

## Task 1: Database Indexes Migration

**Files:**
- Create: `supabase/migrations/20260330120000_scale_optimization_indexes.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Scale optimization: 10 compound indexes for high-volume tables
-- Safe to run in production: all indexes created CONCURRENTLY

-- 1. ai_conversations: client lookup filtered by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_conv_client_status_date
  ON ai_conversations(helpdesk_client_id, status, started_at DESC);

-- 2. ai_conversations: human agent queue (partial)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_conv_handler_active
  ON ai_conversations(handler_type, status)
  WHERE status IN ('active', 'waiting', 'aguardando');

-- 3. ai_messages: agent performance dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_msg_agent_created
  ON ai_messages(agent_id, created_at DESC);

-- 4. ai_messages: general feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_msg_created
  ON ai_messages(created_at DESC);

-- 5. helpdesk_clients: CRM segmentation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hc_lifecycle_health
  ON helpdesk_clients(lifecycle_stage, health_score DESC);

-- 6. helpdesk_clients: recent clients list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hc_created
  ON helpdesk_clients(created_at DESC);

-- 7. campaign_contacts: campaign progress
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cc_campaign_status_date
  ON campaign_contacts(campaign_id, status, created_at DESC);

-- 8. crm_duplicate_candidates: review queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_dup_status_score
  ON crm_duplicate_candidates(status, match_score DESC);

-- 9. crm_score_history: score trending
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_score_client_type_date
  ON crm_score_history(client_id, score_type, calculated_at DESC);

-- 10. whatsapp_messages: thread history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_msg_conv_created
  ON whatsapp_messages(conversation_id, created_at DESC);
```

- [ ] **Step 2: Validate SQL syntax locally**

Run: `cd supabase/migrations && cat 20260330120000_scale_optimization_indexes.sql`
Verify: No syntax errors, all 10 CREATE INDEX statements present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260330120000_scale_optimization_indexes.sql
git commit -m "perf(db): add 10 compound indexes for scale optimization

Indexes for ai_conversations, ai_messages, helpdesk_clients,
campaign_contacts, crm_duplicate_candidates, crm_score_history,
and whatsapp_messages. All created CONCURRENTLY for zero downtime."
```

---

## Task 2: Shared Cache Module for Edge Functions

**Files:**
- Create: `supabase/functions/_shared/cache.ts`

- [ ] **Step 1: Create the cache module**

```typescript
// supabase/functions/_shared/cache.ts
// In-memory cache with TTL for Deno Edge Functions.
// Cache survives between warm invocations, dies on cold start.
// No external dependencies (no Redis needed).

interface CacheEntry<T> {
  data: T
  expires: number
}

const store = new Map<string, CacheEntry<unknown>>()

/**
 * Get cached data or fetch it. Thread-safe for single-isolate Deno runtime.
 *
 * @param key - Unique cache key (e.g. 'active_agents')
 * @param ttlMs - Time-to-live in milliseconds (e.g. 300_000 for 5 min)
 * @param fetcher - Async function that returns fresh data
 * @returns Cached or freshly fetched data
 */
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = store.get(key)
  if (cached && Date.now() < cached.expires) {
    return cached.data as T
  }

  const data = await fetcher()
  store.set(key, { data, expires: Date.now() + ttlMs })
  return data
}

/**
 * Invalidate a specific cache key. Use when you know data changed.
 */
export function invalidateCache(key: string): void {
  store.delete(key)
}

/**
 * Clear all cached data. Use sparingly.
 */
export function clearCache(): void {
  store.clear()
}
```

- [ ] **Step 2: Verify Deno compatibility**

Run: `cd supabase/functions && deno check _shared/cache.ts`
Expected: No errors (pure TypeScript, no Node.js APIs)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/cache.ts
git commit -m "feat(shared): add in-memory cache module with TTL for edge functions"
```

---

## Task 3: Parallelize `ai-whatsapp-reply`

**Files:**
- Modify: `supabase/functions/ai-whatsapp-reply/index.ts`

- [ ] **Step 1: Read the current function fully**

Read `supabase/functions/ai-whatsapp-reply/index.ts` end-to-end. Identify all database queries and their dependencies. Map which queries depend on results from previous queries and which are independent.

- [ ] **Step 2: Add cache import at the top**

Add after existing imports:

```typescript
import { cachedQuery } from "../_shared/cache.ts"
```

- [ ] **Step 3: Cache agent lookups**

Find where `ai_agents` are fetched (the default agent lookup and priority agent lookup). Wrap with cachedQuery:

```typescript
// Replace direct supabase query for default agent with:
const defaultAgent = await cachedQuery(
  'default_ai_agent',
  300_000, // 5 min
  async () => {
    const { data } = await supabase
      .from('platform_ai_config')
      .select('value')
      .eq('key', 'default_ai_agent_id')
      .single()
    return data?.value ?? null
  }
)
```

Do the same for the priority agent lookup (highest priority active agent fallback):

```typescript
const priorityAgent = await cachedQuery(
  'priority_agent',
  300_000,
  async () => {
    const { data } = await supabase
      .from('ai_agents')
      .select('id, name')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single()
    return data
  }
)
```

- [ ] **Step 4: Parallelize Block 1 — initial lookups**

Find the section where conversation, client data, and agent config are fetched sequentially. Group them into Promise.all:

```typescript
// Block 1: Independent lookups (no cross-dependencies)
const [conversationResult, clientResult, agentConfigResult] = await Promise.all([
  // Conversation lookup
  supabase
    .from('ai_conversations')
    .select('*, ai_agents(*)')
    .eq('id', conversationId)
    .single(),
  // Client data
  supabase
    .from('helpdesk_clients')
    .select('*')
    .eq('id', helpdeskClientId)
    .single(),
  // Agent config (cached)
  cachedQuery(`agent_config_${agentId}`, 300_000, async () => {
    const { data } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single()
    return data
  })
])
```

- [ ] **Step 5: Parallelize Block 2 — context building**

After Block 1 resolves (we now have conversation, client, agent), parallelize the context-building queries:

```typescript
// Block 2: Context building (depends on Block 1 results)
const [skillsResult, messageHistory, ragResults] = await Promise.all([
  // Skill assignments for this agent
  cachedQuery(`skills_${agentId}`, 300_000, async () => {
    const { data } = await supabase
      .from('ai_agent_skill_assignments')
      .select('*, ai_agent_skills(*)')
      .eq('agent_id', agentId)
    return data ?? []
  }),
  // Message history (last 15)
  supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(15),
  // RAG search (only if agent has RAG enabled)
  agentConfig?.rag_enabled
    ? fetchRagContext(supabase, messageText, agentConfig)
    : Promise.resolve([])
])
```

- [ ] **Step 6: Verify the function still works**

Run: `cd supabase/functions && deno check ai-whatsapp-reply/index.ts`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ai-whatsapp-reply/index.ts
git commit -m "perf(ai-whatsapp-reply): parallelize 12 sequential queries into 2 blocks

Groups independent DB queries into Promise.all blocks.
Adds caching for agent config, skills, and platform settings.
Expected latency reduction: ~300ms per message."
```

---

## Task 4: Parallelize `process-incoming-message`

**Files:**
- Modify: `supabase/functions/process-incoming-message/index.ts`

- [ ] **Step 1: Read the current function fully**

Read `supabase/functions/process-incoming-message/index.ts` end-to-end. This is ~1244 lines. Map all DB queries and function invocations with their dependencies.

- [ ] **Step 2: Add cache import**

```typescript
import { cachedQuery } from "../_shared/cache.ts"
```

- [ ] **Step 3: Parallelize initial lookups**

Find the sequential conversation lookup, processing lock acquisition, and client data fetch. Group the independent ones:

```typescript
// Conversation + client can be fetched in parallel
// Lock must be acquired after we know the conversation exists
const [conversationResult, clientResult] = await Promise.all([
  supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single(),
  supabase
    .from('helpdesk_clients')
    .select('*')
    .eq('id', helpdeskClientId)
    .single()
])

// Lock depends on conversation existing
const lockResult = await supabase.rpc('acquire_processing_lock', {
  p_conversation_id: conversationId,
  p_locked_by: 'process-incoming-message',
  p_message_id: messageId
})
```

- [ ] **Step 4: Parallelize context queries**

Find where last_human_message, last_queue_notice, and last_queue_message are fetched. These are independent:

```typescript
const [lastHumanMsg, lastQueueNotice, lastQueueMsg] = await Promise.all([
  supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('role', 'human_agent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
  supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .ilike('content', '%fila%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
  supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('role', 'system')
    .ilike('content', '%aguardando%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
])
```

- [ ] **Step 5: Cache agent config lookup**

```typescript
const agentConfig = await cachedQuery(
  `agent_config_${agentId}`,
  300_000,
  async () => {
    const { data } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single()
    return data
  }
)
```

- [ ] **Step 6: Verify**

Run: `cd supabase/functions && deno check process-incoming-message/index.ts`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/process-incoming-message/index.ts
git commit -m "perf(process-incoming-message): parallelize sequential DB queries

Groups independent lookups into Promise.all blocks.
Caches agent config with 5-min TTL.
Expected latency reduction: ~350ms per message."
```

---

## Task 5: Optimize `uazapi-webhook` Deduplication

**Files:**
- Modify: `supabase/functions/uazapi-webhook/index.ts`

- [ ] **Step 1: Read the dedup section**

Read `supabase/functions/uazapi-webhook/index.ts`, focusing on lines 148-197 (dedup logic). Identify the 3 separate queries used for deduplication.

- [ ] **Step 2: Replace 3 dedup queries with 1**

Find the sequential dedup checks and replace with a single composite query:

```typescript
// BEFORE: 3 separate queries
// 1. instance lookup
// 2. check uazapi_messages
// 3. check ai_messages

// AFTER: single composite check
const { data: existingMsg } = await supabase
  .from('uazapi_messages')
  .select('id')
  .eq('message_id', messageId)
  .eq('instance_id', instanceId)
  .limit(1)
  .maybeSingle()

if (existingMsg) {
  return new Response(JSON.stringify({ status: 'duplicate' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

- [ ] **Step 3: Cache instance lookup**

```typescript
import { cachedQuery } from "../_shared/cache.ts"

// Replace direct instance query with cached version
const instance = await cachedQuery(
  `uazapi_instance_${instanceName}`,
  300_000, // 5 min
  async () => {
    const { data } = await supabase
      .from('uazapi_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .single()
    return data
  }
)
```

- [ ] **Step 4: Verify**

Run: `cd supabase/functions && deno check uazapi-webhook/index.ts`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/uazapi-webhook/index.ts
git commit -m "perf(uazapi-webhook): reduce dedup from 3 queries to 1, cache instance lookup

Eliminates ~2000 redundant DB queries per day at 1000 msgs/day."
```

---

## Task 6: Parallelize `whatsapp-meta-webhook`

**Files:**
- Modify: `supabase/functions/whatsapp-meta-webhook/index.ts`

- [ ] **Step 1: Read the current function**

Read `supabase/functions/whatsapp-meta-webhook/index.ts` (154 lines). Identify the sequential for-loop processing multiple messages.

- [ ] **Step 2: Cache account lookup**

```typescript
import { cachedQuery } from "../_shared/cache.ts"

// Replace per-message account lookup with cached version
const account = await cachedQuery(
  `wa_account_${phoneNumberId}`,
  600_000, // 10 min — accounts almost never change
  async () => {
    const { data } = await supabase
      .from('whatsapp_business_accounts')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .single()
    return data
  }
)
```

- [ ] **Step 3: Parallelize message inserts**

Find the for-loop that processes messages sequentially. Replace with Promise.allSettled:

```typescript
// BEFORE: sequential for-loop
// for (const message of messages) { await insertMessage(message) }

// AFTER: parallel with error isolation
const results = await Promise.allSettled(
  messages.map(message => insertMessage(supabase, message, account))
)

// Log any failures without crashing the webhook
for (const result of results) {
  if (result.status === 'rejected') {
    console.error('Failed to insert message:', result.reason)
  }
}
```

- [ ] **Step 4: Verify**

Run: `cd supabase/functions && deno check whatsapp-meta-webhook/index.ts`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/whatsapp-meta-webhook/index.ts
git commit -m "perf(whatsapp-meta-webhook): parallelize message inserts, cache account lookup

Uses Promise.allSettled for error isolation on batch webhooks.
Caches whatsapp_business_accounts with 10-min TTL."
```

---

## Task 7: Optimize `agent-executor`

**Files:**
- Modify: `supabase/functions/agent-executor/index.ts`

- [ ] **Step 1: Read the current function**

Read `supabase/functions/agent-executor/index.ts` fully. Map the RAG pipeline and summarization logic.

- [ ] **Step 2: Add cache import**

```typescript
import { cachedQuery } from "../_shared/cache.ts"
```

- [ ] **Step 3: Parallelize client data + ticket history**

Find where client data and previous tickets are fetched. They should already be partially parallel (lines 146-159). Verify and extend:

```typescript
const [clientData, previousTickets, ragDocs] = await Promise.all([
  supabase
    .from('helpdesk_clients')
    .select('*')
    .eq('id', helpdeskClientId)
    .single(),
  supabase
    .from('ai_conversations')
    .select('id, ticket_number, status, started_at')
    .eq('helpdesk_client_id', helpdeskClientId)
    .neq('id', conversationId)
    .order('started_at', { ascending: false })
    .limit(5),
  // RAG search in parallel with client data
  agentConfig?.rag_enabled
    ? supabase.rpc('search_knowledge_hybrid', {
        query_embedding: embedding,
        query_text: messageText,
        match_threshold: 0.3,
        match_count: 5,
        filter_product_id: agentConfig.rag_product_id
      })
    : Promise.resolve({ data: [] })
])
```

- [ ] **Step 4: Disable RAG reranking via LLM**

Find the RAG reranking section (where an LLM is called to rerank search results). Replace with simpler score-based sorting:

```typescript
// BEFORE: LLM-based reranking (1-3s extra latency)
// const reranked = await rerankWithLLM(docs, query)

// AFTER: Use the hybrid search score directly (already good via RRF)
const rankedDocs = ragDocs
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  .slice(0, topK)
```

- [ ] **Step 5: Cache skill assignments**

```typescript
const skills = await cachedQuery(
  `agent_skills_${agentId}`,
  300_000,
  async () => {
    const { data } = await supabase
      .from('ai_agent_skill_assignments')
      .select('*, ai_agent_skills(*)')
      .eq('agent_id', agentId)
    return data ?? []
  }
)
```

- [ ] **Step 6: Verify**

Run: `cd supabase/functions && deno check agent-executor/index.ts`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/agent-executor/index.ts
git commit -m "perf(agent-executor): parallelize queries, remove LLM reranking, cache skills

RAG reranking now uses score-based sort instead of extra LLM call.
Client data, tickets, and RAG search run in parallel.
Expected latency reduction: ~500ms on long conversations."
```

---

## Task 8: Shared Realtime Channel Hook

**Files:**
- Create: `src/hooks/useSharedRealtimeChannel.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useSharedRealtimeChannel.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSharedRealtimeChannel } from '../useSharedRealtimeChannel'

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}))

describe('useSharedRealtimeChannel', () => {
  it('creates a channel on first subscriber', () => {
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useSharedRealtimeChannel('ai_messages', 'INSERT', callback)
    )
    expect(result.current).toBeDefined()
  })

  it('reuses existing channel for same table', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    renderHook(() => useSharedRealtimeChannel('ai_messages', 'INSERT', cb1))
    renderHook(() => useSharedRealtimeChannel('ai_messages', 'INSERT', cb2))
    // Should not create a second channel — validated by mock call count
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useSharedRealtimeChannel.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the shared channel hook**

```typescript
// src/hooks/useSharedRealtimeChannel.ts
import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
type Callback = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

interface ChannelState {
  channel: RealtimeChannel
  subscribers: Set<Callback>
}

// Module-level shared channels (survives re-renders, one per table+event)
const channels = new Map<string, ChannelState>()

/**
 * Subscribe to Realtime changes on a table using a shared channel.
 * Multiple components subscribing to the same table reuse one channel.
 * Client-side filtering is the caller's responsibility.
 */
export function useSharedRealtimeChannel(
  table: string,
  event: EventType,
  callback: Callback
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const key = `${table}:${event}`
    const wrappedCallback: Callback = (payload) => callbackRef.current(payload)

    let state = channels.get(key)

    if (!state) {
      // First subscriber — create the channel
      const channel = supabase
        .channel(`shared:${key}`)
        .on(
          'postgres_changes',
          { event, schema: 'public', table },
          (payload) => {
            const s = channels.get(key)
            if (s) {
              for (const cb of s.subscribers) {
                cb(payload)
              }
            }
          }
        )
        .subscribe()

      state = { channel, subscribers: new Set() }
      channels.set(key, state)
    }

    state.subscribers.add(wrappedCallback)

    return () => {
      const s = channels.get(key)
      if (s) {
        s.subscribers.delete(wrappedCallback)
        if (s.subscribers.size === 0) {
          supabase.removeChannel(s.channel)
          channels.delete(key)
        }
      }
    }
  }, [table, event])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useSharedRealtimeChannel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSharedRealtimeChannel.ts src/hooks/__tests__/useSharedRealtimeChannel.test.ts
git commit -m "feat(hooks): add useSharedRealtimeChannel for subscription pooling

Module-level shared channels — one per table+event.
Multiple subscribers reuse the same channel.
Auto-cleanup when last subscriber unmounts."
```

---

## Task 9: Migrate `useKanbanTickets` to Shared Channel

**Files:**
- Modify: `src/hooks/useKanbanTickets.ts`

- [ ] **Step 1: Read the current hook**

Read `src/hooks/useKanbanTickets.ts` fully. Identify all `supabase.channel()` calls and their filters.

- [ ] **Step 2: Replace individual channels with shared channel**

Find the realtime subscription setup section. Replace individual channels with useSharedRealtimeChannel:

```typescript
import { useSharedRealtimeChannel } from './useSharedRealtimeChannel'

// Inside the hook, replace the channel setup:

// Shared channel for ai_conversations changes
useSharedRealtimeChannel('ai_conversations', '*', (payload) => {
  // Client-side filter: only process if it belongs to current board
  const conv = payload.new as Record<string, unknown>
  if (conv?.kanban_board_id === boardId) {
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets', boardId] })
  }
})

// Shared channel for new ai_messages
useSharedRealtimeChannel('ai_messages', 'INSERT', (payload) => {
  const msg = payload.new as Record<string, unknown>
  // Invalidate only if message belongs to a conversation in current view
  if (conversationIds.has(msg?.conversation_id as string)) {
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets', boardId] })
  }
})
```

Remove the old `supabase.channel()` setup and its cleanup in the useEffect return.

- [ ] **Step 3: Remove old channel cleanup**

Delete the `return () => { supabase.removeChannel(...) }` cleanup for the old individual channels. The shared hook handles its own cleanup.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKanbanTickets.ts
git commit -m "perf(kanban): migrate to shared realtime channels

Replaces 4 individual channels with 2 shared channels.
Client-side filtering by boardId and conversationIds.
Reduces subscription count by ~75% per operator."
```

---

## Task 10: Migrate `useConversationMessages` to Shared Channel

**Files:**
- Modify: `src/hooks/useConversationMessages.ts`

- [ ] **Step 1: Read the current hook**

Read `src/hooks/useConversationMessages.ts` fully. Identify the per-conversation channel creation.

- [ ] **Step 2: Replace with shared channel**

```typescript
import { useSharedRealtimeChannel } from './useSharedRealtimeChannel'

// Replace per-conversation channel with shared channel + client filter:
useSharedRealtimeChannel('ai_messages', 'INSERT', (payload) => {
  const msg = payload.new as Record<string, unknown>
  if (msg?.conversation_id !== conversationId) return

  // Existing optimistic cache update logic stays the same
  queryClient.setQueryData(
    ['messages', conversationId],
    (old: unknown) => {
      // ... existing merge logic unchanged
    }
  )
})

// Also subscribe to UPDATE events for message edits
useSharedRealtimeChannel('ai_messages', 'UPDATE', (payload) => {
  const msg = payload.new as Record<string, unknown>
  if (msg?.conversation_id !== conversationId) return

  queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
})
```

Remove old `supabase.channel(`messages:${conversationId}`)` setup.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useConversationMessages.ts
git commit -m "perf(messages): migrate to shared realtime channel

Replaces per-conversation channels with shared ai_messages channel.
Client-side filtering by conversationId.
Eliminates N channels per N open conversations."
```

---

## Task 11: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 5: Deno check all modified edge functions**

```bash
cd supabase/functions
deno check ai-whatsapp-reply/index.ts
deno check process-incoming-message/index.ts
deno check uazapi-webhook/index.ts
deno check whatsapp-meta-webhook/index.ts
deno check agent-executor/index.ts
```

Expected: No type errors in any function.

- [ ] **Step 6: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from scale optimization"
```

---

## Summary

| Task | Frente | Ganho Estimado |
|------|--------|---------------|
| 1. DB Indexes | Banco | Queries de 2-5s → 50-200ms |
| 2. Cache Module | Shared | Base para tasks 3-7 |
| 3. ai-whatsapp-reply | Edge Functions | -300ms/msg |
| 4. process-incoming-message | Edge Functions | -350ms/msg |
| 5. uazapi-webhook | Edge Functions | -60ms/msg, -2000 queries/dia |
| 6. whatsapp-meta-webhook | Edge Functions | -80% latência batch |
| 7. agent-executor | Edge Functions | -500ms em conversas longas |
| 8. Shared Channel Hook | Frontend | Base para tasks 9-10 |
| 9. useKanbanTickets | Frontend | -75% subscriptions/operador |
| 10. useConversationMessages | Frontend | Elimina N channels por N chats |
| 11. Verificação final | QA | Zero regressões |
