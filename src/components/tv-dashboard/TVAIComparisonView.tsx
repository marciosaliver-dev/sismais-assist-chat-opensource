import type { TVKPIs, TVAgentRank } from '@/hooks/useTVDashboardData'

interface TVAIComparisonViewProps {
  kpis: TVKPIs
  agentRanking: TVAgentRank[]
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

interface ComparisonRowProps {
  label: string
  aiValue: string
  humanValue: string
  aiColor?: string
  humanColor?: string
  highlight?: 'ai' | 'human' | 'none'
}

function ComparisonRow({ label, aiValue, humanValue, aiColor = '#45E5E5', humanColor = '#A78BFA', highlight = 'none' }: ComparisonRowProps) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{label}</span>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center" style={{ width: 100 }}>
          <span style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 24,
            fontWeight: 800,
            color: highlight === 'ai' ? '#16A34A' : aiColor,
            lineHeight: 1,
          }}>
            {aiValue}
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 20 }}>vs</span>
        <div className="flex flex-col items-center" style={{ width: 100 }}>
          <span style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 24,
            fontWeight: 800,
            color: highlight === 'human' ? '#16A34A' : humanColor,
            lineHeight: 1,
          }}>
            {humanValue}
          </span>
        </div>
      </div>
    </div>
  )
}

export function TVAIComparisonView({ kpis, agentRanking }: TVAIComparisonViewProps) {
  const aiPct = kpis.resolvedToday > 0 ? Math.round((kpis.aiResolvedToday / kpis.resolvedToday) * 100) : 0
  const humanPct = 100 - aiPct

  const aiTmaFaster = kpis.aiAvgResolutionSeconds < kpis.humanAvgResolutionSeconds && kpis.aiAvgResolutionSeconds > 0
  const humanCsatHigher = kpis.humanCsatToday > kpis.aiCsatToday && kpis.humanCsatToday > 0

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 16, fontWeight: 700, color: '#fff' }}>
            IA vs Humano — Comparativo do Dia
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
          Atualizado em tempo real
        </span>
      </div>

      {/* Barra de proporção */}
      <div className="shrink-0 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(69,229,229,0.08)' }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 10, fontWeight: 700, color: '#45E5E5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🤖 IA — {kpis.aiResolvedToday} resolvidos ({aiPct}%)
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            👤 Humano — {kpis.humanResolvedToday} resolvidos ({humanPct}%)
          </span>
        </div>
        <div className="h-4 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${aiPct}%`,
              background: 'linear-gradient(90deg, #45E5E5, #2DD4BF)',
              borderRadius: aiPct >= 100 ? '9999px' : '9999px 0 0 9999px',
            }}
          />
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${humanPct}%`,
              background: 'linear-gradient(90deg, #A78BFA, #8B5CF6)',
              borderRadius: humanPct >= 100 ? '9999px' : '0 9999px 9999px 0',
            }}
          />
        </div>
      </div>

      {/* Grid: métricas comparativas */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Tabela comparativa */}
        <div className="flex flex-col flex-1 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(69,229,229,0.08)' }}>
          <div className="px-4 py-2.5 shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(69,229,229,0.08)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.35)' }}>
              Métricas Comparativas
            </span>
            <div className="flex items-center gap-4">
              <span style={{ fontSize: 9, fontWeight: 700, color: '#45E5E5' }}>🤖 IA</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#A78BFA' }}>👤 Humano</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 p-3 overflow-y-auto flex-1">
            <ComparisonRow
              label="Resolvidos Hoje"
              aiValue={String(kpis.aiResolvedToday)}
              humanValue={String(kpis.humanResolvedToday)}
              highlight={kpis.aiResolvedToday > kpis.humanResolvedToday ? 'ai' : kpis.humanResolvedToday > kpis.aiResolvedToday ? 'human' : 'none'}
            />
            <ComparisonRow
              label="TMA (Tempo Médio)"
              aiValue={formatSeconds(kpis.aiAvgResolutionSeconds)}
              humanValue={formatSeconds(kpis.humanAvgResolutionSeconds)}
              highlight={aiTmaFaster ? 'ai' : 'human'}
            />
            <ComparisonRow
              label="CSAT Médio"
              aiValue={kpis.aiCsatToday > 0 ? `${kpis.aiCsatToday}` : '—'}
              humanValue={kpis.humanCsatToday > 0 ? `${kpis.humanCsatToday}` : '—'}
              highlight={humanCsatHigher ? 'human' : kpis.aiCsatToday > kpis.humanCsatToday ? 'ai' : 'none'}
            />
            <ComparisonRow
              label="Taxa de Escalação"
              aiValue={`${kpis.escalationRate}%`}
              humanValue="—"
            />
            <ComparisonRow
              label="FCR (1º Contato)"
              aiValue={`${kpis.fcrRate}%`}
              humanValue="—"
            />
          </div>
        </div>

        {/* KPI Cards grandes */}
        <div className="flex flex-col gap-3 shrink-0" style={{ width: '30%' }}>
          {[
            {
              label: 'Velocidade IA',
              value: kpis.resolvedPerHour > 0 ? `${kpis.resolvedPerHour}/h` : '—',
              sub: 'resolvidos por hora',
              color: '#45E5E5',
              icon: '⚡',
            },
            {
              label: 'Backlog Total',
              value: String(kpis.backlog),
              sub: 'tickets em aberto',
              color: kpis.backlog > 50 ? '#DC2626' : kpis.backlog > 20 ? '#FFB800' : '#16A34A',
              icon: '📋',
            },
            {
              label: 'Msgs/Conversa',
              value: kpis.avgMessagesPerConversation > 0 ? `${kpis.avgMessagesPerConversation}` : '—',
              sub: 'média de mensagens',
              color: '#A78BFA',
              icon: '💬',
            },
            {
              label: 'Eficiência IA',
              value: `${aiPct}%`,
              sub: `${kpis.aiResolvedToday} de ${kpis.resolvedToday}`,
              color: aiPct >= 60 ? '#16A34A' : aiPct >= 30 ? '#FFB800' : '#DC2626',
              icon: '🎯',
            },
          ].map(card => (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-xl p-4 flex-1"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${card.color}20` }}
            >
              <span style={{ fontSize: 20 }}>{card.icon}</span>
              <div className="flex flex-col">
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.35)' }}>
                  {card.label}
                </span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 28, fontWeight: 900, color: card.color, lineHeight: 1, marginTop: 2 }}>
                  {card.value}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {card.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
