/**
 * Edge Function: asaas-proxy
 * Proxy para API Asaas (assinaturas, boletos, PIX).
 * Usado como tool pelos agentes IA (financial agent).
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

interface AsaasRequest {
  action: string
  cpfCnpj?: string
  customerId?: string
  paymentId?: string
  status?: string
}

const VALID_ACTIONS = [
  'find_customer',
  'list_subscriptions',
  'list_payments',
  'get_payment',
  'get_boleto_line',
  'get_pix_qr',
] as const

// ── Fetch com retry + timeout ──

async function asaasFetch(
  path: string,
  apiUrl: string,
  apiKey: string,
): Promise<unknown> {
  const url = `${apiUrl}${path}`

  return withRetry(
    () =>
      withTimeout(
        async (signal) => {
          const res = await fetch(url, {
            headers: { access_token: apiKey, 'Content-Type': 'application/json' },
            signal,
          })
          if (!res.ok) {
            const body = await res.text()
            throw new Error(`Asaas API ${res.status}: ${body}`)
          }
          return res.json()
        },
        { timeoutMs: 10_000, errorMessage: `Asaas request timeout: ${path}` },
      ),
    { maxAttempts: 3, baseDelayMs: 500 },
  )
}

// ── Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  const log = createLogger('asaas-proxy', extractRequestId(req))

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
    const body: AsaasRequest = await req.json()
    const { action } = body

    if (!action || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
      return errorResponse(`Invalid action: ${action}. Valid: ${VALID_ACTIONS.join(', ')}`, 400)
    }

    const apiUrl = Deno.env.get('ASAAS_API_URL') || 'https://sandbox.asaas.com/api/v3'
    const apiKey = Deno.env.get('ASAAS_API_KEY')
    if (!apiKey) return errorResponse('ASAAS_API_KEY not configured', 500)

    log.info('Processing action', { action, userId: user.id })

    let result: unknown

    switch (action) {
      case 'find_customer': {
        if (!body.cpfCnpj) return errorResponse('cpfCnpj is required', 400)
        log.info('Finding customer', { cpfCnpj: maskPII(body.cpfCnpj) })
        result = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(body.cpfCnpj)}`, apiUrl, apiKey)
        break
      }
      case 'list_subscriptions': {
        if (!body.customerId) return errorResponse('customerId is required', 400)
        log.info('Listing subscriptions', { customerId: body.customerId })
        result = await asaasFetch(`/subscriptions?customer=${encodeURIComponent(body.customerId)}`, apiUrl, apiKey)
        break
      }
      case 'list_payments': {
        if (!body.customerId) return errorResponse('customerId is required', 400)
        let path = `/payments?customer=${encodeURIComponent(body.customerId)}`
        if (body.status) path += `&status=${encodeURIComponent(body.status)}`
        log.info('Listing payments', { customerId: body.customerId, status: body.status })
        result = await asaasFetch(path, apiUrl, apiKey)
        break
      }
      case 'get_payment': {
        if (!body.paymentId) return errorResponse('paymentId is required', 400)
        log.info('Getting payment', { paymentId: body.paymentId })
        result = await asaasFetch(`/payments/${encodeURIComponent(body.paymentId)}`, apiUrl, apiKey)
        break
      }
      case 'get_boleto_line': {
        if (!body.paymentId) return errorResponse('paymentId is required', 400)
        log.info('Getting boleto line', { paymentId: body.paymentId })
        result = await asaasFetch(`/payments/${encodeURIComponent(body.paymentId)}/identificationField`, apiUrl, apiKey)
        break
      }
      case 'get_pix_qr': {
        if (!body.paymentId) return errorResponse('paymentId is required', 400)
        log.info('Getting PIX QR', { paymentId: body.paymentId })
        result = await asaasFetch(`/payments/${encodeURIComponent(body.paymentId)}/pixQrCode`, apiUrl, apiKey)
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
