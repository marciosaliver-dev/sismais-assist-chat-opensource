/**
 * Shared OpenRouter client for ALL AI calls (chat, embeddings, audio).
 * Single provider — no OpenAI direct, no Lovable Gateway.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { withCircuitBreaker, CircuitBreakerOpenError } from './resilience.ts';

const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

const CIRCUIT_BREAKER_NAME = "openrouter-api";

/** Timeout for each individual LLM request (ms). */
const REQUEST_TIMEOUT_MS = 25_000

/** Exponential backoff base delay (ms) between fallback model attempts. */
const BACKOFF_BASE_MS = 500

interface OpenRouterHeaders {
  Authorization: string
  "Content-Type": string
  "HTTP-Referer": string
  "X-Title": string
}

function getHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY")
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured")

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "https://sismais.com",
    "X-Title": "Sismais Helpdesk",
  }
}

// ── API Logging ──

interface LogApiCallParams {
  edgeFunction: string
  model: string
  result?: ChatResult
  latencyMs: number
  status: "success" | "error" | "timeout"
  errorMessage?: string
  conversationId?: string
  agentId?: string
}

async function logApiCall(params: LogApiCallParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceKey) return

    const sb = createClient(supabaseUrl, serviceKey)
    await sb.from("ai_api_logs").insert({
      edge_function: params.edgeFunction,
      model: params.model,
      prompt_tokens: params.result?.usage?.prompt_tokens || 0,
      completion_tokens: params.result?.usage?.completion_tokens || 0,
      total_tokens: params.result?.usage?.total_tokens || 0,
      cost_usd: params.result?.cost_usd || 0,
      latency_ms: params.latencyMs,
      status: params.status,
      error_message: params.errorMessage || null,
      conversation_id: params.conversationId || null,
      agent_id: params.agentId || null,
    })
  } catch (err) {
    console.warn("[openrouter-client] Failed to log API call:", (err as Error).message)
  }
}

// ── Chat Completions ──

export interface ChatParams {
  model: string
  messages: any[]
  tools?: any[]
  tool_choice?: any
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  stream?: boolean
  modalities?: string[]
  audio?: { voice: string; format: string }
  response_format?: any
  /** Context for API logging */
  _logContext?: {
    edgeFunction: string
    conversationId?: string
    agentId?: string
  }
}

export interface ChatResult {
  content: string | null
  tool_calls?: any[]
  audio?: { data: string; transcript?: string }
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  model_used: string
  cost_usd: number
  raw_choice: any
}

export async function callOpenRouter(params: ChatParams): Promise<ChatResult> {
  const body: Record<string, any> = {
    model: params.model,
    messages: params.messages,
    stream: params.stream ?? false,
  }

  if (params.tools?.length) body.tools = params.tools
  if (params.tool_choice !== undefined) body.tool_choice = params.tool_choice
  if (params.temperature !== undefined) body.temperature = params.temperature
  if (params.max_tokens !== undefined) body.max_tokens = params.max_tokens
  if (params.max_completion_tokens !== undefined) body.max_completion_tokens = params.max_completion_tokens
  if (params.modalities) body.modalities = params.modalities
  if (params.audio) body.audio = params.audio
  if (params.response_format) body.response_format = params.response_format

  const logCtx = params._logContext
  const startTime = Date.now()

  // Abort controller for per-request timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    const fetchWithCircuitBreaker = () => fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    response = await withCircuitBreaker(fetchWithCircuitBreaker, {
      failureThreshold: 10,
      resetTimeoutMs: 60_000,
      name: CIRCUIT_BREAKER_NAME,
    });
  } catch (err) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime
    if (err instanceof CircuitBreakerOpenError) {
      const error = new OpenRouterError(
        `OpenRouter circuit breaker open. Retry after ${Math.round(err.retryAfterMs / 1000)}s`,
        503,
        "circuit_breaker"
      );
      if (logCtx) {
        logApiCall({ edgeFunction: logCtx.edgeFunction, model: params.model, latencyMs, status: "error", errorMessage: error.message, conversationId: logCtx.conversationId, agentId: logCtx.agentId });
      }
      throw error;
    }
    if ((err as Error).name === "AbortError") {
      const error = new OpenRouterError(
        `Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s for model ${params.model}`,
        408,
        "timeout"
      )
      if (logCtx) {
        logApiCall({ edgeFunction: logCtx.edgeFunction, model: params.model, latencyMs, status: "timeout", errorMessage: error.message, conversationId: logCtx.conversationId, agentId: logCtx.agentId })
      }
      throw error
    }
    if (logCtx) {
      logApiCall({ edgeFunction: logCtx.edgeFunction, model: params.model, latencyMs, status: "error", errorMessage: (err as Error).message, conversationId: logCtx.conversationId, agentId: logCtx.agentId })
    }
    throw err
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errText = await response.text()
    const latencyMs = Date.now() - startTime
    let error: OpenRouterError
    if (response.status === 429) {
      error = new OpenRouterError("Rate limit exceeded", 429, errText)
    } else if (response.status === 402) {
      error = new OpenRouterError("Insufficient credits", 402, errText)
    } else {
      error = new OpenRouterError(`OpenRouter error [${response.status}]`, response.status, errText)
    }
    if (logCtx) {
      logApiCall({ edgeFunction: logCtx.edgeFunction, model: params.model, latencyMs, status: "error", errorMessage: error.message, conversationId: logCtx.conversationId, agentId: logCtx.agentId })
    }
    throw error
  }

  const data = await response.json()
  const choice = data.choices?.[0]
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const latencyMs = Date.now() - startTime

  const result: ChatResult = {
    content: choice?.message?.content || null,
    tool_calls: choice?.message?.tool_calls,
    audio: choice?.message?.audio,
    usage,
    model_used: data.model || params.model,
    cost_usd: typeof data.usage?.cost === "number" ? data.usage.cost : 0,
    raw_choice: choice,
  }

  // Log successful call (fire and forget)
  if (logCtx) {
    logApiCall({ edgeFunction: logCtx.edgeFunction, model: params.model, result, latencyMs, status: "success", conversationId: logCtx.conversationId, agentId: logCtx.agentId })
  }

  return result
}

// ── Chat Completions with Fallback Chain ──

export interface FallbackParams extends Omit<ChatParams, "model"> {
  models: string[]
}

/** Sleep helper with jitter to avoid thundering herd on retries. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function callOpenRouterWithFallback(params: FallbackParams): Promise<ChatResult> {
  const { models, ...rest } = params
  let lastError: Error | null = null

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    try {
      const result = await callOpenRouter({ ...rest, model })
      if (i > 0) {
        console.log(`[openrouter-client] Fallback success with model: ${model} (attempt ${i + 1})`)
      }
      return result
    } catch (err) {
      lastError = err as Error
      const status = err instanceof OpenRouterError ? err.status : 0
      console.warn(
        `[openrouter-client] Model ${model} failed [${status}]: ${(err as Error).message}`
      )

      // 402 = no credits — pointless to try other models, all will fail
      if (status === 402) throw err

      // Before trying next model, apply exponential backoff with jitter
      // (skip delay after last model — no next attempt)
      if (i < models.length - 1) {
        // 429 = rate limit → longer backoff; other errors → shorter
        const base = status === 429 ? BACKOFF_BASE_MS * 2 : BACKOFF_BASE_MS
        const delay = Math.min(base * Math.pow(2, i) + Math.random() * 200, 3_000)
        console.log(`[openrouter-client] Backoff ${Math.round(delay)}ms before next model`)
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error("All models in fallback chain failed")
}

// ── Embeddings ──

export interface EmbeddingParams {
  model: string
  input: string | string[]
}

export interface EmbeddingResult {
  embedding: number[]
  embeddings?: number[][]
  tokens_used: number
}

export async function callOpenRouterEmbedding(params: EmbeddingParams): Promise<EmbeddingResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${OPENROUTER_BASE}/embeddings`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: params.model,
        input: params.input,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if ((err as Error).name === "AbortError") {
      throw new OpenRouterError(`Embedding request timeout after ${REQUEST_TIMEOUT_MS / 1000}s`, 408, "timeout")
    }
    throw err
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errText = await response.text()
    if (response.status === 429) {
      throw new OpenRouterError("Embedding rate limit exceeded", 429, errText)
    }
    if (response.status === 402) {
      throw new OpenRouterError("Insufficient credits for embedding", 402, errText)
    }
    throw new OpenRouterError(`OpenRouter embedding error [${response.status}]`, response.status, errText)
  }

  const data = await response.json()
  const usage = data.usage || {}

  if (Array.isArray(params.input)) {
    return {
      embedding: data.data?.[0]?.embedding || [],
      embeddings: data.data?.map((d: any) => d.embedding) || [],
      tokens_used: usage.total_tokens || usage.prompt_tokens || 0,
    }
  }

  return {
    embedding: data.data?.[0]?.embedding || [],
    tokens_used: usage.total_tokens || usage.prompt_tokens || 0,
  }
}

// ── Error Class ──

export class OpenRouterError extends Error {
  status: number
  body: string

  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = "OpenRouterError"
    this.status = status
    this.body = body
  }
}
