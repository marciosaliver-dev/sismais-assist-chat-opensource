import { describe, it, expect } from 'vitest'

describe('github-client', () => {
  describe('buildIssueBody', () => {
    it('builds correct markdown body', async () => {
      const { buildIssueBody } = await import('./github-client-logic')
      const body = buildIssueBody({
        edge_function: 'uazapi-webhook',
        event_type: 'timeout_error',
        error_message: 'request timed out after 30s',
        severity: 'critical',
        squad_name: 'helpdesk-dev-squad',
        request_id: 'req-123',
        latency_ms: 30200,
        occurrence_count: 3,
      })

      expect(body).toContain('uazapi-webhook')
      expect(body).toContain('timeout_error')
      expect(body).toContain('critical')
      expect(body).toContain('helpdesk-dev-squad')
      expect(body).toContain('req-123')
      expect(body).toContain('30200ms')
      expect(body).toContain('@marciosaliver-dev')
    })
  })

  describe('buildIssueTitle', () => {
    it('builds title with prefix and truncation', async () => {
      const { buildIssueTitle } = await import('./github-client-logic')
      const title = buildIssueTitle('uazapi-webhook', 'request timed out after 30s')
      expect(title).toBe('[ERROR-AUTO] uazapi-webhook: request timed out after 30s')
    })

    it('truncates long messages', async () => {
      const { buildIssueTitle } = await import('./github-client-logic')
      const longMsg = 'a'.repeat(200)
      const title = buildIssueTitle('func', longMsg)
      expect(title.length).toBeLessThanOrEqual(120)
      expect(title).toContain('...')
    })
  })
})
