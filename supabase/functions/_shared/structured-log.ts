/**
 * Logger estruturado para Edge Functions — Sismais Helpdesk IA
 *
 * Garante logs consistentes em JSON com correlation ID para rastreamento
 * end-to-end entre edge functions (webhook -> process-incoming -> orchestrator -> agent-executor).
 *
 * Uso:
 *   import { createLogger } from '../_shared/structured-log.ts'
 *   const log = createLogger('agent-executor', requestId)
 *   log.info('Processing message', { conversationId: '...' })
 *   log.error('Failed to call LLM', { model: '...', error: err.message })
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  fn: string
  msg: string
  requestId?: string
  ts: string
  [key: string]: unknown
}

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void
  info(msg: string, extra?: Record<string, unknown>): void
  warn(msg: string, extra?: Record<string, unknown>): void
  error(msg: string, extra?: Record<string, unknown>): void
  /** Retorna o requestId atual para propagar entre edge functions */
  getRequestId(): string
}

/**
 * Cria um logger estruturado para a edge function.
 *
 * @param fnName - Nome da edge function (ex: 'uazapi-webhook', 'agent-executor')
 * @param requestId - ID de correlacao. Se nao fornecido, gera um novo.
 */
export function createLogger(fnName: string, requestId?: string): Logger {
  const rid = requestId || crypto.randomUUID().substring(0, 12)

  function emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      fn: fnName,
      msg,
      requestId: rid,
      ts: new Date().toISOString(),
      ...extra,
    }

    switch (level) {
      case 'debug':
        console.debug(JSON.stringify(entry))
        break
      case 'info':
        console.log(JSON.stringify(entry))
        break
      case 'warn':
        console.warn(JSON.stringify(entry))
        break
      case 'error':
        console.error(JSON.stringify(entry))
        break
    }
  }

  return {
    debug: (msg, extra) => emit('debug', msg, extra),
    info: (msg, extra) => emit('info', msg, extra),
    warn: (msg, extra) => emit('warn', msg, extra),
    error: (msg, extra) => emit('error', msg, extra),
    getRequestId: () => rid,
  }
}

/**
 * Extrai o requestId do header da request (propagado entre edge functions).
 * Header: x-request-id
 */
export function extractRequestId(req: Request): string | undefined {
  return req.headers.get('x-request-id') || undefined
}

/**
 * Cria headers incluindo o requestId para propagar entre edge functions.
 */
export function propagateRequestId(requestId: string): Record<string, string> {
  return { 'x-request-id': requestId }
}

/**
 * Gera um request ID unico para correlacao entre edge functions.
 * Formato: req_<timestamp_base36>_<random>
 */
export function generateRequestId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 8)
  return `req_${ts}_${rand}`
}
