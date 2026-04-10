import { cn } from '@/lib/utils'
import type { AtendimentoPriority } from './types'

interface Props {
  priority: AtendimentoPriority
  size?: 'sm' | 'md'
}

const config: Record<AtendimentoPriority, { label: string; classes: string }> = {
  critica: { label: 'Crítica', classes: 'bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30' },
  urgente: { label: 'Urgente', classes: 'bg-[var(--gms-err-bg)] text-[var(--gms-err)] border-[var(--gms-err)]/30' },
  alta: { label: 'Alta', classes: 'bg-[var(--gms-err-bg)] text-[var(--gms-err)] border-[var(--gms-err)]/30' },
  media: { label: 'Média', classes: 'bg-[var(--gms-yellow-bg)] text-[var(--gms-warn)] border-[var(--gms-yellow)]/30' },
  baixa: { label: 'Baixa', classes: 'bg-[var(--gms-ok-bg)] text-[var(--gms-ok)] border-[var(--gms-ok)]/30' },
}

export function PriorityBadge({ priority, size = 'sm' }: Props) {
  const c = config[priority]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        c.classes,
      )}
    >
      {c.label}
    </span>
  )
}
