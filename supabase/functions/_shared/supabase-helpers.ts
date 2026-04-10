/**
 * Helpers de Supabase para Edge Functions — Sismais Helpdesk IA
 *
 * Fornece:
 * - createServiceClient: cria client com service_role (padrao para edge functions)
 * - atomicIncrement: incremento atomico de contadores (resolve D3/D8 do CTO report)
 * - corsHeaders: headers CORS padronizados
 * - jsonResponse / errorResponse: respostas HTTP padronizadas
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS Headers padronizados ──

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Supabase Client ──

let _cachedClient: SupabaseClient | null = null

/**
 * Cria (ou reutiliza) o client Supabase com service_role.
 * Reutiliza o mesmo client dentro do mesmo Deno isolate para performance.
 */
export function createServiceClient(): SupabaseClient {
  if (_cachedClient) return _cachedClient

  _cachedClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  return _cachedClient
}

// ── Respostas HTTP padronizadas ──

export function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function corsPreflightResponse(): Response {
  return new Response(null, { headers: corsHeaders })
}

// ── Incrementos atomicos (resolve race conditions D3) ──

/**
 * Incrementa atomicamente um campo numerico usando RPC.
 * Requer a funcao SQL `increment_counter` (ver migration correspondente).
 *
 * Fallback: se a funcao SQL nao existir, faz SELECT + UPDATE (nao atomico).
 */
export async function atomicIncrement(
  supabase: SupabaseClient,
  table: string,
  idColumn: string,
  idValue: string,
  counterColumn: string,
  incrementBy = 1,
): Promise<void> {
  const { error } = await supabase.rpc('increment_counter', {
    p_table: table,
    p_id_column: idColumn,
    p_id_value: idValue,
    p_counter_column: counterColumn,
    p_increment_by: incrementBy,
  })

  if (error) {
    // Fallback nao atomico (log warning)
    console.warn(JSON.stringify({
      level: 'warn',
      module: 'supabase-helpers',
      msg: `atomicIncrement RPC failed, using fallback. Table: ${table}, column: ${counterColumn}`,
      error: error.message,
    }))

    const { data } = await supabase
      .from(table)
      .select(counterColumn)
      .eq(idColumn, idValue)
      .single()

    if (data) {
      const currentVal = (data as Record<string, number>)[counterColumn] || 0
      await supabase
        .from(table)
        .update({ [counterColumn]: currentVal + incrementBy })
        .eq(idColumn, idValue)
    }
  }
}

// ── PII Masking Helpers (LGPD compliance) ──

/** Mascara telefone: 5577991234567 → 55779912****7 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '[sem telefone]'
  const clean = phone.replace(/\D/g, '')
  if (clean.length <= 4) return '****'
  return clean.slice(0, -4) + '****'
}

/** Mascara email: user@domain.com → us***@domain.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[sem email]'
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return local.slice(0, 2) + '***@' + domain
}

/** Mascara CPF/CNPJ: 12345678901 → 123.***.***-01 */
export function maskDocument(doc: string | null | undefined): string {
  if (!doc) return '[sem documento]'
  const clean = doc.replace(/\D/g, '')
  if (clean.length <= 4) return '****'
  return clean.slice(0, 3) + '***' + clean.slice(-2)
}
