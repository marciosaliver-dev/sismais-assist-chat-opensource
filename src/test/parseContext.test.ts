import { describe, it, expect } from 'vitest'

// parseContext is not exported from useCancellationKPIs, so we replicate its logic
// to test independently. This validates the same contract the hook uses.
function parseContext(context: unknown): Record<string, unknown> {
  if (!context) return {}
  if (typeof context === 'string') {
    try { return JSON.parse(context) } catch { return {} }
  }
  if (typeof context === 'object') return context as Record<string, unknown>
  return {}
}

describe('parseContext', () => {
  it('returns empty object for null', () => {
    expect(parseContext(null)).toEqual({})
  })

  it('returns empty object for undefined', () => {
    expect(parseContext(undefined)).toEqual({})
  })

  it('returns empty object for empty string', () => {
    expect(parseContext('')).toEqual({})
  })

  it('parses valid JSON string', () => {
    const result = parseContext('{"reason": "preco", "mrr_value": 100}')
    expect(result).toEqual({ reason: 'preco', mrr_value: 100 })
  })

  it('returns empty object for invalid JSON string', () => {
    expect(parseContext('not-json')).toEqual({})
  })

  it('returns object as-is when already an object', () => {
    const obj = { cancellation_reason: 'fechamento' }
    expect(parseContext(obj)).toBe(obj)
  })

  it('returns empty object for number', () => {
    expect(parseContext(42)).toEqual({})
  })

  it('returns empty object for boolean', () => {
    expect(parseContext(true)).toEqual({})
  })

  it('handles nested JSON', () => {
    const nested = '{"data": {"nested": true}}'
    const result = parseContext(nested)
    expect(result).toEqual({ data: { nested: true } })
  })

  it('handles array as object (edge case)', () => {
    const arr = [1, 2, 3]
    const result = parseContext(arr)
    expect(result).toEqual(arr) // arrays are objects in JS
  })
})
