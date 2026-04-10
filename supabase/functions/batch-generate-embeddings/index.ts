import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouterEmbedding } from '../_shared/openrouter-client.ts'
import { getModelConfig } from '../_shared/get-model-config.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

/**
 * Gera embeddings em batch para documentos da ai_knowledge_base que ainda não têm.
 * Aceita: { limit?: number, product_id?: string }
 * Não requer auth de usuário — usa service role.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { limit = 20, product_id } = await req.json().catch(() => ({}))

    // Buscar docs sem embedding
    let query = supabase
      .from('ai_knowledge_base')
      .select('id, title, content')
      .is('embedding', null)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(Math.min(limit, 50))

    if (product_id) {
      query = query.eq('product_id', product_id)
    }

    const { data: docs, error: fetchError } = await query

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`)
    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({
        success: true, processed: 0, message: 'No documents without embeddings found'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[batch-embeddings] Processing ${docs.length} documents...`)

    const { model: embeddingModel } = await getModelConfig(supabase, 'embedding', 'openai/text-embedding-3-small')
    const openRouterModel = embeddingModel.includes('/') ? embeddingModel : `openai/${embeddingModel}`

    let processed = 0
    let errors = 0
    const results: Array<{ id: string; title: string; success: boolean; error?: string }> = []

    for (const doc of docs) {
      try {
        const textToEmbed = `${doc.title}\n\n${doc.content}`.slice(0, 32000)

        const embResult = await callOpenRouterEmbedding({
          model: openRouterModel,
          input: textToEmbed,
        })

        if (!embResult.embedding?.length) {
          throw new Error('Empty embedding returned')
        }

        const embeddingStr = `[${embResult.embedding.join(',')}]`

        const { error: updateError } = await supabase
          .from('ai_knowledge_base')
          .update({ embedding: embeddingStr })
          .eq('id', doc.id)

        if (updateError) throw new Error(updateError.message)

        processed++
        results.push({ id: doc.id, title: doc.title, success: true })
        console.log(`[batch-embeddings] ✓ ${doc.title} (${embResult.tokens_used} tokens)`)
      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ id: doc.id, title: doc.title, success: false, error: msg })
        console.error(`[batch-embeddings] ✗ ${doc.title}: ${msg}`)
      }
    }

    // Contar quantos ainda faltam
    const { count } = await supabase
      .from('ai_knowledge_base')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null)
      .eq('is_active', true)

    console.log(`[batch-embeddings] Done: ${processed} ok, ${errors} errors, ${count} remaining`)

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      remaining: count,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[batch-embeddings] Fatal:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
