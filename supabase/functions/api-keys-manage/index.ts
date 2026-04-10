/**
 * API Keys Management — Admin Only
 *
 * CRUD de API keys para a API publica.
 * Autenticacao via JWT + verificacao de role admin.
 *
 * Actions: create, list, get, activate, deactivate, delete
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateApiKey } from '../_shared/api-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status)
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

// Planos com rate limits padrao
const PLAN_LIMITS: Record<string, { rpm: number; rpd: number }> = {
  free:       { rpm: 30,  rpd: 1000 },
  starter:    { rpm: 60,  rpd: 10000 },
  pro:        { rpm: 120, rpd: 50000 },
  enterprise: { rpm: 300, rpd: 200000 },
}

const VALID_SCOPES = [
  'conversations:read',
  'tickets:read',
  'clients:read',
  'webhooks:read',
  'webhooks:write',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405)
  }

  // Auth
  const user = await getAuthUser(req)
  if (!user) return err('Unauthorized', 401)
  if (!(await isAdmin(user.id))) return err('Forbidden: admin role required', 403)

  const body = await req.json()
  const { action } = body

  const supabase = getSupabase()

  switch (action) {
    case 'create': {
      const { name, organization_name, contact_email, plan, scopes, expires_at } = body
      if (!name || !organization_name || !contact_email) {
        return err('name, organization_name and contact_email are required')
      }

      const keyPlan = plan && PLAN_LIMITS[plan] ? plan : 'free'
      const limits = PLAN_LIMITS[keyPlan]

      // Validar scopes
      const keyScopes = (scopes || ['conversations:read', 'tickets:read', 'clients:read'])
        .filter((s: string) => VALID_SCOPES.includes(s))
      if (keyScopes.length === 0) {
        return err('At least one valid scope is required')
      }

      // Gerar chave
      const { key, keyHash, keyPrefix } = await generateApiKey('live')

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          scopes: keyScopes,
          rate_limit_rpm: limits.rpm,
          rate_limit_rpd: limits.rpd,
          plan: keyPlan,
          organization_name,
          contact_email,
          is_active: true,
          expires_at: expires_at || null,
          created_by: user.id,
        })
        .select('id, name, key_prefix, scopes, plan, organization_name, contact_email, rate_limit_rpm, rate_limit_rpd, is_active, expires_at, created_at')
        .single()

      if (error) {
        console.error('Failed to create API key:', error)
        return err('Failed to create API key', 500)
      }

      // Retorna a key em texto plano UMA vez
      return json({ ...data, key }, 201)
    }

    case 'list': {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, scopes, plan, organization_name, contact_email, rate_limit_rpm, rate_limit_rpd, is_active, expires_at, request_count, last_used_at, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) return err('Failed to list API keys', 500)
      return json(data || [])
    }

    case 'get': {
      const { id } = body
      if (!id) return err('id is required')

      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, scopes, plan, organization_name, contact_email, rate_limit_rpm, rate_limit_rpd, is_active, expires_at, request_count, last_used_at, created_at, updated_at')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (error || !data) return err('API key not found', 404)
      return json(data)
    }

    case 'activate': {
      const { id } = body
      if (!id) return err('id is required')

      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)

      if (error) return err('Failed to activate', 500)
      return json({ success: true })
    }

    case 'deactivate': {
      const { id } = body
      if (!id) return err('id is required')

      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)

      if (error) return err('Failed to deactivate', 500)
      return json({ success: true })
    }

    case 'delete': {
      const { id } = body
      if (!id) return err('id is required')

      const { error } = await supabase
        .from('api_keys')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)

      if (error) return err('Failed to delete', 500)
      return json({ success: true })
    }

    case 'stats': {
      // Buscar todas as chaves ativas com contadores
      const { data: keys } = await supabase
        .from('api_keys')
        .select('id, name, organization_name, key_prefix, plan, is_active, request_count, last_used_at, rate_limit_rpm, rate_limit_rpd')
        .is('deleted_at', null)
        .order('request_count', { ascending: false })

      const allKeys = keys || []
      const activeKeys = allKeys.filter(k => k.is_active)
      const totalRequests = allKeys.reduce((sum, k) => sum + (k.request_count || 0), 0)

      // Buscar rate limits das ultimas 24h para grafico
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: rateLimits } = await supabase
        .from('api_rate_limits')
        .select('api_key_id, window_start, request_count, window_type')
        .gte('window_start', since24h)
        .eq('window_type', 'minute')
        .order('window_start', { ascending: true })

      // Agregar por hora para o grafico
      const hourlyMap: Record<string, number> = {}
      for (const rl of rateLimits || []) {
        const hour = rl.window_start.slice(0, 13) + ':00:00'
        hourlyMap[hour] = (hourlyMap[hour] || 0) + rl.request_count
      }
      const hourlyUsage = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }))

      // Requests hoje
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: todayLimits } = await supabase
        .from('api_rate_limits')
        .select('request_count')
        .gte('window_start', todayStart.toISOString())
        .eq('window_type', 'minute')

      const requestsToday = (todayLimits || []).reduce((sum, r) => sum + r.request_count, 0)

      return json({
        total_keys: allKeys.length,
        active_keys: activeKeys.length,
        total_requests: totalRequests,
        requests_today: requestsToday,
        keys: allKeys,
        hourly_usage: hourlyUsage,
      })
    }

    default:
      return err(`Unknown action: ${action}`)
  }
})
