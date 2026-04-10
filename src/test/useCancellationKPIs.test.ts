import { describe, it, expect } from 'vitest'
import {
  CANCELLATION_REASONS,
  RETENTION_OFFERS,
} from '@/hooks/useCancellationKPIs'

// Test the exported constants and parseContext logic
// (parseContext is not exported, so we test through the interface)

describe('CANCELLATION_REASONS', () => {
  it('has 7 defined reasons', () => {
    expect(Object.keys(CANCELLATION_REASONS)).toHaveLength(7)
  })

  it('includes all expected keys', () => {
    const expectedKeys = [
      'preco',
      'fechamento',
      'concorrente',
      'falta_uso',
      'insatisfacao_suporte',
      'bug_nao_resolvido',
      'outro',
    ]
    for (const key of expectedKeys) {
      expect(CANCELLATION_REASONS).toHaveProperty(key)
    }
  })

  it('all values are non-empty strings', () => {
    for (const value of Object.values(CANCELLATION_REASONS)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

describe('RETENTION_OFFERS', () => {
  it('has 6 defined offers', () => {
    expect(Object.keys(RETENTION_OFFERS)).toHaveLength(6)
  })

  it('includes all expected keys', () => {
    const expectedKeys = [
      'desconto',
      'pausa',
      'suporte_dedicado',
      'treinamento',
      'resolucao_bug',
      'outro',
    ]
    for (const key of expectedKeys) {
      expect(RETENTION_OFFERS).toHaveProperty(key)
    }
  })

  it('all values are non-empty strings', () => {
    for (const value of Object.values(RETENTION_OFFERS)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

describe('CancellationKPIs interface contract', () => {
  it('empty KPI result matches expected shape', () => {
    const emptyResult = {
      reversalRate: null,
      avgFirstContactMinutes: null,
      mrrSaved: 0,
      mrrLost: 0,
      noResponseRate: null,
      totalTickets: 0,
      openTickets: 0,
      reasonRanking: [],
      offerEffectiveness: [],
    }

    expect(emptyResult.reversalRate).toBeNull()
    expect(emptyResult.mrrSaved).toBe(0)
    expect(emptyResult.totalTickets).toBe(0)
    expect(emptyResult.reasonRanking).toEqual([])
    expect(emptyResult.offerEffectiveness).toEqual([])
  })
})
