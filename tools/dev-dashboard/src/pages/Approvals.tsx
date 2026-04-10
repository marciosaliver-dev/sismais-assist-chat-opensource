import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { subscribe } from '../lib/ws'
import { ApprovalCard } from '../components/ApprovalCard'

export function Approvals() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const reload = () => {
    const params = filter === 'pending' ? '?status=pending' : ''
    api<any[]>(`/approvals${params}`).then(setApprovals)
  }

  useEffect(() => {
    reload()
    return subscribe(() => reload())
  }, [filter])

  const pendingCount = approvals.filter(a => a.status === 'pending').length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">
          Aprovações
          {pendingCount > 0 && (
            <span className="ml-2 text-sm bg-yellow/20 text-yellow px-2 py-0.5 rounded-full">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
          )}
        </h1>
        <div className="flex gap-1 bg-surface rounded-lg p-0.5">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded text-sm transition-colors ${filter === 'pending' ? 'bg-cyan/10 text-cyan' : 'text-white/50'}`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${filter === 'all' ? 'bg-cyan/10 text-cyan' : 'text-white/50'}`}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <div className="text-center text-white/30 py-12">Nenhuma aprovação {filter === 'pending' ? 'pendente' : ''}</div>
        ) : (
          approvals.map(a => <ApprovalCard key={a.id} approval={a} onResolved={reload} />)
        )}
      </div>
    </div>
  )
}
