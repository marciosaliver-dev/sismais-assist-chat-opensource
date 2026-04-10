import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface TicketSeparatorProps {
  ticketNumber: number
  startedAt: string | null
  status: string | null
  isCurrent?: boolean
}

const statusLabel: Record<string, { label: string; className: string }> = {
  finalizado: { label: 'Finalizado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  aguardando: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
}

export function TicketSeparator({ ticketNumber, startedAt, status, isCurrent }: TicketSeparatorProps) {
  const st = statusLabel[status || ''] || { label: status || '', className: 'bg-muted text-muted-foreground' }
  const dateStr = startedAt ? format(new Date(startedAt), 'dd/MM/yyyy') : ''

  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border",
        isCurrent
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground"
      )}>
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="font-bold">#{ticketNumber}</span>
        {dateStr && <span className="opacity-70">• {dateStr}</span>}
        {!isCurrent && status && (
          <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", st.className)}>{st.label}</span>
        )}
        {isCurrent && <span className="text-xs font-bold">(atual)</span>}
      </div>
      <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
    </div>
  )
}
