/**
 * Rate Limiting — Sismais Public API
 *
 * Usa janela fixa (por minuto e por dia) via funcao SQL atomica.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ApiKeyInfo } from './api-auth.ts'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number // unix timestamp
  retryAfter?: number // seconds
}

/**
 * Verifica rate limit para uma API key.
 * Checa janela por minuto E por dia.
 */
export async function checkRateLimit(key: ApiKeyInfo): Promise<RateLimitResult> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Check por minuto
  const { data: minuteOk } = await supabase.rpc('check_api_rate_limit', {
    p_key_id: key.id,
    p_window_type: 'minute',
    p_max_requests: key.rate_limit_rpm,
  })

  if (!minuteOk) {
    const now = new Date()
    const nextMinute = new Date(now)
    nextMinute.setSeconds(60, 0)
    const retryAfter = Math.ceil((nextMinute.getTime() - now.getTime()) / 1000)

    return {
      allowed: false,
      limit: key.rate_limit_rpm,
      remaining: 0,
      reset: Math.floor(nextMinute.getTime() / 1000),
      retryAfter,
    }
  }

  // Check por dia
  const { data: dayOk } = await supabase.rpc('check_api_rate_limit', {
    p_key_id: key.id,
    p_window_type: 'day',
    p_max_requests: key.rate_limit_rpd,
  })

  if (!dayOk) {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setHours(24, 0, 0, 0)
    const retryAfter = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)

    return {
      allowed: false,
      limit: key.rate_limit_rpd,
      remaining: 0,
      reset: Math.floor(tomorrow.getTime() / 1000),
      retryAfter,
    }
  }

  return {
    allowed: true,
    limit: key.rate_limit_rpm,
    remaining: key.rate_limit_rpm - 1, // aproximado
    reset: Math.floor(Date.now() / 1000) + 60,
  }
}

/**
 * Headers padrao de rate limit para incluir na resposta
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }
  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter)
  }
  return headers
}
