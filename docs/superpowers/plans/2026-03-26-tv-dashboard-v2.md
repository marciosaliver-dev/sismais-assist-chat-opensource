# TV Dashboard v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite o TV Dashboard (`/tv`) com 4 views auto-rotativas (Visão Geral, Fila Ao Vivo, Performance, SLA), navegação por tabs, transições suaves e barra de progresso visual.

**Architecture:** Um hook `useTVAutoRotation` gerencia qual view está ativa e o timer de 20s. `TVNavBar` exibe logo + tabs + progresso + relógio. `TVDashboard` orquestra as 4 views com transição CSS `key`-based. Todos os dados vêm do hook existente `useTVDashboardMetrics` sem alteração.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Vitest + @testing-library/react, Lucide-react, Supabase client já configurado.

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `src/index.css` | Adicionar keyframes `.tv-view-enter` |
| Create | `src/hooks/useTVAutoRotation.ts` | Timer de rotação, pausa manual, progresso 0-100 |
| Create | `src/hooks/useTVAutoRotation.test.ts` | Testes do hook |
| Create | `src/components/tv-dashboard/TVNavBar.tsx` | Logo + tabs + progress bar + relógio |
| Create | `src/components/tv-dashboard/TVOverviewView.tsx` | Visão Geral: KPIs + boards + mini ranking |
| Create | `src/components/tv-dashboard/TVQueueView.tsx` | Fila Ao Vivo: stale tickets + boards detalhados |
| Create | `src/components/tv-dashboard/TVPerformanceView.tsx` | Performance: top agent card + ranking completo |
| Create | `src/components/tv-dashboard/TVSLAView.tsx` | SLA: compliance donut + tabela de violações |
| Modify | `src/pages/TVDashboard.tsx` | Orquestrador: monta views + alert banner + ticker |
| Delete/Keep | `src/components/tv-dashboard/TVKPIStrip.tsx` | Substituído por TVNavBar — manter arquivo mas não usar |

---

## Task 1: CSS — Animações de transição de view

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Adicionar keyframes ao final do arquivo `src/index.css`**

```css
/* ── TV Dashboard transitions ── */
.tv-view-enter {
  animation: tvViewEnter 300ms ease-out both;
}

@keyframes tvViewEnter {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tv-view-enter {
    animation: tvViewFade 200ms ease-out both;
  }

  @keyframes tvViewFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
}

/* TV ticker marquee */
.tv-ticker-track {
  display: flex;
  animation: tvTicker 40s linear infinite;
}

.tv-ticker-track:hover {
  animation-play-state: paused;
}

@keyframes tvTicker {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "style(tv-dashboard): add view transition and ticker keyframes"
```

---

## Task 2: Hook `useTVAutoRotation`

**Files:**
- Create: `src/hooks/useTVAutoRotation.ts`
- Create: `src/hooks/useTVAutoRotation.test.ts`

- [ ] **Step 1: Criar arquivo de teste `src/hooks/useTVAutoRotation.test.ts`**

```ts
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

  it('avança pela view 3 e volta ao 0 (loop)', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { vi.advanceTimersByTime(20_000 * 4) })
    expect(result.current.currentView).toBe(0)
  })

  it('pausa rotação ao chamar setView', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { result.current.setView(2) })
    expect(result.current.currentView).toBe(2)
    expect(result.current.isPaused).toBe(true)
    // não avança enquanto pausado
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.currentView).toBe(2)
  })

  it('retoma rotação após 60s de pausa', () => {
    const { result } = renderHook(() => useTVAutoRotation())
    act(() => { result.current.setView(1) })
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current.isPaused).toBe(false)
    // agora deve avançar normalmente
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(result.current.currentView).toBe(2)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que FALHA**

```bash
npx vitest run src/hooks/useTVAutoRotation.test.ts
```
Esperado: erro "Cannot find module './useTVAutoRotation'"

- [ ] **Step 3: Criar `src/hooks/useTVAutoRotation.ts`**

```ts
import { useState, useEffect, useCallback, useRef } from 'react'

const VIEW_COUNT = 4
const AUTO_ADVANCE_MS = 20_000
const PAUSE_MS = 60_000

export interface UseTVAutoRotationReturn {
  currentView: number
  setView: (i: number) => void
  isPaused: boolean
  progress: number // 0–100
}

export function useTVAutoRotation(): UseTVAutoRotationReturn {
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
      setCurrentView(v => (v + 1) % VIEW_COUNT)
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [currentView, isPaused])

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
```

- [ ] **Step 4: Rodar testes e confirmar que PASSAM**

```bash
npx vitest run src/hooks/useTVAutoRotation.test.ts
```
Esperado: 5 testes PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTVAutoRotation.ts src/hooks/useTVAutoRotation.test.ts
git commit -m "feat(tv-dashboard): add useTVAutoRotation hook with TDD"
```

---

## Task 3: Componente `TVNavBar`

**Files:**
- Create: `src/components/tv-dashboard/TVNavBar.tsx`

- [ ] **Step 1: Criar `src/components/tv-dashboard/TVNavBar.tsx`**

```tsx
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ListOrdered,
  Trophy,
  ShieldAlert,
  Pause,
  Play,
} from 'lucide-react'

const TABS = [
  { label: 'Visão Geral',   icon: LayoutDashboard },
  { label: 'Fila Ao Vivo', icon: ListOrdered },
  { label: 'Performance',   icon: Trophy },
  { label: 'SLA',           icon: ShieldAlert },
] as const

interface TVNavBarProps {
  currentView: number
  onSelectView: (i: number) => void
  isPaused: boolean
  progress: number // 0-100
  hasCriticalAlert: boolean
}

export function TVNavBar({
  currentView,
  onSelectView,
  isPaused,
  progress,
  hasCriticalAlert,
}: TVNavBarProps) {
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      className="shrink-0 relative flex items-center px-6 gap-6"
      style={{
        height: 64,
        background: '#0d2237',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <span
          className="font-bold text-sm px-2 py-1 rounded"
          style={{ background: '#45E5E5', color: '#10293F', fontFamily: 'Poppins, sans-serif' }}
        >
          GMS
        </span>
        <span
          className="text-white/50 text-xs uppercase tracking-widest"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          TV Dashboard
        </span>
      </div>

      {/* Divisor */}
      <div className="w-px h-8 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Tabs */}
      <nav className="flex items-center gap-1 flex-1">
        {TABS.map((tab, i) => {
          const Icon = tab.icon
          const isActive = i === currentView
          return (
            <button
              key={tab.label}
              onClick={() => onSelectView(i)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
              style={{
                background: isActive ? 'rgba(69,229,229,0.12)' : 'transparent',
                color: isActive ? '#45E5E5' : 'rgba(255,255,255,0.4)',
                border: isActive ? '1px solid rgba(69,229,229,0.2)' : '1px solid transparent',
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Live indicator + paused state */}
      <div className="flex items-center gap-2 shrink-0">
        {isPaused ? (
          <Pause size={12} style={{ color: '#FFB800' }} />
        ) : (
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#16A34A', boxShadow: '0 0 6px rgba(22,163,74,0.6)' }}
          />
        )}
        <span className="text-xs" style={{ color: isPaused ? '#FFB800' : 'rgba(255,255,255,0.3)' }}>
          {isPaused ? 'PAUSADO' : 'AO VIVO'}
        </span>
      </div>

      {/* Clock */}
      <div className="flex flex-col items-end shrink-0">
        <span
          className="font-bold text-white"
          style={{ fontSize: 22, fontFamily: 'Poppins, sans-serif', lineHeight: 1 }}
        >
          {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className="text-white/30 text-xs mt-0.5">
          {clock.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* Progress bar — borda inferior da navbar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 transition-none"
        style={{
          width: `${progress}%`,
          background: isPaused
            ? 'rgba(255,184,0,0.5)'
            : 'linear-gradient(90deg, #45E5E5, #16A34A)',
          boxShadow: isPaused ? 'none' : '0 0 6px rgba(69,229,229,0.4)',
        }}
      />
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVNavBar.tsx
git commit -m "feat(tv-dashboard): add TVNavBar with tabs, progress bar, and clock"
```

---

## Task 4: `TVOverviewView` — Visão Geral

**Files:**
- Create: `src/components/tv-dashboard/TVOverviewView.tsx`

Props necessárias:
```ts
import type { TVKPIs, QueueByBoard, AgentRank } from '@/hooks/useTVDashboardMetrics'
interface TVOverviewViewProps {
  kpis: TVKPIs
  queueByBoard: QueueByBoard[]
  agentRanking: AgentRank[]
}
```

- [ ] **Step 1: Criar `src/components/tv-dashboard/TVOverviewView.tsx`**

```tsx
import type { TVKPIs, QueueByBoard, AgentRank } from '@/hooks/useTVDashboardMetrics'

interface TVOverviewViewProps {
  kpis: TVKPIs
  queueByBoard: QueueByBoard[]
  agentRanking: AgentRank[]
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

const medalEmojis = ['🥇', '🥈', '🥉']

export function TVOverviewView({ kpis, queueByBoard, agentRanking }: TVOverviewViewProps) {
  const aiPercent = kpis.resolvedToday > 0
    ? Math.round((kpis.aiResolvedToday / kpis.resolvedToday) * 100)
    : 0

  const top3 = [...agentRanking].sort((a, b) => b.resolved - a.resolved).slice(0, 3)

  const heroKpis = [
    {
      label: 'Na Fila',
      value: kpis.totalWaiting,
      color: kpis.totalWaiting > 10 ? '#DC2626' : kpis.totalWaiting > 5 ? '#FFB800' : '#45E5E5',
      icon: '⏳',
    },
    {
      label: 'Em Atendimento',
      value: kpis.totalInProgress,
      color: '#45E5E5',
      icon: '💬',
    },
    {
      label: 'Resolvidos Hoje',
      value: kpis.resolvedToday,
      color: '#16A34A',
      icon: '✅',
    },
    {
      label: '% Resolvido por IA',
      value: `${aiPercent}%`,
      color: '#45E5E5',
      icon: '🤖',
    },
    {
      label: 'CSAT Médio',
      value: kpis.avgCsatToday > 0 ? kpis.avgCsatToday.toFixed(1) : '—',
      color: '#FFB800',
      icon: '⭐',
    },
    {
      label: 'Ticket + Antigo',
      value: formatMinutes(kpis.oldestTicketMinutes),
      color: kpis.oldestTicketMinutes > 240 ? '#DC2626' : kpis.oldestTicketMinutes > 120 ? '#FFB800' : '#45E5E5',
      icon: '🕐',
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6">
      {/* Hero KPIs — 6 cards */}
      <div className="grid grid-cols-6 gap-4 shrink-0">
        {heroKpis.map(kpi => (
          <div
            key={kpi.label}
            className="flex flex-col items-center justify-center rounded-xl p-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              minHeight: 110,
            }}
          >
            <span style={{ fontSize: 22 }}>{kpi.icon}</span>
            <span
              className="font-black mt-2"
              style={{
                color: kpi.color,
                fontSize: 42,
                fontFamily: 'Poppins, sans-serif',
                lineHeight: 1,
                filter: `drop-shadow(0 0 8px ${kpi.color}40)`,
              }}
            >
              {kpi.value}
            </span>
            <span className="text-white/40 text-xs uppercase tracking-wider mt-1 text-center leading-tight">
              {kpi.label}
            </span>
          </div>
        ))}
      </div>

      {/* Linha inferior: boards + mini ranking */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Boards */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          <h3 className="text-white/40 text-xs uppercase tracking-widest font-semibold shrink-0">
            Filas por Board
          </h3>
          {queueByBoard.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-white/20 text-sm">Nenhuma conversa ativa</span>
            </div>
          ) : (
            queueByBoard.map(board => {
              const isWarning = board.waiting > 5 && board.waiting <= 10
              const isCritical = board.waiting > 10
              return (
                <div
                  key={board.boardName}
                  className="flex items-center gap-4 rounded-lg px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderLeft: `4px solid ${board.boardColor}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium text-sm truncate block">{board.boardName}</span>
                    <span className="text-white/30 text-xs">{board.inProgress} em atendimento · {board.total} total</span>
                  </div>
                  <span
                    className="font-black shrink-0"
                    style={{
                      fontSize: 32,
                      fontFamily: 'Poppins, sans-serif',
                      lineHeight: 1,
                      color: isCritical ? '#DC2626' : isWarning ? '#FFB800' : '#45E5E5',
                    }}
                  >
                    {board.waiting}
                  </span>
                  <span className="text-white/30 text-xs">aguardando</span>
                </div>
              )
            })
          )}
        </div>

        {/* Mini ranking top 3 */}
        <div
          className="w-72 shrink-0 flex flex-col gap-3 rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h3 className="text-white/40 text-xs uppercase tracking-widest font-semibold">Top Agentes Hoje</h3>
          {top3.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <span className="text-white/20 text-sm text-center">Nenhum atendimento finalizado hoje</span>
            </div>
          ) : (
            top3.map((agent, i) => (
              <div
                key={agent.agentId}
                className="flex items-center gap-3 rounded-lg px-3 py-3"
                style={{
                  background: i === 0 ? 'rgba(69,229,229,0.08)' : 'rgba(255,255,255,0.03)',
                  border: i === 0 ? '1px solid rgba(69,229,229,0.15)' : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ fontSize: 20 }}>{medalEmojis[i]}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-medium truncate block">{agent.agentName}</span>
                  <span className="text-white/30 text-xs">{agent.resolved} resolvidos · {formatSeconds(agent.avgResolutionSeconds)}</span>
                </div>
                <span
                  className="font-bold text-sm shrink-0"
                  style={{ color: '#FFB800' }}
                >
                  {(agent.avgCsat ?? 0).toFixed(1)} ★
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVOverviewView.tsx
git commit -m "feat(tv-dashboard): add TVOverviewView with hero KPIs, boards and ranking"
```

---

## Task 5: `TVQueueView` — Fila Ao Vivo

**Files:**
- Create: `src/components/tv-dashboard/TVQueueView.tsx`

- [ ] **Step 1: Criar `src/components/tv-dashboard/TVQueueView.tsx`**

```tsx
import type { StaleTicket, QueueByBoard, TVKPIs } from '@/hooks/useTVDashboardMetrics'

interface TVQueueViewProps {
  staleTickets: StaleTicket[]
  queueByBoard: QueueByBoard[]
  kpis: TVKPIs
}

function formatStale(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function severityColor(mins: number) {
  if (mins > 240) return '#DC2626'
  if (mins > 60)  return '#FFB800'
  return '#45E5E5'
}

export function TVQueueView({ staleTickets, queueByBoard, kpis }: TVQueueViewProps) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Esquerda: lista de tickets parados */}
      <div
        className="flex flex-col p-6 gap-4 overflow-hidden"
        style={{ width: '55%', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-baseline justify-between shrink-0">
          <h2 className="text-white/40 text-xs uppercase tracking-widest font-semibold">
            Tickets Parados
          </h2>
          <span className="text-xs" style={{ color: staleTickets.length > 0 ? '#FFB800' : '#16A34A' }}>
            {staleTickets.length} ticket{staleTickets.length !== 1 ? 's' : ''} &gt;30min
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {staleTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <span style={{ fontSize: 48 }}>✅</span>
              <span className="text-white/30 text-sm">Nenhum ticket parado</span>
            </div>
          ) : (
            staleTickets.map(ticket => {
              const color = severityColor(ticket.staleMinutes)
              const isCritical = ticket.staleMinutes > 240
              return (
                <div
                  key={ticket.id}
                  className={`flex items-center gap-4 rounded-lg px-4 py-3 ${isCritical ? 'animate-pulse' : ''}`}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  {/* Timer */}
                  <span
                    className="font-black shrink-0"
                    style={{
                      color,
                      fontSize: 28,
                      fontFamily: 'Poppins, sans-serif',
                      lineHeight: 1,
                      minWidth: 70,
                    }}
                  >
                    {formatStale(ticket.staleMinutes)}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white/40 text-xs font-mono">#{ticket.ticketNumber}</span>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-white/40 text-xs truncate">{ticket.boardName}</span>
                    </div>
                    <span className="text-white text-sm font-medium truncate block">
                      {ticket.subject || ticket.customerName || 'Sem título'}
                    </span>
                  </div>

                  {/* Agente */}
                  <div className="flex flex-col items-end shrink-0 min-w-0 max-w-[120px]">
                    <span className="text-white/30 text-xs">
                      {ticket.handlerType === 'ai' ? '🤖 IA' : '👤 Humano'}
                    </span>
                    <span className="text-white/40 text-xs truncate">{ticket.agentName || '—'}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Direita: boards + KPIs de fila */}
      <div className="flex flex-col p-6 gap-6 overflow-y-auto" style={{ width: '45%' }}>
        {/* KPIs rápidos */}
        <div className="grid grid-cols-2 gap-4 shrink-0">
          {[
            { label: 'Aguardando', value: kpis.totalWaiting, color: kpis.totalWaiting > 10 ? '#DC2626' : '#45E5E5' },
            { label: 'Em Atendimento', value: kpis.totalInProgress, color: '#45E5E5' },
          ].map(item => (
            <div
              key={item.label}
              className="flex flex-col items-center justify-center rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', minHeight: 90 }}
            >
              <span
                className="font-black"
                style={{ color: item.color, fontSize: 52, fontFamily: 'Poppins, sans-serif', lineHeight: 1 }}
              >
                {item.value}
              </span>
              <span className="text-white/40 text-xs uppercase tracking-wider mt-1">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Boards detalhados */}
        <div className="flex flex-col gap-3">
          <h3 className="text-white/40 text-xs uppercase tracking-widest font-semibold">Por Board</h3>
          {queueByBoard.map(board => {
            const maxTotal = Math.max(...queueByBoard.map(b => b.total), 1)
            const pct = Math.round((board.total / maxTotal) * 100)
            return (
              <div key={board.boardName} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: board.boardColor }} />
                    <span className="text-white/70">{board.boardName}</span>
                  </div>
                  <span className="text-white/50">{board.waiting} ag · {board.inProgress} at · {board.total} total</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: board.boardColor }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVQueueView.tsx
git commit -m "feat(tv-dashboard): add TVQueueView with stale tickets and board breakdown"
```

---

## Task 6: `TVPerformanceView` — Performance de Agentes

**Files:**
- Create: `src/components/tv-dashboard/TVPerformanceView.tsx`

- [ ] **Step 1: Criar `src/components/tv-dashboard/TVPerformanceView.tsx`**

```tsx
import type { AgentRank } from '@/hooks/useTVDashboardMetrics'

interface TVPerformanceViewProps {
  agents: AgentRank[]
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

const medalEmojis = ['🥇', '🥈', '🥉']

export function TVPerformanceView({ agents }: TVPerformanceViewProps) {
  const sorted = [...agents].sort((a, b) => b.resolved - a.resolved)
  const top = sorted[0]
  const rest = sorted.slice(1)
  const maxResolved = top?.resolved || 1

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span style={{ fontSize: 64 }}>📊</span>
        <span className="text-white/30 text-lg">Nenhum atendimento finalizado hoje</span>
        <span className="text-white/20 text-sm">Os dados aparecerão conforme os tickets forem resolvidos</span>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden p-6 gap-6">
      {/* Top performer card */}
      <div
        className="flex flex-col shrink-0 rounded-2xl p-8 relative overflow-hidden"
        style={{
          width: '42%',
          background: 'linear-gradient(135deg, rgba(69,229,229,0.08) 0%, rgba(16,41,63,0.8) 100%)',
          border: '1px solid rgba(69,229,229,0.15)',
          boxShadow: '0 0 40px rgba(69,229,229,0.08)',
        }}
      >
        {/* Glow bg */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(69,229,229,0.1)' }}
        />

        <div className="relative z-10">
          <span className="text-white/40 text-xs uppercase tracking-widest font-semibold">
            🏆 Top Performer Hoje
          </span>

          {/* Avatar inicial */}
          <div className="flex items-center gap-4 mt-6 mb-6">
            <div
              className="flex items-center justify-center rounded-2xl shrink-0"
              style={{
                width: 72,
                height: 72,
                background: '#45E5E5',
                color: '#10293F',
                fontSize: 28,
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
              }}
            >
              {top.agentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2
                className="text-white font-black"
                style={{ fontSize: 28, fontFamily: 'Poppins, sans-serif', lineHeight: 1.1 }}
              >
                {top.agentName}
              </h2>
              <span className="text-white/40 text-sm">Agente de Suporte</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Resolvidos', value: top.resolved, color: '#45E5E5' },
              { label: 'TMA', value: formatSeconds(top.avgResolutionSeconds), color: '#bdd3f3' },
              { label: 'CSAT', value: top.avgCsat > 0 ? `${top.avgCsat.toFixed(1)}★` : '—', color: '#FFB800' },
            ].map(stat => (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-xl p-3"
                style={{ background: 'rgba(0,0,0,0.2)', borderBottom: `2px solid ${stat.color}` }}
              >
                <span
                  className="font-black"
                  style={{ color: stat.color, fontSize: 26, fontFamily: 'Poppins, sans-serif', lineHeight: 1 }}
                >
                  {stat.value}
                </span>
                <span className="text-white/30 text-xs uppercase tracking-wider mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ranking completo */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 overflow-y-auto">
        <h3 className="text-white/40 text-xs uppercase tracking-widest font-semibold shrink-0">
          Ranking Geral — Hoje
        </h3>

        {/* Linha do top performer no ranking */}
        <div
          className="flex items-center gap-4 rounded-xl px-4 py-3 shrink-0"
          style={{
            background: 'rgba(69,229,229,0.08)',
            border: '1px solid rgba(69,229,229,0.2)',
          }}
        >
          <span style={{ fontSize: 24, width: 32 }}>{medalEmojis[0]}</span>
          <span className="text-white font-semibold flex-1 truncate">{top.agentName}</span>
          <div className="flex-1 mx-3">
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: '100%', background: '#45E5E5' }} />
            </div>
          </div>
          <span className="font-black shrink-0" style={{ color: '#45E5E5', fontFamily: 'Poppins, sans-serif' }}>
            {top.resolved}
          </span>
          <span className="text-white/30 text-xs shrink-0 w-10">resol.</span>
          <span className="font-semibold shrink-0 w-12 text-right" style={{ color: '#FFB800' }}>
            {top.avgCsat > 0 ? `${top.avgCsat.toFixed(1)}★` : '—'}
          </span>
        </div>

        {rest.map((agent, i) => {
          const pct = Math.round((agent.resolved / maxResolved) * 100)
          const medal = i < 2 ? medalEmojis[i + 1] : null
          return (
            <div
              key={agent.agentId}
              className="flex items-center gap-4 rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span style={{ width: 32, textAlign: 'center', fontSize: medal ? 20 : 14, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
                {medal || `${i + 2}`}
              </span>
              <span className="text-white/80 font-medium flex-1 truncate text-sm">{agent.agentName}</span>
              <div className="flex-1 mx-3">
                <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#45E5E5' }} />
                </div>
              </div>
              <span className="font-bold shrink-0 text-sm" style={{ color: '#45E5E5', fontFamily: 'Poppins, sans-serif', minWidth: 28, textAlign: 'right' }}>
                {agent.resolved}
              </span>
              <span className="text-white/30 text-xs shrink-0 w-10">resol.</span>
              <span className="text-sm shrink-0 w-12 text-right" style={{ color: '#FFB800' }}>
                {agent.avgCsat > 0 ? `${agent.avgCsat.toFixed(1)}★` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVPerformanceView.tsx
git commit -m "feat(tv-dashboard): add TVPerformanceView with top performer card and ranking"
```

---

## Task 7: `TVSLAView` — Monitoramento SLA

**Files:**
- Create: `src/components/tv-dashboard/TVSLAView.tsx`

- [ ] **Step 1: Criar `src/components/tv-dashboard/TVSLAView.tsx`**

```tsx
import type { StaleTicket, TVKPIs, QueueByBoard } from '@/hooks/useTVDashboardMetrics'

interface TVSLAViewProps {
  staleTickets: StaleTicket[]
  kpis: TVKPIs
  queueByBoard: QueueByBoard[]
}

function formatStale(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface DonutProps {
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
}

function DonutChart({ percent, size = 160, strokeWidth = 14, color = '#45E5E5' }: DonutProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${color}60)` }}
      />
      {/* Label */}
      <text
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
        fill={color}
        fontSize={38}
        fontWeight={900}
        fontFamily="Poppins, sans-serif"
        dominantBaseline="middle"
      >
        {percent}%
      </text>
      <text
        x={size / 2}
        y={size / 2 + 22}
        textAnchor="middle"
        fill="rgba(255,255,255,0.3)"
        fontSize={11}
        fontFamily="Inter, sans-serif"
      >
        SLA OK
      </text>
    </svg>
  )
}

export function TVSLAView({ staleTickets, kpis, queueByBoard }: TVSLAViewProps) {
  // Deriva métricas de SLA a partir dos dados existentes
  const totalActive = kpis.totalWaiting + kpis.totalInProgress
  const violated = staleTickets.filter(t => t.staleMinutes > 60).length
  const atRisk   = staleTickets.filter(t => t.staleMinutes > 30 && t.staleMinutes <= 60).length
  const ok       = Math.max(0, totalActive - violated - atRisk)
  const compliancePct = totalActive > 0
    ? Math.round((ok / totalActive) * 100)
    : 100

  const donutColor = compliancePct >= 90 ? '#16A34A' : compliancePct >= 70 ? '#FFB800' : '#DC2626'

  const violatedTickets = staleTickets
    .filter(t => t.staleMinutes > 60)
    .sort((a, b) => b.staleMinutes - a.staleMinutes)

  return (
    <div className="flex h-full overflow-hidden p-6 gap-6">
      {/* Coluna esquerda: donut + resumo */}
      <div
        className="flex flex-col items-center shrink-0 rounded-2xl p-6 gap-6"
        style={{
          width: '32%',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <h3 className="text-white/40 text-xs uppercase tracking-widest font-semibold self-start">
          Compliance SLA
        </h3>

        <DonutChart percent={compliancePct} color={donutColor} size={180} />

        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { label: 'OK', value: ok, color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
            { label: 'Em Risco', value: atRisk, color: '#FFB800', bg: 'rgba(255,184,0,0.1)' },
            { label: 'Violado', value: violated, color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
          ].map(item => (
            <div
              key={item.label}
              className="flex flex-col items-center rounded-lg p-3"
              style={{ background: item.bg, border: `1px solid ${item.color}30` }}
            >
              <span
                className="font-black"
                style={{ color: item.color, fontSize: 28, fontFamily: 'Poppins, sans-serif', lineHeight: 1 }}
              >
                {item.value}
              </span>
              <span className="text-white/40 text-xs uppercase tracking-wider mt-1 text-center leading-tight">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Tempo médio do ticket mais antigo */}
        <div
          className="w-full rounded-lg p-3 flex flex-col items-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className="text-white/30 text-xs uppercase tracking-wider">Ticket + Antigo</span>
          <span
            className="font-black mt-1"
            style={{
              color: kpis.oldestTicketMinutes > 240 ? '#DC2626' : kpis.oldestTicketMinutes > 60 ? '#FFB800' : '#45E5E5',
              fontSize: 28,
              fontFamily: 'Poppins, sans-serif',
              lineHeight: 1,
            }}
          >
            {formatStale(kpis.oldestTicketMinutes)}
          </span>
        </div>
      </div>

      {/* Coluna direita: tabela de violações */}
      <div className="flex flex-col flex-1 min-w-0 gap-4 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-white/40 text-xs uppercase tracking-widest font-semibold">
            Tickets em Violação (&gt;1h parados)
          </h3>
          {violatedTickets.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(220,38,38,0.15)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}
            >
              {violatedTickets.length} VIOLAÇÃO{violatedTickets.length > 1 ? 'ÕES' : ''}
            </span>
          )}
        </div>

        {violatedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <span style={{ fontSize: 64 }}>🎯</span>
            <span className="text-white/30 text-lg">SLA 100% cumprido</span>
            <span className="text-white/20 text-sm">Nenhum ticket em violação no momento</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto flex-1">
            {violatedTickets.map(ticket => {
              const isCritical = ticket.staleMinutes > 240
              return (
                <div
                  key={ticket.id}
                  className={`flex items-center gap-4 rounded-lg px-4 py-3 ${isCritical ? 'animate-pulse' : ''}`}
                  style={{
                    background: isCritical ? 'rgba(220,38,38,0.08)' : 'rgba(255,184,0,0.05)',
                    borderLeft: `3px solid ${isCritical ? '#DC2626' : '#FFB800'}`,
                  }}
                >
                  <span
                    className="font-black shrink-0"
                    style={{
                      color: isCritical ? '#DC2626' : '#FFB800',
                      fontSize: 26,
                      fontFamily: 'Poppins, sans-serif',
                      lineHeight: 1,
                      minWidth: 70,
                    }}
                  >
                    {formatStale(ticket.staleMinutes)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white/30 text-xs font-mono">#{ticket.ticketNumber}</span>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-white/30 text-xs">{ticket.boardName || '—'}</span>
                    </div>
                    <span className="text-white text-sm font-medium truncate block">
                      {ticket.subject || ticket.customerName || 'Sem título'}
                    </span>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="text-xs" style={{ color: isCritical ? '#DC2626' : '#FFB800' }}>
                      {isCritical ? '🔴 CRÍTICO' : '🟡 ALERTA'}
                    </span>
                    <span className="text-white/30 text-xs">
                      {ticket.handlerType === 'ai' ? '🤖' : '👤'} {ticket.agentName || 'Sem agente'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SLA por Board */}
        {queueByBoard.length > 0 && (
          <div className="shrink-0">
            <h4 className="text-white/30 text-xs uppercase tracking-widest mb-2">SLA por Board</h4>
            <div className="flex flex-wrap gap-2">
              {queueByBoard.map(board => {
                const boardViolated = staleTickets.filter(t => t.boardName === board.boardName && t.staleMinutes > 60).length
                const boardOk = board.total - boardViolated
                const pct = board.total > 0 ? Math.round((boardOk / board.total) * 100) : 100
                return (
                  <div
                    key={board.boardName}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${board.boardColor}30`,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: board.boardColor }} />
                    <span className="text-white/60">{board.boardName}</span>
                    <span
                      className="font-bold"
                      style={{ color: pct >= 90 ? '#16A34A' : pct >= 70 ? '#FFB800' : '#DC2626' }}
                    >
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tv-dashboard/TVSLAView.tsx
git commit -m "feat(tv-dashboard): add TVSLAView with SVG donut chart and violation table"
```

---

## Task 8: Reescrever `TVDashboard.tsx` — Orquestrador

**Files:**
- Modify: `src/pages/TVDashboard.tsx`

- [ ] **Step 1: Substituir o conteúdo de `src/pages/TVDashboard.tsx`**

```tsx
import { useTVDashboardMetrics } from '@/hooks/useTVDashboardMetrics'
import { useTVAutoRotation } from '@/hooks/useTVAutoRotation'
import { TVNavBar } from '@/components/tv-dashboard/TVNavBar'
import { TVOverviewView } from '@/components/tv-dashboard/TVOverviewView'
import { TVQueueView } from '@/components/tv-dashboard/TVQueueView'
import { TVPerformanceView } from '@/components/tv-dashboard/TVPerformanceView'
import { TVSLAView } from '@/components/tv-dashboard/TVSLAView'
import { useRef } from 'react'

export default function TVDashboard() {
  const { queueByBoard, staleTickets, agentRanking, kpis, isLoading } = useTVDashboardMetrics()
  const { currentView, setView, isPaused, progress } = useTVAutoRotation()

  // Banner de alerta crítico: ticket parado há mais de 1h
  const criticalCount = (staleTickets ?? []).filter(t => t.staleMinutes > 60).length
  const hasCriticalAlert = criticalCount > 0

  // Ticker: stale tickets ordenados por último movimento (mais recente primeiro)
  const tickerTickets = [...(staleTickets ?? [])]
    .sort((a, b) => new Date(b.lastStageChange).getTime() - new Date(a.lastStageChange).getTime())
    .slice(0, 10)

  // Duplicar para loop contínuo
  const tickerItems = [...tickerTickets, ...tickerTickets]

  if (isLoading || !kpis) {
    return (
      <div
        className="flex items-center justify-center w-screen h-screen"
        style={{ background: '#0a1929' }}
      >
        <div className="flex flex-col items-center gap-4">
          <span
            className="font-bold text-2xl px-4 py-2 rounded-lg animate-pulse"
            style={{ background: '#45E5E5', color: '#10293F', fontFamily: 'Poppins, sans-serif' }}
          >
            GMS
          </span>
          <span className="text-white/40 text-sm">Carregando dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden"
      style={{ background: '#0a1929', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Nav bar */}
      <TVNavBar
        currentView={currentView}
        onSelectView={setView}
        isPaused={isPaused}
        progress={progress}
        hasCriticalAlert={hasCriticalAlert}
      />

      {/* Banner de alerta crítico (sempre visível quando há violações) */}
      {hasCriticalAlert && (
        <div
          className="flex items-center gap-3 px-6 shrink-0"
          style={{
            height: 40,
            background: 'rgba(220,38,38,0.12)',
            borderBottom: '1px solid rgba(220,38,38,0.3)',
          }}
        >
          <span className="animate-pulse" style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
            ALERTA SLA —{' '}
            <span className="font-black">{criticalCount}</span>
            {' '}ticket{criticalCount > 1 ? 's' : ''} aguardando há mais de 1h sem resposta
          </span>
        </div>
      )}

      {/* Área de views — transição com key para re-mount e trigger da animação CSS */}
      <div
        key={currentView}
        className="tv-view-enter flex-1 min-h-0"
      >
        {currentView === 0 && (
          <TVOverviewView
            kpis={kpis}
            queueByBoard={queueByBoard ?? []}
            agentRanking={agentRanking ?? []}
          />
        )}
        {currentView === 1 && (
          <TVQueueView
            staleTickets={staleTickets ?? []}
            queueByBoard={queueByBoard ?? []}
            kpis={kpis}
          />
        )}
        {currentView === 2 && (
          <TVPerformanceView
            agents={agentRanking ?? []}
          />
        )}
        {currentView === 3 && (
          <TVSLAView
            staleTickets={staleTickets ?? []}
            kpis={kpis}
            queueByBoard={queueByBoard ?? []}
          />
        )}
      </div>

      {/* Ticker bar — rodapé com eventos recentes */}
      <div
        className="shrink-0 overflow-hidden flex items-center"
        style={{
          height: 40,
          background: 'rgba(0,0,0,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {tickerItems.length === 0 ? (
          <span className="px-6 text-white/20 text-xs">Nenhum evento recente</span>
        ) : (
          <div className="flex items-center h-full overflow-hidden flex-1 relative">
            <div className="tv-ticker-track flex items-center gap-8 px-4">
              {tickerItems.map((ticket, i) => {
                const isCrit = ticket.staleMinutes > 240
                const isWarn = ticket.staleMinutes > 60
                return (
                  <div key={`${ticket.id}-${i}`} className="flex items-center gap-2 shrink-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: isCrit ? '#DC2626' : isWarn ? '#FFB800' : '#45E5E5',
                        boxShadow: isCrit ? '0 0 6px rgba(220,38,38,0.6)' : 'none',
                      }}
                    />
                    <span className="text-white/30 text-xs font-mono">
                      #{ticket.ticketNumber}
                    </span>
                    <span className="text-white/60 text-xs truncate max-w-48">
                      {ticket.subject || ticket.customerName}
                    </span>
                    <span className="text-white/20 text-xs">({ticket.boardName})</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isCrit ? '#DC2626' : isWarn ? '#FFB800' : '#45E5E5' }}
                    >
                      {ticket.staleMinutes}m parado
                    </span>
                    <span className="text-white/10 mx-2">|</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rodar o dev server e verificar `/tv`**

```bash
npm run dev
```
Abrir `http://localhost:8080/tv` no navegador.

Verificar:
- [ ] NavBar aparece com logo GMS + 4 tabs + relógio
- [ ] Barra de progresso cyan avança da esquerda para a direita
- [ ] Após 20s a view muda automaticamente com fade+slide
- [ ] Clicar em tab muda imediatamente e mostra indicador PAUSADO (amarelo)
- [ ] Após 60s sem interação, indicador volta a AO VIVO e rotação retoma
- [ ] Se houver stale tickets >60min, banner vermelho aparece no topo
- [ ] Ticker no rodapé com tickets em scroll horizontal

- [ ] **Step 3: Commit final**

```bash
git add src/pages/TVDashboard.tsx
git commit -m "feat(tv-dashboard): rewrite orchestrator with 4 views, auto-rotation and SLA alert banner"
```

---

## Task 9: Push e verificação

- [ ] **Step 1: Rodar lint**

```bash
npm run lint
```
Esperado: sem erros. Se houver warnings de TypeScript sobre tipos `any`, avaliar se são nos comentários do hook existente (ok manter) ou em código novo (corrigir com tipagem explícita).

- [ ] **Step 2: Push para a branch de desenvolvimento**

```bash
git push -u origin claude/sismais-support-system-JCMCi
```

- [ ] **Step 3: Checklist final de verificação em `/tv`**

- [ ] View 0 (Visão Geral): 6 KPIs + boards + mini ranking visíveis
- [ ] View 1 (Fila Ao Vivo): lista de stale tickets + breakdown por board
- [ ] View 2 (Performance): card top performer + ranking com barras de progresso
- [ ] View 3 (SLA): donut SVG + tabela de violações + SLA por board
- [ ] Rotação automática: 20s por view
- [ ] Pausa manual: clique em tab pausa 60s e retoma
- [ ] `prefers-reduced-motion`: sem transform, apenas fade (testar em DevTools → Rendering)
- [ ] Banner de alerta sempre visível quando há violações de SLA
- [ ] Ticker no rodapé com scroll contínuo

---

## Notas de Implementação

- **Tipos reutilizados:** `TVKPIs`, `QueueByBoard`, `StaleTicket`, `AgentRank` — todos de `@/hooks/useTVDashboardMetrics`
- **TVKPIStrip.tsx e componentes antigos:** não deletar, apenas não referenciar. O build tree-shake os elimina.
- **`useTVDashboardMetrics`:** não foi modificado — o refetch interval de 15-30s continua igual
- **Lucide-react:** `LayoutDashboard`, `ListOrdered`, `Trophy`, `ShieldAlert`, `Pause`, `Play` — todos disponíveis no pacote
