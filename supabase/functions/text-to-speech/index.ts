import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter } from '../_shared/openrouter-client.ts'
import { logAICost } from '../_shared/log-ai-cost.ts'
import { getModelConfig, getModelPricing, calculateCost } from '../_shared/get-model-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { text, voice, speed, conversation_id, message_id } = await req.json()

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Read TTS config from DB
    const ttsConfig = await getModelConfig(supabase, 'tts', 'openai/gpt-4o-audio-preview')
    const ttsVoice = voice || 'nova'

    // Truncate very long text (TTS has limits)
    const truncatedText = text.substring(0, 4096)

    console.log(`[text-to-speech] Generating audio via OpenRouter: model=${ttsConfig.model}, voice=${ttsVoice}, chars=${truncatedText.length}`)

    // Call OpenRouter with audio modalities (OpenRouter doesn't have /audio/speech)
    const ttsModel = ttsConfig.model.includes('/') ? ttsConfig.model : `openai/${ttsConfig.model}`
    const ttsResult = await callOpenRouter({
      model: ttsModel,
      messages: [
        {
          role: 'user',
          content: `Leia o seguinte texto em voz alta, de forma natural e clara: ${truncatedText}`
        }
      ],
      modalities: ['text', 'audio'],
      audio: { voice: ttsVoice, format: 'opus' },
    })

    await logAICost(supabase, {
      model: ttsResult.model_used || ttsModel,
      feature: 'tts',
      input_tokens: ttsResult.usage?.prompt_tokens || 0,
      output_tokens: ttsResult.usage?.completion_tokens || 0,
      cost_usd: ttsResult.cost_usd || 0,
      conversation_id,
    })

    // Extract audio data from response (comes as base64 in raw_choice.message.audio.data)
    const audioData = ttsResult.raw_choice?.message?.audio?.data
    if (!audioData) {
      throw new Error('No audio data in OpenRouter response')
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(audioData)
    const audioBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i)
    }

    console.log(`[text-to-speech] Audio generated: ${audioBytes.length} bytes`)

    // Upload to Supabase Storage
    const fileName = `tts/${conversation_id || 'unknown'}/${Date.now()}.opus`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, audioBytes, {
        contentType: 'audio/opus',
        upsert: false,
      })

    if (uploadError) {
      console.error('[text-to-speech] Storage upload error:', uploadError)
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    // Get signed URL (bucket is private, public URLs won't work for external access)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('whatsapp-media')
      .createSignedUrl(fileName, 31536000) // 365 days

    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${urlError?.message || 'unknown'}`)
    }

    const audioUrl = urlData.signedUrl

    console.log(`[text-to-speech] Uploaded to: ${audioUrl}`)

    // Send via UAZAPI as PTT if conversation exists
    if (conversation_id) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('uazapi_chat_id, customer_phone')
        .eq('id', conversation_id)
        .single()

      if (conv?.uazapi_chat_id) {
        // Get active UAZAPI instance
        const { data: instances } = await supabase
          .from('uazapi_instances')
          .select('*')
          .eq('is_active', true)
          .limit(1)

        if (instances?.length) {
          const inst = instances[0]
          const apiUrl = (inst.api_url as string).replace(/\/$/, '')

          const sendResp = await fetch(`${apiUrl}/send/media`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': inst.api_token as string,
            },
            body: JSON.stringify({
              number: conv.uazapi_chat_id,
              type: 'ptt',
              file: audioUrl,
            })
          })

          const sendResult = await sendResp.json()
          console.log(`[text-to-speech] Sent PTT via UAZAPI: ${sendResp.ok ? 'success' : 'failed'}`)

          if (!sendResp.ok) {
            console.error('[text-to-speech] UAZAPI send error:', sendResult)
          }
        }
      }
    }

    // Calculate cost from usage tokens
    const charCount = truncatedText.length
    const promptTokens = ttsResult.usage?.prompt_tokens || 0
    const completionTokens = ttsResult.usage?.completion_tokens || 0
    const pricing = await getModelPricing(supabase, ttsModel)
    const costUSD = calculateCost(promptTokens, completionTokens, pricing)

    // Update message cost if message_id provided
    if (message_id) {
      try {
        await supabase
          .from('ai_messages')
          .update({ cost_usd: costUSD })
          .eq('id', message_id)
      } catch (_) { /* ignore */ }
    }

    console.log(`[text-to-speech] Done. Cost: $${costUSD.toFixed(6)}`)

    return new Response(JSON.stringify({
      success: true,
      audio_url: audioUrl,
      cost_usd: costUSD,
      chars: charCount,
      model: ttsModel,
      voice: ttsVoice,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[text-to-speech] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
