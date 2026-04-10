import { useEffect, useState } from 'react'
import { ListTodo, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { MetricCard } from '../components/MetricCard'
import { AgentCard } from '../components/AgentCard'
import { ActivityFeed } from '../components/ActivityFeed'

interface Metrics { total: number; pending: number; doneToday: number; approvalRate: number }

export function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, pending: 0, doneToday: 0, approvalRate: 0 })
  const [agents, setAgents] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])

  const reload = () => {
    api<Metrics>('/metrics').then(setMetrics)
    api<any[]>('/agents').then(setAgents)
    api<any[]>('/activity?limit=20').then(setActivities)
  }

  useEffect(() => {
    reload()
    return subscribe(() => reload())
  }, [])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Tasks" value={metrics.total} icon={<ListTodo size={20} />} />
        <MetricCard label="Pendentes Aprovação" value={metrics.pending} icon={<Clock size={20} />} />
        <MetricCard label="Concluídas Hoje" value={metrics.doneToday} icon={<CheckCircle2 size={20} />} />
        <MetricCard label="Taxa Conclusão" value={`${metrics.approvalRate}%`} icon={<TrendingUp size={20} />} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="text-sm font-medium text-white/60 mb-3">Agentes ({agents.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {agents.map(a => <AgentCard key={a.id} agent={a} />)}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-white/60 mb-3">Atividade Recente</h2>
          <div className="bg-surface rounded-xl border border-surface-border p-3 max-h-96 overflow-y-auto">
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  )
}
