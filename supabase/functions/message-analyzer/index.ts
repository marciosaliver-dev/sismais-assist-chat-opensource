import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getModelConfig, getModelPricing, calculateCost } from '../_shared/get-model-config.ts'
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
    const { conversation_id, message_content } = await req.json()
    const startTime = Date.now()

    // OpenRouter is used for both LLM analysis and embeddings

    // ── PARALELO 1: Buscar histórico + configs de modelo simultaneamente ──
    const [historyResult, analyzerConfig, embeddingConfig] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('role, content')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(5),
      getModelConfig(supabase, 'message_analyzer', DEFAULT_LITE_MODEL, 0.2, 300),
      getModelConfig(supabase, 'embedding', 'text-embedding-3-small'),
    ])

    const context = historyResult.data
      ?.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`)
      .join('\n') || ''

    console.log(`[message-analyzer] Using model: ${analyzerConfig.model} (configs loaded in ${Date.now() - startTime}ms)`)

    const openRouterEmbModel = embeddingConfig.model.includes('/') ? embeddingConfig.model : `openai/${embeddingConfig.model}`

    // ── PARALELO 2: LLM analysis + Embedding generation simultaneamente ──
    const [llmResult, embResult] = await Promise.all([
      // LLM Analysis via OpenRouter
      callOpenRouter({
        model: analyzerConfig.model,
        messages: [
          {
            role: 'system',
            content: `Você é um analisador de mensagens para um helpdesk.

Analise a mensagem do cliente e retorne APENAS um JSON válido (sem markdown, sem backticks) com:
{
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "low" | "medium" | "high" | "critical",
  "intent": string (ex: "billing_question", "technical_support", "complaint", "general_inquiry", "password_reset", "invoice_question", "want_human", "satisfied_resolved"),
  "keywords": string[] (palavras-chave relevantes),
  "suggested_category": "financial" | "support" | "sales" | "triage"
}

Regras:
- "urgency" = "critical" se mencionar: sistema fora, urgente, emergência, não consigo acessar
- "urgency" = "high" se mencionar: problema grave, não funciona, erro
- "sentiment" = "negative" se houver reclamação, frustração, raiva
- "intent" = "want_human" se cliente pedir para falar com pessoa, atendente humano, operador ou responsável
- "intent" = "satisfied_resolved" se cliente confirmar que o problema foi resolvido (ex: "resolveu", "funcionou", "ok obrigado", "era isso", "perfeito resolvido")
- "intent" deve ser específico e descritivo`
          },
          {
            role: 'user',
            content: context
              ? `Histórico recente:\n${context}\n\nMensagem atual: ${message_content}`
              : `Mensagem: ${message_content}`
          }
        ],
        temperature: analyzerConfig.temperature,
        max_tokens: analyzerConfig.max_tokens,
      }),
      // Embedding generation via OpenRouter (runs in parallel with LLM)
      callOpenRouterEmbedding({
        model: openRouterEmbModel,
        input: message_content,
      }),
    ])

    const analysisText = llmResult.content?.trim()

    if (!analysisText) {
      throw new Error('Empty response from LLM')
    }

    // Parse JSON (remove markdown se houver)
    const cleanJson = analysisText.replace(/```json\n?|\n?```/g, '').trim()
    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(cleanJson)
    } catch {
      console.error('[message-analyzer] Failed to parse LLM response:', cleanJson)
      analysis = {
        sentiment: 'neutral',
        urgency: 'medium',
        intent: 'general_inquiry',
        keywords: [],
        suggested_category: 'triage'
      }
    }

    // Process embedding result
    const embedding = embResult.embedding

    // ── PARALELO 3: Buscar última mensagem + calcular custo simultaneamente ──
    const promptTokens = llmResult.usage?.prompt_tokens || 0
    const completionTokens = llmResult.usage?.completion_tokens || 0

    const [lastMsgResult, pricing] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      getModelPricing(supabase, analyzerConfig.model),
    ])

    // Update message analysis (non-blocking — don't await)
    if (lastMsgResult.data) {
      supabase
        .from('ai_messages')
        .update({
          intent: analysis.intent as string,
          sentiment: analysis.sentiment as string,
          urgency: analysis.urgency as string,
          sentiment_score: analysis.sentiment === 'positive' ? 0.8 : analysis.sentiment === 'negative' ? -0.8 : 0
        })
        .eq('id', lastMsgResult.data.id)
        .then(() => {})
    }

    const costUSD = calculateCost(promptTokens, completionTokens, pricing)
    const totalMs = Date.now() - startTime

    console.log(`[message-analyzer] Intent: ${analysis.intent}, Sentiment: ${analysis.sentiment}, Urgency: ${analysis.urgency}, Cost: $${costUSD.toFixed(6)}, Latency: ${totalMs}ms`)

    return new Response(JSON.stringify({
      ...analysis,
      embedding,
      cost_usd: costUSD,
      latency_ms: totalMs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[message-analyzer] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
