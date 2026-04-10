import type { TVAgentWorkload, TVKPIs } from '@/hooks/useTVDashboardData'

interface TVAgentWorkloadViewProps {
  agents: TVAgentWorkload[]
  kpis: TVKPIs
  isTVMode: boolean
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

const AVATAR_COLORS = ['#45E5E5', '#A78BFA', '#F472B6', '#60A5FA', '#2DD4BF', '#FB923C', '#34D399', '#FBBF24']

function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = ((hash << 5) - hash) + c.charCodeAt(0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function workloadLevel(active: number): { label: string; color: string; bg: string } {
  if (active === 0) return { label: 'Livre', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' }
  if (active <= 3) return { label: 'Normal', color: '#45E5E5', bg: 'rgba(69,229,229,0.12)' }
  if (active <= 6) return { label: 'Alto', color: '#FFB800', bg: 'rgba(255,184,0,0.12)' }
  return { label: 'Sobrecarregado', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' }
}

export function TVAgentWorkloadView({ agents, kpis, isTVMode }: TVAgentWorkloadViewProps) {
  const onlineAgents = agents.filter(a => a.isOnline)
  const offlineAgents = agents.filter(a => !a.isOnline)
  const totalActive = agents.reduce((s, a) => s + a.activeTickets, 0)
  const totalResolvedByAgents = agents.reduce((s, a) => s + a.resolvedToday, 0)
  const totalSlaViolated = agents.reduce((s, a) => s + a.slaViolated, 0)
  const totalSlaAtRisk = agents.reduce((s, a) => s + a.slaAtRisk, 0)
  const maxActive = Math.max(...agents.map(a => a.activeTickets), 1)

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span style={{ fontSize: 56 }}>👥</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>Nenhum atendente cadastrado</span>
      </div>
    )
  }

  // TV mode: card-based layout, max 8 visible
  if (isTVMode) {
    const visibleAgents = onlineAgents.slice(0, 8)

    return (
      <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          {[
            { label: 'Online', value: onlineAgents.length, total: agents.length, color: '#16A34A' },
            { label: 'Ativos', value: totalActive, color: '#45E5E5' },
            { label: 'SLA Violado', value: totalSlaViolated, color: totalSlaViolated > 0 ? '#DC2626' : '#16A34A', pulse: totalSlaViolated > 0 },
            { label: 'Resolvidos', value: totalResolvedByAgents, color: '#16A34A' },
          ].map(card => (
            <div
              key={card.label}
              className={`rounded-xl p-3 flex flex-col ${'pulse' in card && card.pulse ? 'animate-pulse' : ''}`}
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${card.color}20` }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                {card.label}
              </span>
              <div className="flex items-baseline gap-1">
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 36, fontWeight: 900, color: card.color, lineHeight: 1 }}>
                  {card.value}
                </span>
                {'total' in card && (
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>/{card.total}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Agent cards grid */}
        <div className="grid grid-cols-4 gap-3 flex-1 min-h-0 overflow-hidden">
          {visibleAgents.map(agent => {
            const wl = workloadLevel(agent.activeTickets)
            const barPct = maxActive > 0 ? Math.round((agent.activeTickets / maxActive) * 100) : 0
            const avColor = avatarColor(agent.agentName)
            return (
              <div
                key={agent.agentId}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{
                  background: agent.activeTickets > 6 ? 'rgba(220,38,38,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${wl.color}20`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: avColor, color: '#10293F', fontSize: 13, fontWeight: 800 }}
                    >
                      {avatarInitials(agent.agentName)}
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
                      style={{
                        width: 12, height: 12,
                        borderColor: '#10293F',
                        background: agent.isOnline ? '#16A34A' : '#666666',
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span style={{ color: '#fff', fontSize: 20, fontWeight: 600 }} className="truncate block">
                      {agent.agentName.split(' ')[0]}
                    </span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{ fontSize: 10, fontWeight: 700, background: wl.bg, color: wl.color }}
                  >
                    {wl.label}
                  </span>
                </div>

                {/* Workload bar */}
                <div className="rounded-full" style={{ height: 14, background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barPct}%`,
                      background: wl.color,
                      transition: 'width 500ms ease',
                      boxShadow: agent.activeTickets > 6 ? `0 0 6px ${wl.color}60` : 'none',
                    }}
                  />
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 24, fontWeight: 900, color: '#45E5E5' }}>
                    {agent.activeTickets}
                  </span>
                  <div className="flex items-center gap-2">
                    {agent.slaViolated > 0 && (
                      <span className="px-1.5 py-0.5 rounded animate-pulse" style={{ fontSize: 14, fontWeight: 800, background: 'rgba(220,38,38,0.15)', color: '#DC2626' }}>
                        {agent.slaViolated} SLA
                      </span>
                    )}
                    {agent.slaAtRisk > 0 && !agent.slaViolated && (
                      <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 14, fontWeight: 800, background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
                        {agent.slaAtRisk} RISCO
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>
                      {agent.resolvedToday} resol.
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Desktop mode: tabular layout
  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3 shrink-0">
        {[
          { label: 'Atendentes Online', value: onlineAgents.length, total: agents.length, color: '#16A34A' },
          { label: 'Atendimentos Ativos', value: totalActive, color: '#45E5E5' },
          { label: 'SLA Violado', value: totalSlaViolated, color: totalSlaViolated > 0 ? '#DC2626' : '#16A34A', pulse: totalSlaViolated > 0 },
          { label: 'SLA em Risco', value: totalSlaAtRisk, color: totalSlaAtRisk > 0 ? '#FFB800' : '#16A34A' },
          { label: 'Resolvidos (Equipe)', value: totalResolvedByAgents, color: '#16A34A' },
          { label: 'Resolvidos/Hora', value: kpis.resolvedPerHour, color: '#FFB800' },
        ].map(card => (
          <div
            key={card.label}
            className={`rounded-xl p-3 flex flex-col ${'pulse' in card && card.pulse ? 'animate-pulse' : ''}`}
            style={{
              background: 'pulse' in card && card.pulse ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${card.color}20`,
            }}
          >
            <span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              {card.label}
            </span>
            <div className="flex items-baseline gap-1">
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 28, fontWeight: 900, color: card.color, lineHeight: 1 }}>
                {card.value}
              </span>
              {'total' in card && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>/{card.total}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(69,229,229,0.08)' }}>
        <div
          className="grid items-center px-4 py-2 shrink-0"
          style={{
            gridTemplateColumns: '44px 1fr 70px 70px 60px 55px 70px 50px 80px',
            background: 'rgba(16,41,63,0.8)',
            borderBottom: '1px solid rgba(69,229,229,0.1)',
          }}
        >
          {['', 'Atendente', 'Status', 'Ativos', 'Aguard.', 'Atend.', 'SLA', 'Resol.', 'TMA / CSAT'].map((h, i) => (
            <span key={i} style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
              color: 'rgba(255,255,255,0.45)',
              textAlign: i >= 3 ? 'center' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 36px)' }}>
          {onlineAgents.map(agent => (
            <AgentRow key={agent.agentId} agent={agent} maxActive={maxActive} />
          ))}

          {offlineAgents.length > 0 && (
            <>
              <div className="px-4 py-1.5" style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)' }}>
                  Offline ({offlineAgents.length})
                </span>
              </div>
              {offlineAgents.map(agent => (
                <AgentRow key={agent.agentId} agent={agent} maxActive={maxActive} isOffline />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentRow({ agent, maxActive, isOffline }: { agent: TVAgentWorkload; maxActive: number; isOffline?: boolean }) {
  const wl = workloadLevel(agent.activeTickets)
  const barPct = maxActive > 0 ? Math.round((agent.activeTickets / maxActive) * 100) : 0
  const avColor = avatarColor(agent.agentName)

  return (
    <div
      className="grid items-center px-4 py-2.5"
      style={{
        gridTemplateColumns: '44px 1fr 70px 70px 60px 55px 70px 50px 80px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        opacity: isOffline ? 0.45 : 1,
        background: agent.activeTickets > 6 ? 'rgba(220,38,38,0.04)' : 'transparent',
      }}
    >
      <div className="relative">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: avColor, color: '#10293F', fontSize: 10, fontWeight: 800 }}
        >
          {avatarInitials(agent.agentName)}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
          style={{ borderColor: '#10293F', background: agent.isOnline ? '#16A34A' : '#666666' }}
        />
      </div>

      <div className="min-w-0 pl-2">
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }} className="truncate block">
          {agent.agentName}
        </span>
        <div className="h-1 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.06)', maxWidth: 120 }}>
          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: wl.color, transition: 'width 500ms ease', boxShadow: agent.activeTickets > 6 ? `0 0 6px ${wl.color}60` : 'none' }} />
        </div>
      </div>

      <div className="flex justify-center">
        <span className="px-2 py-0.5 rounded-full text-center" style={{ fontSize: 8, fontWeight: 700, background: wl.bg, color: wl.color }}>
          {wl.label}
        </span>
      </div>

      <div className="flex justify-center">
        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 20, fontWeight: 900, lineHeight: 1, color: agent.activeTickets > 6 ? '#DC2626' : agent.activeTickets > 3 ? '#FFB800' : '#45E5E5' }}>
          {agent.activeTickets}
        </span>
      </div>

      <div className="flex justify-center">
        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 700, color: agent.waitingTickets > 0 ? '#45E5E5' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
          {agent.waitingTickets}
        </span>
      </div>

      <div className="flex justify-center">
        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 700, color: agent.inProgressTickets > 0 ? '#A78BFA' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
          {agent.inProgressTickets}
        </span>
      </div>

      <div className="flex justify-center">
        {agent.slaViolated > 0 ? (
          <span className="px-1.5 py-0.5 rounded text-center animate-pulse" style={{ fontSize: 8, fontWeight: 800, background: 'rgba(220,38,38,0.15)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}>
            {agent.slaViolated} VENCIDO
          </span>
        ) : agent.slaAtRisk > 0 ? (
          <span className="px-1.5 py-0.5 rounded text-center" style={{ fontSize: 8, fontWeight: 800, background: 'rgba(255,184,0,0.12)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.25)' }}>
            {agent.slaAtRisk} RISCO
          </span>
        ) : (
          <span style={{ fontSize: 9, color: '#16A34A', fontWeight: 700 }}>✓ OK</span>
        )}
      </div>

      <div className="flex justify-center">
        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 700, color: agent.resolvedToday > 0 ? '#16A34A' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
          {agent.resolvedToday}
        </span>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span style={{ fontSize: 11, fontWeight: 600, color: '#A78BFA' }}>
          {agent.avgResolutionSeconds > 0 ? formatSeconds(agent.avgResolutionSeconds) : '—'}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#FFB800' }}>
          {agent.avgCsat > 0 ? `${agent.avgCsat.toFixed(1)}★` : '—'}
        </span>
      </div>
    </div>
  )
}
