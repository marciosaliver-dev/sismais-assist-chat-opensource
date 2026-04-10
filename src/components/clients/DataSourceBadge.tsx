import { cn } from '@/lib/utils'
import { Database, Cloud, MessageSquare, Headphones } from 'lucide-react'

interface DataSourceBadgeProps {
  sources: Array<{
    source_system: string
    sync_status: string
    last_synced_at: string | null
  }>
  className?: string
}

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Database }> = {
  sismais_gl: { label: 'GL', icon: Database },
  sismais_admin: { label: 'Admin', icon: Cloud },
  helpdesk: { label: 'Helpdesk', icon: Headphones },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare },
}

export function DataSourceBadge({ sources, className }: DataSourceBadgeProps) {
  const sourceMap = new Map(sources.map(s => [s.source_system, s]))

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
        const source = sourceMap.get(key)
        const synced = source?.sync_status === 'synced'
        const exists = !!source
        const Icon = config.icon

        return (
          <span
            key={key}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
              exists && synced
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40'
                : exists
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40'
                  : 'bg-muted text-muted-foreground border-border',
            )}
            title={
              exists
                ? `${config.label}: ${synced ? 'Sincronizado' : 'Desatualizado'}`
                : `${config.label}: Sem dados`
            }
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        )
      })}
    </div>
  )
}
