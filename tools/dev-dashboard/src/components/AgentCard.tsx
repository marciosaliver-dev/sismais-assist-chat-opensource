interface Agent {
  id: string
  name: string
  division: string
  emoji: string
  status: 'idle' | 'working' | 'blocked'
}

const statusColors = {
  idle: 'bg-white/10 text-white/40',
  working: 'bg-cyan/10 text-cyan border-cyan/30',
  blocked: 'bg-yellow/10 text-yellow border-yellow/30'
}

const statusLabels = { idle: 'Idle', working: 'Ativo', blocked: 'Bloqueado' }

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`rounded-lg border p-3 transition-all ${statusColors[agent.status]} border-surface-border`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{agent.emoji}</span>
        <span className="text-sm font-medium text-white truncate">{agent.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{agent.division}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColors[agent.status]}`}>
          {statusLabels[agent.status]}
        </span>
      </div>
    </div>
  )
}
