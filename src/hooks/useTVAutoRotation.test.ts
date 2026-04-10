import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useTVAutoRotation } from './useTVAutoRotation'

describe('useTVAutoRotation', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('inicia na view 0', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    expect(result.current.currentView).toBe(0)
    expect(result.current.isPaused).toBe(false)
  })

  it('avança para a próxima view após 20s', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.currentView).toBe(1)
  })

  it('avança pelas 5 views e volta ao 0 (loop)', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { vi.advanceTimersByTime(20_000) })
    act(() => { vi.advanceTimersByTime(20_000) })
    act(() => { vi.advanceTimersByTime(20_000) })
    act(() => { vi.advanceTimersByTime(20_000) })
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.currentView).toBe(0)
  })

  it('pausa rotação ao chamar setView', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { result.current.setView(2) })
    expect(result.current.currentView).toBe(2)
    expect(result.current.isPaused).toBe(true)
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.currentView).toBe(2)
  })

  it('retoma rotação após 60s de pausa', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { result.current.setView(1) })
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current.isPaused).toBe(false)
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.currentView).toBe(2)
  })
})
