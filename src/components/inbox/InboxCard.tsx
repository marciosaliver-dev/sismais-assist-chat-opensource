import { memo } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Bot, Headphones, Timer, CheckCircle2,
  MessageSquare, Star, Building2, Hourglass, User,
} from 'lucide-react'
import type { KanbanTicket } from '@/hooks/useKanbanTickets'
import { useContactPicture } from '@/hooks/useContactPicture'
import { useWaitTimer, getWaitColor, formatCompactTime } from '@/hooks/useWaitTimer'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const priorityConfig: Record<string, { label: string; className: string; ringClass: string }> = {
  urgent: { label: 'Urgente', className: 'bg-gms-err text-white', ringClass: 'ring-gms-err' },
  critical: { label: 'Crítica', className: 'bg-gms-err text-white', ringClass: 'ring-gms-err' },
  high: { label: 'Alta', className: 'bg-gms-err-bg text-gms-err border-gms-err/30', ringClass: 'ring-gms-err/60' },
  medium: { label: 'Média', className: 'bg-gms-yellow-bg text-gms-g900 border-gms-yellow/30', ringClass: 'ring-gms-yellow/50' },
  low: { label: 'Baixa', className: 'bg-gms-ok-bg text-gms-ok border-gms-ok/30', ringClass: 'ring-gms-g300' },
}

function formatSLATime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }
  return `${Math.round(minutes)}m`
}

interface InboxCardProps {
  ticket: KanbanTicket
  isSelected: boolean
  onClick: () => void
}

export const InboxCard = memo(function InboxCard({ ticket, isSelected, onClick }: InboxCardProps) {
  const initials = (ticket.customer_name || 'C')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const priority = priorityConfig[ticket.priority || 'medium']
  const unread = ticket.uazapi_unread_count || 0
  const isVIP = ticket.tags?.some(t => t.toLowerCase() === 'vip') ?? false

  // Handler states
  const isAI = ticket.handler_type === 'ai'
  const isWaitingHuman = ticket.handler_type === 'human' && !ticket.human_agent_id && !ticket.resolved_at
  const isHumanAssigned = ticket.handler_type === 'human' && !!ticket.human_agent_id

  // Timer logic
  const isQueue = ticket.statusType === 'queue'
  const isInProgress = ticket.statusType === 'in_progress'
  const isFinished = ticket.statusType === 'finished'
  const timerRef = isQueue
    ? (ticket.queue_entered_at || ticket.started_at)
    : isInProgress
      ? (ticket.human_started_at || ticket.started_at)
      : ticket.started_at
  const elapsed = useWaitTimer(!isFinished ? timerRef : null, 10000)

  // SLA calculations
  const sla = ticket.slaTargets
  const now = Date.now()
  const firstResponseDone = !!ticket.first_human_response_at
  const firstResponseElapsedMin = ticket.queue_entered_at && !firstResponseDone
    ? (now - new Date(ticket.queue_entered_at).getTime()) / 60000 : 0
  const firstResponseTarget = sla?.first_response_target_minutes || 0
  const firstResponsePct = firstResponseTarget > 0 && !firstResponseDone
    ? Math.min((firstResponseElapsedMin / firstResponseTarget) * 100, 150) : 0
  const firstResponseBreached = !firstResponseDone && firstResponseTarget > 0 && firstResponseElapsedMin > firstResponseTarget
  const firstResponseWarning = !firstResponseDone && firstResponseTarget > 0 && firstResponseElapsedMin >= firstResponseTarget * 0.8 && !firstResponseBreached

  const resolutionDone = !!ticket.resolved_at
  const resolutionStartRef = ticket.queue_entered_at || ticket.started_at
  const resolutionElapsedMin = resolutionStartRef && !resolutionDone
    ? (now - new Date(resolutionStartRef).getTime()) / 60000 : 0
  const resolutionTarget = sla?.resolution_target_minutes || 0
  const resolutionPct = resolutionTarget > 0 && !resolutionDone
    ? Math.min((resolutionElapsedMin / resolutionTarget) * 100, 150) : 0
  const resolutionBreached = !resolutionDone && resolutionTarget > 0 && resolutionElapsedMin > resolutionTarget
  const resolutionWarning = !resolutionDone && resolutionTarget > 0 && resolutionElapsedMin >= resolutionTarget * 0.8 && !resolutionBreached

  const hasSLAIssue = firstResponseBreached || resolutionBreached
  const totalMessages = (ticket.ai_messages_count || 0) + (ticket.human_messages_count || 0)

  // SLA helpers
  const getSLAStatus = (breached: boolean, warning: boolean) =>
    breached ? 'crit' : warning ? 'warn' : 'ok'

  const slaBarColor: Record<string, string> = {
    ok: 'bg-gms-ok',
    warn: 'bg-gms-yellow',
    crit: 'bg-gms-err',
  }

  const slaTextColor: Record<string, string> = {
    ok: 'text-gms-ok',
    warn: 'text-gms-warn',
    crit: 'text-gms-err',
  }

  // Agent display
  const agentDisplayName = isAI
    ? (ticket.ai_agent_name || 'IA')
    : (ticket.humanAgentName || 'Atendente')
  const agentInitials = isAI
    ? 'IA'
    : (ticket.humanAgentName || 'AG').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // WhatsApp avatar
  const { data: defaultInstanceId } = useQuery({
    queryKey: ['default-uazapi-instance'],
    queryFn: async () => {
      const { data } = await supabase
        .from('uazapi_instances' as any)
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()
      return (data as any)?.id as string | null
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  })

  const { url: contactAvatarUrl } = useContactPicture(
    undefined,
    undefined,
    defaultInstanceId || undefined,
    ticket.avatar_url,
    ticket.customer_phone
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 border-l-[3px] transition-all duration-150 relative group/inbox-card',
        'hover:bg-gms-g100 hover:shadow-[0_2px_8px_rgba(16,41,63,0.06)] hover:-translate-y-px',
        'focus-visible:outline-2 focus-visible:outline-gms-cyan focus-visible:outline-offset-[-2px]',
        isWaitingHuman && !isSelected
          ? 'bg-gms-yellow-bg border-l-gms-yellow border-b border-gms-yellow/30 ring-1 ring-gms-yellow/40'
          : hasSLAIssue && !isSelected
            ? 'bg-white border-l-gms-err border-b border-gms-err/20'
            : isSelected
              ? 'bg-gms-cyan-light border-l-gms-cyan shadow-[inset_0_0_0_1px_rgba(69,229,229,0.3)]'
              : unread > 0
                ? 'bg-[#FFF7ED] border-l-[#EA580C] border-b border-[#EA580C]/20 ring-1 ring-[#EA580C]/30 animate-unread-pulse'
                : 'bg-white border-b border-gms-g200/60 border-l-transparent'
      )}
    >
      {/* Awaiting human triangle indicator */}
      {isWaitingHuman && !isSelected && (
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-t-gms-yellow border-l-[16px] border-l-transparent" />
      )}

      {/* Unread badge */}
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 z-10 min-w-[18px] h-[18px] rounded-full bg-gms-err text-white text-[9px] font-bold flex items-center justify-center px-1 ring-1 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}

      {/* ═══ HEADER: Avatar + Name/Phone ←→ #Ticket + Priority ═══ */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
      <Avatar className={cn(
            'w-[34px] h-[34px] shrink-0 ring-2',
            isWaitingHuman ? 'ring-gms-yellow' : (priority?.ringClass || 'ring-gms-g200')
          )}>
            {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt={ticket.customer_name || ''} />}
            <AvatarFallback className="bg-gms-navy text-gms-cyan text-[11px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              {isVIP && <Star className="w-3 h-3 text-gms-yellow fill-gms-yellow shrink-0" />}
              <p className="text-[13px] font-bold text-gms-navy leading-tight line-clamp-1 min-w-0">
                {ticket.customer_name || ticket.customer_phone}
              </p>
            </div>
            <p className="text-[10px] text-gms-g500 leading-tight">
              {ticket.customer_phone || '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] font-bold text-gms-g500 tracking-wide">
            #{ticket.ticket_number || '—'}
          </span>
          <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', priority?.className)}>
            {priority?.label}
          </Badge>
        </div>
      </div>

      {/* ═══ COMPANY ═══ */}
      {ticket.helpdesk_client_name && (
        <div className="flex items-center gap-1 mb-1 min-w-0">
          <Building2 className="w-3 h-3 text-gms-g500 shrink-0" />
          <span className="text-[11px] text-gms-g500 truncate">{ticket.helpdesk_client_name}</span>
        </div>
      )}

      {/* ═══ SUBJECT ═══ */}
      {(ticket as any).ticket_subject && (
        <p className="text-[12px] font-semibold text-gms-navy leading-snug line-clamp-2 mb-1 min-w-0">
          {(ticket as any).ticket_subject}
        </p>
      )}

      {/* ═══ LAST MESSAGE PREVIEW ═══ */}
      {ticket.last_message && (
        <p className="text-[11px] text-gms-g500 leading-relaxed line-clamp-2 mb-1.5 min-w-0">
          {ticket.last_message}
        </p>
      )}

      {/* ═══ TAGS ROW: Handler badge + message count ═══ */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5 min-w-0">
        {isAI ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded-full bg-gms-cyan-light text-gms-navy border border-gms-cyan/40">
            <Bot className="w-[11px] h-[11px]" />
            IA
          </span>
        ) : isWaitingHuman ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded-full bg-gms-yellow-bg text-gms-warn border border-gms-yellow/30">
            <Hourglass className="w-[11px] h-[11px]" />
            Aguardando
          </span>
        ) : isHumanAssigned ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded-full bg-gms-g100 text-gms-navy border border-gms-g300">
            <User className="w-[11px] h-[11px]" />
            Humano
          </span>
        ) : null}

        {totalMessages > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-gms-g500">
            <MessageSquare className="w-[11px] h-[11px]" />
            {totalMessages}
          </span>
        )}
      </div>

      {/* ═══ SLA PROGRESS BARS ═══ */}
      {sla && !isFinished && (
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-[4px] mb-1.5">
            {/* 1st Response SLA */}
            {firstResponseTarget > 0 && (
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gms-g500">1ª Resposta</span>
                  {firstResponseDone ? (
                    <span className="text-[10px] font-bold text-gms-ok flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      OK
                    </span>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('text-[10px] font-bold', slaTextColor[getSLAStatus(firstResponseBreached, firstResponseWarning)])}>
                          {formatSLATime(firstResponseElapsedMin)} / {formatSLATime(firstResponseTarget)}
                          {firstResponseBreached && ' ⚠'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {firstResponseBreached
                          ? `SLA estourado (${Math.round(firstResponseElapsedMin - firstResponseTarget)}min além)`
                          : `${Math.round(firstResponseTarget - firstResponseElapsedMin)}min restantes`
                        }
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {!firstResponseDone && (
                  <div className="w-full h-[3px] rounded-full bg-gms-g200 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-300', slaBarColor[getSLAStatus(firstResponseBreached, firstResponseWarning)])}
                      style={{ width: `${Math.min(firstResponsePct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Resolution SLA */}
            {resolutionTarget > 0 && !resolutionDone && (
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gms-g500">Resolução</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn('text-[10px] font-bold', slaTextColor[getSLAStatus(resolutionBreached, resolutionWarning)])}>
                        {formatSLATime(resolutionElapsedMin)} / {formatSLATime(resolutionTarget)}
                        {resolutionBreached && ' ⚠'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {resolutionBreached
                        ? `SLA estourado (${Math.round(resolutionElapsedMin - resolutionTarget)}min além)`
                        : `${Math.round(resolutionTarget - resolutionElapsedMin)}min restantes`
                      }
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="w-full h-[3px] rounded-full bg-gms-g200 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', slaBarColor[getSLAStatus(resolutionBreached, resolutionWarning)])}
                    style={{ width: `${Math.min(resolutionPct, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* ═══ FOOTER: Agent ←→ Timer ═══ */}
      <div className="flex items-center justify-between min-w-0">
        {/* Left: Agent avatar + name */}
        <div className="flex items-center gap-[5px] min-w-0 flex-1 overflow-hidden">
          <div className={cn(
            "w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
            isAI ? 'bg-gms-cyan text-gms-navy' : 'bg-gms-navy text-white'
          )}>
            {agentInitials}
          </div>
          <span className="text-[11px] text-gms-g700 font-medium truncate min-w-0">
            {agentDisplayName}
          </span>
        </div>

        {/* Right: Timer */}
        {!isFinished && timerRef && (
          <span className={cn(
            'flex items-center gap-1 text-[10px] shrink-0',
            isQueue ? getWaitColor(elapsed) : 'text-gms-g500'
          )}>
            <Timer className="w-3 h-3" />
            <span className="font-bold font-mono">{formatCompactTime(elapsed)}</span>
          </span>
        )}
      </div>
    </button>
  )
})
