import { useMemo } from 'react'
import type { TVQueueItem, TVKPIs } from '@/hooks/useTVDashboardData'
import { TVQueueCard } from './TVQueueCard'

interface TVQueuePanelProps {
  queue: TVQueueItem[]
  kpis: TVKPIs
  isRealtime: boolean
  isTVMode: boolean
}

function formatElapsed(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function TVQueuePanel({ queue, kpis, isRealtime, isTVMode }: TVQueuePanelProps) {
  // Sort by SLA urgency: (elapsed / threshold) descending
  const sortedQueue = useMemo(() => {
    const now = Date.now()
    return [...queue].sort((a, b) => {
      const aElapsed = a.startedAt ? (now - new Date(a.startedAt).getTime()) / 60000 : 0
      const bElapsed = b.startedAt ? (now - new Date(b.startedAt).getTime()) / 60000 : 0
      const aRatio = aElapsed / (a.slaThresholdMinutes || 60)
      const bRatio = bElapsed / (b.slaThresholdMinutes || 60)
      return bRatio - aRatio
    })
  }, [queue])

  const needsAutoScroll = isTVMode && sortedQueue.length > 6

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{ width: '30%', borderRight: '1px solid rgba(69,229,229,0.07)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(69,229,229,0.1)', background: 'rgba(16,41,63,0.6)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Realtime indicator */}
          <span
            className={`w-2.5 h-2.5 rounded-full ${isRealtime ? 'animate-pulse' : ''}`}
            style={{
              background: isRealtime ? '#16A34A' : '#FFB800',
              boxShadow: isRealtime ? '0 0 8px rgba(22,163,74,0.6)' : '0 0 8px rgba(255,184,0,0.5)',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: isRealtime ? 'rgba(22,163,74,0.8)' : 'rgba(255,184,0,0.8)' }}>
            {isRealtime ? 'AO VIVO' : 'POLLING'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.5)' }}>
            Fila
          </span>
        </div>
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 20,
            fontWeight: 900,
            color: kpis.totalWaiting > 10 ? '#FFB800' : '#45E5E5',
            lineHeight: 1,
          }}
        >
          {kpis.totalWaiting}
        </span>
      </div>

      {/* Mini KPI strip */}
      <div
        className="grid grid-cols-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(69,229,229,0.07)' }}
      >
        {[
          {
            label: 'Espera Média',
            value: formatElapsed(kpis.avgWaitingMinutes),
            color: kpis.avgWaitingMinutes > 30 ? '#DC2626' : kpis.avgWaitingMinutes > 15 ? '#FFB800' : '#45E5E5',
          },
          {
            label: 'Maior Espera',
            value: formatElapsed(kpis.oldestWaitingMinutes),
            color: kpis.oldestWaitingMinutes > 60 ? '#DC2626' : kpis.oldestWaitingMinutes > 30 ? '#FFB800' : '#45E5E5',
          },
          {
            label: 'Abertos Total',
            value: String(kpis.totalOpen),
            color: '#A78BFA',
          },
        ].map((item, i) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center py-2.5 px-2"
            style={{ borderRight: i < 2 ? '1px solid rgba(69,229,229,0.06)' : 'none' }}
          >
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>
              {item.value}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Queue cards */}
      {sortedQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <span style={{ fontSize: 44 }}>✅</span>
          <span style={{ color: '#16A34A', fontSize: 15, fontWeight: 600 }}>Fila vazia</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Nenhum cliente aguardando</span>
        </div>
      ) : needsAutoScroll ? (
        /* TV mode auto-scroll: duplicate items for seamless loop */
        <div className="flex-1 overflow-hidden relative">
          <style>{`
            @keyframes tv-queue-scroll {
              0% { transform: translateY(0); }
              100% { transform: translateY(-50%); }
            }
          `}</style>
          <div
            className="flex flex-col gap-2 p-3"
            style={{
              animation: `tv-queue-scroll ${sortedQueue.length * 4}s linear infinite`,
            }}
          >
            {[...sortedQueue, ...sortedQueue].map((ticket, idx) => (
              <TVQueueCard key={`${ticket.id}-${idx}`} item={ticket} isTVMode={isTVMode} />
            ))}
          </div>
        </div>
      ) : (
        /* Desktop mode or short queue: normal scroll */
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {sortedQueue.map(ticket => (
            <TVQueueCard key={ticket.id} item={ticket} isTVMode={isTVMode} />
          ))}
        </div>
      )}
    </div>
  )
}
