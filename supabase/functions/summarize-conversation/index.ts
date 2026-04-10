import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouterWithFallback } from '../_shared/openrouter-client.ts'
import { logAICost } from '../_shared/log-ai-cost.ts'
import { logActionAsync } from '../_shared/action-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { conversation_id } = await req.json()
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch conversation current summary state
    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('conversation_summary, summary_last_message_id, summary_history')
      .eq('id', conversation_id)
      .maybeSingle()

    if (convErr) throw convErr

    const previousSummary = conv?.conversation_summary || null
    const lastMessageId = conv?.summary_last_message_id || null

    // 2. Fetch new messages since last summarized message
    // Fetch messages - include human_agent role too
    let msgQuery = supabase
      .from('ai_messages')
      .select('id, role, content, created_at, media_type')
      .eq('conversation_id', conversation_id)
      .in('role', ['user', 'assistant', 'agent', 'human_agent'])
      .not('intent', 'eq', 'summarization')
      .order('created_at', { ascending: true })
      .limit(30)

    if (lastMessageId) {
      // Get the timestamp of the last summarized message to fetch only newer ones
      const { data: lastMsg } = await supabase
        .from('ai_messages')
        .select('created_at')
        .eq('id', lastMessageId)
        .maybeSingle()

      if (lastMsg?.created_at) {
        msgQuery = msgQuery.gt('created_at', lastMsg.created_at)
      }
    }

    const { data: rawMessages, error: msgErr } = await msgQuery
    if (msgErr) throw msgErr

    // Filter out empty/placeholder messages
    const placeholderPatterns = [
      /^\[Áudio\]$/,
      /^\[Áudio recebido\]$/,
      /^\[Áudio de \d+:\d+\]$/,
      /^\[Imagem\]$/,
      /^\[Vídeo\]$/,
      /^\[Documento\]$/,
      /^\[Sticker\]$/,
    ]
    const newMessages = (rawMessages || []).filter(m => {
      const text = (m.content || '').trim()
      if (!text) return false
      return !placeholderPatterns.some(p => p.test(text))
    })

    const messagesProcessed = newMessages.length

    // 3. If no new messages → return existing summary (zero tokens)
    if (messagesProcessed === 0 && previousSummary) {
      return new Response(
        JSON.stringify({
          summary: previousSummary,
          is_fresh: false,
          messages_processed: 0,
          tokens_used: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If no new messages and no previous summary, nothing to summarize
    if (messagesProcessed === 0 && !previousSummary) {
      return new Response(
        JSON.stringify({
          summary: null,
          is_fresh: false,
          messages_processed: 0,
          tokens_used: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Build compact prompt
    const systemPrompt = `Você é um analista de suporte sênior. Analise a conversa e retorne um JSON com:

{
  "summary": "Resumo de 2-4 frases do problema e status atual",
  "satisfaction_score": 0.0,
  "suggested_responses": ["sugestão 1", "sugestão 2", "sugestão 3"],
  "next_steps": "Próximo passo recomendado",
  "customer_emotion": "neutral"
}

Regras:
- satisfaction_score: -1.0 (muito irritado) a 1.0 (muito satisfeito). Baseie-se no tom das mensagens do cliente.
- suggested_responses: 3 respostas concretas que o agente poderia usar agora. Não genéricas — baseadas no contexto real.
- customer_emotion: um de "frustrated", "angry", "neutral", "satisfied", "happy"
- next_steps: ação específica recomendada baseada no contexto
- Retorne APENAS o JSON válido, sem markdown ou blocos de código.`

    let userContent = ''
    if (previousSummary) {
      userContent += `Resumo anterior:\n${previousSummary.substring(0, 500)}\n\n`
    }
    userContent += `Novas mensagens:\n`
    for (const msg of newMessages) {
      const roleLabel = msg.role === 'user' ? 'Cliente' : 'Atendente'
      let text = msg.content || ''

      // Clean audio transcriptions for readability
      if (text.startsWith('[Áudio transcrito] ')) {
        text = '🎤 ' + text.replace('[Áudio transcrito] ', '')
      } else if (
        text === '[Áudio]' ||
        text === '[Áudio recebido]' ||
        /^\[Áudio de \d+:\d+\]$/.test(text)
      ) {
        text = '[Áudio sem transcrição disponível]'
      } else if (text.startsWith('[Imagem] ')) {
        text = '🖼️ ' + text.replace('[Imagem] ', '')
      } else if (text === '[Imagem]') {
        text = '[Imagem sem descrição disponível]'
      }

      userContent += `${roleLabel}: ${text.substring(0, 300)}\n`
    }
    userContent += `\nAtualize o resumo incorporando as novas mensagens.`

    // 5. Call OpenRouter with fallback chain (only confirmed valid models)
    const { DEFAULT_FALLBACK_CHAIN } = await import('../_shared/default-models.ts')
    const modelsToTry = DEFAULT_FALLBACK_CHAIN

    const aiResult = await callOpenRouterWithFallback({
      models: modelsToTry,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_completion_tokens: 300,
      temperature: 0.3,
    })

    const tokensUsed = aiResult.usage?.total_tokens || 0

    let enrichedSummary = {
      summary: '',
      satisfaction_score: 0,
      suggested_responses: [] as string[],
      next_steps: '',
      customer_emotion: 'neutral',
    }

    try {
      const rawContent = aiResult.content || ''
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      enrichedSummary = JSON.parse(cleaned)
    } catch {
      enrichedSummary.summary = aiResult.content?.trim() || previousSummary || ''
    }

    const newSummary = enrichedSummary.summary || aiResult.content?.trim() || previousSummary || ''

    await logAICost(supabase, {
      model: aiResult.model_used,
      feature: 'summarization',
      input_tokens: aiResult.usage?.prompt_tokens || 0,
      output_tokens: aiResult.usage?.completion_tokens || 0,
      cost_usd: aiResult.cost_usd || 0,
      conversation_id,
    })

    // 6. Save summary, last message ID, and append to summary_history
    const lastMsg = newMessages[newMessages.length - 1]

    // Build history entry
    const historyEntry = {
      timestamp: new Date().toISOString(),
      tokens_used: tokensUsed,
      model_used: aiResult.model_used,
      messages_processed: messagesProcessed,
    }
    const existingHistory = Array.isArray(conv?.summary_history) ? conv.summary_history : []
    const newHistory = [...existingHistory, historyEntry].slice(-50) // keep last 50 entries

    const summaryToSave = JSON.stringify(enrichedSummary)

    const { error: updateErr } = await supabase
      .from('ai_conversations')
      .update({
        conversation_summary: summaryToSave,
        summary_last_message_id: lastMsg.id,
        summary_history: newHistory,
      })
      .eq('id', conversation_id)

    if (updateErr) throw updateErr

    // Auto-escalate priority if customer is dissatisfied
    if (enrichedSummary.satisfaction_score < -0.3) {
      const newPriority = enrichedSummary.satisfaction_score < -0.7 ? 'critical' : 'high'
      const newScore = enrichedSummary.satisfaction_score < -0.7 ? 90 : 75

      const { data: currentConv } = await supabase
        .from('ai_conversations')
        .select('priority_score')
        .eq('id', conversation_id)
        .single()

      if (currentConv && (currentConv.priority_score || 0) < newScore) {
        await supabase
          .from('ai_conversations')
          .update({
            priority: newPriority,
            priority_score: newScore,
          })
          .eq('id', conversation_id)

        logActionAsync({
          conversationId: conversation_id,
          actionType: 'priority_change',
          status: 'success',
          details: {
            new_priority: newPriority,
            new_score: newScore,
            satisfaction_score: enrichedSummary.satisfaction_score,
            customer_emotion: enrichedSummary.customer_emotion,
          },
        })
      }
    }

    // 7. Record consumption in ai_messages for dashboard tracking
    await supabase.from('ai_messages').insert({
      conversation_id,
      role: 'system',
      content: newSummary.substring(0, 500) || summaryToSave.substring(0, 500),
      model_used: aiResult.model_used,
      total_tokens: tokensUsed,
      prompt_tokens: aiResult.usage?.prompt_tokens || 0,
      completion_tokens: aiResult.usage?.completion_tokens || 0,
      cost_usd: (tokensUsed / 1000) * 0.0002,
      intent: 'summarization',
    })

    // 7. Return result
    return new Response(
      JSON.stringify({
        summary: newSummary,
        satisfaction_score: enrichedSummary.satisfaction_score,
        suggested_responses: enrichedSummary.suggested_responses,
        next_steps: enrichedSummary.next_steps,
        customer_emotion: enrichedSummary.customer_emotion,
        is_fresh: true,
        messages_processed: messagesProcessed,
        tokens_used: tokensUsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('summarize-conversation error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
