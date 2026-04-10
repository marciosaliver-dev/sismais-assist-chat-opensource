import { useState, useEffect } from 'react'
import logoWhite from '@/assets/logo-sismais-horizontal-white.png'
import { useTVDashboardData, type TVKPIs, type TVBoard } from '@/hooks/useTVDashboardData'
import { useTVAutoRotation } from '@/hooks/useTVAutoRotation'
import { TVScoreboard } from '@/components/tv-dashboard/TVScoreboard'
import { TVNavBar } from '@/components/tv-dashboard/TVNavBar'
import { TVQueuePanel } from '@/components/tv-dashboard/TVQueuePanel'
import { TVOverviewView } from '@/components/tv-dashboard/TVOverviewView'
import { TVPerformanceView } from '@/components/tv-dashboard/TVPerformanceView'
import { TVSLAView } from '@/components/tv-dashboard/TVSLAView'
import { TVAgentWorkloadView } from '@/components/tv-dashboard/TVAgentWorkloadView'
import { TVAIComparisonView } from '@/components/tv-dashboard/TVAIComparisonView'

const defaultKpis: TVKPIs = {
  totalWaiting: 0,
  totalInProgress: 0,
  totalOpen: 0,
  resolvedToday: 0,
  aiResolvedToday: 0,
  humanResolvedToday: 0,
  avgCsatToday: 0,
  aiCsatToday: 0,
  humanCsatToday: 0,
  avgWaitingMinutes: 0,
  oldestWaitingMinutes: 0,
  avgResolutionSecondsToday: 0,
  aiAvgResolutionSeconds: 0,
  humanAvgResolutionSeconds: 0,
  resolvedPerHour: 0,
  fcrRate: 0,
  escalationRate: 0,
  backlog: 0,
  oldestTicketMinutes: 0,
  avgMessagesPerConversation: 0,
}

export default function TVDashboard() {
  const [isTVMode, setIsTVMode] = useState(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'tv'
      || (window.innerWidth >= 1920 && !window.matchMedia('(pointer: fine)').matches)
  })
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)

  const viewCount = isTVMode ? 4 : 5
  const { currentView, setView, isPaused, progress } = useTVAutoRotation(viewCount)
  const { data, isLoading, isRealtime } = useTVDashboardData(selectedBoardId)

  // Timeout para não ficar preso no loading infinitamente
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  useEffect(() => {
    if (data) { setLoadingTimedOut(false); return }
    const timer = setTimeout(() => setLoadingTimedOut(true), 10000)
    return () => clearTimeout(timer)
  }, [data])

  const kpis = data?.kpis ?? defaultKpis
  const criticalCount = (data?.staleTickets ?? []).filter(t => t.staleMinutes > 60).length
  const hasCriticalAlert = criticalCount > 0

  const tickerTickets = [...(data?.staleTickets ?? [])]
    .sort((a, b) => b.staleMinutes - a.staleMinutes)
    .slice(0, 10)
  const tickerItems = [...tickerTickets, ...tickerTickets]

  if (!data && !loadingTimedOut) {
    return (
      <div className="flex items-center justify-center w-screen h-screen" style={{ background: '#10293F' }}>
        <div className="flex flex-col items-center gap-4">
          <img src={logoWhite} alt="Sismais" className="h-10 w-auto object-contain animate-pulse" />
          <span className="text-white/40 text-sm">Carregando dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden"
      style={{ background: '#10293F', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Scoreboard */}
      <TVScoreboard kpis={kpis} isTVMode={isTVMode} />

      {/* Nav bar */}
      <TVNavBar
        currentView={currentView}
        onSelectView={setView}
        isPaused={isPaused}
        progress={progress}
        hasCriticalAlert={hasCriticalAlert}
        queueCount={kpis.totalWaiting}
        isRealtime={isRealtime}
        isTVMode={isTVMode}
        onToggleMode={() => setIsTVMode(m => !m)}
        boards={data?.boards ?? []}
        selectedBoardId={selectedBoardId}
        onSelectBoard={setSelectedBoardId}
      />

      {/* Alert banner */}
      {hasCriticalAlert && (
        <div
          className="flex items-center gap-3 px-6 shrink-0"
          style={{
            height: 38,
            background: 'rgba(220,38,38,0.1)',
            borderBottom: '1px solid rgba(220,38,38,0.25)',
          }}
        >
          <span className="animate-pulse text-sm">⚠️</span>
          <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
            VIOLAÇÃO SLA —{' '}
            <span className="font-black">{criticalCount}</span>
            {' '}ticket{criticalCount > 1 ? 's' : ''} sem resposta há mais de 1h
          </span>
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded font-bold animate-pulse"
            style={{ background: 'rgba(220,38,38,0.2)', color: '#DC2626' }}
          >
            AÇÃO IMEDIATA
          </span>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Rotatable views — 70% */}
        <div
          key={currentView}
          className="tv-view-enter flex-1 min-h-0 overflow-hidden"
        >
          {currentView === 0 && (
            <TVOverviewView
              kpis={kpis}
              stageBreakdown={data?.stageBreakdown ?? []}
              ranking={data?.ranking ?? []}
              staleTickets={data?.staleTickets ?? []}
              isTVMode={isTVMode}
            />
          )}
          {currentView === 1 && (
            <TVAgentWorkloadView
              agents={data?.agents ?? []}
              kpis={kpis}
              isTVMode={isTVMode}
            />
          )}
          {currentView === 2 && (
            <TVSLAView
              staleTickets={data?.staleTickets ?? []}
              kpis={kpis}
              stageBreakdown={data?.stageBreakdown ?? []}
              isTVMode={isTVMode}
            />
          )}
          {currentView === 3 && (
            <TVPerformanceView
              agents={data?.ranking ?? []}
              isTVMode={isTVMode}
            />
          )}
          {!isTVMode && currentView === 4 && (
            <TVAIComparisonView
              kpis={kpis}
              agentRanking={data?.ranking ?? []}
            />
          )}
        </div>

        {/* Queue panel — 30% */}
        <TVQueuePanel
          queue={data?.queue ?? []}
          kpis={kpis}
          isRealtime={isRealtime}
          isTVMode={isTVMode}
        />
      </div>

      {/* Ticker */}
      <div
        className="shrink-0 overflow-hidden flex items-center"
        style={{
          height: 36,
          background: 'rgba(0,0,0,0.5)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
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
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: isCrit ? '#DC2626' : isWarn ? '#FFB800' : '#45E5E5' }}
                    />
                    <span className="text-white/30 text-xs font-mono">#{ticket.ticketNumber}</span>
                    <span className="text-white/60 text-xs truncate max-w-40">
                      {ticket.subject || ticket.customerName}
                    </span>
                    <span className="text-white/20 text-xs">({ticket.boardName})</span>
                    <span className="text-xs font-semibold" style={{ color: isCrit ? '#DC2626' : isWarn ? '#FFB800' : '#45E5E5' }}>
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
