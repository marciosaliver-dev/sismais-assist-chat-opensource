import { useState, useEffect, useCallback, useRef } from 'react'

const AUTO_ADVANCE_MS = 20_000
const PAUSE_MS = 60_000

export interface UseTVAutoRotationReturn {
  currentView: number
  setView: (i: number) => void
  isPaused: boolean
  progress: number // 0–100
}

export function useTVAutoRotation(viewCount = 5): UseTVAutoRotationReturn {
  const [currentView, setCurrentView] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)

  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(Date.now())

  // Atualiza barra de progresso a cada 100ms
  useEffect(() => {
    if (isPaused) {
      setProgress(0)
      return
    }
    startTimeRef.current = Date.now()
    setProgress(0)

    const tick = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setProgress(Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100))
    }, 100)

    return () => clearInterval(tick)
  }, [currentView, isPaused])

  // Auto-avança a cada 20s (quando não pausado)
  useEffect(() => {
    if (isPaused) return
    const timer = setTimeout(() => {
      setCurrentView(v => (v + 1) % viewCount)
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [currentView, isPaused, viewCount])

  // Cleanup do timer de pausa ao desmontar
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    }
  }, [])

  const setView = useCallback((i: number) => {
    setCurrentView(i)
    setIsPaused(true)
    setProgress(0)

    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = setTimeout(() => {
      setIsPaused(false)
    }, PAUSE_MS)
  }, [])

  return { currentView, setView, isPaused, progress }
}
