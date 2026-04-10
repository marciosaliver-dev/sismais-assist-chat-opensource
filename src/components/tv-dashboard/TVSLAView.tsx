import type { TVStaleTicket, TVKPIs, TVStageCount } from '@/hooks/useTVDashboardData'

interface TVSLAViewProps {
  staleTickets: TVStaleTicket[]
  kpis: TVKPIs
  stageBreakdown: TVStageCount[]
  isTVMode: boolean
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
  fontSize?: number
}

function DonutChart({ percent, size = 160, strokeWidth = 14, color = '#45E5E5', fontSize = 34 }: DonutProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={radius} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 8px ${color}80)` }}
      />
      <text x={size/2} y={size/2 - 8} textAnchor="middle" fill={color} fontSize={fontSize} fontWeight={900} fontFamily="Poppins, sans-serif" dominantBaseline="middle">
        {percent}%
      </text>
      <text x={size/2} y={size/2 + Math.round(fontSize * 0.8)} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="Inter, sans-serif">
        Compliance
      </text>
    </svg>
  )
}

export function TVSLAView({ staleTickets, kpis, stageBreakdown, isTVMode }: TVSLAViewProps) {
  const totalActive = kpis.totalWaiting + kpis.totalInProgress
  const violated = staleTickets.filter(t => t.staleMinutes > 60).length
  const atRisk = staleTickets.filter(t => t.staleMinutes > 30 && t.staleMinutes <= 60).length
  const ok = Math.max(0, totalActive - violated - atRisk)
  const compliancePct = totalActive > 0 ? Math.round((ok / totalActive) * 100) : 100
  const donutColor = compliancePct >= 90 ? '#16A34A' : compliancePct >= 70 ? '#FFB800' : '#DC2626'
  const violatedTickets = staleTickets.filter(t => t.staleMinutes > 60).sort((a, b) => b.staleMinutes - a.staleMinutes)
  const maxViolated = isTVMode ? 5 : violatedTickets.length
  const violatedFontSize = isTVMode ? 16 : 12

  return (
    <div className="flex h-full overflow-hidden p-4 gap-4">
      {/* Left: Donut + stats */}
      <div
        className="flex flex-col items-center shrink-0 rounded-2xl p-5 gap-4"
        style={{
          width: '38%',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.35)', alignSelf: 'flex-start' }}>
          Compliance SLA
        </span>

        <DonutChart
          percent={compliancePct}
          color={donutColor}
          size={isTVMode ? 250 : 170}
          fontSize={isTVMode ? 64 : 34}
          strokeWidth={isTVMode ? 20 : 14}
        />

        <div className="grid grid-cols-3 gap-2 w-full">
          {[
            { label: 'OK', value: ok, color: '#16A34A', bg: 'rgba(34,212,123,0.1)' },
            { label: 'Em Risco', value: atRisk, color: '#FFB800', bg: 'rgba(255,184,0,0.1)' },
            { label: 'Violado', value: violated, color: '#DC2626', bg: 'rgba(255,77,77,0.1)' },
          ].map(item => (
            <div
              key={item.label}
              className="flex flex-col items-center rounded-lg p-2"
              style={{ background: item.bg, border: `1px solid ${item.color}30` }}
            >
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 32 : 24, fontWeight: 900, color: item.color, lineHeight: 1 }}>
                {item.value}
              </span>
              <span style={{ fontSize: isTVMode ? 10 : 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 3 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div
          className="w-full rounded-xl p-3 flex flex-col items-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Ticket + Antigo
          </span>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: isTVMode ? 36 : 28,
              fontWeight: 900,
              lineHeight: 1,
              marginTop: 4,
              color: kpis.oldestTicketMinutes > 240 ? '#DC2626' : kpis.oldestTicketMinutes > 60 ? '#FFB800' : '#45E5E5',
              textShadow: kpis.oldestTicketMinutes > 60 ? '0 0 15px rgba(255,77,77,0.5)' : 'none',
            }}
          >
            {formatStale(kpis.oldestTicketMinutes)}
          </span>
        </div>

        {/* SLA per stage */}
        {stageBreakdown.length > 0 && (
          <div className="w-full">
            <span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>
              SLA por Etapa
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stageBreakdown.map(stage => {
                const pct = stage.count > 0 ? Math.round(((stage.count - stage.violatedCount) / stage.count) * 100) : 100
                return (
                  <div
                    key={stage.stageId}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${stage.stageColor}25` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.stageColor }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{stage.stageName}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 90 ? '#16A34A' : pct >= 70 ? '#FFB800' : '#DC2626' }}>
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right: Violated tickets */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.35)' }}>
            Tickets em Violação (&gt;1h parados)
          </span>
          {violatedTickets.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ background: 'rgba(255,77,77,0.15)', color: '#DC2626', border: '1px solid rgba(255,77,77,0.3)' }}
            >
              {violatedTickets.length} VIOLAÇÃO{violatedTickets.length > 1 ? 'ÕES' : ''}
            </span>
          )}
        </div>

        {violatedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <span style={{ fontSize: 56 }}>🎯</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: isTVMode ? 20 : 16 }}>SLA 100% cumprido</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto flex-1">
            {violatedTickets.slice(0, maxViolated).map(ticket => {
              const isCritical = ticket.staleMinutes > 240
              return (
                <div
                  key={ticket.id}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3 ${isCritical ? 'animate-pulse' : ''}`}
                  style={{
                    background: isCritical ? 'rgba(255,77,77,0.07)' : 'rgba(255,184,0,0.04)',
                    borderLeft: `3px solid ${isCritical ? '#DC2626' : '#FFB800'}`,
                    boxShadow: isCritical ? '0 0 15px rgba(255,77,77,0.08)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: isTVMode ? 28 : 24,
                      fontWeight: 900,
                      color: isCritical ? '#DC2626' : '#FFB800',
                      lineHeight: 1,
                      minWidth: 65,
                      textShadow: isCritical ? '0 0 12px rgba(255,77,77,0.5)' : 'none',
                    }}
                  >
                    {formatStale(ticket.staleMinutes)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: isTVMode ? 11 : 9, fontFamily: 'monospace' }}>#{ticket.ticketNumber}</span>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: isTVMode ? 11 : 9 }}>{ticket.boardName || '—'}</span>
                    </div>
                    <span style={{ color: '#fff', fontSize: violatedFontSize, fontWeight: 600 }} className="truncate block">
                      {ticket.subject || ticket.customerName || 'Sem título'}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span style={{ fontSize: isTVMode ? 13 : 11, fontWeight: 700, color: isCritical ? '#DC2626' : '#FFB800' }}>
                      {isCritical ? '🔴 CRÍTICO' : '🟡 ALERTA'}
                    </span>
                    <span style={{ fontSize: isTVMode ? 12 : 10, color: 'rgba(255,255,255,0.3)' }}>
                      {ticket.handlerType === 'ai' ? '🤖' : '👤'} {ticket.agentName || 'Sem agente'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
