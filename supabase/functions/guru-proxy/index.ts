/**
 * Edge Function: guru-proxy
 * Proxy para API Guru Manager (vendas digitais).
 * Usado como tool pelos agentes IA (financial/sales agent).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from '../_shared/supabase-helpers.ts'
import { withRetry, withTimeout } from '../_shared/resilience.ts'
import { createLogger, extractRequestId } from '../_shared/structured-log.ts'

// ── PII Masking ──

function maskPII(value: string | undefined): string {
  if (!value) return '***'
  if (value.includes('@')) return value[0] + '***@' + value.split('@')[1]
  if (value.length >= 11) return value.slice(0, 3) + '***' + value.slice(-2)
  return value.slice(0, 2) + '***'
}

// ── Tipos ──

interface GuruRequest {
  action: string
  email?: string
}

const GURU_BASE_URL = 'https://digitalmanager.guru/api/v1'

const VALID_ACTIONS = [
  'list_transactions',
  'list_subscriptions',
  'list_products',
  'get_contact',
] as const

// ── Fetch com retry + timeout ──

async function guruFetch(
  path: string,
  apiToken: string,
): Promise<unknown> {
  const url = `${GURU_BASE_URL}${path}`

  return withRetry(
    () =>
      withTimeout(
        async (signal) => {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            signal,
          })
          if (!res.ok) {
            const body = await res.text()
            throw new Error(`Guru API ${res.status}: ${body}`)
          }
          return res.json()
        },
        { timeoutMs: 10_000, errorMessage: `Guru request timeout: ${path}` },
      ),
    { maxAttempts: 3, baseDelayMs: 500 },
  )
}

// ── Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  const log = createLogger('guru-proxy', extractRequestId(req))

  // Auth JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Missing authorization', 401)

  const token = authHeader.replace('Bearer ', '')
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return errorResponse('Invalid token', 401)

  try {
    const body: GuruRequest = await req.json()
    const { action } = body

    if (!action || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
      return errorResponse(`Invalid action: ${action}. Valid: ${VALID_ACTIONS.join(', ')}`, 400)
    }

    const apiToken = Deno.env.get('GURU_API_TOKEN')
    if (!apiToken) return errorResponse('GURU_API_TOKEN not configured', 500)

    log.info('Processing action', { action, userId: user.id })

    let result: unknown

    switch (action) {
      case 'list_transactions': {
        if (!body.email) return errorResponse('email is required', 400)
        log.info('Listing transactions', { email: maskPII(body.email) })
        result = await guruFetch(`/transactions?email=${encodeURIComponent(body.email)}`, apiToken)
        break
      }
      case 'list_subscriptions': {
        if (!body.email) return errorResponse('email is required', 400)
        log.info('Listing subscriptions', { email: maskPII(body.email) })
        result = await guruFetch(`/subscriptions?contact_email=${encodeURIComponent(body.email)}`, apiToken)
        break
      }
      case 'list_products': {
        log.info('Listing products')
        result = await guruFetch('/products', apiToken)
        break
      }
      case 'get_contact': {
        if (!body.email) return errorResponse('email is required', 400)
        log.info('Getting contact', { email: maskPII(body.email) })
        result = await guruFetch(`/contacts?email=${encodeURIComponent(body.email)}`, apiToken)
        break
      }
    }

    log.info('Action completed', { action })
    return jsonResponse({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('Request failed', { error: message })
    return errorResponse(message, 502)
  }
})
