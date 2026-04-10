import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouterWithFallback } from '../_shared/openrouter-client.ts'
import { logAICost } from '../_shared/log-ai-cost.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

// Extract storage path from a Supabase Storage signed URL to regenerate if expired
function extractStoragePath(url: string): string | null {
  try {
    const u = new URL(url)
    // Supabase storage URLs: /storage/v1/object/sign/<bucket>/<path>?token=...
    const match = u.pathname.match(/\/storage\/v1\/object\/sign\/([^?]+)/)
    if (match) return match[1]
    // Also handle: /storage/v1/object/public/<bucket>/<path>
    const pubMatch = u.pathname.match(/\/storage\/v1\/object\/public\/([^?]+)/)
    if (pubMatch) return pubMatch[1]
    return null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let message_id: string | null = null
  let conversation_id: string | null = null
  let media_type: string | null = null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json()
    conversation_id = body.conversation_id || null
    message_id = body.message_id || null
    media_type = body.media_type || null
    let media_url: string = body.media_url || ''

    if (!media_url || !media_type) {
      return new Response(JSON.stringify({ error: 'media_url and media_type required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine feature key based on media type
    const isAudio = media_type === 'audio' || media_type === 'ptt'
    const featureKey = isAudio ? 'audio_transcription' : media_type === 'video' ? 'video_transcription' : 'image_transcription'

    // Read config from platform_ai_config
    const { data: config } = await supabase
      .from('platform_ai_config')
      .select('model, enabled, extra_config')
      .eq('feature', featureKey)
      .maybeSingle()

    if (config && !config.enabled) {
      console.log(`[transcribe-media] Feature ${featureKey} is disabled`)
      return new Response(JSON.stringify({ skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { DEFAULT_MULTIMODAL_MODEL } = await import('../_shared/default-models.ts')
    const model = config?.model || DEFAULT_MULTIMODAL_MODEL
    const language = (config?.extra_config as Record<string, string>)?.language || 'pt'

    // Download the media file — with signed URL refresh for Supabase Storage
    console.log(`[transcribe-media] Downloading media: ${media_url.substring(0, 80)}`)
    let mediaResp = await fetch(media_url)

    // If download failed and it's a Supabase Storage URL, try refreshing the signed URL
    if (!mediaResp.ok && media_url.includes('/storage/v1/')) {
      console.log(`[transcribe-media] Download failed (${mediaResp.status}), attempting signed URL refresh`)
      const storagePath = extractStoragePath(media_url)
      if (storagePath) {
        const parts = storagePath.split('/')
        const bucket = parts[0]
        const filePath = parts.slice(1).join('/')
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 31536000) // 1 year
        if (signedData?.signedUrl) {
          console.log(`[transcribe-media] Refreshed signed URL, retrying download`)
          media_url = signedData.signedUrl
          mediaResp = await fetch(media_url)

          // Also update the ai_message media_url with the fresh signed URL
          if (mediaResp.ok && message_id) {
            await supabase.from('ai_messages').update({ media_url }).eq('id', message_id)
          }
        }
      }
    }

    if (!mediaResp.ok) {
      throw new Error(`Failed to download media: ${mediaResp.status}`)
    }

    const mediaBuffer = await mediaResp.arrayBuffer()
    const mediaBytes = new Uint8Array(mediaBuffer)

    // Convert to base64
    let binaryStr = ''
    const chunkSize = 8192
    for (let i = 0; i < mediaBytes.length; i += chunkSize) {
      const chunk = mediaBytes.slice(i, i + chunkSize)
      binaryStr += String.fromCharCode(...chunk)
    }
    const base64Data = btoa(binaryStr)

    // Determine MIME type from URL or media type
    const isVideo = media_type === 'video'
    const mimeMap: Record<string, string> = {
      audio: 'audio/ogg',
      ptt: 'audio/ogg',
      image: 'image/jpeg',
      video: 'video/mp4',
    }
    const contentType = mediaResp.headers.get('content-type')?.split(';')[0]?.trim() || mimeMap[media_type] || 'application/octet-stream'

    // Build prompt based on type
    let systemPrompt: string
    let userPrompt: string

    if (isAudio) {
      systemPrompt = `Você é um transcritor especializado. Transcreva o áudio com precisão em ${language === 'pt' ? 'português' : language}. Retorne apenas a transcrição, sem comentários adicionais.`
      userPrompt = 'Transcreva este áudio.'
    } else if (isVideo) {
      systemPrompt = `Você é um especialista em análise de vídeos. Descreva o conteúdo do vídeo: o que está acontecendo, qualquer texto visível na tela, e o áudio/narração se houver. Seja conciso e objetivo. Responda em português.`
      userPrompt = 'Descreva o conteúdo deste vídeo, incluindo áudio e texto visível.'
    } else {
      systemPrompt = `Você é um especialista em análise de imagens. Descreva o conteúdo da imagem e extraia qualquer texto visível (OCR). Seja conciso e objetivo. Responda em português.`
      userPrompt = 'Descreva esta imagem e extraia qualquer texto presente.'
    }

    // Call OpenRouter with fallback chain (multimodal models — only confirmed valid)
    const { DEFAULT_MULTIMODAL_FALLBACK_CHAIN } = await import('../_shared/default-models.ts')
    const modelsToTry = [model, ...DEFAULT_MULTIMODAL_FALLBACK_CHAIN]
    const uniqueModels = [...new Set(modelsToTry)]

    const aiResult = await callOpenRouterWithFallback({
      models: uniqueModels,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${contentType};base64,${base64Data}`,
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
      max_completion_tokens: 500,
    })

    const usedModel = aiResult.model_used
    const transcription = aiResult.content?.trim() || ''
    const promptTokens = aiResult.usage?.prompt_tokens || 0
    const completionTokens = aiResult.usage?.completion_tokens || 0
    const totalTokens = aiResult.usage?.total_tokens || (promptTokens + completionTokens)

    // Cost calculation (approximate per-token pricing)
    const costPer1kTokens = 0.0002 // ~$0.0002/1k tokens for flash models
    const costUsd = (totalTokens / 1000) * costPer1kTokens

    await logAICost(supabase, {
      model: usedModel,
      feature: 'transcription',
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      cost_usd: aiResult.cost_usd || costUsd,
      conversation_id: conversation_id || undefined,
    })

    console.log(`[transcribe-media] Transcription done: ${totalTokens} tokens, model=${usedModel}`)

    // Update the ai_message content with transcription
    if (message_id && transcription) {
      const prefix = isAudio ? '[Áudio transcrito] ' : isVideo ? '[Vídeo] ' : '[Imagem] '
      await supabase
        .from('ai_messages')
        .update({
          content: prefix + transcription,
          model_used: usedModel,
          total_tokens: totalTokens,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cost_usd: costUsd,
          intent: featureKey,
        })
        .eq('id', message_id)
    }

    // Insert a consumption record (if no message_id or as supplement)
    if (!message_id && conversation_id && transcription) {
      await supabase.from('ai_messages').insert({
        conversation_id,
        role: 'system',
        content: transcription,
        model_used: usedModel,
        total_tokens: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        intent: featureKey,
        media_type: media_type,
      })
    }

    // After successful transcription, fire-and-forget message-analyzer so AI analysis
    // updates automatically (fixes issue where conversations with only audio had no analysis)
    if (conversation_id && transcription && (isAudio || isVideo)) {
      console.log(`[transcribe-media] Triggering message-analyzer for conversation ${conversation_id}`)
      supabase.functions.invoke('message-analyzer', {
        body: {
          conversation_id,
          message_content: transcription,
        },
      }).catch((err: unknown) => console.error('[transcribe-media] message-analyzer invoke failed:', err))
    }

    // After successful transcription, trigger AI reply if conversation is AI-handled
    // This ensures the agent responds to audio/image messages with the transcribed content
    if (conversation_id && transcription) {
      try {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('id, handler_type, uazapi_chat_id, whatsapp_instance_id')
          .eq('id', conversation_id)
          .single()

        if (conv && conv.handler_type === 'ai') {
          const USE_NEW_PIPELINE = Deno.env.get('FF_NEW_PIPELINE') === 'true'

          if (USE_NEW_PIPELINE) {
            // ── PIPELINE COMPLETO (process-incoming-message) ──
            console.log(`[transcribe-media] Triggering process-incoming-message for conversation ${conversation_id} with transcribed ${media_type} content`)
            const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-incoming-message`
            fetch(processUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                conversation_id,
                message_content: transcription,
                message_id: message_id,
              }),
            }).catch((err: unknown) => console.error('[transcribe-media] process-incoming-message invoke failed:', err))
          } else if (conv.uazapi_chat_id) {
            // ── PIPELINE LEGADO (ai-whatsapp-reply) — fallback ──
            const { data: chatRecord } = await supabase
              .from('uazapi_chats')
              .select('id')
              .eq('chat_id', conv.uazapi_chat_id)
              .eq('instance_id', conv.whatsapp_instance_id)
              .limit(1)
              .maybeSingle()

            if (chatRecord) {
              console.log(`[transcribe-media] Triggering ai-whatsapp-reply (LEGACY) for conversation ${conversation_id} with transcribed ${media_type} content`)
              const aiReplyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-whatsapp-reply`
              fetch(aiReplyUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  chatId: chatRecord.id,
                  instanceId: conv.whatsapp_instance_id,
                  conversationId: conversation_id,
                  text: transcription,
                }),
              }).catch((err: unknown) => console.error('[transcribe-media] ai-whatsapp-reply invoke failed:', err))
            }
          }
        }
      } catch (err) {
        console.error('[transcribe-media] Error triggering AI reply:', err)
      }
    }

    return new Response(
      JSON.stringify({ transcription, tokens_used: totalTokens, model: usedModel }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[transcribe-media] error:', err)

    // Mark the message as transcription-failed so the UI can show a retry button
    if (message_id) {
      const isAudio = media_type === 'audio' || media_type === 'ptt'
      const failContent = isAudio ? '[Áudio - transcrição falhou]' : '[Imagem - processamento falhou]'
      try {
        await supabase
          .from('ai_messages')
          .update({ content: failContent })
          .eq('id', message_id)
        console.log(`[transcribe-media] Marked message ${message_id} as failed`)
      } catch (e) {
        console.error('[transcribe-media] Failed to mark message:', e)
      }
    }

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
