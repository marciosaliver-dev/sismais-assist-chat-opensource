import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { useSLAConfig } from '@/hooks/useSLAConfig'
import { useWaitTimer } from '@/hooks/useWaitTimer'
import { useBusinessHours } from '@/hooks/useBusinessHours'
import { calculateBusinessSeconds } from '@/utils/calculateBusinessMinutes'
import type { Tables } from '@/integrations/supabase/types'

interface InlineSLAProps {
  conversation: Tables<'ai_conversations'>
}

export function InlineSLA({ conversation }: InlineSLAProps) {
  const { data: slaConfig } = useSLAConfig()
  const boardId = (conversation as any).kanban_board_id || null
  const { data: businessHours = [] } = useBusinessHours(boardId)
  const isStillInQueue = !!conversation.queue_entered_at && !conversation.first_human_response_at
  // Keep the timer ticking for visual updates
  useWaitTimer(isStillInQueue ? conversation.queue_entered_at : null, 1000)

  const slaCfg = slaConfig?.get(conversation.priority || 'medium')

  // Calculate elapsed using business hours when available
  const slaElapsedSeconds = useMemo(() => {
    if (!slaCfg) return 0
    if (!isStillInQueue) {
      return conversation.first_human_response_seconds || 0
    }
    if (!conversation.queue_entered_at) return 0

    const start = new Date(conversation.queue_entered_at)
    const now = new Date()

    if (businessHours.length > 0) {
      return calculateBusinessSeconds(start, now, businessHours)
    }
    // Fallback: wall-clock
    return Math.round((now.getTime() - start.getTime()) / 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slaCfg, isStillInQueue, conversation.queue_entered_at, conversation.first_human_response_seconds, businessHours, Math.floor(Date.now() / 1000)])

  if (!slaCfg) return null

  const slaTargetSeconds = slaCfg.first_response_target_minutes * 60
  const slaPercent = Math.min(Math.round((slaElapsedSeconds / slaTargetSeconds) * 100), 150)
  const slaExceeded = slaPercent > 100

  const slaLabel = slaExceeded ? 'Estourado' : slaPercent > 70 ? 'Crítico' : 'OK'
  const slaColor = slaExceeded ? 'text-destructive' : slaPercent > 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
  const progressColor = slaExceeded ? 'rgb(239, 68, 68)' : slaPercent > 70 ? 'rgb(234, 179, 8)' : 'rgb(34, 197, 94)'

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border",
      slaExceeded
        ? 'bg-destructive/10 border-destructive/30 animate-pulse'
        : slaPercent > 70
          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
          : 'bg-muted/50 border-border'
    )}>
      <span className="text-xs font-semibold text-muted-foreground uppercase">SLA</span>
      <div className="w-[60px]">
        <Progress
          value={Math.min(slaPercent, 100)}
          className="h-1.5"
          style={{ ['--progress-color' as string]: progressColor }}
        />
      </div>
      <span className={cn("text-xs font-bold", slaColor)}>{slaLabel}</span>
    </div>
  )
}
