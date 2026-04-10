/**
 * document-processor — Processa uploads de documentos para a base de conhecimento
 *
 * Aceita PDF, DOCX, XLSX e imagens. Extrai texto, salva no Storage,
 * insere na ai_knowledge_base e dispara geração de embeddings.
 */

import { createServiceClient, corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from '../_shared/supabase-helpers.ts'
// @deno-types="https://esm.sh/pdf-parse@1.1.1"
import pdfParse from 'https://esm.sh/pdf-parse@1.1.1'
import mammoth from 'https://esm.sh/mammoth@1.6.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const LOG_MODULE = 'document-processor'
const CHUNK_SIZE = 2000
const CHUNK_OVERLAP = 200
const CHUNK_THRESHOLD = 6000
const STORAGE_BUCKET = 'knowledge-documents'

interface RequestBody {
  file_base64: string
  file_name: string
  file_type: 'pdf' | 'docx' | 'image' | 'xlsx'
  title: string
  category?: string
  tags?: string[]
  product_id?: string
  group_id?: string
  is_public?: boolean
  feeds_ai?: boolean
}

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  image: 'image/png',
}

function log(level: string, msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, module: LOG_MODULE, msg, ...extra }))
}

/**
 * Divide texto em chunks com overlap
 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end))
    if (end >= text.length) break
    start = end - CHUNK_OVERLAP
  }
  return chunks
}

/**
 * Extrai texto de PDF
 */
async function extractPdf(buffer: Uint8Array): Promise<string> {
  const result = await pdfParse(buffer)
  return result.text?.trim() || ''
}

/**
 * Extrai texto de DOCX
 */
async function extractDocx(buffer: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value?.trim() || ''
}

/**
 * Extrai texto de XLSX convertendo cada sheet para CSV
 */
function extractXlsx(buffer: Uint8Array): string {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheets: string[] = []
  for (const name of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
    if (csv.trim()) {
      sheets.push(`--- ${name} ---\n${csv}`)
    }
  }
  return sheets.join('\n\n').trim()
}

/**
 * Extrai texto de imagem via OpenAI GPT-4o Vision
 */
async function extractImage(base64: string, fileName: string): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')

  // Detecta mime type pela extensão
  const ext = fileName.split('.').pop()?.toLowerCase() || 'png'
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp'
    : ext === 'gif' ? 'image/gif'
    : 'image/png'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sismais.com.br',
      'X-Title': 'Sismais Helpdesk',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ALL text visible in this image. Return only the extracted text, preserving the original structure and formatting as much as possible. If no text is found, return "NO_TEXT_FOUND".',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI Vision API error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  if (text === 'NO_TEXT_FOUND') return ''
  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse()
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const body: RequestBody = await req.json()

    // Validação
    const { file_base64, file_name, file_type, title } = body
    if (!file_base64 || !file_name || !file_type || !title) {
      return errorResponse('Missing required fields: file_base64, file_name, file_type, title', 400)
    }

    const supportedTypes = ['pdf', 'docx', 'image', 'xlsx']
    if (!supportedTypes.includes(file_type)) {
      return errorResponse(`Unsupported file_type: ${file_type}. Supported: ${supportedTypes.join(', ')}`, 400)
    }

    log('info', `Processing ${file_type} document: ${file_name}`)

    // Decode base64
    const binaryString = atob(file_base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const fileSize = bytes.length

    // Extrair texto
    let content = ''
    switch (file_type) {
      case 'pdf':
        content = await extractPdf(bytes)
        break
      case 'docx':
        content = await extractDocx(bytes)
        break
      case 'xlsx':
        content = extractXlsx(bytes)
        break
      case 'image':
        content = await extractImage(file_base64, file_name)
        break
    }

    if (!content) {
      return errorResponse('Could not extract any text from the document', 422)
    }

    log('info', `Extracted ${content.length} chars from ${file_name}`)

    const supabase = createServiceClient()

    // Upload para Storage
    const timestamp = Date.now()
    const storagePath = `${file_type}/${timestamp}_${file_name}`
    const mimeType = MIME_MAP[file_type] || 'application/octet-stream'

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      log('error', `Storage upload failed: ${uploadError.message}`)
      return errorResponse(`File upload failed: ${uploadError.message}`, 500)
    }

    log('info', `Uploaded to storage: ${storagePath}`)

    // Preparar dados base para inserção
    const baseDoc = {
      title,
      content_type: file_type,
      file_path: storagePath,
      file_size: fileSize,
      file_type: mimeType,
      source: 'file_upload',
      category: body.category || null,
      tags: body.tags || null,
      product_id: body.product_id || null,
      group_id: body.group_id || null,
      is_public: body.is_public ?? false,
      feeds_ai: body.feeds_ai ?? true,
      is_active: true,
    }

    let documentId: string
    let chunksCount = 0

    if (content.length > CHUNK_THRESHOLD) {
      // Criar documento pai (sem conteúdo completo para economizar espaço)
      const { data: parentDoc, error: parentError } = await supabase
        .from('ai_knowledge_base')
        .insert({
          ...baseDoc,
          content: content.substring(0, 500) + '\n\n[Document split into chunks]',
        })
        .select('id')
        .single()

      if (parentError) {
        log('error', `Parent doc insert failed: ${parentError.message}`)
        return errorResponse(`Database insert failed: ${parentError.message}`, 500)
      }

      documentId = parentDoc.id
      const chunks = splitIntoChunks(content)
      chunksCount = chunks.length

      log('info', `Splitting into ${chunksCount} chunks for doc ${documentId}`)

      // Inserir chunks
      const chunkRows = chunks.map((chunk, index) => ({
        ...baseDoc,
        title: `${title} [${index + 1}/${chunksCount}]`,
        content: chunk,
        parent_doc_id: documentId,
        chunk_index: index,
      }))

      const { data: insertedChunks, error: chunksError } = await supabase
        .from('ai_knowledge_base')
        .insert(chunkRows)
        .select('id')

      if (chunksError) {
        log('error', `Chunks insert failed: ${chunksError.message}`)
        return errorResponse(`Chunks insert failed: ${chunksError.message}`, 500)
      }

      // Fire-and-forget: gerar embeddings para cada chunk
      for (const chunk of insertedChunks || []) {
        supabase.functions.invoke('generate-embedding', {
          body: { document_id: chunk.id },
        }).catch((err: Error) => {
          log('warn', `Embedding generation failed for chunk ${chunk.id}: ${err.message}`)
        })
      }
    } else {
      // Documento único (sem chunking)
      const { data: doc, error: docError } = await supabase
        .from('ai_knowledge_base')
        .insert({
          ...baseDoc,
          content,
        })
        .select('id')
        .single()

      if (docError) {
        log('error', `Doc insert failed: ${docError.message}`)
        return errorResponse(`Database insert failed: ${docError.message}`, 500)
      }

      documentId = doc.id
      chunksCount = 0

      // Fire-and-forget: gerar embedding
      supabase.functions.invoke('generate-embedding', {
        body: { document_id: documentId },
      }).catch((err: Error) => {
        log('warn', `Embedding generation failed for doc ${documentId}: ${err.message}`)
      })
    }

    log('info', `Document processed successfully: ${documentId}, chunks: ${chunksCount}`)

    return jsonResponse({
      success: true,
      document_id: documentId,
      chunks_count: chunksCount,
      content_length: content.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Unhandled error: ${message}`)
    return errorResponse(`Processing failed: ${message}`, 500)
  }
})
