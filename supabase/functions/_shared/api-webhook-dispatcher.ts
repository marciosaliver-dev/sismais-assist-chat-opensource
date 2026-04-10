/**
 * Webhook Dispatcher — Sismais Public API
 *
 * Dispara webhooks de saida para integradores quando eventos ocorrem.
 * Eventos suportados: ticket.created, message.received, conversation.escalated
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type WebhookEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'message.received'
  | 'message.sent'
  | 'conversation.escalated'
  | 'conversation.closed'

/**
 * Gera assinatura HMAC-SHA256 do payload
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Dispara webhooks para todos os integradores inscritos em um evento.
 * Fire-and-forget — nao bloqueia o caller.
 */
export async function dispatchWebhooks(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Buscar webhooks ativos inscritos neste evento
  const { data: webhooks, error } = await supabase
    .from('api_webhooks')
    .select('id, url, secret, failure_count, max_failures')
    .filter('events', 'cs', `{${event}}`)
    .eq('is_active', true)

  if (error || !webhooks?.length) return

  const eventPayload = {
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  }
  const payloadStr = JSON.stringify(eventPayload)

  for (const wh of webhooks) {
    try {
      const signature = await signPayload(payloadStr, wh.secret)
      const startTime = Date.now()

      const resp = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sismais-Signature': `sha256=${signature}`,
          'X-Sismais-Event': event,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000),
      })

      const durationMs = Date.now() - startTime
      const responseBody = await resp.text().catch(() => '')
      const success = resp.status >= 200 && resp.status < 300

      // Log delivery
      await supabase.from('api_webhook_deliveries').insert({
        webhook_id: wh.id,
        event,
        payload: eventPayload,
        response_status: resp.status,
        response_body: responseBody.slice(0, 1000),
        duration_ms: durationMs,
        success,
      })

      if (success) {
        // Reset failure count
        if (wh.failure_count > 0) {
          await supabase.from('api_webhooks').update({ failure_count: 0 }).eq('id', wh.id)
        }
      } else {
        const newCount = wh.failure_count + 1
        const updates: Record<string, unknown> = { failure_count: newCount }
        if (newCount >= wh.max_failures) {
          updates.is_active = false
        }
        await supabase.from('api_webhooks').update(updates).eq('id', wh.id)
      }
    } catch (err) {
      // Timeout ou erro de rede
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await supabase.from('api_webhook_deliveries').insert({
        webhook_id: wh.id,
        event,
        payload: eventPayload,
        response_status: 0,
        response_body: msg,
        duration_ms: 0,
        success: false,
      })

      const newCount = wh.failure_count + 1
      const updates: Record<string, unknown> = { failure_count: newCount }
      if (newCount >= wh.max_failures) {
        updates.is_active = false
      }
      await supabase.from('api_webhooks').update(updates).eq('id', wh.id)
    }
  }
}
