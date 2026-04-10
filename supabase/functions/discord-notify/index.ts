/**
 * Discord Notify — Envia notificações para canal Discord via webhook
 *
 * Recebe: { webhook_url, title, description, color?, fields?[] }
 * Formata como Discord embed e envia via POST
 */

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

interface DiscordField {
  name: string
  value: string
  inline?: boolean
}

interface RequestBody {
  webhook_url: string
  title: string
  description: string
  color?: number
  fields?: DiscordField[]
  footer?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()

    if (!body.webhook_url || !body.title) {
      return json({ error: 'webhook_url e title são obrigatórios' }, 400)
    }

    // Montar embed Discord
    const embed = {
      title: body.title,
      description: body.description || '',
      color: body.color || 3394815, // cyan #45E5E5 em decimal: 0x33CCCC
      fields: body.fields || [],
      footer: {
        text: body.footer || 'Sismais GMS — Gestão Mais Simples',
      },
      timestamp: new Date().toISOString(),
    }

    const discordPayload = {
      embeds: [embed],
    }

    const response = await fetch(body.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Discord webhook error:', response.status, errorText)
      return json({ error: 'Falha ao enviar para Discord', status: response.status, details: errorText }, 502)
    }

    return json({ success: true, message: 'Notificação enviada ao Discord' })
  } catch (err) {
    console.error('discord-notify error:', err)
    return json({ error: err.message || 'Erro interno' }, 500)
  }
})
