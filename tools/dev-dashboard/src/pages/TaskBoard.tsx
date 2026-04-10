import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { TaskCard } from '../components/TaskCard'

const columns = [
  { key: 'todo', label: 'A Fazer', color: 'border-t-cyan' },
  { key: 'in_progress', label: 'Em Progresso', color: 'border-t-navy-hover' },
  { key: 'review', label: 'Review', color: 'border-t-yellow' },
  { key: 'done', label: 'Concluído', color: 'border-t-green-500' },
]

export function TaskBoard() {
  const [tasks, setTasks] = useState<any[]>([])
  const [filterAgent, setFilterAgent] = useState('')
  const [agents, setAgents] = useState<any[]>([])

  const reload = () => {
    const params = filterAgent ? `?agent_id=${filterAgent}` : ''
    api<any[]>(`/tasks${params}`).then(setTasks)
  }

  useEffect(() => {
    reload()
    api<any[]>('/agents').then(setAgents)
    return subscribe(() => reload())
  }, [filterAgent])

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-white">Task Board</h1>
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

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key)
          return (
            <div key={col.key} className={`flex flex-col rounded-xl bg-bg border border-surface-border border-t-2 ${col.color}`}>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">{col.label}</span>
                <span className="text-xs text-white/30 bg-white/5 px-1.5 rounded">{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colTasks.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
