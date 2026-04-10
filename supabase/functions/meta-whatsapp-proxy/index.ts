/**
 * Meta WhatsApp Proxy — Envio de mensagens via Cloud API
 *
 * Similar ao uazapi-proxy, mas para a API oficial da Meta.
 * Usado pelo frontend (ChatArea) para enviar mensagens humanas.
 *
 * Actions:
 * - sendMessage: Envia texto, media, template ou interativo
 * - downloadMedia: Baixa media de uma mensagem recebida
 * - getStatus: Verifica status da instância
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { check24hWindow } from '../_shared/meta-24h-window.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_API_VERSION = 'v21.0'

interface ChannelInstance {
  id: string
  phone_number_id: string
  waba_id: string
  access_token: string
  display_name: string
  phone_number: string
  graphUrl: string
}

async function resolveInstance(supabase: any, instanceId: string): Promise<ChannelInstance | null> {
  const { data } = await supabase
    .from('channel_instances')
    .select('id, config, display_name, phone_number')
    .eq('id', instanceId)
    .eq('channel_type', 'meta_whatsapp')
    .eq('is_active', true)
    .single()

  if (!data) return null

  const config = data.config as any
  const version = config.graph_api_version || DEFAULT_API_VERSION
  return {
    id: data.id,
    phone_number_id: config.phone_number_id,
    waba_id: config.waba_id,
    access_token: config.access_token,
    display_name: data.display_name,
    phone_number: data.phone_number,
    graphUrl: `https://graph.facebook.com/${version}`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = await req.json()
    const { action, instanceId } = body

    const inst = await resolveInstance(supabase, instanceId)
    if (!inst) {
      return new Response(JSON.stringify({ error: 'Meta WhatsApp instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── sendMessage ─────────────────────────────────────────────────
    if (action === 'sendMessage') {
      const { recipient, type, text, mediaUrl, mediaType, quotedMsgId, templateName, templateLanguage, templateParams, buttons } = body

      // ── Validar janela de 24h (Meta Business Policy) ──
      // Templates HSM são permitidos fora da janela
      if (!templateName) {
        const { data: convData } = await supabase
          .from('ai_conversations')
          .select('last_customer_message_at')
          .eq('channel_instance_id', instanceId)
          .eq('customer_phone', (recipient || '').replace(/@.*$/, '').replace(/\D/g, ''))
          .in('status', ['aguardando', 'em_atendimento', 'nova'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const windowStatus = check24hWindow(convData?.last_customer_message_at || null)

        if (!windowStatus.isOpen) {
          return new Response(JSON.stringify({
            error: 'WINDOW_CLOSED',
            message: 'A janela de 24h expirou. Use um template HSM ou continue via UAZAPI.',
            requiresTemplate: true,
            expiresAt: windowStatus.expiresAt,
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Limpar telefone: remover @s.whatsapp.net, @lid, espaços, etc.
      const cleanRecipient = (recipient || '').replace(/@.*$/, '').replace(/\D/g, '')

      if (!cleanRecipient) {
        return new Response(JSON.stringify({ error: 'Recipient is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let msgBody: Record<string, unknown>

      // Template HSM
      if (templateName) {
        msgBody = {
          messaging_product: 'whatsapp',
          to: cleanRecipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage || 'pt_BR' },
            components: templateParams?.length
              ? [{ type: 'body', parameters: templateParams.map((p: string) => ({ type: 'text', text: p })) }]
              : undefined,
          },
        }
      }
      // Botões interativos
      else if (buttons?.length) {
        msgBody = {
          messaging_product: 'whatsapp',
          to: cleanRecipient,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: {
              buttons: buttons.map((b: any) => ({
                type: 'reply',
                reply: { id: b.id, title: b.text.substring(0, 20) },
              })),
            },
          },
        }
      }
      // Media
      else if (mediaUrl && mediaType) {
        msgBody = {
          messaging_product: 'whatsapp',
          to: cleanRecipient,
          type: mediaType,
          [mediaType]: {
            link: mediaUrl,
            caption: text || undefined,
          },
        }
      }
      // Texto simples
      else {
        msgBody = {
          messaging_product: 'whatsapp',
          to: cleanRecipient,
          type: 'text',
          text: { body: text, preview_url: true },
          ...(quotedMsgId ? { context: { message_id: quotedMsgId } } : {}),
        }
      }

      const url = `${inst.graphUrl}/${inst.phone_number_id}/messages`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inst.access_token}`,
        },
        body: JSON.stringify(msgBody),
      })

      const result = await resp.json()

      if (!resp.ok) {
        const errorMsg = result?.error?.message || `HTTP ${resp.status}`
        console.error(`[meta-whatsapp-proxy] Send error: ${errorMsg}`, result)
        return new Response(JSON.stringify({ error: errorMsg, details: result }), {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const externalMsgId = result.messages?.[0]?.id

      // Salvar na channel_messages
      if (externalMsgId) {
        await supabase.from('channel_messages').insert({
          channel_type: 'meta_whatsapp',
          channel_instance_id: instanceId,
          external_message_id: externalMsgId,
          sender_phone: inst.phone_number?.replace(/\D/g, ''),
          message_type: type || 'text',
          text_content: text,
          from_me: true,
          status: 'sent',
          timestamp: new Date().toISOString(),
        }).catch((e: any) => console.error('[meta-whatsapp-proxy] Failed to log sent msg:', e))

        // Incrementar contador
        await supabase.rpc('increment_channel_counter', {
          p_instance_id: instanceId,
          p_counter: 'messages_sent_count',
          p_amount: 1,
        }).catch(() => {})
      }

      return new Response(JSON.stringify({
        success: true,
        _msgId: externalMsgId,
        contacts: result.contacts,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── downloadMedia ───────────────────────────────────────────────
    if (action === 'downloadMedia') {
      const { mediaId } = body

      // Passo 1: obter URL temporária
      const metaResp = await fetch(`${inst.graphUrl}/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })
      if (!metaResp.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get media URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const metaData = await metaResp.json()

      // Passo 2: baixar o arquivo (precisa do mesmo token)
      const mediaResp = await fetch(metaData.url, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })
      if (!mediaResp.ok) {
        return new Response(JSON.stringify({ error: 'Failed to download media' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const mediaBuffer = await mediaResp.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(mediaBuffer)))

      return new Response(JSON.stringify({
        success: true,
        data: base64,
        mimeType: metaData.mime_type,
        fileSize: metaData.file_size,
        url: metaData.url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── getStatus ───────────────────────────────────────────────────
    if (action === 'getStatus') {
      const url = `${inst.graphUrl}/${inst.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })
      const data = await resp.json()

      return new Response(JSON.stringify({
        connected: resp.ok,
        ...data,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── markAsRead ──────────────────────────────────────────────────
    if (action === 'markAsRead') {
      const { messageId } = body
      const url = `${inst.graphUrl}/${inst.phone_number_id}/messages`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inst.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      })

      return new Response(JSON.stringify({ success: resp.ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── getTemplates ────────────────────────────────────────────────
    if (action === 'getTemplates') {
      const { statusFilter } = body
      const fields = 'name,status,category,language,components,quality_score'
      const url = `${inst.graphUrl}/${inst.waba_id}/message_templates?fields=${fields}&limit=100`
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${inst.access_token}` },
      })
      const data = await resp.json()

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: data?.error?.message || `HTTP ${resp.status}` }), {
          status: resp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Filtrar por status se solicitado (default: apenas APPROVED)
      const filter = statusFilter || 'APPROVED'
      const templates = filter === 'ALL'
        ? data.data || []
        : (data.data || []).filter((t: any) => t.status === filter)

      return new Response(JSON.stringify({ templates }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[meta-whatsapp-proxy] Error: ${msg}`)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
