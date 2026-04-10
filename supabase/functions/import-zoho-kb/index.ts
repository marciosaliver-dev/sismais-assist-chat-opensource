import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenRouterEmbedding } from '../_shared/openrouter-client.ts'
import { htmlToText, sanitizeHtml, rehostImages } from '../_shared/html-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ─── Tipos ──────────────────────────────────────────────────────────

interface ImportStats {
  total_found: number
  imported: number
  duplicates: number
  skipped: number
  errors: number
  images_rehosted: number
  details: string[]
}

interface ManualArticle {
  title: string
  content: string
  category?: string
  tags?: string[]
  url?: string
}

interface ZohoCategory {
  id: string
  name: string
  description?: string
}

interface ZohoArticle {
  id: string
  title: string
  answer?: string        // HTML do conteudo no Zoho Desk
  answerText?: string    // texto puro (se disponivel)
  status?: string
  categoryId?: string
  category?: { name?: string }
  tags?: string[]
  webUrl?: string
  permalink?: string
  modifiedTime?: string
}

// ─── Utilitarios ────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const result = await callOpenRouterEmbedding({
      model: 'openai/text-embedding-3-small',
      input: text.substring(0, 32000),
    })
    return result.embedding?.length ? result.embedding : null
  } catch (err) {
    console.error('[import-zoho-kb] Erro gerando embedding:', err)
    return null
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Zoho API Client ────────────────────────────────────────────────

class ZohoClient {
  private baseUrl: string
  private token: string
  private orgId: string

  constructor(token: string, orgId: string, domain = 'desk.zoho.com') {
    this.baseUrl = `https://${domain}/api/v1`
    this.token = token
    this.orgId = orgId
  }

  getToken(): string {
    return this.token
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Zoho-oauthtoken ${this.token}`,
        'orgId': this.orgId,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Zoho API ${res.status}: ${body}`)
    }

    return res.json()
  }

  async listCategories(departmentId?: string): Promise<ZohoCategory[]> {
    const params: Record<string, string> = { from: '0', limit: '100' }
    if (departmentId) params.departmentId = departmentId

    const data = await this.request<{ data: ZohoCategory[] }>('/articles/categories', params)
    return data.data ?? []
  }

  async listArticles(categoryId: string, from = 0): Promise<ZohoArticle[]> {
    const data = await this.request<{ data: ZohoArticle[] }>('/articles', {
      categoryId,
      from: String(from),
      limit: '50',
      status: 'Published',
    })
    return data.data ?? []
  }

  async getArticle(articleId: string): Promise<ZohoArticle> {
    return this.request<ZohoArticle>(`/articles/${articleId}`)
  }
}

// ─── Processamento de artigo ────────────────────────────────────────

async function processAndSaveArticle(
  supabase: ReturnType<typeof createClient>,
  article: {
    title: string
    contentPlain: string
    contentHtml: string | null
    category: string
    tags: string[]
    url: string
  },
  stats: ImportStats,
): Promise<void> {
  const { title, contentPlain, contentHtml, category, tags, url } = article

  if (!contentPlain || contentPlain.length < 10) {
    stats.skipped++
    stats.details.push(`Ignorado (conteudo vazio): "${title}"`)
    return
  }

  // Deduplicacao por original_url ou titulo
  const dedupeField = url ? 'original_url' : 'title'
  const dedupeValue = url || title

  const { data: existing } = await supabase
    .from('ai_knowledge_base')
    .select('id')
    .eq(dedupeField, dedupeValue)
    .eq('is_active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    stats.duplicates++
    stats.details.push(`Duplicado: "${title}"`)
    return
  }

  // Gerar embedding
  const embeddingInput = `${title}\n\n${contentPlain}`
  const embedding = await generateEmbedding(embeddingInput)

  const { error } = await supabase
    .from('ai_knowledge_base')
    .insert({
      title,
      content: contentPlain,
      content_html: contentHtml,
      content_type: 'text',
      category: category || 'tutorial',
      tags: tags?.length ? tags : null,
      original_url: url || null,
      source: 'zoho_desk',
      is_active: true,
      is_public: true,
      feeds_ai: true,
      embedding: embedding ? JSON.stringify(embedding) : null,
      chunk_index: 0,
    })

  if (error) {
    stats.errors++
    stats.details.push(`Erro ao salvar "${title}": ${error.message}`)
    console.error(`[import-zoho-kb] Erro insert "${title}":`, error.message)
  } else {
    stats.imported++
    console.log(`[import-zoho-kb] ✓ ${title}`)
  }
}

// ─── Processar HTML: sanitizar, rehostear imagens ───────────────────

async function processHtml(
  rawHtml: string,
  supabase: ReturnType<typeof createClient>,
  articleId: string,
  authToken?: string,
): Promise<{ contentHtml: string; imagesCount: number }> {
  let sanitized = sanitizeHtml(rawHtml)

  // Rehostear imagens para Supabase Storage
  const before = sanitized
  sanitized = await rehostImages(sanitized, {
    supabase,
    basePath: `zoho/${articleId}`,
    authToken,
  })

  // Contar imagens rehostadas (comparando antes/depois)
  const imgsBefore = (before.match(/<img/gi) || []).length
  const imgsAfter = (sanitized.match(/supabase\.co\/storage/gi) || []).length
  const imagesCount = Math.min(imgsBefore, imgsAfter)

  return { contentHtml: sanitized, imagesCount }
}

// ─── Modo 1: Importacao direta via API Zoho ─────────────────────────

async function importFromZohoApi(
  supabase: ReturnType<typeof createClient>,
  config: { token: string; orgId: string; domain?: string; departmentId?: string },
): Promise<ImportStats> {
  const stats: ImportStats = {
    total_found: 0, imported: 0, duplicates: 0, skipped: 0,
    errors: 0, images_rehosted: 0, details: [],
  }
  const client = new ZohoClient(config.token, config.orgId, config.domain)

  console.log('[import-zoho-kb] Buscando categorias...')
  const categories = await client.listCategories(config.departmentId)
  console.log(`[import-zoho-kb] ${categories.length} categorias encontradas`)

  for (const cat of categories) {
    console.log(`[import-zoho-kb] Categoria: ${cat.name}`)
    let from = 0
    let hasMore = true

    while (hasMore) {
      const articles = await client.listArticles(cat.id, from)
      if (articles.length === 0) {
        hasMore = false
        break
      }

      stats.total_found += articles.length

      for (const article of articles) {
        let fullArticle: ZohoArticle
        try {
          fullArticle = await client.getArticle(article.id)
        } catch (err) {
          stats.errors++
          stats.details.push(`Erro ao buscar artigo ${article.id}: ${err}`)
          continue
        }

        const rawHtml = fullArticle.answer || ''
        const contentPlain = fullArticle.answerText?.trim() || htmlToText(rawHtml)
        const url = fullArticle.permalink || fullArticle.webUrl || ''

        // Processar HTML com imagens
        let contentHtml: string | null = null
        if (rawHtml.length > 0) {
          const result = await processHtml(rawHtml, supabase, fullArticle.id, client.getToken())
          contentHtml = result.contentHtml
          stats.images_rehosted += result.imagesCount
        }

        await processAndSaveArticle(supabase, {
          title: fullArticle.title,
          contentPlain,
          contentHtml,
          category: cat.name,
          tags: fullArticle.tags || [],
          url,
        }, stats)

        // Rate limiting
        await delay(200)
      }

      from += articles.length
      if (articles.length < 50) hasMore = false
    }
  }

  return stats
}

// ─── Modo 2: Importacao manual via JSON batch ───────────────────────

async function importFromBatch(
  supabase: ReturnType<typeof createClient>,
  articles: ManualArticle[],
): Promise<ImportStats> {
  const stats: ImportStats = {
    total_found: articles.length, imported: 0, duplicates: 0,
    skipped: 0, errors: 0, images_rehosted: 0, details: [],
  }

  console.log(`[import-zoho-kb] Importacao batch: ${articles.length} artigos`)

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]
    if (!article.title || !article.content) {
      stats.skipped++
      stats.details.push(`Ignorado (sem titulo ou conteudo)`)
      continue
    }

    const rawHtml = article.content
    const contentPlain = htmlToText(rawHtml)

    // Processar HTML com imagens
    let contentHtml: string | null = null
    if (rawHtml.includes('<')) {
      const result = await processHtml(rawHtml, supabase, `batch-${i}`)
      contentHtml = result.contentHtml
      stats.images_rehosted += result.imagesCount
    }

    await processAndSaveArticle(supabase, {
      title: article.title,
      contentPlain,
      contentHtml,
      category: article.category || 'geral',
      tags: article.tags || [],
      url: article.url || '',
    }, stats)

    await delay(100)
  }

  return stats
}

// ─── Handler principal ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const body = await req.json()

    const mode = body.mode || (body.articles ? 'batch' : body.token ? 'api' : null)

    if (!mode) {
      return new Response(JSON.stringify({
        error: 'Informe o modo de importacao',
        usage: {
          api: { mode: 'api', token: 'Zoho-oauthtoken', orgId: 'ID da org', domain: 'desk.zoho.com (opcional)', departmentId: 'opcional' },
          batch: { mode: 'batch', articles: [{ title: 'Titulo', content: 'Conteudo HTML ou texto', category: 'opcional', tags: ['opcional'], url: 'opcional' }] },
        },
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let stats: ImportStats

    if (mode === 'api') {
      if (!body.token || !body.orgId) {
        throw new Error('Campos obrigatorios para modo api: token, orgId')
      }
      stats = await importFromZohoApi(supabase, {
        token: body.token,
        orgId: body.orgId,
        domain: body.domain,
        departmentId: body.departmentId,
      })
    } else if (mode === 'batch') {
      if (!Array.isArray(body.articles) || body.articles.length === 0) {
        throw new Error('Campo "articles" deve ser um array com pelo menos 1 artigo')
      }
      stats = await importFromBatch(supabase, body.articles)
    } else {
      throw new Error(`Modo "${mode}" nao reconhecido. Use "api" ou "batch".`)
    }

    console.log('[import-zoho-kb] Concluido:', JSON.stringify(stats, null, 2))

    return new Response(JSON.stringify({
      success: true,
      mode,
      stats: {
        total_found: stats.total_found,
        imported: stats.imported,
        duplicates: stats.duplicates,
        skipped: stats.skipped,
        errors: stats.errors,
        images_rehosted: stats.images_rehosted,
      },
      details: stats.details,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[import-zoho-kb] Erro:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
