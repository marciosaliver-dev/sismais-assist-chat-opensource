import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouter, callOpenRouterEmbedding } from '../_shared/openrouter-client.ts'
import { logAICost } from '../_shared/log-ai-cost.ts'
import { getModelConfig } from '../_shared/get-model-config.ts'
import { FLAGS } from '../_shared/feature-flags.ts'
import { corsHeaders } from '../_shared/supabase-helpers.ts'

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
    const { type, url, content, title, category, tags } = await req.json()

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')

    let finalContent = content || ''
    let finalTitle = title || ''
    let source = 'manual_upload'
    const mediaUrl = url

    console.log(`[knowledge-ingestion] Processing type="${type}", title="${title}"`)

    // Helper: clean markdown content from HTML artifacts and boilerplate
    const cleanMarkdown = (raw: string): string => {
      let cleaned = raw
      // Remove <script> and <style> blocks
      cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '')
      cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '')
      // Remove HTML comments
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')
      // Remove remaining HTML tags
      cleaned = cleaned.replace(/<[^>]+>/g, '')
      // Remove base64 images
      cleaned = cleaned.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '')
      // Remove "Skip to content" links
      cleaned = cleaned.replace(/\[?\s*Skip to (?:content|main|navigation)\s*\]?\(?[^)]*\)?/gi, '')
      // Normalize excessive newlines (3+ → 2)
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
      // Remove trailing whitespace per line
      cleaned = cleaned.replace(/[ \t]+$/gm, '')
      // Trim
      cleaned = cleaned.trim()
      return cleaned
    }

    // 1. PROCESSAR BASEADO NO TIPO
    if (type === 'link' && url) {
      if (!FIRECRAWL_API_KEY) {
        throw new Error('FIRECRAWL_API_KEY not configured for link crawling')
      }

      console.log(`[knowledge-ingestion] Crawling URL: ${url}`)
      const crawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true
        })
      })

      const crawlData = await crawlResponse.json()

      if (crawlData.success) {
        finalContent = crawlData.data?.markdown || crawlData.markdown || ''
        finalTitle = crawlData.data?.metadata?.title || title || url
        source = 'firecrawl'
        console.log(`[knowledge-ingestion] Crawled successfully: ${finalTitle} (${finalContent.length} chars)`)
      } else {
        throw new Error('Firecrawl failed: ' + (crawlData.error || 'Unknown error'))
      }
    }

    if (type === 'image' && url) {
      console.log(`[knowledge-ingestion] OCR via GPT-4o for image: ${url}`)
      const visionResult = await callOpenRouter({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia TODO o texto desta imagem. Se houver diagramas ou elementos visuais importantes, descreva-os também. Retorne o conteúdo em formato texto estruturado.'
              },
              {
                type: 'image_url',
                image_url: { url }
              }
            ]
          }
        ],
        max_tokens: 2000
      })

      finalContent = visionResult.content || ''

      await logAICost(supabase, {
        model: visionResult.model_used || 'openai/gpt-4o',
        feature: 'ocr',
        input_tokens: visionResult.usage?.prompt_tokens || 0,
        output_tokens: visionResult.usage?.completion_tokens || 0,
        cost_usd: visionResult.cost_usd || 0,
      })

      finalTitle = title || 'Imagem processada via OCR'
      source = 'ocr'
      console.log(`[knowledge-ingestion] OCR extracted ${finalContent.length} chars`)
    }

    if (!finalContent || finalContent.trim().length === 0) {
      throw new Error('No content to process')
    }

    // 1.5. LIMPEZA DE CONTEÚDO
    finalContent = cleanMarkdown(finalContent)
    console.log(`[knowledge-ingestion] Content cleaned: ${finalContent.length} chars`)

    // 1.6. VERIFICAÇÃO DE DUPLICATA POR URL
    let updatedExisting = false
    if (type === 'link' && url) {
      const { data: existing } = await supabase
        .from('ai_knowledge_base')
        .select('id, title')
        .eq('original_url', url)
        .eq('is_active', true)
        .limit(1)

      if (existing && existing.length > 0) {
        // Atualizar o documento existente em vez de criar novo
        console.log(`[knowledge-ingestion] Duplicate URL found, updating doc ${existing[0].id}`)
        const { error: updateError } = await supabase
          .from('ai_knowledge_base')
          .update({
            title: finalTitle,
            content: finalContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing[0].id)

        if (updateError) {
          console.error('[knowledge-ingestion] Update error:', updateError)
        } else {
          // Re-generate embedding for updated content
          try {
            const embResult = await callOpenRouterEmbedding({
              model: 'openai/text-embedding-3-small',
              input: finalContent.substring(0, 32000)
            })
            if (embResult.embedding?.length) {
              await supabase.from('ai_knowledge_base')
                .update({ embedding: JSON.stringify(embResult.embedding) })
                .eq('id', existing[0].id)
            }
            await logAICost(supabase, {
              model: 'openai/text-embedding-3-small',
              feature: 'embedding',
              input_tokens: embResult.tokens_used || 0,
              output_tokens: 0,
              cost_usd: 0,
            })
          } catch (embErr) {
            console.error('[knowledge-ingestion] Embedding update error:', embErr)
          }
          updatedExisting = true

          return new Response(JSON.stringify({
            success: true,
            action: 'updated',
            documents_updated: 1,
            document_ids: [existing[0].id],
            total_chars: finalContent.length,
            source
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // 2. CHUNKING — semântico (por seções/parágrafos) ou fixo (legado)
    const chunks: string[] = []

    if (FLAGS.RAG_SEMANTIC_CHUNKING) {
      // Chunking semântico: respeita limites de parágrafos, headers e seções
      const MAX_CHUNK = 2500
      const MIN_CHUNK = 200
      const TARGET_CHUNK = 1500

      // Separadores em ordem de prioridade (seções > parágrafos > frases)
      const sectionSplitters = [
        /\n#{1,3}\s+/,     // Markdown headers
        /\n---+\n/,         // Horizontal rules
        /\n\n\n+/,          // Triple+ newlines
      ]

      let sections: string[] = [finalContent]
      for (const splitter of sectionSplitters) {
        const newSections: string[] = []
        for (const section of sections) {
          if (section.length <= MAX_CHUNK) {
            newSections.push(section)
          } else {
            newSections.push(...section.split(splitter).filter(s => s.trim().length > 0))
          }
        }
        sections = newSections
      }

      // Split remaining large sections by paragraph
      const finalSections: string[] = []
      for (const section of sections) {
        if (section.length <= MAX_CHUNK) {
          finalSections.push(section)
        } else {
          const paragraphs = section.split(/\n\n/)
          let current = ''
          for (const para of paragraphs) {
            if (current.length + para.length > TARGET_CHUNK && current.length >= MIN_CHUNK) {
              finalSections.push(current.trim())
              // Overlap: keep last paragraph as context bridge
              const lastPara = current.split(/\n\n/).pop() || ''
              current = lastPara.length < 300 ? lastPara + '\n\n' + para : para
            } else {
              current += (current ? '\n\n' : '') + para
            }
          }
          if (current.trim().length >= MIN_CHUNK) {
            finalSections.push(current.trim())
          }
        }
      }

      // Merge tiny sections with next
      const merged: string[] = []
      let buffer = ''
      for (const sec of finalSections) {
        if (buffer.length + sec.length < TARGET_CHUNK) {
          buffer += (buffer ? '\n\n' : '') + sec
        } else {
          if (buffer.trim().length >= MIN_CHUNK) merged.push(buffer.trim())
          buffer = sec
        }
      }
      if (buffer.trim().length >= MIN_CHUNK) merged.push(buffer.trim())

      chunks.push(...(merged.length > 0 ? merged : [finalContent]))
      console.log(`[knowledge-ingestion] Semantic chunking: ${chunks.length} chunks (flag: RAG_SEMANTIC_CHUNKING)`)
    } else {
      // Chunking fixo legado
      const CHUNK_SIZE = 2000
      const CHUNK_OVERLAP = 200

      if (finalContent.length > 6000) {
        for (let i = 0; i < finalContent.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const chunk = finalContent.substring(i, i + CHUNK_SIZE)
          if (chunk.trim().length > 50) {
            chunks.push(chunk)
          }
        }
        console.log(`[knowledge-ingestion] Fixed chunking: ${chunks.length} chunks`)
      } else {
        chunks.push(finalContent)
      }
    }

    // 3. GERAR EMBEDDINGS E SALVAR
    // Ler modelo de embedding da config (em vez de hardcodar)
    const { model: embeddingModel } = await getModelConfig(supabase, 'embedding', 'openai/text-embedding-3-small')
    const openRouterEmbModel = embeddingModel.includes('/') ? embeddingModel : `openai/${embeddingModel}`
    console.log(`[knowledge-ingestion] Using embedding model: ${openRouterEmbModel}`)

    const documentIds: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      // Gerar embedding via OpenRouter
      const embResult = await callOpenRouterEmbedding({
        model: openRouterEmbModel,
        input: chunk
      })

      const embedding = embResult.embedding

      await logAICost(supabase, {
        model: openRouterEmbModel,
        feature: 'embedding',
        input_tokens: embResult.tokens_used || 0,
        output_tokens: 0,
        cost_usd: 0,
      })

      if (!embedding?.length) {
        throw new Error(`Failed to generate embedding for chunk ${i}`)
      }

      // Salvar no banco
      const { data: doc, error } = await supabase
        .from('ai_knowledge_base')
        .insert({
          title: chunks.length === 1 ? finalTitle : `${finalTitle} (parte ${i + 1}/${chunks.length})`,
          content: chunk,
          content_type: type || 'text',
          category: category || 'general',
          tags: tags || null,
          original_url: type === 'link' ? url : null,
          media_url: type !== 'text' ? mediaUrl : null,
          source,
          embedding: JSON.stringify(embedding),
          chunk_index: i,
          parent_doc_id: i > 0 ? documentIds[0] : null
        })
        .select('id')
        .single()

      if (error) {
        console.error(`[knowledge-ingestion] Error saving chunk ${i}:`, error)
        throw error
      }
      
      documentIds.push(doc.id)
    }

    console.log(`[knowledge-ingestion] Created ${documentIds.length} documents successfully`)

    return new Response(JSON.stringify({
      success: true,
      documents_created: documentIds.length,
      document_ids: documentIds,
      total_chars: finalContent.length,
      source
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[knowledge-ingestion] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
