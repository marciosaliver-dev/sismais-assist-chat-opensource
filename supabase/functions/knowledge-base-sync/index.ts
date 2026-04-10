/**
 * Knowledge Base Sync
 *
 * Sincroniza e mantém a base de conhecimento atualizada.
 * Detecta artigos desatualizados, sugere novos documentos baseado
 * em conversas recentes, e pode importar de fontes externas.
 *
 * Ações:
 * - detect_stale: Detecta artigos que podem estar desatualizados
 * - suggest_new: Sugere novos artigos baseado em perguntas sem resposta
 * - sync_external: Importa/atualiza de fonte externa (Confluence, Zoho, etc.)
 * - health: Health check
 */

import { createServiceClient, corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from '../_shared/supabase-helpers.ts'
import { trackMetric } from '../_shared/pipeline-metrics.ts'

interface StaleArticle {
  id: string
  title: string
  last_updated: string
  days_since_update: number
  usage_count: number
  avg_relevance_score: number | null
  reason: string
}

interface SuggestedArticle {
  topic: string
  frequency: number
  sample_questions: string[]
  priority: 'high' | 'medium' | 'low'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  const supabase = createServiceClient()
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { action = 'detect_stale', stale_days = 90, min_frequency = 3 } = body

    if (action === 'health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() })
    }

    // ── Detectar artigos desatualizados ──
    if (action === 'detect_stale') {
      const cutoffDate = new Date(Date.now() - stale_days * 24 * 60 * 60 * 1000).toISOString()

      const { data: articles, error } = await supabase
        .from('ai_knowledge_base')
        .select('id, title, updated_at, created_at, content, metadata')
        .lt('updated_at', cutoffDate)
        .eq('is_active', true)
        .order('updated_at', { ascending: true })
        .limit(50)

      if (error) throw new Error(`Failed to fetch articles: ${error.message}`)

      const staleArticles: StaleArticle[] = (articles ?? []).map((article) => {
        const updatedAt = new Date(article.updated_at ?? article.created_at)
        const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))

        return {
          id: article.id,
          title: article.title ?? 'Sem título',
          last_updated: updatedAt.toISOString(),
          days_since_update: daysSinceUpdate,
          usage_count: (article.metadata as any)?.usage_count ?? 0,
          avg_relevance_score: (article.metadata as any)?.avg_relevance ?? null,
          reason: daysSinceUpdate > 180
            ? 'Muito desatualizado (6+ meses)'
            : 'Desatualizado (3+ meses)',
        }
      })

      trackMetric(supabase, {
        edge_function: 'knowledge-base-sync',
        event_type: 'detect_stale_complete',
        latency_ms: Date.now() - startTime,
        metadata: { stale_count: staleArticles.length, stale_days },
      })

      return jsonResponse({
        success: true,
        stale_articles: staleArticles,
        total_stale: staleArticles.length,
        recommendation: staleArticles.length > 10
          ? 'Muitos artigos desatualizados. Considere uma revisão em massa.'
          : 'Poucos artigos para revisar. Revise individualmente.',
      })
    }

    // ── Sugerir novos artigos baseado em conversas ──
    if (action === 'suggest_new') {
      const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Buscar mensagens onde o agente não teve confiança alta
      const { data: lowConfidenceMessages, error } = await supabase
        .from('ai_messages')
        .select('content, confidence, conversation_id')
        .eq('role', 'user')
        .gte('created_at', last30days)
        .limit(500)

      if (error) throw new Error(`Failed to fetch messages: ${error.message}`)

      // Buscar mensagens do assistente com confiança baixa para encontrar o contexto
      const { data: lowConfResponses } = await supabase
        .from('ai_messages')
        .select('content, confidence, conversation_id')
        .eq('role', 'assistant')
        .lt('confidence', 0.6)
        .gte('created_at', last30days)
        .limit(200)

      // Agrupar por conversation_id para encontrar temas recorrentes
      const conversationIds = new Set(
        (lowConfResponses ?? []).map((m) => m.conversation_id)
      )

      // Buscar as perguntas dos usuários nessas conversas
      const unansweredQuestions = (lowConfidenceMessages ?? [])
        .filter((m) => conversationIds.has(m.conversation_id))
        .map((m) => m.content)
        .filter((c): c is string => !!c && c.length > 10)

      // Agrupar perguntas similares (simplificado — por palavras-chave)
      const topicCounts = new Map<string, { count: number; samples: string[] }>()

      for (const question of unansweredQuestions) {
        // Extrair palavras-chave (simplificado)
        const words = question
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 4)
          .slice(0, 3)
          .sort()
          .join(' ')

        if (!words) continue

        const existing = topicCounts.get(words)
        if (existing) {
          existing.count++
          if (existing.samples.length < 3) existing.samples.push(question)
        } else {
          topicCounts.set(words, { count: 1, samples: [question] })
        }
      }

      // Filtrar por frequência mínima e ordenar
      const suggestions: SuggestedArticle[] = Array.from(topicCounts.entries())
        .filter(([, v]) => v.count >= min_frequency)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([topic, data]) => ({
          topic,
          frequency: data.count,
          sample_questions: data.samples,
          priority: data.count >= 10 ? 'high' : data.count >= 5 ? 'medium' : 'low',
        }))

      trackMetric(supabase, {
        edge_function: 'knowledge-base-sync',
        event_type: 'suggest_new_complete',
        latency_ms: Date.now() - startTime,
        metadata: { suggestions_count: suggestions.length, conversations_analyzed: conversationIds.size },
      })

      return jsonResponse({
        success: true,
        suggestions,
        total_suggestions: suggestions.length,
        conversations_analyzed: conversationIds.size,
        period: 'last_30_days',
      })
    }

    // ── Sync de fonte externa ──
    if (action === 'sync_external') {
      const { source, source_url, api_key } = body

      if (!source || !source_url) {
        return errorResponse('source and source_url are required', 400)
      }

      // Por agora, retornar instrução para usar as functions de importação existentes
      return jsonResponse({
        success: true,
        message: `Para importar de ${source}, use a edge function específica:`,
        available_importers: {
          zoho: 'import-zoho-kb',
          freshdesk: 'import-freshdesk-kb',
          confluence: 'Usar firecrawl-crawl + knowledge-ingestion',
          manual: 'knowledge-ingestion (upload direto)',
        },
        recommended_action: source === 'zoho'
          ? 'invoke import-zoho-kb'
          : source === 'freshdesk'
            ? 'invoke import-freshdesk-kb'
            : 'invoke firecrawl-crawl para extrair e depois knowledge-ingestion para ingerir',
      })
    }

    return errorResponse(`Unknown action: ${action}. Valid: detect_stale, suggest_new, sync_external, health`, 400)
  } catch (error) {
    console.error('[knowledge-base-sync] Error:', error.message)
    return errorResponse(error.message)
  }
})
