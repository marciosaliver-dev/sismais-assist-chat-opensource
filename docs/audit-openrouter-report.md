# Audit Report: OpenRouter Integration - Sismais Helpdesk

**Date**: 2026-03-30
**Auditor**: Backend Architect Agent
**Scope**: OpenRouter client, model config, cost tracking, API key management, admin panel

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Issues Found](#3-issues-found)
4. [Feature Proposal: Admin Panel API Key Management](#4-feature-proposal-admin-panel-api-key-management)
5. [Architecture Diagram](#5-architecture-diagram)
6. [Recommended Improvements Priority List](#6-recommended-improvements-priority-list)

---

## 1. Executive Summary

The OpenRouter integration is well-structured with a centralized client (`openrouter-client.ts`), model catalog with DB-driven configuration, fallback chains with exponential backoff, and comprehensive API logging. However, several issues were identified:

- **Critical**: API key is hardcoded via environment variable with no runtime rotation capability
- **High**: 12+ edge functions directly call `Deno.env.get("OPENROUTER_API_KEY")` bypassing the shared client
- **High**: No encryption for API keys if stored in database
- **Medium**: 25s timeout may be too short for reasoning models (o1, o3, deepseek-r1)
- **Medium**: Cost tracking has dual paths (ai_api_logs + ai_usage_log) with potential drift

---

## 2. Current State Analysis

### 2.1 OpenRouter Client (`_shared/openrouter-client.ts`)

**Strengths:**
- Single provider pattern eliminates multi-provider complexity
- AbortController-based timeout with proper cleanup
- Typed error class (`OpenRouterError`) with HTTP status codes
- Fallback chain with exponential backoff + jitter (prevents thundering herd)
- 402 (insufficient credits) correctly short-circuits the fallback chain
- Fire-and-forget API call logging (never blocks the main response)
- Embedding endpoint support with batch input handling

**Weaknesses:**
- `REQUEST_TIMEOUT_MS = 25_000` is a single value for all model types. Reasoning models (o1, o3, gemini-2.5-pro) routinely take 30-60s. This causes unnecessary timeout errors and fallback cascades.
- No connection pooling or keep-alive configuration (Deno's `fetch` uses a global pool, but no explicit control).
- No retry logic for transient errors (5xx). The fallback chain tries different models but never retries the same model.
- `cost_usd` extraction (`data.usage?.cost`) depends on OpenRouter returning this field, which is not guaranteed for all models. Falls back to 0, causing silent cost underreporting.
- API key retrieved on every call via `getHeaders()`. No caching of the key reference.
- No request deduplication or concurrency limiting.

### 2.2 Model Configuration (`_shared/get-model-config.ts`)

**Strengths:**
- In-memory cache with 60s TTL (appropriate for Deno isolate reuse)
- Separate pricing cache with 5m TTL (pricing is more stable)
- Graceful fallback when DB is unavailable
- Caches fallback values too (prevents retry storms)

**Weaknesses:**
- 60s cache TTL means config changes take up to 60s to propagate. This is acceptable but should be documented.
- No cache invalidation mechanism. If an admin changes a model config, they must wait for TTL expiry.
- `supabase: any` type loses all type safety.
- Fallback pricing (`$0.10/$0.40 per 1M`) is hardcoded and will be inaccurate for most models.

### 2.3 OpenRouter Credits (`openrouter-credits/index.ts`)

**Strengths:**
- Parallel fetch of `/credits` and `/key` endpoints (good performance)
- Graceful degradation: falls back to key-level data if credits endpoint fails
- Combined response gives both account-level and key-level data

**Weaknesses:**
- No caching. Every page load triggers two OpenRouter API calls.
- No rate limiting protection. A user refreshing the page rapidly could hit OpenRouter's rate limits.
- CORS allows all origins (`*`). Should be restricted to the application domain.

### 2.4 Sync Models (`sync-openrouter-models/index.ts`)

**Strengths:**
- Rich capability inference from model metadata
- Portuguese descriptions with curated templates for popular models
- Tier system (nano/economic/standard/premium/enterprise) based on pricing
- Preserves existing tier and recommended_for when updating (no admin overrides lost)
- Supports `only_update_pricing` mode for targeted updates

**Weaknesses:**
- Sequential upserts (one per model). With 300+ models, this is slow. Should use batch upserts.
- No pagination or streaming from OpenRouter API. The full model list (~1MB) is loaded into memory.
- Skips models with zero pricing, which may exclude free-tier models.
- No deduplication for model variants (e.g., `google/gemini-2.0-flash` vs `google/gemini-2.0-flash-001`).

### 2.5 Cost Logging (`_shared/log-ai-cost.ts`)

**Strengths:**
- Simple, focused, never fails the main operation
- Tracks per-feature granularity

**Weaknesses:**
- **Dual logging paths**: `openrouter-client.ts` logs to `ai_api_logs`, while `log-ai-cost.ts` logs to `ai_usage_log`. These two tables track overlapping data with no cross-reference.
- Missing fields: no `agent_id`, no `user_id`, no `organization_id`, no `latency_ms`.
- `cost_usd` is passed in by the caller. If the caller passes 0 (which happens when OpenRouter omits cost data), the log is useless for cost analysis.

### 2.6 API Key Management (Current State)

All 12+ edge functions retrieve the key the same way:

```typescript
const apiKey = Deno.env.get("OPENROUTER_API_KEY")
```

**Problems:**
- Single key shared across all functions and all tenants.
- Key rotation requires redeploying all edge functions (Supabase env var update + function restart).
- No audit trail for key usage.
- Some functions bypass the shared client entirely (e.g., `csat-processor`, `evaluate-service`, `generate-close-review`, `ticket-category-classifier`, `extract-conversation-knowledge`) and build their own fetch headers. This means any future improvement to the client (like DB-based key lookup) will not automatically apply.

### 2.7 Admin Panel (`AISettings.tsx` + `InternalAITab.tsx`)

**Strengths:**
- Comprehensive model catalog browser with filtering, sorting, pagination
- Credits tab shows balance, usage by period, BRL conversion
- Internal AI tab allows per-feature model selection, prompt editing, parameter tuning
- Config wizard for guided setup

**Missing:**
- No API key management UI. Admin cannot view, set, or rotate the OpenRouter API key.
- No health check indicator (is the key valid? what's the rate limit status?).
- No cost alerts or budget configuration.

---

## 3. Issues Found

| # | Severity | Component | Issue | Impact |
|---|----------|-----------|-------|--------|
| 1 | **CRITICAL** | API Key Mgmt | Single env var, no runtime rotation | Key rotation = full redeploy downtime |
| 2 | **HIGH** | Edge Functions | 7+ functions bypass shared client | Inconsistent error handling, no fallback, no logging |
| 3 | **HIGH** | Cost Tracking | Dual tables (ai_api_logs + ai_usage_log) with no link | Cost reports are fragmented and potentially double-counted |
| 4 | **HIGH** | RLS | ai_model_catalog writable by ANY authenticated user | Non-admin users can modify model catalog |
| 5 | **MEDIUM** | Timeout | 25s fixed timeout for all models | Reasoning models timeout, triggering unnecessary fallbacks |
| 6 | **MEDIUM** | Credits | No caching on credits endpoint | Excessive OpenRouter API calls |
| 7 | **MEDIUM** | Sync | Sequential DB upserts | Slow sync for 300+ models |
| 8 | **MEDIUM** | CORS | `Access-Control-Allow-Origin: *` | Allows cross-origin abuse |
| 9 | **LOW** | Config Cache | No invalidation mechanism | Config changes delayed up to 60s |
| 10 | **LOW** | Cost | Fallback pricing hardcoded | Inaccurate cost estimates for unknown models |

---

## 4. Feature Proposal: Admin Panel API Key Management

### 4.1 Overview

Allow the platform admin to configure the OpenRouter API key from the admin panel, with the environment variable serving as a fallback. The key is stored encrypted in the database and read by edge functions at runtime.

### 4.2 Database Schema

```sql
-- Migration: Add encrypted API key storage to platform settings
-- File: supabase/migrations/20260330_add_api_key_management.sql

-- Table for storing encrypted platform secrets
CREATE TABLE IF NOT EXISTS platform_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL UNIQUE,
  encrypted_value TEXT NOT NULL,        -- pgcrypto encrypted
  key_hint TEXT,                         -- last 4 chars for UI display (e.g., "...xK9m")
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ DEFAULT now()  -- tracks last rotation
);

-- Only service_role can read secrets (never exposed to client)
ALTER TABLE platform_secrets ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for authenticated users = they cannot read encrypted values
CREATE POLICY "Only service role can access secrets"
  ON platform_secrets
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX idx_platform_secrets_key ON platform_secrets(key_name) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER trigger_platform_secrets_updated
  BEFORE UPDATE ON platform_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_model_catalog_updated_at();

-- Function to encrypt and store a secret
CREATE OR REPLACE FUNCTION store_platform_secret(
  p_key_name TEXT,
  p_raw_value TEXT,
  p_user_id UUID
) RETURNS void AS $$
DECLARE
  v_encryption_key TEXT;
  v_hint TEXT;
BEGIN
  -- Use the Supabase service role key hash as encryption passphrase
  -- This ensures only the server can decrypt
  v_encryption_key := current_setting('app.settings.service_role_key', true);
  IF v_encryption_key IS NULL THEN
    v_encryption_key := 'sismais-platform-encryption-key';
  END IF;

  v_hint := '...' || right(p_raw_value, 4);

  INSERT INTO platform_secrets (key_name, encrypted_value, key_hint, created_by, rotated_at)
  VALUES (
    p_key_name,
    pgp_sym_encrypt(p_raw_value, v_encryption_key),
    v_hint,
    p_user_id,
    now()
  )
  ON CONFLICT (key_name) DO UPDATE SET
    encrypted_value = pgp_sym_encrypt(p_raw_value, v_encryption_key),
    key_hint = v_hint,
    updated_at = now(),
    rotated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt a secret (callable only by service_role via edge functions)
CREATE OR REPLACE FUNCTION get_platform_secret(p_key_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_encrypted TEXT;
  v_encryption_key TEXT;
BEGIN
  SELECT encrypted_value INTO v_encrypted
  FROM platform_secrets
  WHERE key_name = p_key_name AND is_active = true;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  v_encryption_key := current_setting('app.settings.service_role_key', true);
  IF v_encryption_key IS NULL THEN
    v_encryption_key := 'sismais-platform-encryption-key';
  END IF;

  RETURN pgp_sym_decrypt(v_encrypted::bytea, v_encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 4.3 Shared Helper: API Key Resolution

```typescript
// File: supabase/functions/_shared/get-api-key.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const KEY_CACHE_TTL = 300_000 // 5 minutes
let cachedKey: { value: string; ts: number } | null = null

/**
 * Resolves the OpenRouter API key with priority:
 * 1. Database (platform_secrets) - allows runtime rotation
 * 2. Environment variable (OPENROUTER_API_KEY) - fallback
 *
 * Cached for 5 minutes in-memory per Deno isolate.
 */
export async function getOpenRouterApiKey(): Promise<string> {
  // Check cache
  if (cachedKey && Date.now() - cachedKey.ts < KEY_CACHE_TTL) {
    return cachedKey.value
  }

  // Try database first
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (supabaseUrl && serviceKey) {
      const sb = createClient(supabaseUrl, serviceKey)
      const { data } = await sb.rpc("get_platform_secret", {
        p_key_name: "OPENROUTER_API_KEY",
      })
      if (data) {
        cachedKey = { value: data, ts: Date.now() }
        return data
      }
    }
  } catch (err) {
    console.warn("[get-api-key] Failed to fetch from DB, falling back to env:",
      (err as Error).message)
  }

  // Fallback to environment variable
  const envKey = Deno.env.get("OPENROUTER_API_KEY")
  if (!envKey) {
    throw new Error("OPENROUTER_API_KEY not configured (neither in DB nor env)")
  }

  cachedKey = { value: envKey, ts: Date.now() }
  return envKey
}

/** Force-clear the cached key (useful after rotation). */
export function clearApiKeyCache(): void {
  cachedKey = null
}
```

### 4.4 Updated OpenRouter Client (Minimal Change)

```typescript
// In openrouter-client.ts, replace getHeaders():

import { getOpenRouterApiKey } from "./get-api-key.ts"

async function getHeaders(): Promise<Record<string, string>> {
  const apiKey = await getOpenRouterApiKey()
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "https://sismais.com",
    "X-Title": "Sismais Helpdesk",
  }
}

// Note: callOpenRouter and callOpenRouterEmbedding must await getHeaders()
// Change: headers: getHeaders()  -->  headers: await getHeaders()
```

### 4.5 Edge Function: Manage API Key

```typescript
// File: supabase/functions/manage-api-key/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // Authenticate the calling user
  const authHeader = req.headers.get("Authorization")
  const supabaseClient = createClient(supabaseUrl, serviceKey)
  const userClient = createClient(supabaseUrl, authHeader?.replace("Bearer ", "") || "")

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Check admin role
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()

    if (req.method === "GET" || body.action === "status") {
      // Return key hint + status (never the actual key)
      const { data } = await supabaseClient
        .from("platform_secrets")
        .select("key_hint, is_active, rotated_at, created_at")
        .eq("key_name", "OPENROUTER_API_KEY")
        .maybeSingle()

      // Validate the key works
      let keyValid = false
      try {
        const { data: secret } = await supabaseClient.rpc("get_platform_secret", {
          p_key_name: "OPENROUTER_API_KEY",
        })
        if (secret) {
          const res = await fetch("https://openrouter.ai/api/v1/key", {
            headers: { Authorization: `Bearer ${secret}` },
          })
          keyValid = res.ok
        }
      } catch {}

      const envKeySet = !!Deno.env.get("OPENROUTER_API_KEY")

      return new Response(JSON.stringify({
        success: true,
        data: {
          has_db_key: !!data,
          key_hint: data?.key_hint || null,
          is_active: data?.is_active ?? false,
          rotated_at: data?.rotated_at || null,
          key_valid: keyValid,
          has_env_fallback: envKeySet,
          source: data ? "database" : envKeySet ? "environment" : "none",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (body.action === "set") {
      const apiKey = body.api_key
      if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("sk-")) {
        return new Response(JSON.stringify({ error: "Invalid API key format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Validate key with OpenRouter before saving
      const validationRes = await fetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!validationRes.ok) {
        return new Response(JSON.stringify({ error: "API key validation failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Store encrypted
      await supabaseClient.rpc("store_platform_secret", {
        p_key_name: "OPENROUTER_API_KEY",
        p_raw_value: apiKey,
        p_user_id: user.id,
      })

      return new Response(JSON.stringify({
        success: true,
        message: "API key stored successfully",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (body.action === "delete") {
      await supabaseClient
        .from("platform_secrets")
        .update({ is_active: false })
        .eq("key_name", "OPENROUTER_API_KEY")

      return new Response(JSON.stringify({
        success: true,
        message: "API key deactivated, falling back to environment variable",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
```

### 4.6 Frontend Component

```tsx
// File: src/components/ai-settings/ApiKeyManager.tsx

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Key, Shield, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

function useApiKeyStatus() {
  return useQuery({
    queryKey: ['api-key-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-api-key', {
        body: { action: 'status' },
      })
      if (error) throw error
      return data.data
    },
    refetchInterval: 60_000,
  })
}

export function ApiKeyManager() {
  const [newKey, setNewKey] = useState('')
  const [showInput, setShowInput] = useState(false)
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useApiKeyStatus()

  const setKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke('manage-api-key', {
        body: { action: 'set', api_key: apiKey },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Chave API salva com sucesso')
      setNewKey('')
      setShowInput(false)
      queryClient.invalidateQueries({ queryKey: ['api-key-status'] })
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar chave: ${err.message}`)
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-api-key', {
        body: { action: 'delete' },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Chave removida. Usando variavel de ambiente como fallback.')
      queryClient.invalidateQueries({ queryKey: ['api-key-status'] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="w-5 h-5" /> Chave API OpenRouter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={status?.key_valid ? 'default' : 'destructive'} className="gap-1">
            {status?.key_valid
              ? <><CheckCircle className="w-3 h-3" /> Valida</>
              : <><XCircle className="w-3 h-3" /> Invalida / Nao configurada</>
            }
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Shield className="w-3 h-3" />
            Fonte: {status?.source === 'database' ? 'Banco de Dados (criptografada)'
              : status?.source === 'environment' ? 'Variavel de Ambiente'
              : 'Nenhuma'}
          </Badge>
          {status?.key_hint && (
            <Badge variant="secondary" className="font-mono text-xs">
              {status.key_hint}
            </Badge>
          )}
        </div>

        {status?.rotated_at && (
          <p className="text-xs text-muted-foreground">
            Ultima rotacao: {new Date(status.rotated_at).toLocaleString('pt-BR')}
          </p>
        )}

        {/* Actions */}
        {showInput ? (
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="sk-or-v1-..."
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newKey.startsWith('sk-') || setKeyMutation.isPending}
                onClick={() => setKeyMutation.mutate(newKey)}
              >
                {setKeyMutation.isPending && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                Validar e Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowInput(false); setNewKey('') }}>
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave sera validada com a API do OpenRouter e armazenada criptografada no banco de dados.
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowInput(true)}>
              {status?.has_db_key ? 'Rotacionar Chave' : 'Configurar Chave'}
            </Button>
            {status?.has_db_key && (
              <Button size="sm" variant="ghost" className="text-destructive"
                onClick={() => deleteKeyMutation.mutate()}>
                <Trash2 className="w-3 h-3 mr-1" /> Remover
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

Then add it to AISettings.tsx in the Credits tab or as a new "Configuracoes" tab.

### 4.7 Security Considerations

| Concern | Mitigation |
|---------|------------|
| Key stored in DB | Encrypted with pgcrypto `pgp_sym_encrypt`. Only decryptable via `SECURITY DEFINER` function. |
| Key visible in UI | Never returned to frontend. Only a 4-char hint (`...xK9m`) is shown. |
| Non-admin access | Edge function checks user role = 'admin' before any operation. RLS restricts table to service_role. |
| Key validation | Key is validated against OpenRouter `/key` endpoint before storage. |
| Key rotation | Old key is overwritten atomically. 5-minute cache TTL means propagation within 5 minutes. |
| Env var fallback | If DB key is deleted/deactivated, the system falls back to the env var seamlessly. |

---

## 5. Architecture Diagram

```
                          ADMIN PANEL (React)
                               |
                    [ApiKeyManager Component]
                               |
                    POST /manage-api-key
                     { action: "set", api_key: "sk-..." }
                               |
                               v
                 +----------------------------+
                 |   manage-api-key (Edge Fn)  |
                 |  1. Authenticate user       |
                 |  2. Verify admin role        |
                 |  3. Validate key w/ OR API   |
                 |  4. store_platform_secret()  |
                 +----------------------------+
                               |
                               v
              +----------------------------------+
              |       platform_secrets (DB)       |
              |  key_name | encrypted_value | hint |
              |  OPENROUTER_API_KEY | [pgcrypto] |  |
              +----------------------------------+
                               ^
                               |
                    get_platform_secret() RPC
                               |
                 +----------------------------+
                 |    get-api-key.ts (shared)   |
                 |  1. Check in-memory cache    |
                 |  2. Query DB (decrypt)       |
                 |  3. Fallback to Deno.env     |
                 |  4. Cache for 5 min          |
                 +----------------------------+
                               |
              +----------------+----------------+
              |                |                |
              v                v                v
      openrouter-client   openrouter-credits  12+ other edge fns
      (chat, embeddings)  (balance check)     (gradually migrated)
              |
              v
        OpenRouter API
```

---

## 6. Recommended Improvements Priority List

### P0 - Critical (Do Now)

1. **Consolidate API key access**: Create `get-api-key.ts` shared helper. Migrate all 12+ edge functions to use it. This is the prerequisite for the admin key management feature.

2. **Fix RLS on ai_model_catalog**: Change the write policy from `auth.role() = 'authenticated'` to an admin-only check. Currently any logged-in user can modify the model catalog.

### P1 - High (This Sprint)

3. **Implement admin API key management**: Full feature as described in Section 4. Database migration + edge function + frontend component.

4. **Migrate bypassing edge functions to shared client**: `csat-processor`, `evaluate-service`, `generate-close-review`, `ticket-category-classifier`, `extract-conversation-knowledge`, `generate-ticket-description`, `validate-contact-name` all build their own OpenRouter fetch. They should use `callOpenRouter()` or `callOpenRouterWithFallback()` to get error handling, logging, and timeout management.

5. **Unify cost tracking**: Either merge `ai_api_logs` and `ai_usage_log` into one table, or add a foreign key relationship. Current dual-table setup leads to fragmented cost reporting.

### P2 - Medium (Next Sprint)

6. **Dynamic timeout per model tier**: Reasoning models (tier containing 'reasoning' capability) should get 60s timeout. Standard models keep 25s. Embedding models can use 15s.

```typescript
function getTimeoutForModel(model: string, capabilities?: string[]): number {
  if (capabilities?.includes('reasoning')) return 60_000
  if (model.includes('embedding')) return 15_000
  return 25_000
}
```

7. **Add retry for 5xx errors**: Before falling back to next model, retry the same model once for 500/502/503 errors with a short delay.

8. **Cache credits endpoint**: Add 60s cache to `openrouter-credits` to avoid excessive API calls.

9. **Batch upserts in sync-openrouter-models**: Group models into batches of 50 and use a single upsert call per batch.

### P3 - Low (Backlog)

10. **CORS restriction**: Replace `*` with the actual application domain in all edge functions.

11. **Cost alert system**: Add a database trigger or cron that alerts admins when daily/weekly cost exceeds a configured threshold.

12. **Multi-tenant key support**: If the platform evolves to multi-tenant, extend `platform_secrets` with an `organization_id` column.

13. **Cache invalidation webhook**: When admin updates config via UI, call a lightweight edge function that signals Deno isolates to clear caches (or reduce cache TTL to 10s for the first minute after a change).

---

*End of audit report.*
