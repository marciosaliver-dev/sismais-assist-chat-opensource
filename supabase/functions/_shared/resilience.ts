/**
 * Modulo de resiliencia para Edge Functions — Sismais Helpdesk IA
 *
 * Fornece:
 * - withRetry: retry com backoff exponencial e jitter
 * - withTimeout: timeout com AbortController
 * - withCircuitBreaker: circuit breaker pattern (open/half-open/closed)
 * - withBulkhead: limita concorrencia por chave
 *
 * Uso:
 *   import { withRetry, withTimeout, withCircuitBreaker } from '../_shared/resilience.ts'
 *
 *   const result = await withRetry(() => callExternalApi(), { maxAttempts: 3 })
 *   const result = await withTimeout(() => longOperation(), { timeoutMs: 5000 })
 */

// ── Tipos ──

export interface RetryOptions {
  /** Numero maximo de tentativas (inclui a primeira). Default: 3 */
  maxAttempts?: number
  /** Delay base em ms para backoff exponencial. Default: 500 */
  baseDelayMs?: number
  /** Delay maximo em ms. Default: 5000 */
  maxDelayMs?: number
  /** Funcao que decide se deve fazer retry com base no erro. Default: sempre true */
  shouldRetry?: (error: Error, attempt: number) => boolean
  /** Callback de log entre tentativas */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void
}

export interface TimeoutOptions {
  /** Timeout em milliseconds. Default: 25000 */
  timeoutMs?: number
  /** Mensagem de erro customizada */
  errorMessage?: string
}

export interface CircuitBreakerOptions {
  /** Numero de falhas para abrir o circuito. Default: 5 */
  failureThreshold?: number
  /** Tempo em ms que o circuito fica aberto antes de half-open. Default: 30000 */
  resetTimeoutMs?: number
  /** Nome do circuito para logs */
  name?: string
}

// ── Retry ──

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    shouldRetry = () => true,
    onRetry,
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt >= maxAttempts || !shouldRetry(lastError, attempt)) {
        throw lastError
      }

      // Backoff exponencial com jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200,
        maxDelayMs
      )

      if (onRetry) {
        onRetry(lastError, attempt, delay)
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('withRetry: all attempts failed')
}

// ── Timeout ──

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeoutMs = 25_000, errorMessage } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await fn(controller.signal)
    return result
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new TimeoutError(
        errorMessage || `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export class TimeoutError extends Error {
  timeoutMs: number
  constructor(message: string, timeoutMs: number) {
    super(message)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

// ── Circuit Breaker ──

type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerState {
  state: CircuitState
  failures: number
  lastFailureTime: number
  successesSinceHalfOpen: number
}

// Cache global de circuit breakers (persiste no isolate Deno)
const circuits = new Map<string, CircuitBreakerState>()

function getCircuit(name: string): CircuitBreakerState {
  let circuit = circuits.get(name)
  if (!circuit) {
    circuit = { state: 'closed', failures: 0, lastFailureTime: 0, successesSinceHalfOpen: 0 }
    circuits.set(name, circuit)
  }
  return circuit
}

export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const {
    failureThreshold = 5,
    resetTimeoutMs = 30_000,
    name = 'default',
  } = options

  const circuit = getCircuit(name)

  // Verificar se circuito aberto pode transicionar para half-open
  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailureTime >= resetTimeoutMs) {
      circuit.state = 'half-open'
      circuit.successesSinceHalfOpen = 0
      console.log(JSON.stringify({ level: 'info', module: 'circuit-breaker', circuit: name, transition: 'open -> half-open' }))
    } else {
      throw new CircuitBreakerOpenError(name, resetTimeoutMs - (Date.now() - circuit.lastFailureTime))
    }
  }

  try {
    const result = await fn()

    // Sucesso: resetar ou fechar
    if (circuit.state === 'half-open') {
      circuit.successesSinceHalfOpen++
      if (circuit.successesSinceHalfOpen >= 2) {
        circuit.state = 'closed'
        circuit.failures = 0
        console.log(JSON.stringify({ level: 'info', module: 'circuit-breaker', circuit: name, transition: 'half-open -> closed' }))
      }
    } else {
      circuit.failures = 0
    }

    return result
  } catch (err) {
    circuit.failures++
    circuit.lastFailureTime = Date.now()

    if (circuit.state === 'half-open') {
      // Falha em half-open: volta para open
      circuit.state = 'open'
      console.log(JSON.stringify({ level: 'warn', module: 'circuit-breaker', circuit: name, transition: 'half-open -> open' }))
    } else if (circuit.failures >= failureThreshold) {
      circuit.state = 'open'
      console.log(JSON.stringify({ level: 'warn', module: 'circuit-breaker', circuit: name, transition: 'closed -> open', failures: circuit.failures }))
    }

    throw err
  }
}

export class CircuitBreakerOpenError extends Error {
  circuitName: string
  retryAfterMs: number
  constructor(name: string, retryAfterMs: number) {
    super(`Circuit breaker "${name}" is open. Retry after ${Math.round(retryAfterMs / 1000)}s`)
    this.name = 'CircuitBreakerOpenError'
    this.circuitName = name
    this.retryAfterMs = retryAfterMs
  }
}

// ── Utilitario: getCircuitState (para health checks) ──

export function getCircuitState(name: string): CircuitState | 'unknown' {
  return circuits.get(name)?.state || 'unknown'
}

// ── Composicao: retry + timeout + circuit breaker ──

export interface ResilientCallOptions {
  retry?: RetryOptions
  timeout?: TimeoutOptions
  circuitBreaker?: CircuitBreakerOptions
}

/**
 * Chamada resiliente que combina circuit breaker + retry + timeout.
 * Ordem: circuitBreaker(retry(timeout(fn)))
 */
export async function resilientCall<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: ResilientCallOptions = {}
): Promise<T> {
  const operation = () =>
    withRetry(
      () => withTimeout(fn, options.timeout),
      {
        ...options.retry,
        shouldRetry: (err, attempt) => {
          // Nao fazer retry em circuit breaker open
          if (err instanceof CircuitBreakerOpenError) return false
          // Nao fazer retry em timeout se ja tentou mais de 1 vez
          if (err instanceof TimeoutError && attempt > 1) return false
          return options.retry?.shouldRetry?.(err, attempt) ?? true
        },
        onRetry: (err, attempt, delay) => {
          console.log(JSON.stringify({
            level: 'warn',
            module: 'resilient-call',
            retry: attempt,
            delay,
            error: err.message,
          }))
          options.retry?.onRetry?.(err, attempt, delay)
        },
      }
    )

  if (options.circuitBreaker) {
    return withCircuitBreaker(operation, options.circuitBreaker)
  }

  return operation()
}
