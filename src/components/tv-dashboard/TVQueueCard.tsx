import { useState, useEffect } from 'react'

interface TVQueueCardProps {
  item: {
    id: string
    ticketNumber: string | null
    customerName: string | null
    customerPhone: string | null
    subject: string | null
    status: string
    startedAt: string | null
    boardName: string | null
    boardColor: string
    agentName: string | null
    handlerType: string | null
    satisfactionScore: number | null
    slaThresholdMinutes: number
  }
  isTVMode: boolean
}

function getElapsedSeconds(startedAt: string | null): number {
  if (!startedAt) return 0
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

function formatElapsed(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getSeverityColor(elapsedMinutes: number): string {
  if (elapsedMinutes < 15) return '#45E5E5'
  if (elapsedMinutes < 30) return '#FFB800'
  return '#DC2626'
}

function isGrave(elapsedMinutes: number): boolean {
  return elapsedMinutes > 60
}

function getHumor(score: number | null): { emoji: string; label: string; bg: string } {
  if (score === null) return { emoji: '🤷', label: 'Sem dados', bg: 'rgba(102,102,102,0.3)' }
  if (score >= 4) return { emoji: '😊', label: 'Satisfeito', bg: 'rgba(22,163,74,0.25)' }
  if (score >= 3) return { emoji: '😐', label: 'Neutro', bg: 'rgba(102,102,102,0.3)' }
  if (score >= 2) return { emoji: '😤', label: 'Frustrado', bg: 'rgba(255,184,0,0.25)' }
  return { emoji: '🔥', label: 'Irritado', bg: 'rgba(220,38,38,0.3)' }
}

function getHandlerDisplay(handlerType: string | null, agentName: string | null): string {
  const name = agentName || ''
  if (handlerType === 'ai') return `🤖 ${name}`
  if (handlerType === 'human') return `👤 ${name}`
  if (handlerType === 'hybrid') return `🤖→👤 ${name}`
  return name
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    open: 'Aberto',
    in_progress: 'Em andamento',
    waiting: 'Aguardando',
    resolved: 'Resolvido',
    closed: 'Fechado',
  }
  return map[status] ?? status
}

export function TVQueueCard({ item, isTVMode }: TVQueueCardProps) {
  const [elapsed, setElapsed] = useState(() => getElapsedSeconds(item.startedAt))

  useEffect(() => {
    if (!item.startedAt) return
    const id = setInterval(() => {
      setElapsed(getElapsedSeconds(item.startedAt))
    }, 1000)
    return () => clearInterval(id)
  }, [item.startedAt])

  const elapsedMinutes = Math.floor(elapsed / 60)
  const severityColor = getSeverityColor(elapsedMinutes)
  const grave = isGrave(elapsedMinutes)
  const humor = getHumor(item.satisfactionScore)
  const slaPercent = Math.min(100, (elapsedMinutes / item.slaThresholdMinutes) * 100)

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderLeft: `4px solid ${severityColor}`,
    borderRadius: isTVMode ? '12px' : '8px',
    padding: isTVMode ? '12px 14px' : '9px 11px',
    minHeight: isTVMode ? '110px' : '85px',
    display: 'flex',
    flexDirection: 'column',
    gap: isTVMode ? '5px' : '3px',
    cursor: isTVMode ? 'default' : 'pointer',
    transition: 'background 150ms, transform 150ms',
    position: 'relative',
    overflow: 'hidden',
    animation: grave ? 'tvPulse 1.5s ease-in-out infinite' : undefined,
  }

  const primaryText: React.CSSProperties = {
    color: '#fff',
    fontSize: isTVMode ? '15px' : '13px',
    fontWeight: 600,
    lineHeight: 1.3,
  }

  const secondaryText: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)',
    fontSize: isTVMode ? '13px' : '11px',
    lineHeight: 1.3,
  }

  return (
    <>
      <style>{`
        @keyframes tvPulse {
          0%, 100% { border-left-color: #DC2626; }
          50% { border-left-color: rgba(220,38,38,0.3); }
        }
        .tv-queue-card:hover {
          background: rgba(255,255,255,0.07) !important;
          transform: translateY(-1px);
        }
      `}</style>

      <div className="tv-queue-card" style={cardStyle}>
        {/* Row 1: ticket number + status + timer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.ticketNumber && (
              <span style={{ ...secondaryText, fontFamily: 'monospace', fontSize: isTVMode ? '13px' : '11px' }}>
                #{item.ticketNumber}
              </span>
            )}
            <span style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: isTVMode ? '11px' : '10px',
              fontWeight: 500,
              padding: '1px 7px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              {getStatusLabel(item.status)}
            </span>
          </div>
          <span style={{
            color: severityColor,
            fontSize: isTVMode ? '14px' : '12px',
            fontWeight: 700,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}>
            ⏱ {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Row 2: customer name + phone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {item.customerName && (
            <span style={{ ...primaryText, fontSize: isTVMode ? '15px' : '13px' }}>
              👤 {item.customerName}
            </span>
          )}
          {item.customerPhone && (
            <span style={{ ...secondaryText }}>
              📱 {item.customerPhone}
            </span>
          )}
        </div>

        {/* Row 3: subject */}
        {item.subject && (
          <div style={{
            ...secondaryText,
            color: 'rgba(255,255,255,0.65)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            📋 {item.subject}
          </div>
        )}

        {/* Row 4: board badge + Row 5: humor + handler */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
          {item.boardName && (
            <span style={{
              background: item.boardColor || 'rgba(69,229,229,0.2)',
              color: '#fff',
              fontSize: isTVMode ? '11px' : '10px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.15)',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              🏷 {item.boardName}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{
              background: humor.bg,
              color: '#fff',
              fontSize: isTVMode ? '11px' : '10px',
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: '9999px',
            }}>
              {humor.emoji} {humor.label}
            </span>
            {(item.handlerType || item.agentName) && (
              <span style={{ ...secondaryText, fontSize: isTVMode ? '12px' : '10px', whiteSpace: 'nowrap' }}>
                {getHandlerDisplay(item.handlerType, item.agentName)}
              </span>
            )}
          </div>
        </div>

        {/* Row 6: SLA bar */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isTVMode ? '4px' : '3px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${slaPercent}%`,
            height: '100%',
            background: severityColor,
            borderRadius: '0 2px 2px 0',
            transition: 'width 1s linear',
          }} />
        </div>
      </div>
    </>
  )
}
