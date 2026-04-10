import type { TVKPIs, TVStageCount, TVAgentRank, TVStaleTicket } from '@/hooks/useTVDashboardData'

interface TVOverviewViewProps {
  kpis: TVKPIs
  stageBreakdown: TVStageCount[]
  ranking: TVAgentRank[]
  staleTickets: TVStaleTicket[]
  isTVMode: boolean
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatStale(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const AVATAR_COLORS = ['#45E5E5', '#A78BFA', '#F472B6', '#60A5FA', '#2DD4BF', '#FB923C']
function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = ((hash << 5) - hash) + c.charCodeAt(0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function TVOverviewView({ kpis, stageBreakdown, ranking, staleTickets, isTVMode }: TVOverviewViewProps) {
  const violated = staleTickets.filter(t => t.staleMinutes > 60).length
  const totalActive = kpis.totalWaiting + kpis.totalInProgress
  const compliancePct = totalActive > 0 ? Math.round(((totalActive - violated) / totalActive) * 100) : 100

  const kpiSize = isTVMode ? 48 : 36
  const topN = isTVMode ? 3 : 5

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">

      {/* ROW 1: KPI cards */}
      <div className={`grid ${isTVMode ? 'grid-cols-3 gap-4' : 'grid-cols-6 gap-3'} shrink-0`}>
        {[
          {
            label: 'Na Fila',
            value: String(kpis.totalWaiting),
            sub: 'aguardando',
            color: kpis.totalWaiting > 10 ? '#FFB800' : kpis.totalWaiting > 0 ? '#45E5E5' : '#16A34A',
            alert: kpis.totalWaiting > 10,
          },
          {
            label: 'Em Atendimento',
            value: String(kpis.totalInProgress),
            sub: `${kpis.totalOpen} abertos total`,
            color: '#A78BFA',
          },
          {
            label: 'Resolvidos Hoje',
            value: String(kpis.resolvedToday),
            sub: `${kpis.resolvedPerHour}/h · ${kpis.aiResolvedToday} por IA`,
            color: '#16A34A',
          },
          {
            label: 'TMA',
            value: formatSeconds(kpis.avgResolutionSecondsToday),
            sub: 'tempo médio atendimento',
            color: '#A78BFA',
          },
          {
            label: 'FCR',
            value: `${kpis.fcrRate}%`,
            sub: 'resolução 1º contato',
            color: kpis.fcrRate >= 80 ? '#16A34A' : kpis.fcrRate >= 60 ? '#FFB800' : '#DC2626',
          },
          {
            label: 'SLA Compliance',
            value: `${compliancePct}%`,
            sub: violated > 0 ? `${violated} violações` : 'sem violações',
            color: compliancePct >= 90 ? '#16A34A' : compliancePct >= 70 ? '#FFB800' : '#DC2626',
            alert: violated > 0,
          },
        ].slice(0, isTVMode ? 3 : 6).map(card => (
          <div
            key={card.label}
            className={`rounded-xl p-4 flex flex-col justify-between ${card.alert ? 'animate-pulse' : ''}`}
            style={{
              background: card.alert ? `${card.color}10` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${card.color}25`,
              minHeight: isTVMode ? 120 : 100,
            }}
          >
            <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.4)' }}>
              {card.label}
            </span>
            <span style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: kpiSize,
              fontWeight: 900,
              color: card.color,
              lineHeight: 1,
              marginTop: 8,
            }}>
              {card.value}
            </span>
            <span style={{ fontSize: isTVMode ? 11 : 9, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              {card.sub}
            </span>
          </div>
        ))}

        {/* TV mode: show remaining 3 KPIs in second row */}
        {isTVMode && [
          {
            label: 'TMA',
            value: formatSeconds(kpis.avgResolutionSecondsToday),
            sub: 'tempo médio atendimento',
            color: '#A78BFA',
          },
          {
            label: 'FCR',
            value: `${kpis.fcrRate}%`,
            sub: 'resolução 1º contato',
            color: kpis.fcrRate >= 80 ? '#16A34A' : kpis.fcrRate >= 60 ? '#FFB800' : '#DC2626',
          },
          {
            label: 'SLA Compliance',
            value: `${compliancePct}%`,
            sub: violated > 0 ? `${violated} violações` : 'sem violações',
            color: compliancePct >= 90 ? '#16A34A' : compliancePct >= 70 ? '#FFB800' : '#DC2626',
            alert: violated > 0,
          },
        ].map(card => (
          <div
            key={card.label}
            className={`rounded-xl p-4 flex flex-col justify-between ${card.alert ? 'animate-pulse' : ''}`}
            style={{
              background: card.alert ? `${card.color}10` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${card.color}25`,
              minHeight: 120,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.4)' }}>
              {card.label}
            </span>
            <span style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: kpiSize,
              fontWeight: 900,
              color: card.color,
              lineHeight: 1,
              marginTop: 8,
            }}>
              {card.value}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              {card.sub}
            </span>
          </div>
        ))}
      </div>

      {/* ROW 2: Stage breakdown + Top Performers */}
      <div className={`flex gap-4 flex-1 min-h-0 overflow-hidden ${isTVMode ? 'flex-col' : ''}`}>
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

          {/* Tickets por Etapa */}
          <div
            className="flex flex-col rounded-xl overflow-hidden flex-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(69,229,229,0.08)' }}
          >
            <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(69,229,229,0.08)' }}>
              <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.35)' }}>
                Por Etapa
              </span>
            </div>
            <div className="flex flex-col gap-2.5 p-3 overflow-y-auto flex-1">
              {stageBreakdown.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Sem tickets</span>
              ) : (
                stageBreakdown.map(stage => {
                  const hasAlert = stage.violatedCount > 0
                  const maxCount = Math.max(...stageBreakdown.map(s => s.count), 1)
                  const pct = Math.round((stage.count / maxCount) * 100)
                  const barH = isTVMode ? 'h-2' : 'h-1'
                  return (
                    <div key={stage.stageId} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.stageColor }} />
                          <span style={{ fontSize: isTVMode ? 14 : 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }} className="truncate">
                            {stage.stageName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasAlert && (
                            <span className="px-1 py-0.5 rounded" style={{ fontSize: isTVMode ? 9 : 7, fontWeight: 800, background: 'rgba(220,38,38,0.15)', color: '#DC2626' }}>
                              {stage.violatedCount} SLA
                            </span>
                          )}
                          {stage.atRiskCount > 0 && (
                            <span className="px-1 py-0.5 rounded" style={{ fontSize: isTVMode ? 9 : 7, fontWeight: 800, background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
                              {stage.atRiskCount} RISCO
                            </span>
                          )}
                          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 20 : 16, fontWeight: 900, color: hasAlert ? '#DC2626' : '#fff', lineHeight: 1 }}>
                            {stage.count}
                          </span>
                        </div>
                      </div>
                      <div className={`${barH} rounded-full`} style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hasAlert ? '#DC2626' : stage.stageColor, transition: 'width 500ms ease' }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Top Performers */}
          <div
            className="flex flex-col rounded-xl overflow-hidden"
            style={{ width: isTVMode ? '50%' : '35%', flexShrink: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(69,229,229,0.08)' }}
          >
            <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(69,229,229,0.08)' }}>
              <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.35)' }}>
                Top Performers Hoje
              </span>
            </div>
            <div className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto">
              {ranking.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Nenhum atendimento hoje</span>
              ) : (
                ranking.slice(0, topN).map((agent, i) => {
                  const medals = ['🥇', '🥈', '🥉']
                  const avColor = avatarColor(agent.agentName)
                  return (
                    <div
                      key={agent.agentId}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                      style={{
                        background: i === 0 ? 'rgba(69,229,229,0.07)' : 'rgba(255,255,255,0.02)',
                        border: i === 0 ? '1px solid rgba(69,229,229,0.15)' : '1px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: isTVMode ? 20 : 16, width: 22, textAlign: 'center', flexShrink: 0 }}>
                        {i < 3 ? medals[i] : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
                      </span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: avColor, color: '#10293F', fontSize: 10, fontWeight: 800 }}
                      >
                        {agent.agentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span style={{ fontSize: isTVMode ? 14 : 12, fontWeight: 600, color: '#fff' }} className="truncate block">
                          {agent.agentName.split(' ')[0]}
                        </span>
                        <span style={{ fontSize: isTVMode ? 11 : 9, color: 'rgba(255,255,255,0.3)' }}>
                          TMA: {formatSeconds(agent.avgResolutionSeconds)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 22 : 18, fontWeight: 800, color: '#45E5E5', lineHeight: 1 }}>
                          {agent.resolved}
                        </span>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>resol.</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: Mini KPI strip */}
      <div className="flex gap-3 shrink-0">
        {[
          { label: 'CSAT Médio', value: kpis.avgCsatToday > 0 ? `${kpis.avgCsatToday.toFixed(1)}` : '—', icon: '⭐', color: '#FFB800' },
          { label: 'Espera Média', value: formatStale(kpis.avgWaitingMinutes), icon: '⏱', color: kpis.avgWaitingMinutes > 30 ? '#DC2626' : kpis.avgWaitingMinutes > 15 ? '#FFB800' : '#45E5E5' },
          { label: 'Escalação', value: `${kpis.escalationRate}%`, icon: '🔄', color: kpis.escalationRate > 40 ? '#DC2626' : kpis.escalationRate > 20 ? '#FFB800' : '#16A34A' },
          { label: 'Backlog', value: String(kpis.backlog), icon: '📋', color: kpis.backlog > 50 ? '#DC2626' : kpis.backlog > 20 ? '#FFB800' : '#45E5E5' },
          { label: 'Msgs/Conversa', value: kpis.avgMessagesPerConversation > 0 ? `${kpis.avgMessagesPerConversation}` : '—', icon: '💬', color: '#A78BFA' },
          { label: 'Ticket + Antigo', value: formatStale(kpis.oldestTicketMinutes), icon: '📌', color: kpis.oldestTicketMinutes > 240 ? '#DC2626' : kpis.oldestTicketMinutes > 60 ? '#FFB800' : '#45E5E5' },
        ].map(item => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg px-4 py-2 flex-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.color}15` }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <div className="flex flex-col">
              <span style={{ fontSize: isTVMode ? 10 : 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'rgba(255,255,255,0.35)' }}>
                {item.label}
              </span>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 22 : 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
