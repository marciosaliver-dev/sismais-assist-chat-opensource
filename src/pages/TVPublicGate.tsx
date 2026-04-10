import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import TVDashboard from './TVDashboard'
import { Delete } from 'lucide-react'

const SESSION_KEY = 'tv_pin_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 horas
const PIN_LENGTH = 4
const DEFAULT_PIN = '1234'

// Cliente público (publishable key) — só leitura com RLS
const publicSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

function isSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const { exp } = JSON.parse(raw)
    return Date.now() < exp
  } catch {
    return false
  }
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }))
}

const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export default function TVPublicGate() {
  const [unlocked, setUnlocked] = useState(isSessionValid)
  const [digits, setDigits] = useState<string[]>([])
  const [configuredPin, setConfiguredPin] = useState<string>(DEFAULT_PIN)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Carrega PIN configurado
  useEffect(() => {
    publicSupabase
      .from('platform_ai_config')
      .select('extra_config')
      .eq('feature', 'tv_dashboard_pin')
      .maybeSingle()
      .then(({ data }) => {
        const pin = (data?.extra_config as Record<string, string> | null)?.pin
        if (pin && /^\d{4,6}$/.test(pin)) setConfiguredPin(pin)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleKey = useCallback((key: string) => {
    if (key === 'del') {
      setDigits(prev => prev.slice(0, -1))
      setError(false)
      return
    }
    if (key === '') return // espaço vazio no teclado
    setDigits(prev => {
      if (prev.length >= PIN_LENGTH) return prev
      const next = [...prev, key]
      if (next.length === PIN_LENGTH) {
        const entered = next.join('')
        if (entered === configuredPin) {
          saveSession()
          setTimeout(() => setUnlocked(true), 200) // pequeno delay para feedback visual
        } else {
          setError(true)
          setTimeout(() => {
            setDigits([])
            setError(false)
          }, 800)
        }
      }
      return next
    })
  }, [configuredPin])

  // Suporte a teclado físico
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace') handleKey('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey])

  if (unlocked) return <TVDashboard />

  if (loading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen" style={{ background: '#10293F' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#45E5E5', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center w-screen h-screen gap-10"
      style={{ background: '#10293F', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <span
          className="text-2xl font-bold px-4 py-2 rounded-lg"
          style={{ background: '#45E5E5', color: '#10293F', fontFamily: 'Poppins, sans-serif' }}
        >
          GMS
        </span>
        <span className="text-white/70 text-sm tracking-wider uppercase">Dashboard TV</span>
      </div>

      {/* Indicadores de dígito */}
      <div className="flex gap-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full transition-all duration-150"
            style={{
              background: error
                ? '#DC2626'
                : i < digits.length
                  ? '#45E5E5'
                  : 'rgba(255,255,255,0.2)',
              transform: i < digits.length ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3">
        {NUM_KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              onClick={() => handleKey(key)}
              className="flex items-center justify-center rounded-xl text-white font-semibold text-xl transition-all duration-100 select-none"
              style={{
                width: 72,
                height: 72,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              onMouseDown={e => (e.currentTarget.style.background = 'rgba(69,229,229,0.2)')}
              onMouseUp={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              {key === 'del' ? <Delete className="w-5 h-5" /> : key}
            </button>
          )
        })}
      </div>

      <span className="text-white/30 text-xs">Digite o PIN para acessar</span>
    </div>
  )
}
