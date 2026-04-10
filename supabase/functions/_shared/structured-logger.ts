/**
 * DEPRECATED: Use structured-log.ts
 * Este arquivo existe apenas para compatibilidade — re-exporta tudo de structured-log.ts
 */
export { createLogger, extractRequestId, propagateRequestId, generateRequestId } from './structured-log.ts'
export type { LogLevel, LogEntry, Logger } from './structured-log.ts'
