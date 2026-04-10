export interface IssueBodyParams {
  edge_function: string
  event_type: string
  error_message: string
  severity: string
  squad_name: string
  request_id: string | null
  latency_ms: number | null
  occurrence_count: number
}

export function buildIssueTitle(edgeFunction: string, errorMessage: string): string {
  const prefix = `[ERROR-AUTO] ${edgeFunction}: `
  const maxMsgLen = 120 - prefix.length
  const msg = errorMessage.length > maxMsgLen
    ? errorMessage.slice(0, maxMsgLen - 3) + '...'
    : errorMessage
  return `${prefix}${msg}`
}

export function buildIssueBody(params: IssueBodyParams): string {
  return `## Erro Detectado Automaticamente

- **Funcao:** ${params.edge_function}
- **Tipo:** ${params.event_type}
- **Ocorrencias:** ${params.occurrence_count}
- **Severidade:** ${params.severity}

## Detalhes
${params.error_message}

## Contexto
- **Request ID:** ${params.request_id || 'N/A'}
- **Latencia:** ${params.latency_ms ? params.latency_ms + 'ms' : 'N/A'}

## Squad Atribuido
${params.squad_name}

## Acao Esperada
1. Investigar e corrigir
2. Abrir PR com fix
3. Aguardar aprovacao de @marciosaliver-dev

---
🤖 Issue criada automaticamente por error-watcher`
}
