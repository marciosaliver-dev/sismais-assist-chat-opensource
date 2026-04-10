export function computeErrorHash(edgeFunction: string, errorType: string, errorMessage: string): string {
  const input = `${edgeFunction}:${errorType}:${errorMessage}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export interface RoutingRule {
  pattern: string
  squad_name: string
  github_label: string
  is_critical: boolean
  discord_webhook_url: string | null
  github_assignee: string | null
  priority: number
}

export function matchRoutingRule(edgeFunction: string, rules: RoutingRule[]): RoutingRule {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  for (const rule of sorted) {
    if (new RegExp(rule.pattern).test(edgeFunction)) {
      return rule
    }
  }
  return sorted[sorted.length - 1]
}

export function classifySeverity(params: { is_critical: boolean; latency_ms: number | null; recentCount: number }): string {
  if (params.is_critical) return 'critical'
  if (params.latency_ms && params.latency_ms > 25000) return 'high'
  if (params.recentCount >= 3) return 'high'
  return 'medium'
}
