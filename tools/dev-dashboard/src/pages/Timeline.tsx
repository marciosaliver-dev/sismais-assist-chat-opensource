import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { ActivityFeed } from '../components/ActivityFeed'

export function Timeline() {
  const [activities, setActivities] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [filterAgent, setFilterAgent] = useState('')

  const reload = () => {
    const params = filterAgent ? `?agent_id=${filterAgent}&limit=100` : '?limit=100'
    api<any[]>(`/activity${params}`).then(setActivities)
  }

  useEffect(() => {
    reload()
    api<any[]>('/agents').then(setAgents)
    return subscribe(() => reload())
  }, [filterAgent])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Timeline</h1>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white/80"
        >
          <option value="">Todos os agentes</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-surface-border p-4">
        {activities.length === 0 ? (
          <div className="text-center text-white/30 py-12">Nenhuma atividade registrada</div>
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </div>
  )
}
