import type { TVAgentRank } from '@/hooks/useTVDashboardData'

interface TVPerformanceViewProps {
  agents: TVAgentRank[]
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

const AVATAR_COLORS = ['#45E5E5','#A78BFA','#F472B6','#60A5FA','#2DD4BF','#FB923C','#34D399','#FBBF24']
function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = ((hash << 5) - hash) + c.charCodeAt(0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const medalEmojis = ['🥇', '🥈', '🥉']

export function TVPerformanceView({ agents, isTVMode }: TVPerformanceViewProps) {
  const sorted = [...agents].sort((a, b) => b.resolved - a.resolved)
  const maxVisible = isTVMode ? 5 : sorted.length
  const visible = sorted.slice(0, maxVisible)
  const top = visible[0]
  const rest = visible.slice(1)
  const maxResolved = top?.resolved || 1

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span style={{ fontSize: 56 }}>📊</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>Nenhum atendimento finalizado hoje</span>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Os dados aparecerão conforme os tickets forem resolvidos</span>
      </div>
    )
  }

  const avColor = avatarColor(top.agentName)
  const nameSize = isTVMode ? 32 : 22
  const resolvedSize = isTVMode ? 64 : 22
  const medalSize = isTVMode ? 48 : 22
  const barHeight = isTVMode ? 'h-3.5' : 'h-1.5'

  return (
    <div className="flex h-full overflow-hidden p-4 gap-4">
      {/* Top performer spotlight */}
      <div
        className="flex flex-col shrink-0 rounded-2xl p-6 relative overflow-hidden"
        style={{
          width: '45%',
          background: 'linear-gradient(145deg, rgba(69,229,229,0.06) 0%, rgba(16,41,63,0.95) 60%)',
          border: '1px solid rgba(69,229,229,0.2)',
          boxShadow: '0 0 40px rgba(69,229,229,0.07)',
        }}
      >
        {/* Glow */}
        <div
          className="absolute -top-8 -right-8 w-36 h-36 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(69,229,229,0.15) 0%, transparent 70%)' }}
        />

        <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#45E5E5', opacity: 0.8, marginBottom: 16 }}>
          🏆 Top Performer Hoje
        </span>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="rounded-2xl flex items-center justify-center shrink-0 relative"
            style={{ width: isTVMode ? 80 : 64, height: isTVMode ? 80 : 64, background: avColor, boxShadow: `0 0 20px ${avColor}50` }}
          >
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 32 : 24, fontWeight: 800, color: '#10293F' }}>
              {top.agentName.charAt(0).toUpperCase()}
            </span>
            <div
              className="absolute -bottom-1.5 -right-1.5 rounded-full flex items-center justify-center"
              style={{ width: isTVMode ? 32 : 24, height: isTVMode ? 32 : 24, background: '#FFB800', fontSize: isTVMode ? medalSize * 0.4 : 14 }}
            >
              ⭐
            </div>
          </div>
          <div>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: nameSize, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
              {top.agentName}
            </h2>
            <span style={{ fontSize: isTVMode ? 14 : 11, color: 'rgba(255,255,255,0.4)' }}>Agente de Suporte</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Resolvidos', value: String(top.resolved), color: '#45E5E5', fontSize: resolvedSize },
            { label: 'TMA', value: formatSeconds(top.avgResolutionSeconds), color: '#A78BFA', fontSize: isTVMode ? 28 : 22 },
            { label: 'CSAT', value: top.avgCsat > 0 ? `${top.avgCsat.toFixed(1)}★` : '—', color: '#FFB800', fontSize: isTVMode ? 28 : 22 },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-xl py-3"
              style={{ background: 'rgba(0,0,0,0.3)', borderBottom: `2px solid ${stat.color}` }}
            >
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: stat.fontSize, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </span>
              <span style={{ fontSize: isTVMode ? 10 : 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 4 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking list */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 overflow-y-auto">
        <span style={{ fontSize: isTVMode ? 11 : 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.35)' }}>
          Ranking Geral — Hoje
        </span>

        {/* #1 in ranking */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 shrink-0"
          style={{ background: 'rgba(69,229,229,0.07)', border: '1px solid rgba(69,229,229,0.18)' }}
        >
          <span style={{ fontSize: isTVMode ? medalSize : 22, width: 28 }}>🥇</span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: avatarColor(top.agentName), color: '#10293F', fontSize: 11, fontWeight: 800 }}
          >
            {top.agentName.charAt(0).toUpperCase()}
          </div>
          <span style={{ color: '#fff', fontWeight: 600, flex: 1, fontSize: isTVMode ? 16 : 13 }} className="truncate">{top.agentName}</span>
          <div className="flex-1 mx-3">
            <div className={`${barHeight} rounded-full`} style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full" style={{ width: '100%', background: '#45E5E5', boxShadow: '0 0 6px rgba(69,229,229,0.5)' }} />
            </div>
          </div>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 24 : 20, fontWeight: 800, color: '#45E5E5' }}>{top.resolved}</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, width: 30 }}>resol.</span>
          <span style={{ fontSize: isTVMode ? 14 : 12, fontWeight: 700, color: '#FFB800', width: 36, textAlign: 'right' }}>
            {top.avgCsat > 0 ? `${top.avgCsat.toFixed(1)}★` : '—'}
          </span>
        </div>

        {rest.map((agent, i) => {
          const pct = Math.round((agent.resolved / maxResolved) * 100)
          const medal = i < 2 ? medalEmojis[i + 1] : null
          const avC = avatarColor(agent.agentName)
          return (
            <div
              key={agent.agentId}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span style={{ width: 28, textAlign: 'center', fontSize: medal ? (isTVMode ? medalSize * 0.6 : 18) : 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                {medal || `${i + 2}`}
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: avC, color: '#10293F', fontSize: 10, fontWeight: 800 }}
              >
                {agent.agentName.charAt(0).toUpperCase()}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500, flex: 1, fontSize: isTVMode ? 14 : 12 }} className="truncate">{agent.agentName}</span>
              <div className="flex-1 mx-3">
                <div className={`${barHeight} rounded-full`} style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: avC, opacity: 0.7, transition: 'width 500ms ease' }}
                  />
                </div>
              </div>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: isTVMode ? 20 : 16, fontWeight: 800, color: '#45E5E5', minWidth: 24, textAlign: 'right' }}>
                {agent.resolved}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, width: 30 }}>resol.</span>
              <span style={{ fontSize: isTVMode ? 13 : 11, fontWeight: 600, color: '#FFB800', width: 36, textAlign: 'right' }}>
                {agent.avgCsat > 0 ? `${agent.avgCsat.toFixed(1)}★` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
