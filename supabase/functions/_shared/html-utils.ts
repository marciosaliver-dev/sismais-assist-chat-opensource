/**
 * Shared HTML utilities for KB import functions.
 * - htmlToText: strip HTML for RAG embeddings
 * - sanitizeHtml: whitelist safe tags for human display
 * - rehostImages: download images and upload to Supabase Storage
 */

// ─── HTML to Plain Text (para RAG/embeddings) ───────────────────────

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Sanitizar HTML (whitelist de tags seguras) ─────────────────────

const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'img',
  'strong', 'b', 'em', 'i', 'u', 's', 'del',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'blockquote', 'code', 'pre', 'hr', 'div', 'span',
  'figure', 'figcaption', 'video', 'source',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'title', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  video: new Set(['src', 'controls', 'width', 'height']),
  source: new Set(['src', 'type']),
}

export function sanitizeHtml(html: string): string {
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/?>/gi, '')

  // Remover event handlers (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')

  // Remover javascript: em href
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')

  // Filtrar tags
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (match.startsWith('</')) return `</${tag}>`

    const allowedAttrs = ALLOWED_ATTRS[tag]
    if (!allowedAttrs) {
      const selfClose = match.endsWith('/>')
      return selfClose ? `<${tag} />` : `<${tag}>`
    }

    const attrs: string[] = []
    const attrRegex = /\s([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(match)) !== null) {
      const name = attrMatch[1].toLowerCase()
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''
      if (allowedAttrs.has(name)) {
        attrs.push(`${name}="${value}"`)
      }
    }

    const selfClose = match.endsWith('/>')
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
    return selfClose ? `<${tag}${attrStr} />` : `<${tag}${attrStr}>`
  })

  return clean.trim()
}

// ─── Rehost de imagens para Supabase Storage ────────────────────────

interface RehostOptions {
  supabase: any
  basePath: string
  authToken?: string
  maxSize?: number
}

const BUCKET = 'knowledge-media'
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024

function getExtFromContentType(ct: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return map[ct.split(';')[0].trim()] || 'jpg'
}

export async function rehostImages(
  html: string,
  options: RehostOptions,
): Promise<string> {
  const { supabase, basePath, authToken, maxSize = DEFAULT_MAX_SIZE } = options

  const imgRegex = /<img\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi
  const matches: Array<{ full: string; src: string }> = []
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    if (m[1].startsWith('data:') || m[1].includes('supabase.co/storage')) continue
    matches.push({ full: m[0], src: m[1] })
  }

  if (matches.length === 0) return html

  let result = html
  let index = 0

  for (const { full, src } of matches) {
    try {
      const headers: Record<string, string> = {}
      if (authToken) {
        headers['Authorization'] = `Zoho-oauthtoken ${authToken}`
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const response = await fetch(src, { headers, signal: controller.signal })
      clearTimeout(timeout)

      if (!response.ok) {
        console.warn(`[html-utils] Falha ao baixar imagem ${src}: ${response.status}`)
        continue
      }

      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > maxSize) {
        console.warn(`[html-utils] Imagem muito grande: ${src}`)
        continue
      }

      const blob = await response.arrayBuffer()
      if (blob.byteLength > maxSize) continue

      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const ext = getExtFromContentType(contentType)
      const fileName = `${basePath}/${index}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, blob, { contentType, upsert: true })

      if (uploadError) {
        console.warn(`[html-utils] Erro upload ${fileName}:`, uploadError.message)
        continue
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
      if (urlData?.publicUrl) {
        result = result.replace(full, full.replace(src, urlData.publicUrl))
        index++
      }
    } catch (err) {
      console.warn(`[html-utils] Erro imagem ${src}:`, (err as Error).message)
    }
  }

  return result
}