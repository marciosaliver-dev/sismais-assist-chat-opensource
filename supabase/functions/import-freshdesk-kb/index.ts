import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouterEmbedding } from '../_shared/openrouter-client.ts'
import { htmlToText, sanitizeHtml, rehostImages } from '../_shared/html-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ZohoArticle {
  id: number
  title: string
  content_html: string
  content_text?: string
  status: string | number
  tags: string[]
  url: string
}

interface ZohoSection {
  id: number
  name: string
  description: string | null
  articles: ZohoArticle[]
}

interface ZohoCategory {
  id: number
  name: string
  description: string | null
  sections: ZohoSection[]
}

interface ZohoPayload {
  exported_at: string
  source_url: string
  portal_name?: string
  categories: ZohoCategory[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}

function isDraft(status: string | number): boolean {
  return status === 'draft' || status === 1 || status === '1'
}

async function generateEmbedding(text: string, _apiKey?: string): Promise<number[] | null> {
  try {
    const result = await callOpenRouterEmbedding({
      model: 'openai/text-embedding-3-small',
      input: text.substring(0, 32000),
    })
    return result.embedding?.length ? result.embedding : null
  } catch {
    return null
  }
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
    const body = await req.json()
    const payload: ZohoPayload = body.data ?? body

    if (!payload?.categories?.length) throw new Error('Nenhuma categoria encontrada no arquivo')

    const stats = { products: 0, groups: 0, articles: 0, skipped: 0, errors: 0, images_rehosted: 0 }

    for (const category of payload.categories) {
      console.log(`[import-kb] Categoria: ${category.name}`)

      // 1. Criar ou reutilizar knowledge_product para a categoria
      const slug = slugify(category.name)

      const { data: existingProduct } = await supabase
        .from('knowledge_products' as any)
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      let productId: string
      if (existingProduct) {
        productId = (existingProduct as any).id
        console.log(`  → Produto existente: ${productId}`)
      } else {
        const { data: newProduct, error: productError } = await supabase
          .from('knowledge_products' as any)
          .insert({
            name: category.name,
            slug,
            description: category.description,
            is_active: true,
            sort_order: stats.products,
          } as any)
          .select('id')
          .single()

        if (productError) {
          console.error(`  Erro criando produto "${category.name}":`, productError)
          continue
        }
        productId = (newProduct as any).id
        stats.products++
        console.log(`  → Produto criado: ${productId}`)
      }

      for (const section of category.sections ?? []) {
        console.log(`  Seção: ${section.name}`)

        // 2. Criar ou reutilizar knowledge_group para a seção
        const { data: existingGroup } = await supabase
          .from('knowledge_groups' as any)
          .select('id')
          .eq('product_id', productId)
          .eq('name', section.name)
          .maybeSingle()

        let groupId: string
        if (existingGroup) {
          groupId = (existingGroup as any).id
        } else {
          const { data: newGroup, error: groupError } = await supabase
            .from('knowledge_groups' as any)
            .insert({
              product_id: productId,
              name: section.name,
              description: section.description,
            } as any)
            .select('id')
            .single()

          if (groupError) {
            console.error(`    Erro criando grupo "${section.name}":`, groupError)
            continue
          }
          groupId = (newGroup as any).id
          stats.groups++
        }

        // 3. Importar artigos da seção
        for (let i = 0; i < (section.articles ?? []).length; i++) {
          const article = section.articles[i]

          if (isDraft(article.status)) {
            stats.skipped++
            continue
          }

          const rawHtml = article.content_html || ''
          const contentPlain = article.content_text?.trim() || htmlToText(rawHtml)
          if (!contentPlain) {
            stats.skipped++
            continue
          }

          // Verificar duplicata por URL
          const { data: existing } = await supabase
            .from('ai_knowledge_base')
            .select('id')
            .eq('original_url', article.url)
            .eq('is_active', true)
            .limit(1)

          if (existing && existing.length > 0) {
            stats.skipped++
            continue
          }

          // Processar HTML: sanitizar e rehostear imagens
          let contentHtml: string | null = null
          if (rawHtml.includes('<')) {
            const sanitized = sanitizeHtml(rawHtml)
            contentHtml = await rehostImages(sanitized, {
              supabase,
              basePath: `zoho/${category.id}-${section.id}/${article.id}`,
            })

            // Contar imagens rehostadas
            const rehosted = (contentHtml.match(/supabase\.co\/storage/gi) || []).length
            stats.images_rehosted += rehosted
          }

          // Gerar embedding
          const embeddingInput = `${article.title}\n\n${contentPlain}`
          const embedding = await generateEmbedding(embeddingInput)

          // Salvar artigo
          const { error: insertError } = await supabase
            .from('ai_knowledge_base')
            .insert({
              title: article.title,
              content: contentPlain,
              content_html: contentHtml,
              content_type: 'text',
              category: 'tutorial',
              tags: article.tags?.length ? article.tags : null,
              original_url: article.url,
              source: 'zoho_desk',
              product_id: productId,
              group_id: groupId,
              is_active: true,
              is_public: true,
              feeds_ai: true,
              embedding: embedding ? JSON.stringify(embedding) : null,
              chunk_index: 0,
            })

          if (insertError) {
            console.error(`    Erro salvando "${article.title}":`, insertError.message)
            stats.errors++
          } else {
            stats.articles++
            console.log(`    ✓ ${article.title}`)
          }
        }
      }
    }

    console.log('[import-kb] Concluído:', stats)

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[import-kb] Erro:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
