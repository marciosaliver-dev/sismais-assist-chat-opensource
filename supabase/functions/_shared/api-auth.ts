/**
 * API Authentication — Sismais Public API
 *
 * Autentica requests via API key no header X-API-Key.
 * A key e hasheada com SHA-256 e comparada com o hash no banco.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ApiKeyInfo {
  id: string
  name: string
  scopes: string[]
  rate_limit_rpm: number
  rate_limit_rpd: number
  plan: string
  organization_name: string | null
}

export type AuthResult = {
  success: true
  key: ApiKeyInfo
} | {
  success: false
  error: string
  status: number
}

/**
 * Gera hash SHA-256 de uma API key
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Autentica request usando header X-API-Key.
 * Retorna info da key se valida, ou erro.
 */
export async function authenticateApiKey(req: Request): Promise<AuthResult> {
  const apiKey = req.headers.get('X-API-Key')

  if (!apiKey) {
    return { success: false, error: 'Missing X-API-Key header', status: 401 }
  }

  // Validar formato basico (sk_live_ ou sk_test_ + 32 chars)
  if (!/^sk_(live|test)_[a-zA-Z0-9]{32}$/.test(apiKey)) {
    return { success: false, error: 'Invalid API key format', status: 401 }
  }

  const keyHash = await hashApiKey(apiKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, scopes, rate_limit_rpm, rate_limit_rpd, plan, organization_name, is_active, expires_at')
    .eq('key_hash', keyHash)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    return { success: false, error: 'Invalid API key', status: 401 }
  }

  if (!data.is_active) {
    return { success: false, error: 'API key is disabled', status: 403 }
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { success: false, error: 'API key has expired', status: 403 }
  }

  // Incrementar uso (fire and forget)
  supabase.rpc('increment_api_key_usage', { p_key_id: data.id }).then(() => {})

  return {
    success: true,
    key: {
      id: data.id,
      name: data.name,
      scopes: data.scopes,
      rate_limit_rpm: data.rate_limit_rpm,
      rate_limit_rpd: data.rate_limit_rpd,
      plan: data.plan,
      organization_name: data.organization_name,
    },
  }
}

/**
 * Verifica se a key tem um scope especifico
 */
export function hasScope(key: ApiKeyInfo, scope: string): boolean {
  return key.scopes.includes('*') || key.scopes.includes(scope)
}

/**
 * Gera uma nova API key (retorna a key em texto plano — mostrar apenas uma vez)
 */
export async function generateApiKey(prefix: 'live' | 'test' = 'live'): Promise<{
  key: string
  keyHash: string
  keyPrefix: string
}> {
  const randomBytes = new Uint8Array(24)
  crypto.getRandomValues(randomBytes)
  const randomPart = Array.from(randomBytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
  const key = `sk_${prefix}_${randomPart}`
  const keyHash = await hashApiKey(key)
  const keyPrefix = `sk_${prefix}_${randomPart.slice(0, 8)}...`

  return { key, keyHash, keyPrefix }
}
