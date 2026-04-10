import { Clock, Timer, TrendingUp, Lock } from 'lucide-react'
import { useWaitTimer, getWaitColor, formatHHMMSS } from '@/hooks/useWaitTimer'
import { useSLAConfig } from '@/hooks/useSLAConfig'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Tables } from '@/integrations/supabase/types'

type Conversation = Tables<'ai_conversations'>

interface Props {
  conversation: Conversation
}

function getSLAColor(percent: number) {
  if (percent > 90) return 'bg-red-500'
  if (percent > 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

export function ConversationTimerIndicators({ conversation }: Props) {
  const { data: slaConfig } = useSLAConfig()

  // Queue time
  const isStillInQueue = !!conversation.queue_entered_at && !conversation.first_human_response_at
  const queueElapsed = useWaitTimer(isStillInQueue ? conversation.queue_entered_at : null, 1000)

  // In-service time
  const isFinished = conversation.resolved_at != null
  const inServiceRef = conversation.first_human_response_at && !isFinished ? conversation.first_human_response_at : null
  const serviceElapsed = useWaitTimer(inServiceRef, 1000)

  // Fixed values
  const fixedQueueSeconds = conversation.first_human_response_seconds
  const fixedServiceSeconds = isFinished && conversation.first_human_response_at && conversation.resolved_at
    ? Math.round((new Date(conversation.resolved_at).getTime() - new Date(conversation.first_human_response_at).getTime()) / 1000)
    : null

  // SLA
  const slaCfg = slaConfig?.get(conversation.priority || 'medium')
  const slaTargetSeconds = slaCfg ? slaCfg.first_response_target_minutes * 60 : null
  const slaElapsedSeconds = isStillInQueue
    ? queueElapsed
    : (fixedQueueSeconds || 0)
  const slaPercent = slaTargetSeconds ? Math.min(Math.round((slaElapsedSeconds / slaTargetSeconds) * 100), 150) : null
  const slaExceeded = slaPercent != null && slaPercent > 100

  const showQueue = !!conversation.queue_entered_at
  const showService = !!conversation.first_human_response_at
  const showSLA = !!slaCfg
  const isLocked = conversation.is_data_locked === true

  if (!showQueue && !showService && !showSLA) return null

  const LockIcon = isLocked ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Dado protegido — não pode ser alterado
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null

  return (
    <div className="flex items-center gap-5 px-6 py-2 border-b border-border bg-card/50 text-xs">
      {/* Queue time */}
      {showQueue && (
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Fila:</span>
          {isStillInQueue ? (
            <span className={cn("font-mono font-bold text-sm", getWaitColor(queueElapsed))}>
              {formatHHMMSS(queueElapsed)}
            </span>
          ) : (
            <span className="font-mono font-semibold text-sm text-muted-foreground">
              {formatHHMMSS(fixedQueueSeconds || 0)}
            </span>
          )}
          {isLocked && LockIcon}
        </div>
      )}

      {/* Service time */}
      {showService && (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Atendimento:</span>
          {fixedServiceSeconds != null ? (
            <span className="font-mono font-semibold text-sm text-muted-foreground">
              {formatHHMMSS(fixedServiceSeconds)}
            </span>
          ) : (
            <span className="font-mono font-semibold text-sm text-muted-foreground">
              {formatHHMMSS(serviceElapsed)}
            </span>
          )}
          {isLocked && LockIcon}
        </div>
      )}

      {/* SLA */}
      {showSLA && slaPercent != null && (
        <div className="flex items-center gap-2 min-w-[160px]">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground font-medium">SLA:</span>
          <div className="flex-1 max-w-[90px]">
            <Progress
              value={Math.min(slaPercent, 100)}
              className="h-2"
              style={{
                ['--progress-color' as string]: slaExceeded ? 'rgb(239, 68, 68)' : slaPercent > 70 ? 'rgb(234, 179, 8)' : 'rgb(34, 197, 94)',
              }}
            />
          </div>
          <span className={cn(
            "font-semibold text-sm",
            slaExceeded ? "text-red-500" : slaPercent > 70 ? "text-yellow-500" : "text-green-500"
          )}>
            {slaExceeded
              ? 'Estourado'
              : `${Math.floor(slaElapsedSeconds / 60)}m de ${slaCfg!.first_response_target_minutes}m`
            }
          </span>
        </div>
      )}
    </div>
  )
}
