import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter, callOpenRouterEmbedding } from '../_shared/openrouter-client.ts'
import { DEFAULT_LITE_MODEL } from '../_shared/default-models.ts'

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
    const { conversation_id, agent_id } = await req.json()

    if (!conversation_id || !agent_id) {
      return new Response(JSON.stringify({ error: 'conversation_id and agent_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[extract-knowledge] Processing conversation ${conversation_id} for agent ${agent_id}`)

    // 1. Check if already processed
    const { data: existing } = await supabase
      .from('ai_learning_feedback')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('feedback_type', 'auto_extraction')
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`[extract-knowledge] Conversation already processed, skipping`)
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch conversation and messages
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('csat_rating, status')
      .eq('id', conversation_id)
      .single()

    const { data: messages } = await supabase
      .from('ai_messages')
      .select('role, content, confidence')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })

    if (!messages || messages.length < 2) {
      console.log(`[extract-knowledge] Not enough messages (${messages?.length || 0})`)
      return new Response(JSON.stringify({ success: true, reason: 'too_few_messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Quality filter: avg confidence >= 0.85
    const assistantMessages = messages.filter(m => m.role === 'assistant' && m.confidence)
    const avgConfidence = assistantMessages.length > 0
      ? assistantMessages.reduce((sum, m) => sum + Number(m.confidence), 0) / assistantMessages.length
      : 0

    const LEARNING_THRESHOLD = 0.70
    if (avgConfidence < LEARNING_THRESHOLD) {
      console.log(`[extract-knowledge] Avg confidence ${avgConfidence.toFixed(2)} < ${LEARNING_THRESHOLD}, skipping`)
      return new Response(JSON.stringify({ success: true, reason: 'low_confidence', avg_confidence: avgConfidence }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Format conversation for LLM
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
      .join('\n\n')

    // 5. Call LLM to extract Q&A pairs via shared openrouter-client
    // (usa modelo centralizado + logging automatico de custo em ai_api_logs)
    const llmResult = await callOpenRouter({
      model: DEFAULT_LITE_MODEL,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em extração de conhecimento. Analise conversas de suporte técnico e extraia pares de pergunta-resposta úteis para treinar uma IA de atendimento.

Regras:
- Extraia apenas informações genuinamente úteis e reutilizáveis
- Máximo 5 pares por conversa
- Generalize as perguntas (remova dados pessoais, nomes, IDs específicos)
- Mantenha as respostas informativas e completas
- Ignore cumprimentos, despedidas e conversa genérica
- Retorne APENAS um JSON válido, sem markdown

Formato de saída:
[{"question": "...", "answer": "...", "tags": ["..."]}]

Se não houver pares úteis, retorne: []`
        },
        {
          role: 'user',
          content: `Analise esta conversa e extraia pares pergunta-resposta:\n\n${conversationText}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      _logContext: {
        edgeFunction: 'extract-conversation-knowledge',
        conversationId: conversation_id,
        agentId: agent_id,
      },
    })

    const rawContent = llmResult.content || '[]'

    // Parse JSON from LLM response
    let qaPairs: { question: string; answer: string; tags: string[] }[]
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/)
      qaPairs = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent)
    } catch {
      console.error('[extract-knowledge] Failed to parse LLM response:', rawContent)
      qaPairs = []
    }

    if (!Array.isArray(qaPairs) || qaPairs.length === 0) {
      console.log('[extract-knowledge] No useful Q&A pairs found')
      await supabase.from('ai_learning_feedback').insert({
        conversation_id,
        agent_id,
        feedback_type: 'auto_extraction',
        feedback_source: 'extract_knowledge',
        learning_action: 'No Q&A pairs extracted'
      })
      return new Response(JSON.stringify({ success: true, pairs_extracted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. For each pair, check for duplicates and save
    let savedCount = 0

    for (const pair of qaPairs.slice(0, 5)) {
      if (!pair.question || !pair.answer) continue

      const content = `Pergunta: ${pair.question}\n\nResposta: ${pair.answer}`

      // Generate embedding for dedup check via OpenRouter
      try {
        const embResult = await callOpenRouterEmbedding({
          model: 'openai/text-embedding-3-small',
          input: content
        })

        const embedding = embResult.embedding

        if (embedding?.length) {
          // Check for duplicates (similarity > 0.90)
          const { data: similar } = await supabase.rpc('search_knowledge', {
            query_embedding: JSON.stringify(embedding),
            match_threshold: 0.90,
            match_count: 1
          })

          if (similar && similar.length > 0) {
            console.log(`[extract-knowledge] Duplicate found for: "${pair.question}" (similarity: ${similar[0].similarity})`)
            continue
          }

          // Save new Q&A document
          const { error: insertError } = await supabase
            .from('ai_knowledge_base')
            .insert({
              title: pair.question,
              content,
              content_type: 'text',
              category: 'qa',
              source: 'conversation_learning',
              agent_filter: [agent_id],
              tags: ['qa', 'auto-extracted', ...(pair.tags || [])],
              embedding: JSON.stringify(embedding)
            })

          if (!insertError) {
            savedCount++
            console.log(`[extract-knowledge] Saved Q&A: "${pair.question}"`)
          }
        }
      } catch (e) {
        console.error(`[extract-knowledge] Error processing pair:`, e)
      }
    }

    // 7. Record extraction in learning feedback
    await supabase.from('ai_learning_feedback').insert({
      conversation_id,
      agent_id,
      feedback_type: 'auto_extraction',
      feedback_source: 'extract_knowledge',
      learning_action: `Extracted ${savedCount} Q&A pairs from ${qaPairs.length} candidates`
    })

    console.log(`[extract-knowledge] Done: ${savedCount} pairs saved from ${qaPairs.length} extracted`)

    return new Response(JSON.stringify({
      success: true,
      pairs_extracted: qaPairs.length,
      pairs_saved: savedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[extract-knowledge] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
