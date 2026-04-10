/**
 * Instagram Messaging API — Webhook Receiver
 *
 * Recebe webhooks do Instagram (DMs, story mentions, story replies)
 * e roteia para o pipeline unificado.
 *
 * Endpoints:
 * - GET  /instagram-webhook — Webhook verification challenge
 * - POST /instagram-webhook — Recebe eventos
 *
 * Variaveis de ambiente necessarias:
 * - INSTAGRAM_VERIFY_TOKEN — Token para verificacao do webhook
 * - META_WHATSAPP_APP_SECRET — App secret para HMAC (mesmo app Meta)
 *
 * Feature flag: FF_CHANNEL_INSTAGRAM=true para ativar
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { InstagramAdapter } from '../_shared/instagram-adapter.ts'
import { routeIncomingMessage } from '../_shared/channel-router.ts'
import { registerAdapter } from '../_shared/channel-adapter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Feature flag
  const FF_ENABLED = Deno.env.get('FF_CHANNEL_INSTAGRAM') === 'true'
  if (!FF_ENABLED) {
    return new Response(JSON.stringify({ error: 'Instagram channel is disabled' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const adapter = new InstagramAdapter(supabase)
  registerAdapter(adapter)

  // ── GET: Webhook verification challenge ─────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('INSTAGRAM_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[instagram-webhook] Webhook verified successfully')
      return new Response(challenge, { status: 200 })
    }

    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Verificar assinatura
    const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET') // Mesmo app
    if (appSecret) {
      const isValid = await adapter.verifyWebhook(req, appSecret)
      if (!isValid) {
        console.warn('[instagram-webhook] Invalid webhook signature')
        return new Response('Invalid signature', { status: 401 })
      }
    }

    const payload = await req.json()

    console.log(JSON.stringify({
      level: 'info',
      fn: 'instagram-webhook',
      step: 'received',
      object: payload.object,
      entries: payload.entry?.length || 0,
    }))

    if (payload.object !== 'instagram') {
      return new Response(JSON.stringify({ ok: true, skipped: 'not_instagram' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const entry of payload.entry || []) {
      // Resolver instancia pelo recipient ID (nosso IG user ID)
      const recipientId = entry.messaging?.[0]?.recipient?.id
      if (!recipientId) continue

      const { data: instance } = await supabase
        .from('channel_instances')
        .select('id')
        .eq('channel_type', 'instagram')
        .contains('config', { ig_user_id: recipientId })
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (!instance) {
        console.warn(`[instagram-webhook] No instance found for ig_user_id: ${recipientId}`)
        continue
      }

      // Processar cada messaging event
      for (const messaging of entry.messaging || []) {
        const singlePayload = {
          object: payload.object,
          entry: [{
            ...entry,
            messaging: [messaging],
          }],
        }

        const normalized = await adapter.parseWebhook(singlePayload, instance.id)
        if (!normalized) continue

        const result = await routeIncomingMessage(supabase, normalized)
        console.log(JSON.stringify({
          level: 'info',
          fn: 'instagram-webhook',
          step: 'routed',
          conversationId: result.conversationId,
          processed: result.processed,
          skipped: result.skipped,
        }))
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'instagram-webhook', error: msg }))
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
