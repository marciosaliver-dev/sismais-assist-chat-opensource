/**
 * API Response Helpers — Sismais Public API
 *
 * Formatacao padronizada de respostas da API publica.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export function apiSuccess(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function apiError(
  message: string,
  status: number,
  code?: string,
  details?: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  const body: Record<string, unknown> = {
    error: {
      message,
      code: code || httpStatusCode(status),
      status,
    },
  }
  if (details) body.error = { ...body.error as Record<string, unknown>, details }

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function apiPaginated(
  data: unknown[],
  total: number,
  page: number,
  perPage: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function corsPreflightResponse(): Response {
  return new Response(null, { headers: corsHeaders })
}

function httpStatusCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'bad_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    422: 'unprocessable_entity',
    429: 'rate_limit_exceeded',
    500: 'internal_error',
  }
  return codes[status] || 'error'
}

/**
 * Parseia parametros de paginacao da query string
 */
export function parsePagination(url: URL): { page: number; perPage: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '20', 10)))
  const offset = (page - 1) * perPage
  return { page, perPage, offset }
}
