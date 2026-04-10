/**
 * Meta WhatsApp Business API — Webhook Receiver
 *
 * Recebe webhooks da Meta (WhatsApp Cloud API) e roteia para o pipeline unificado.
 *
 * Endpoints:
 * - GET  /meta-whatsapp-webhook — Webhook verification challenge
 * - POST /meta-whatsapp-webhook — Recebe eventos (mensagens, status updates)
 *
 * Variaveis de ambiente necessarias:
 * - META_WHATSAPP_VERIFY_TOKEN — Token para verificacao do webhook
 * - META_WHATSAPP_APP_SECRET — App secret para verificacao de assinatura HMAC
 *
 * Feature flag: FF_CHANNEL_META_WHATSAPP=true para ativar
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MetaWhatsAppAdapter } from '../_shared/meta-whatsapp-adapter.ts'
import { routeIncomingMessage } from '../_shared/channel-router.ts'
import { registerAdapter } from '../_shared/channel-adapter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ── Feature flag check ──────────────────────────────────────────────
  const FF_ENABLED = Deno.env.get('FF_CHANNEL_META_WHATSAPP') === 'true'
  if (!FF_ENABLED) {
    return new Response(JSON.stringify({ error: 'Meta WhatsApp channel is disabled' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const adapter = new MetaWhatsAppAdapter(supabase)
  registerAdapter(adapter)

  // ── GET: Webhook verification challenge ─────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[meta-whatsapp-webhook] Webhook verified successfully')
      return new Response(challenge, { status: 200 })
    }

    console.warn('[meta-whatsapp-webhook] Webhook verification failed')
    return new Response('Forbidden', { status: 403 })
  }

  // ── POST: Receber eventos ───────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Ler body uma vez e reutilizar (evita problema de stream consumido)
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    // Verificar assinatura HMAC (log-only enquanto validamos o app secret)
    const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET')
    if (appSecret) {
      const signature = req.headers.get('x-hub-signature-256')
      if (signature) {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(appSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        )
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
        const expectedSig = 'sha256=' + Array.from(new Uint8Array(sig))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')

        if (signature !== expectedSig) {
          console.warn(JSON.stringify({
            level: 'warn',
            fn: 'meta-whatsapp-webhook',
            step: 'hmac_mismatch',
            received: signature.substring(0, 20) + '...',
            expected: expectedSig.substring(0, 20) + '...',
          }))
          // TODO: reativar bloqueio após validar app secret
          // return new Response('Invalid signature', { status: 401 })
        }
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      fn: 'meta-whatsapp-webhook',
      step: 'received',
      object: payload.object,
      entries: payload.entry?.length || 0,
    }))

    // Verificar que e um evento de WhatsApp Business Account
    if (payload.object !== 'whatsapp_business_account') {
      return new Response(JSON.stringify({ ok: true, skipped: 'not_whatsapp' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Processar cada entry
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        // Status updates — atualizar no banco
        if (change.value?.statuses) {
          for (const status of change.value.statuses) {
            await handleStatusUpdate(supabase, status)
          }
        }

        // Mensagens recebidas
        if (change.value?.messages) {
          const phoneNumberId = change.value?.metadata?.phone_number_id

          // Resolver instancia pelo phone_number_id
          const { data: instance } = await supabase
            .from('channel_instances')
            .select('id')
            .eq('channel_type', 'meta_whatsapp')
            .contains('config', { phone_number_id: phoneNumberId })
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()

          if (!instance) {
            console.warn(`[meta-whatsapp-webhook] No instance found for phone_number_id: ${phoneNumberId}`)
            continue
          }

          // Construir payload por mensagem para o adapter
          for (const message of change.value.messages) {
            const singlePayload = {
              object: payload.object,
              entry: [{
                ...entry,
                changes: [{
                  ...change,
                  value: {
                    ...change.value,
                    messages: [message],
                    contacts: change.value.contacts?.filter(
                      (c: any) => c.wa_id === message.from,
                    ),
                  },
                }],
              }],
            }

            const normalized = await adapter.parseWebhook(singlePayload, instance.id)
            if (!normalized) continue

            // Rotear para pipeline unificado
            const result = await routeIncomingMessage(supabase, normalized)
            console.log(JSON.stringify({
              level: 'info',
              fn: 'meta-whatsapp-webhook',
              step: 'routed',
              conversationId: result.conversationId,
              processed: result.processed,
              skipped: result.skipped,
            }))
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'meta-whatsapp-webhook', error: msg }))
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/** Processa status updates de mensagens (sent, delivered, read, failed) */
async function handleStatusUpdate(supabase: any, status: any): Promise<void> {
  const { id: externalMsgId, status: msgStatus, timestamp, errors } = status

  if (!externalMsgId) return

  const updateData: Record<string, unknown> = {
    status: msgStatus, // sent, delivered, read, failed
    updated_at: new Date(parseInt(timestamp) * 1000).toISOString(),
  }

  if (errors?.length) {
    updateData.error_code = errors[0].code
    updateData.error_message = errors[0].title || errors[0].message
    console.warn(`[meta-whatsapp-webhook] Message ${externalMsgId} failed:`, errors[0])
  }

  await supabase
    .from('channel_messages')
    .update(updateData)
    .eq('external_message_id', externalMsgId)
    .eq('channel_type', 'meta_whatsapp')
}
