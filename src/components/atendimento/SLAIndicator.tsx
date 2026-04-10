import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface SLAData {
  percentUsed: number
  status: 'ok' | 'warn' | 'critical'
  label: string
}

interface Props {
  sla: SLAData
  title?: string
  compact?: boolean
}

const statusColors: Record<string, { bar: string; text: string }> = {
  ok: { bar: 'bg-[var(--sla-ok)]', text: 'text-[var(--sla-ok)]' },
  warn: { bar: 'bg-[var(--sla-warn)]', text: 'text-[var(--sla-warn)]' },
  critical: { bar: 'bg-[var(--sla-crit)]', text: 'text-[var(--sla-crit)]' },
}

export function SLAIndicator({ sla, title, compact = false }: Props) {
  const colors = statusColors[sla.status]

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--gms-g500)]">{title}</span>
        <span className={cn('text-xs font-semibold', colors.text)}>{sla.label}</span>
        <div className="w-12 h-[3px] rounded-full bg-[var(--gms-g200)] overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', colors.bar)}
            style={{ width: `${Math.min(sla.percentUsed, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--gms-g500)]" />
          <span className="text-xs font-medium text-[var(--gms-g700)]">{title}</span>
        </div>
        <span className={cn('text-xs font-semibold', colors.text)}>{sla.label}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[var(--gms-g200)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', colors.bar)}
          style={{ width: `${Math.min(sla.percentUsed, 100)}%` }}
        />
      </div>
      <div className="text-right">
        <span className={cn('text-[9px] font-medium', colors.text)}>
          {sla.percentUsed}%
          {sla.status === 'critical' && ' — Estourado'}
        </span>
      </div>
    </div>
  )
}
