/**
 * Pipeline Metrics — Instrumentacao basica (Fase 1)
 *
 * Helper para registrar metricas no pipeline de mensagens.
 * Todas as insercoes sao fire-and-forget para nao impactar latencia.
 *
 * Uso:
 *   import { trackMetric, trackError } from '../_shared/pipeline-metrics.ts'
 *   trackMetric(supabase, {
 *     edge_function: 'uazapi-webhook',
 *     event_type: 'webhook_received',
 *     latency_ms: 42,
 *     request_id: 'req_xxx',
 *   })
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface MetricEvent {
  edge_function: string
  event_type: string
  request_id?: string
  conversation_id?: string
  latency_ms?: number
  webhook_to_reply_ms?: number
  success?: boolean
  error_message?: string
  error_code?: string
  metadata?: Record<string, unknown>
}

/**
 * Verifica se a feature flag FF_PIPELINE_METRICS esta ativa.
 * Metricas so sao gravadas quando a flag esta habilitada.
 */
export function isMetricsEnabled(): boolean {
  return Deno.env.get('FF_PIPELINE_METRICS') === 'true'
}

/**
 * Registra uma metrica no pipeline. Fire-and-forget.
 * Nao lanca excecao — falhas sao silenciosas (logadas no console).
 */
export function trackMetric(supabase: SupabaseClient, event: MetricEvent): void {
  if (!isMetricsEnabled()) return

  const record = {
    edge_function: event.edge_function,
    event_type: event.event_type,
    request_id: event.request_id || null,
    conversation_id: event.conversation_id || null,
    latency_ms: event.latency_ms || null,
    webhook_to_reply_ms: event.webhook_to_reply_ms || null,
    success: event.success ?? true,
    error_message: event.error_message || null,
    error_code: event.error_code || null,
    metadata: event.metadata || {},
  }

  supabase.from('pipeline_metrics').insert(record)
    .then(() => {}, (err: Error) => {
      console.error(JSON.stringify({
        level: 'warn',
        fn: 'pipeline-metrics',
        msg: 'Failed to insert metric',
        error: err?.message,
        event_type: event.event_type,
      }))
    })
}

/**
 * Atalho para registrar erros. Define success=false automaticamente.
 */
export function trackError(
  supabase: SupabaseClient,
  edgeFunction: string,
  eventType: string,
  error: unknown,
  extra?: Partial<MetricEvent>,
): void {
  const msg = error instanceof Error ? error.message : String(error)
  trackMetric(supabase, {
    edge_function: edgeFunction,
    event_type: eventType,
    success: false,
    error_message: msg,
    ...extra,
  })
}
