import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (classNames utility)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('merges tailwind classes correctly (last wins)', () => {
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
  })

  it('returns empty string for no args', () => {
    expect(cn()).toBe('')
  })
})
