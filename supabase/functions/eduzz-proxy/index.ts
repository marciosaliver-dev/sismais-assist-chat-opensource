/**
 * Edge Function: eduzz-proxy
 * Proxy para API Eduzz (produtos digitais).
 * Usado como tool pelos agentes IA (financial/sales agent).
 *
 * Nova API Eduzz (2025+): autenticacao simplificada por API key.
 * Endpoints: /myeduzz/v1/ (vendas, assinaturas, clientes, produtos)
 * Docs: https://developers.eduzz.com/docs/api
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

interface EduzzRequest {
  action: string
  email?: string
  cpf?: string
  customerId?: string
  saleId?: string
  subscriptionId?: string
  productId?: string
  status?: string
  page?: number
  limit?: number
}

// URL base da nova API Eduzz
const EDUZZ_BASE_URL = Deno.env.get('EDUZZ_API_URL') || 'https://api.eduzz.com'

const VALID_ACTIONS = [
  'list_sales',
  'list_subscriptions',
  'list_customers',
  'get_sale',
  'get_subscription',
  'list_products',
  'get_me',
] as const

// ── Fetch com API key + retry + timeout ──

async function eduzzFetch(path: string): Promise<unknown> {
  const apiKey = Deno.env.get('EDUZZ_API_KEY')
  if (!apiKey) {
    throw new Error('EDUZZ_API_KEY must be configured')
  }

  const url = `${EDUZZ_BASE_URL}${path}`

  return withRetry(
    () =>
      withTimeout(
        async (signal) => {
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            signal,
          })
          if (!res.ok) {
            const body = await res.text()
            throw new Error(`Eduzz API ${res.status}: ${body}`)
          }
          return res.json()
        },
        { timeoutMs: 10_000, errorMessage: `Eduzz request timeout: ${path}` },
      ),
    { maxAttempts: 3, baseDelayMs: 500 },
  )
}

// ── Helpers ──

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

// ── Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  const log = createLogger('eduzz-proxy', extractRequestId(req))

  // Auth JWT (usuario do sistema)
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
    const body: EduzzRequest = await req.json()
    const { action } = body

    if (!action || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
      return errorResponse(`Invalid action: ${action}. Valid: ${VALID_ACTIONS.join(', ')}`, 400)
    }

    log.info('Processing action', { action, userId: user.id })

    let result: unknown

    switch (action) {
      // Conta do produtor
      case 'get_me': {
        result = await eduzzFetch('/accounts/v1/me')
        break
      }

      // Vendas
      case 'list_sales': {
        const query = buildQuery({
          email: body.email,
          document: body.cpf,
          status: body.status,
          page: body.page,
          limit: body.limit || 50,
        })
        log.info('Listing sales', { email: maskPII(body.email), cpf: maskPII(body.cpf) })
        result = await eduzzFetch(`/myeduzz/v1/sales${query}`)
        break
      }

      case 'get_sale': {
        if (!body.saleId) return errorResponse('saleId is required', 400)
        log.info('Getting sale', { saleId: body.saleId })
        result = await eduzzFetch(`/myeduzz/v1/sales/${body.saleId}`)
        break
      }

      // Assinaturas
      case 'list_subscriptions': {
        const query = buildQuery({
          email: body.email,
          status: body.status,
          page: body.page,
          limit: body.limit || 50,
        })
        log.info('Listing subscriptions', { email: maskPII(body.email) })
        result = await eduzzFetch(`/myeduzz/v1/subscriptions${query}`)
        break
      }

      case 'get_subscription': {
        if (!body.subscriptionId) return errorResponse('subscriptionId is required', 400)
        log.info('Getting subscription', { subscriptionId: body.subscriptionId })
        result = await eduzzFetch(`/myeduzz/v1/subscriptions/${body.subscriptionId}`)
        break
      }

      // Clientes
      case 'list_customers': {
        const query = buildQuery({
          email: body.email,
          document: body.cpf,
          page: body.page,
          limit: body.limit || 50,
        })
        log.info('Listing customers', { email: maskPII(body.email) })
        result = await eduzzFetch(`/myeduzz/v1/customers${query}`)
        break
      }

      // Produtos
      case 'list_products': {
        const query = buildQuery({
          page: body.page,
          limit: body.limit || 50,
        })
        log.info('Listing products')
        result = await eduzzFetch(`/myeduzz/v1/products${query}`)
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
