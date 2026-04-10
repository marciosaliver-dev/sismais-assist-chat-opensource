/**
 * API Publica v1 — Sismais Helpdesk IA
 *
 * Router principal que despacha requests para handlers especificos.
 * Autenticacao via X-API-Key, rate limiting por chave/plano.
 *
 * Endpoints:
 *   GET  /api/v1/health
 *   POST /api/v1/messages
 *   GET  /api/v1/conversations
 *   GET  /api/v1/conversations/:id
 *   POST /api/v1/tickets
 *   GET  /api/v1/tickets
 *   GET  /api/v1/clients
 *   POST /api/v1/webhooks
 *   GET  /api/v1/webhooks
 *   DELETE /api/v1/webhooks/:id
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateApiKey, hasScope, generateApiKey, type ApiKeyInfo } from '../_shared/api-auth.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/api-rate-limit.ts'
import { apiSuccess, apiError, apiPaginated, corsPreflightResponse, parsePagination } from '../_shared/api-response.ts'
import { dispatchWebhooks } from '../_shared/api-webhook-dispatcher.ts'

// Feature flag para ativar/desativar a API publica
const API_ENABLED = Deno.env.get('FF_PUBLIC_API') === 'true'

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// ============================================================================
// Router
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse()
  }

  // Feature flag check
  if (!API_ENABLED) {
    return apiError('Public API is not enabled', 503, 'api_disabled')
  }

  const url = new URL(req.url)
  // O path vem como /api-v1/... (nome da edge function)
  // Precisamos extrair o sub-path apos /api-v1
  const fullPath = url.pathname
  const path = fullPath.replace(/^\/api-v1\/?/, '/').replace(/\/$/, '') || '/'
  const method = req.method

  // Health check nao precisa de auth
  if (path === '/health' || path === '/') {
    return handleHealth()
  }

  // Autenticar
  const authResult = await authenticateApiKey(req)
  if (!authResult.success) {
    return apiError(authResult.error, authResult.status)
  }
  const key = authResult.key

  // Rate limiting
  const rateResult = await checkRateLimit(key)
  if (!rateResult.allowed) {
    return apiError(
      'Rate limit exceeded',
      429,
      'rate_limit_exceeded',
      { retry_after: rateResult.retryAfter },
      rateLimitHeaders(rateResult),
    )
  }
  const rlHeaders = rateLimitHeaders(rateResult)

  try {
    // Routing
    // POST /messages
    if (method === 'POST' && path === '/messages') {
      return await handlePostMessage(req, key, rlHeaders)
    }

    // GET /conversations
    if (method === 'GET' && path === '/conversations') {
      return await handleGetConversations(url, key, rlHeaders)
    }

    // GET /conversations/:id
    const convMatch = path.match(/^\/conversations\/([a-f0-9-]+)$/)
    if (method === 'GET' && convMatch) {
      return await handleGetConversation(url, convMatch[1], key, rlHeaders)
    }

    // POST /tickets
    if (method === 'POST' && path === '/tickets') {
      return await handlePostTicket(req, key, rlHeaders)
    }

    // GET /tickets
    if (method === 'GET' && path === '/tickets') {
      return await handleGetTickets(url, key, rlHeaders)
    }

    // GET /clients
    if (method === 'GET' && path === '/clients') {
      return await handleGetClients(url, key, rlHeaders)
    }

    // POST /webhooks
    if (method === 'POST' && path === '/webhooks') {
      return await handlePostWebhook(req, key, rlHeaders)
    }

    // GET /webhooks
    if (method === 'GET' && path === '/webhooks') {
      return await handleGetWebhooks(key, rlHeaders)
    }

    // DELETE /webhooks/:id
    const whMatch = path.match(/^\/webhooks\/([a-f0-9-]+)$/)
    if (method === 'DELETE' && whMatch) {
      return await handleDeleteWebhook(whMatch[1], key, rlHeaders)
    }

    return apiError('Not found', 404, 'not_found')
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(JSON.stringify({ level: 'error', fn: 'api-v1', path, error: msg }))
    return apiError('Internal server error', 500, 'internal_error', undefined, rlHeaders)
  }
})

// ============================================================================
// Handlers
// ============================================================================

function handleHealth(): Response {
  return apiSuccess({
    status: 'ok',
    version: 'v1',
    timestamp: new Date().toISOString(),
  })
}

// --- POST /messages ---
async function handlePostMessage(req: Request, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'messages:write')) {
    return apiError('Insufficient scope: messages:write required', 403, 'forbidden', undefined, headers)
  }

  const body = await req.json()
  const { conversation_id, content, sender_type } = body

  if (!conversation_id || !content) {
    return apiError('conversation_id and content are required', 400, 'bad_request', undefined, headers)
  }

  const supabase = getSupabase()

  // Verificar que a conversa existe
  const { data: conv, error: convErr } = await supabase
    .from('ai_conversations')
    .select('id, status')
    .eq('id', conversation_id)
    .single()

  if (convErr || !conv) {
    return apiError('Conversation not found', 404, 'not_found', undefined, headers)
  }

  // Inserir mensagem
  const { data: message, error: msgErr } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id,
      role: sender_type === 'agent' ? 'assistant' : 'user',
      content,
      metadata: { source: 'api', api_key_id: key.id },
    })
    .select('id, conversation_id, role, content, created_at')
    .single()

  if (msgErr) {
    return apiError('Failed to send message', 500, 'internal_error', undefined, headers)
  }

  // Disparar webhook (fire and forget)
  dispatchWebhooks('message.sent', { message }).catch(() => {})

  return apiSuccess(message, 201, headers)
}

// --- GET /conversations ---
async function handleGetConversations(url: URL, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'conversations:read')) {
    return apiError('Insufficient scope: conversations:read required', 403, 'forbidden', undefined, headers)
  }

  const supabase = getSupabase()
  const { page, perPage, offset } = parsePagination(url)
  const status = url.searchParams.get('status')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const handlerType = url.searchParams.get('handler_type')
  const priority = url.searchParams.get('priority')
  const customerPhone = url.searchParams.get('customer_phone')
  const agentId = url.searchParams.get('agent_id')

  // Helper para aplicar filtros em ambas queries (count + data)
  function applyFilters<T extends { eq: Function; gte: Function; lt: Function }>(q: T): T {
    if (status) q = q.eq('status', status)
    if (handlerType) q = q.eq('handler_type', handlerType)
    if (priority) q = q.eq('priority', priority)
    if (customerPhone) q = q.eq('customer_phone', customerPhone)
    if (agentId) q = q.eq('current_agent_id', agentId)
    if (dateFrom) q = q.gte('started_at', dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setDate(end.getDate() + 1)
      q = q.lt('started_at', end.toISOString())
    }
    return q
  }

  // Count
  let countQuery = supabase.from('ai_conversations').select('*', { count: 'exact', head: true })
  countQuery = applyFilters(countQuery)
  const { count } = await countQuery

  // Data
  let query = supabase
    .from('ai_conversations')
    .select('id, customer_phone, status, handler_type, current_agent_id, priority, started_at')
    .order('started_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  query = applyFilters(query)
  const { data, error } = await query

  if (error) {
    return apiError('Failed to fetch conversations', 500, 'internal_error', undefined, headers)
  }

  return apiPaginated(data || [], count || 0, page, perPage, headers)
}

// --- GET /conversations/:id ---
async function handleGetConversation(url: URL, id: string, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'conversations:read')) {
    return apiError('Insufficient scope: conversations:read required', 403, 'forbidden', undefined, headers)
  }

  const supabase = getSupabase()

  const { data: conv, error } = await supabase
    .from('ai_conversations')
    .select('id, customer_phone, status, handler_type, current_agent_id, priority, conversation_summary, started_at')
    .eq('id', id)
    .single()

  if (error || !conv) {
    return apiError('Conversation not found', 404, 'not_found', undefined, headers)
  }

  // Buscar mensagens com paginacao opcional
  const messagesLimit = Math.min(parseInt(url.searchParams.get('messages_limit') || '100') || 100, 500)
  const messagesAfter = url.searchParams.get('messages_after')

  let msgQuery = supabase
    .from('ai_messages')
    .select('id, role, content, confidence, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(messagesLimit)

  if (messagesAfter) msgQuery = msgQuery.gt('created_at', messagesAfter)

  const { data: messages } = await msgQuery

  return apiSuccess({ ...conv, messages: messages || [] }, 200, headers)
}

// --- POST /tickets ---
async function handlePostTicket(req: Request, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'tickets:write')) {
    return apiError('Insufficient scope: tickets:write required', 403, 'forbidden', undefined, headers)
  }

  const body = await req.json()
  const { title, description, priority, client_id, board_slug } = body

  if (!title) {
    return apiError('title is required', 400, 'bad_request', undefined, headers)
  }

  const supabase = getSupabase()

  // Buscar board e primeiro stage
  const boardSlug = board_slug || 'suporte'
  const { data: board } = await supabase
    .from('kanban_boards')
    .select('id')
    .eq('slug', boardSlug)
    .single()

  if (!board) {
    return apiError(`Board "${boardSlug}" not found`, 404, 'not_found', undefined, headers)
  }

  const { data: firstStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('board_id', board.id)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (!firstStage) {
    return apiError('No stages configured for this board', 500, 'internal_error', undefined, headers)
  }

  // Criar conversa como ticket
  const { data: ticket, error } = await supabase
    .from('ai_conversations')
    .insert({
      status: 'open',
      handler_type: 'human',
      priority: priority || 'medium',
      conversation_summary: title,
      helpdesk_client_id: client_id || null,
      kanban_board_id: board.id,
      kanban_stage_id: firstStage.id,
      metadata: {
        source: 'api',
        api_key_id: key.id,
        description: description || null,
      },
    })
    .select('id, status, priority, conversation_summary, kanban_board_id, kanban_stage_id, started_at')
    .single()

  if (error) {
    return apiError('Failed to create ticket', 500, 'internal_error', undefined, headers)
  }

  // Disparar webhook
  dispatchWebhooks('ticket.created', { ticket }).catch(() => {})

  return apiSuccess(ticket, 201, headers)
}

// --- GET /tickets ---
async function handleGetTickets(url: URL, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'tickets:read')) {
    return apiError('Insufficient scope: tickets:read required', 403, 'forbidden', undefined, headers)
  }

  const supabase = getSupabase()
  const { page, perPage, offset } = parsePagination(url)
  const status = url.searchParams.get('status')
  const priority = url.searchParams.get('priority')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')

  function applyTicketFilters<T extends { eq: Function; gte: Function; lt: Function }>(q: T): T {
    if (status) q = q.eq('status', status)
    if (priority) q = q.eq('priority', priority)
    if (dateFrom) q = q.gte('started_at', dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setDate(end.getDate() + 1)
      q = q.lt('started_at', end.toISOString())
    }
    return q
  }

  let countQuery = supabase
    .from('ai_conversations')
    .select('*', { count: 'exact', head: true })
    .not('kanban_board_id', 'is', null)

  countQuery = applyTicketFilters(countQuery)
  const { count } = await countQuery

  let query = supabase
    .from('ai_conversations')
    .select('id, status, priority, conversation_summary, handler_type, kanban_board_id, kanban_stage_id, helpdesk_client_id, started_at')
    .not('kanban_board_id', 'is', null)
    .order('started_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  query = applyTicketFilters(query)
  const { data, error } = await query

  if (error) {
    return apiError('Failed to fetch tickets', 500, 'internal_error', undefined, headers)
  }

  return apiPaginated(data || [], count || 0, page, perPage, headers)
}

// --- GET /clients ---
async function handleGetClients(url: URL, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'clients:read')) {
    return apiError('Insufficient scope: clients:read required', 403, 'forbidden', undefined, headers)
  }

  const supabase = getSupabase()
  const { page, perPage, offset } = parsePagination(url)
  const search = url.searchParams.get('search')

  let countQuery = supabase.from('helpdesk_clients').select('*', { count: 'exact', head: true })
  if (search) countQuery = countQuery.ilike('name', `%${search}%`)
  const { count } = await countQuery

  let query = supabase
    .from('helpdesk_clients')
    .select('id, name, company_name, email, phone, cnpj, cpf, health_score, lifecycle_stage, created_at')
    .order('name', { ascending: true })
    .range(offset, offset + perPage - 1)

  if (search) query = query.ilike('name', `%${search}%`)
  const { data, error } = await query

  if (error) {
    return apiError('Failed to fetch clients', 500, 'internal_error', undefined, headers)
  }

  return apiPaginated(data || [], count || 0, page, perPage, headers)
}

// --- POST /webhooks ---
async function handlePostWebhook(req: Request, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'webhooks:write')) {
    return apiError('Insufficient scope: webhooks:write required', 403, 'forbidden', undefined, headers)
  }

  const body = await req.json()
  const { url: webhookUrl, events } = body

  if (!webhookUrl || !events?.length) {
    return apiError('url and events are required', 400, 'bad_request', undefined, headers)
  }

  // Validar URL
  try {
    new URL(webhookUrl)
  } catch {
    return apiError('Invalid URL format', 400, 'bad_request', undefined, headers)
  }

  // Validar eventos
  const validEvents = ['ticket.created', 'ticket.updated', 'message.received', 'message.sent', 'conversation.escalated', 'conversation.closed']
  const invalidEvents = events.filter((e: string) => !validEvents.includes(e))
  if (invalidEvents.length) {
    return apiError(`Invalid events: ${invalidEvents.join(', ')}`, 400, 'bad_request', { valid_events: validEvents }, headers)
  }

  // Gerar secret para assinatura HMAC
  const secretBytes = new Uint8Array(32)
  crypto.getRandomValues(secretBytes)
  const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  const supabase = getSupabase()

  const { data: webhook, error } = await supabase
    .from('api_webhooks')
    .insert({
      api_key_id: key.id,
      url: webhookUrl,
      events,
      secret,
    })
    .select('id, url, events, is_active, created_at')
    .single()

  if (error) {
    return apiError('Failed to register webhook', 500, 'internal_error', undefined, headers)
  }

  // Retornar secret apenas na criacao (nunca mais sera visivel)
  return apiSuccess({ ...webhook, secret }, 201, headers)
}

// --- GET /webhooks ---
async function handleGetWebhooks(key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'webhooks:read')) {
    return apiError('Insufficient scope: webhooks:read required', 403, 'forbidden', undefined, headers)
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('api_webhooks')
    .select('id, url, events, is_active, failure_count, last_triggered_at, created_at')
    .eq('api_key_id', key.id)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError('Failed to fetch webhooks', 500, 'internal_error', undefined, headers)
  }

  return apiSuccess(data || [], 200, headers)
}

// --- DELETE /webhooks/:id ---
async function handleDeleteWebhook(id: string, key: ApiKeyInfo, headers: Record<string, string>): Promise<Response> {
  if (!hasScope(key, 'webhooks:write')) {
    return apiError('Insufficient scope: webhooks:write required', 403, 'forbidden', undefined, headers)
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('api_webhooks')
    .delete()
    .eq('id', id)
    .eq('api_key_id', key.id)
    .select('id')
    .single()

  if (error || !data) {
    return apiError('Webhook not found', 404, 'not_found', undefined, headers)
  }

  return apiSuccess({ deleted: true }, 200, headers)
}
