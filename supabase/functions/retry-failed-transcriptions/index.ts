import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

const FAILED_CONTENT_MARKERS = [
  '[Áudio - transcrição falhou]',
  '[audio]',
  '[ptt]',
  '[Áudio]',
]

const MAX_RETRY_PER_RUN = 20
const MAX_AGE_HOURS = 24

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()

    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('id, conversation_id, media_url, media_type, content')
      .in('content', FAILED_CONTENT_MARKERS)
      .in('media_type', ['audio', 'ptt'])
      .not('media_url', 'is', null)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_RETRY_PER_RUN)

    if (error) throw error

    if (!messages || messages.length === 0) {
      console.log('[retry-failed-transcriptions] No failed messages to retry')
      return new Response(JSON.stringify({ retried: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[retry-failed-transcriptions] Found ${messages.length} messages to retry`)

    let retried = 0
    for (const msg of messages) {
      if (!msg.media_url) continue
      try {
        const { error: invokeError } = await supabase.functions.invoke('transcribe-media', {
          body: {
            message_id: msg.id,
            conversation_id: msg.conversation_id,
            media_url: msg.media_url,
            media_type: msg.media_type,
          },
        })
        if (invokeError) {
          console.error(`[retry] Failed to invoke transcribe-media for msg ${msg.id}:`, invokeError)
        } else {
          retried++
          console.log(`[retry] Re-queued transcription for msg ${msg.id}`)
        }
      } catch (err) {
        console.error(`[retry] Unexpected error for msg ${msg.id}:`, err)
      }
    }

    return new Response(
      JSON.stringify({ retried, found: messages.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[retry-failed-transcriptions] Error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
