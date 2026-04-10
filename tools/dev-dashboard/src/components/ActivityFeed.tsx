interface Activity {
  id: number
  agent_name: string | null
  agent_emoji: string | null
  action: string
  details: string | null
  created_at: string
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const actionLabels: Record<string, string> = {
  task_created: 'criou task',
  task_in_progress: 'iniciou',
  task_done: 'concluiu',
  task_review: 'enviou para review',
  approval_requested: 'pediu aprovação',
  approval_approved: 'aprovado',
  approval_rejected: 'rejeitado',
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="space-y-1">
      {activities.map(a => (
        <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 text-sm">
          <span className="text-xs text-white/30 w-8 shrink-0">{timeAgo(a.created_at)}</span>
          <span>{a.agent_emoji || '📋'}</span>
          <span className="text-white/70 truncate">
            {a.agent_name || 'Sistema'} {actionLabels[a.action] || a.action}
          </span>
        </div>
      ))}
    </div>
  )
}
