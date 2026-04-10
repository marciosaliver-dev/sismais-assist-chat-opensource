interface Task {
  id: number
  agent_id: string | null
  title: string
  status: string
  priority: string
  type: string | null
  created_at: string
}

const priorityBorder = {
  low: 'border-l-green-500',
  normal: 'border-l-cyan',
  high: 'border-l-yellow',
  critical: 'border-l-red-500'
}

const typeLabel: Record<string, string> = {
  plan: '📋 Plano', code: '💻 Código', review: '👁 Review', fix: '🔧 Fix', research: '🔍 Pesquisa'
}

export function TaskCard({ task }: { task: Task }) {
  return (
    <div className={`bg-surface rounded-lg border border-surface-border p-3 border-l-2 ${priorityBorder[task.priority as keyof typeof priorityBorder] || 'border-l-cyan'} cursor-pointer hover:bg-surface-light transition-colors`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/30 font-mono">#{task.id}</span>
        {task.type && <span className="text-xs text-white/50">{typeLabel[task.type] || task.type}</span>}
      </div>
      <div className="text-sm font-medium text-white mb-2 leading-snug">{task.title}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{task.agent_id || '—'}</span>
        <span className="text-xs text-white/30">
          {new Date(task.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
