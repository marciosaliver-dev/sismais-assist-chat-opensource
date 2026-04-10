import { describe, it, expect } from 'vitest'

describe('error-classifier', () => {
  describe('computeErrorHash', () => {
    it('returns consistent hash for same inputs', async () => {
      const { computeErrorHash } = await import('./error-classifier-logic')
      const hash1 = computeErrorHash('uazapi-webhook', 'timeout', 'request timed out')
      const hash2 = computeErrorHash('uazapi-webhook', 'timeout', 'request timed out')
      expect(hash1).toBe(hash2)
    })

    it('returns different hash for different inputs', async () => {
      const { computeErrorHash } = await import('./error-classifier-logic')
      const hash1 = computeErrorHash('uazapi-webhook', 'timeout', 'request timed out')
      const hash2 = computeErrorHash('agent-executor', 'timeout', 'request timed out')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('matchRoutingRule', () => {
    const rules = [
      { pattern: 'uazapi-|process-incoming-|whatsapp-', squad_name: 'helpdesk-dev-squad', github_label: 'squad:helpdesk-dev', is_critical: true, discord_webhook_url: null, github_assignee: null, priority: 10 },
      { pattern: 'agent-executor|orchestrat|ai-', squad_name: 'ia-orchestration', github_label: 'squad:ia-orchestration', is_critical: true, discord_webhook_url: null, github_assignee: null, priority: 20 },
      { pattern: '.*', squad_name: 'dx-squad', github_label: 'squad:dx', is_critical: false, discord_webhook_url: null, github_assignee: null, priority: 999 },
    ]

    it('matches uazapi webhook to helpdesk squad', async () => {
      const { matchRoutingRule } = await import('./error-classifier-logic')
      const match = matchRoutingRule('uazapi-webhook', rules)
      expect(match.squad_name).toBe('helpdesk-dev-squad')
    })

    it('matches agent-executor to ia-orchestration', async () => {
      const { matchRoutingRule } = await import('./error-classifier-logic')
      const match = matchRoutingRule('agent-executor', rules)
      expect(match.squad_name).toBe('ia-orchestration')
    })

    it('falls back to dx-squad for unknown functions', async () => {
      const { matchRoutingRule } = await import('./error-classifier-logic')
      const match = matchRoutingRule('some-random-function', rules)
      expect(match.squad_name).toBe('dx-squad')
    })
  })

  describe('classifySeverity', () => {
    it('returns critical for critical function', async () => {
      const { classifySeverity } = await import('./error-classifier-logic')
      const severity = classifySeverity({ is_critical: true, latency_ms: 100, recentCount: 1 })
      expect(severity).toBe('critical')
    })

    it('returns high for timeout (latency > 25000)', async () => {
      const { classifySeverity } = await import('./error-classifier-logic')
      const severity = classifySeverity({ is_critical: false, latency_ms: 30000, recentCount: 1 })
      expect(severity).toBe('high')
    })

    it('returns high for 3+ occurrences in 1h', async () => {
      const { classifySeverity } = await import('./error-classifier-logic')
      const severity = classifySeverity({ is_critical: false, latency_ms: 100, recentCount: 3 })
      expect(severity).toBe('high')
    })

    it('returns medium for normal error', async () => {
      const { classifySeverity } = await import('./error-classifier-logic')
      const severity = classifySeverity({ is_critical: false, latency_ms: 100, recentCount: 1 })
      expect(severity).toBe('medium')
    })
  })
})
