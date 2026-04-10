/**
 * Structured logger for edge functions.
 * Outputs JSON lines for log aggregation (Sentry, Datadog, etc.)
 *
 * Usage:
 *   import { logger } from "../_shared/logger.ts"
 *   const log = logger("agent-executor")
 *   log.info("Processing request", { conversationId, agentId })
 *   log.error("Failed", { error: e.message, stack: e.stack })
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  function: string
  message: string
  [key: string]: unknown
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry)
  switch (entry.level) {
    case "error":
      console.error(line)
      break
    case "warn":
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

export function logger(functionName: string) {
  function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    emit({
      timestamp: new Date().toISOString(),
      level,
      function: functionName,
      message,
      ...data,
    })
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
  }
}
