import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getModelConfig } from '../_shared/get-model-config.ts'
import { callOpenRouter, callOpenRouterEmbedding } from '../_shared/openrouter-client.ts'
import { FLAGS } from '../_shared/feature-flags.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'
import { DEFAULT_LITE_MODEL } from '../_shared/default-models.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  const token = authHeader.replace('Bearer ', '')
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const {
      embedding,
      query,
      mode = 'hybrid',
      top_k = 5,
      similarity_threshold = 0.75,
      category_filter,
      tags_filter,
      product_id,
      conversation_id,
      agent_id,
    } = await req.json()

    // Validar mode
    const validModes = ['hybrid', 'quality', 'vector'] as const
    type SearchMode = typeof validModes[number]
    const searchMode: SearchMode = validModes.includes(mode) ? mode : 'hybrid'

    let queryEmbedding = embedding

    // Se recebeu query text ao invés de embedding, gerar embedding
    if (!queryEmbedding && query) {
      const { model: embeddingModel } = await getModelConfig(
        supabase,
        'embedding',
        'openai/text-embedding-3-small'
      )
      const openRouterModel = embeddingModel.includes('/') ? embeddingModel : `openai/${embeddingModel}`
      console.log(`[rag-search] Using embedding model: ${openRouterModel}`)

      const embResult = await callOpenRouterEmbedding({
        model: openRouterModel,
        input: query
      })

      queryEmbedding = embResult.embedding
    }

    if (!queryEmbedding) {
      throw new Error('Either embedding or query text is required')
    }

    let documents: any[] = []
    let modeUsed: SearchMode = searchMode

    if (searchMode === 'hybrid' && FLAGS.RAG_HYBRID_SEARCH && query) {
      // Busca híbrida (Vector + Full-Text com RRF)
      console.log(`[rag-search] mode=hybrid (RAG_HYBRID_SEARCH enabled)`)
      const { data, error } = await supabase.rpc('search_knowledge_hybrid', {
        query_embedding: JSON.stringify(queryEmbedding),
        query_text: query,
        match_threshold: similarity_threshold,
        match_count: top_k,
        filter_category: category_filter || null,
        filter_tags: tags_filter || null,
        filter_product_id: product_id || null,
        vector_weight: 0.6,
        text_weight: 0.4,
      })

      if (error) throw error
      documents = data || []
    } else if (searchMode === 'quality') {
      // Busca com quality-adjusted ranking (ex-knowledge-search)
      console.log(`[rag-search] mode=quality`)
      const { data, error } = await supabase.rpc('search_knowledge_with_quality', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: similarity_threshold,
        match_count: top_k,
        filter_category: category_filter || null,
        filter_tags: tags_filter || null,
        filter_product_id: product_id || null,
      })

      if (error) {
        // Fallback para busca vetorial pura se quality RPC falhar
        console.warn('[rag-search] quality mode failed, falling back to vector:', error.message)
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('search_knowledge', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: similarity_threshold,
          match_count: top_k,
          filter_category: category_filter || null,
          filter_tags: tags_filter || null,
          filter_product_id: product_id || null,
        })
        if (fallbackError) throw fallbackError
        documents = fallbackData || []
        modeUsed = 'vector'
      } else {
        documents = data || []
      }
    } else {
      // Busca vetorial pura — usada quando mode=vector OU quando mode=hybrid mas flag desligada
      console.log(`[rag-search] mode=vector (requested=${searchMode}, hybrid_flag=${FLAGS.RAG_HYBRID_SEARCH})`)
      const { data, error } = await supabase.rpc('search_knowledge', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: similarity_threshold,
        match_count: top_k,
        filter_category: category_filter || null,
        filter_tags: tags_filter || null,
        filter_product_id: product_id || null,
      })

      if (error) throw error
      documents = data || []
      modeUsed = 'vector'
    }

    // Incluir documentos globais que podem não ter sido filtrados
    // Se agent_id foi passado, buscar docs globais que não estão no resultado
    // Nota: só aplicamos em hybrid/quality (não em vector puro, para preservar semântica legacy)
    if (searchMode !== 'vector' && agent_id && documents.length < top_k) {
      try {
        const existingIds = documents.map((d: any) => d.id)
        const { data: globalDocs } = await supabase
          .from('ai_knowledge_base')
          .select('id, title, content, category, tags')
          .eq('is_global', true)
          .eq('is_active', true)
          .eq('feeds_ai', true)
          .not('id', 'in', `(${existingIds.join(',')})`)
          .limit(top_k - documents.length)

        if (globalDocs?.length) {
          console.log(`[rag-search] Added ${globalDocs.length} global docs to fill top_k`)
          documents = [...documents, ...globalDocs]
        }
      } catch (globalErr) {
        console.warn('[rag-search] Global docs fetch failed:', globalErr)
      }
    }

    // Re-ranking via LLM (opcional, gated por flag; não aplicar em mode=vector por performance)
    if (searchMode !== 'vector' && FLAGS.RAG_RERANK && documents.length > 1 && query) {
      console.log(`[rag-search] Re-ranking ${documents.length} results (flag: RAG_RERANK)`)
      try {
        documents = await rerankDocuments(query, documents)
      } catch (rerankErr) {
        console.warn(`[rag-search] Re-rank failed, using original order:`, rerankErr)
      }
    }

    // Track retrieval count (fire-and-forget)
    if (FLAGS.RAG_QUALITY_TRACKING && documents.length > 0) {
      const docIds = documents.map((d: any) => d.id)
      supabase.rpc('increment_retrieval_count', { doc_ids: docIds })
        .then(() => {}, (e: any) => console.warn('[rag-search] retrieval count error:', e))
    }

    console.log(`[rag-search] mode_used=${modeUsed} found=${documents.length} threshold=${similarity_threshold} top_k=${top_k}`)

    return new Response(JSON.stringify({
      documents,
      results: documents,          // alias: corrige inconsistência com call sites legacy
      count: documents.length,
      total: documents.length,     // alias: compat com shape antigo de knowledge-search
      mode_used: modeUsed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[rag-search] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Re-rank documents using a lightweight LLM call.
 * Uses Gemini Flash Lite for speed (~200ms).
 * Returns documents reordered by contextual relevance.
 */
async function rerankDocuments(
  query: string,
  documents: Array<{ id: string; title: string; content: string; similarity: number; [key: string]: any }>
): Promise<typeof documents> {
  const docSummaries = documents.map((d, i) =>
    `[${i}] "${d.title}": ${d.content.substring(0, 300)}`
  ).join('\n')

  const result = await callOpenRouter({
    model: DEFAULT_LITE_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Você é um sistema de re-ranking. Dada uma consulta e uma lista de documentos, ordene os índices dos documentos do mais relevante ao menos relevante. Retorne APENAS os índices separados por vírgula, ex: "2,0,3,1". Sem explicações.'
      },
      {
        role: 'user',
        content: `Consulta: "${query}"\n\nDocumentos:\n${docSummaries}`
      }
    ],
    temperature: 0,
    max_tokens: 50,
  })

  const indices = (result.content || '').trim().split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n < documents.length)

  if (indices.length === 0) return documents

  // Reorder documents by LLM ranking, append any missing ones at end
  const seen = new Set<number>()
  const reranked: typeof documents = []
  for (const idx of indices) {
    if (!seen.has(idx)) {
      seen.add(idx)
      reranked.push(documents[idx])
    }
  }
  // Append any docs not in LLM output
  for (let i = 0; i < documents.length; i++) {
    if (!seen.has(i)) reranked.push(documents[i])
  }

  return reranked
}
