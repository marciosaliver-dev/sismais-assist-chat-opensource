import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Trophy,
  ShieldAlert,
  Users,
  Bot,
  Monitor,
  Tv,
} from 'lucide-react'
import logoWhite from '@/assets/logo-sismais-horizontal-white.png'

const TV_TABS = [
  { label: 'Visão Geral',   icon: LayoutDashboard },
  { label: 'Carga',         icon: Users },
  { label: 'SLA',           icon: ShieldAlert },
  { label: 'Ranking',       icon: Trophy },
] as const

const DESKTOP_TABS = [
  { label: 'Visão Geral',   icon: LayoutDashboard },
  { label: 'Carga',         icon: Users },
  { label: 'SLA',           icon: ShieldAlert },
  { label: 'Ranking',       icon: Trophy },
  { label: 'IA vs Humano',  icon: Bot },
] as const

interface TVNavBarProps {
  currentView: number
  onSelectView: (i: number) => void
  isPaused: boolean
  progress: number
  hasCriticalAlert: boolean
  queueCount?: number
  isRealtime: boolean
  isTVMode: boolean
  onToggleMode?: () => void
  boards?: Array<{ id: string; name: string; color: string; activeCount: number }>
  selectedBoardId?: string | null
  onSelectBoard?: (id: string | null) => void
}

export function TVNavBar({
  currentView,
  onSelectView,
  isPaused,
  progress,
  hasCriticalAlert: _hasCriticalAlert,
  queueCount = 0,
  isRealtime,
  isTVMode,
  onToggleMode,
  boards,
  selectedBoardId,
  onSelectBoard,
}: TVNavBarProps) {
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const tabs = isTVMode ? TV_TABS : DESKTOP_TABS

  return (
    <header
      className="shrink-0 relative flex items-center px-6 gap-6"
      style={{
        height: 64,
        background: '#10293F',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <img
          src={logoWhite}
          alt="Sismais"
          className="h-7 w-auto object-contain"
        />
        <span
          className="text-white/30 text-xs uppercase tracking-widest hidden sm:block"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          TV Dashboard
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Tabs */}
      <nav className="flex items-center gap-1 flex-1">
        {tabs.map((tab, i) => {
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
                cursor: 'pointer',
              }}
            >
              <Icon size={15} />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Board filter tabs */}
      {boards && boards.length > 0 && onSelectBoard && (
        <>
          <div className="w-px h-8 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <nav className="flex items-center gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => onSelectBoard(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap"
              style={{
                background: selectedBoardId === null || selectedBoardId === undefined
                  ? 'rgba(69,229,229,0.12)' : 'transparent',
                color: selectedBoardId === null || selectedBoardId === undefined
                  ? '#45E5E5' : 'rgba(255,255,255,0.4)',
                border: selectedBoardId === null || selectedBoardId === undefined
                  ? '1px solid rgba(69,229,229,0.2)' : '1px solid transparent',
                fontSize: 12,
                fontWeight: selectedBoardId === null || selectedBoardId === undefined ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              Todos
            </button>
            {boards.map((board) => {
              const isActive = selectedBoardId === board.id
              return (
                <button
                  key={board.id}
                  onClick={() => onSelectBoard(board.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: isActive ? 'rgba(69,229,229,0.12)' : 'transparent',
                    color: isActive ? '#45E5E5' : 'rgba(255,255,255,0.4)',
                    border: isActive ? '1px solid rgba(69,229,229,0.2)' : '1px solid transparent',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: board.color }}
                  />
                  {board.name}
                  {board.activeCount > 0 && (
                    <span
                      className="rounded-full text-center"
                      style={{
                        minWidth: 18,
                        height: 16,
                        padding: '0 5px',
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: '16px',
                        background: isActive ? 'rgba(69,229,229,0.2)' : 'rgba(255,255,255,0.1)',
                        color: isActive ? '#45E5E5' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {board.activeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </>
      )}

      {/* Realtime indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${isRealtime ? 'animate-pulse' : ''}`}
          style={{
            background: isRealtime ? '#16A34A' : '#FFB800',
            boxShadow: isRealtime ? '0 0 6px rgba(22,163,74,0.6)' : '0 0 6px rgba(255,184,0,0.5)',
          }}
        />
        <span className="text-xs hidden sm:inline" style={{ color: isRealtime ? 'rgba(22,163,74,0.8)' : 'rgba(255,184,0,0.8)' }}>
          {isRealtime ? 'AO VIVO' : 'POLLING'}
        </span>
      </div>

      {/* Mode toggle */}
      {onToggleMode && (
        <button
          onClick={onToggleMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
          }}
          title={isTVMode ? 'Modo Desktop' : 'Modo TV'}
        >
          {isTVMode ? <Monitor size={14} /> : <Tv size={14} />}
          <span className="hidden sm:inline">{isTVMode ? 'Desktop' : 'TV'}</span>
        </button>
      )}

      {/* Queue badge */}
      {queueCount > 0 && (
        <div
          className={`flex items-center justify-center shrink-0 rounded-full font-bold text-white ${queueCount > 15 ? 'animate-pulse' : ''}`}
          style={{
            minWidth: 32,
            height: 28,
            padding: '0 8px',
            fontSize: 13,
            background: queueCount <= 5 ? '#16A34A' : queueCount <= 15 ? '#FFB800' : '#DC2626',
            color: queueCount <= 5 ? '#fff' : queueCount <= 15 ? '#10293F' : '#fff',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
          }}
        >
          {queueCount}
        </div>
      )}

      {/* Clock */}
      <div className="flex flex-col items-end shrink-0">
        <span
          className="font-bold text-white"
          style={{ fontSize: 22, fontFamily: 'Poppins, sans-serif', lineHeight: 1 }}
        >
          {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className="text-white/30 text-xs mt-0.5 hidden sm:block">
          {clock.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* Progress bar */}
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
