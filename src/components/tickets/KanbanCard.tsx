import { useState, useMemo, memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, Headphones, Star, Building2, Timer, AlertTriangle, CheckCircle2, ShieldAlert, CalendarClock, DollarSign, MessageSquare, Bot, GripVertical, ArrowRightLeft, Zap, Hourglass, User, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import type { KanbanTicket } from '@/hooks/useKanbanTickets'
import { useContactPicture } from '@/hooks/useContactPicture'
import { useQuery } from '@tanstack/react-query'
import { useWaitTimer, getWaitColor, formatCompactTime } from '@/hooks/useWaitTimer'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { supabase } from '@/integrations/supabase/client'
import { calculateBusinessMinutes } from '@/utils/calculateBusinessMinutes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import type { HumanAgentOption } from './KanbanColumn'
import { TransferDialog } from '@/components/inbox/TransferDialog'

const priorityConfig: Record<string, { label: string; className: string; ringClass: string }> = {
  urgent: { label: 'Urgente', className: 'bg-gms-err text-white', ringClass: 'ring-gms-err' },
  critical: { label: 'Crítica', className: 'bg-gms-err text-white', ringClass: 'ring-gms-err' },
  high: { label: 'Alta', className: 'bg-gms-err-bg text-gms-err border-gms-err/30', ringClass: 'ring-gms-err/60' },
  medium: { label: 'Média', className: 'bg-gms-yellow-bg text-gms-g900 border-gms-yellow/30', ringClass: 'ring-gms-yellow/50' },
  low: { label: 'Baixa', className: 'bg-gms-ok-bg text-gms-ok border-gms-ok/30', ringClass: 'ring-gms-g300' },
}

interface CategoryInfo {
  name: string
  color: string
}

interface ModuleInfo {
  name: string
}

interface Props {
  ticket: KanbanTicket
  isDragging?: boolean
  onClick: (ticket: KanbanTicket) => void
  humanAgents?: HumanAgentOption[]
  categories?: Map<string, CategoryInfo>
  modules?: Map<string, ModuleInfo>
  boardType?: string
  isSelected?: boolean
  isActive?: boolean
  onToggleSelect?: (id: string) => void
  isEntryColumn?: boolean
  onMoveToBoard?: (ticketId: string) => void
  alertThresholdMinutes?: number | null
  businessHours?: import('@/utils/calculateBusinessMinutes').BusinessHourEntry[]
  isAiValidation?: boolean
  onApproveAiClose?: (ticketId: string) => void
  onRejectAiClose?: (ticketId: string) => void
}

function formatDaysAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

function formatSLATime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }
  return `${Math.round(minutes)}m`
}

export const KanbanCard = memo(function KanbanCard({ ticket, isDragging, onClick, humanAgents = [], categories, modules, boardType = 'support', isSelected, isActive, onToggleSelect, isEntryColumn, onMoveToBoard, alertThresholdMinutes, businessHours, isAiValidation, onApproveAiClose, onRejectAiClose }: Props) {
  const queryClient = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const { user: authUser } = useAuth()
  const isSupport = boardType === 'support'

  const assumeTicketFromCard = async (ticketId: string) => {
    try {
      if (!authUser) { toast.error('Usuário não autenticado'); return }
      const { data: agent, error: agentErr } = await supabase
        .from('human_agents').select('id').eq('user_id', authUser.id).limit(1).single()
      if (agentErr || !agent) { toast.error('Agente humano não encontrado'); return }
      const { error: updateErr } = await supabase.from('ai_conversations').update({
        status: 'em_atendimento', human_agent_id: agent.id, handler_type: 'human',
      }).eq('id', ticketId)
      if (updateErr) throw updateErr
      await supabase.from('agent_assignments').insert({
        conversation_id: ticketId, agent_type: 'human', human_agent_id: agent.id,
      })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Atendimento iniciado!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar atendimento')
    }
  }

  // Fetch default WhatsApp instance for avatar fetching
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

  // Lazy-fetch contact avatar from WhatsApp
  const { url: contactAvatarUrl } = useContactPicture(
    undefined,
    undefined,
    defaultInstanceId || undefined,
    ticket.avatar_url,
    ticket.customer_phone
  )

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ticket-priority-classifier', {
        body: { conversation_id: ticket.id, force_reclassify: true }
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      const priority = data?.data?.priority
      toast.success(`Prioridade re-classificada: ${priority || 'atualizada'}`)
    },
    onError: () => toast.error('Erro ao re-classificar prioridade'),
  })

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: ticket.id,
    data: { ticket },
  })

  const priority = priorityConfig[ticket.priority || 'medium']

  // Timer logic (support only)
  const isQueue = ticket.statusType === 'queue'
  const isInProgress = ticket.statusType === 'in_progress'
  const isFinished = ticket.statusType === 'finished'
  const timerRef = isQueue
    ? (ticket.queue_entered_at || ticket.started_at)
    : isInProgress
      ? (ticket.human_started_at || ticket.started_at)
      : ticket.started_at
  const elapsed = useWaitTimer(isSupport && !isFinished ? timerRef : null, 10000)

  // Time in stage (for non-support boards)
  const stageElapsed = useWaitTimer(!isSupport ? ticket.started_at : null, 60000)

  // SLA calculations (support only) — uses business hours when available
  const sla = isSupport ? ticket.slaTargets : undefined
  const nowDate = new Date()

  const firstResponseDone = !!ticket.first_human_response_at
  const firstResponseElapsedMin = useMemo(() => {
    if (!ticket.queue_entered_at || firstResponseDone) return 0
    const start = new Date(ticket.queue_entered_at)
    if (businessHours && businessHours.length > 0) {
      return calculateBusinessMinutes(start, nowDate, businessHours)
    }
    return (nowDate.getTime() - start.getTime()) / 60000
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.queue_entered_at, firstResponseDone, businessHours, Math.floor(Date.now() / 60000)])
  const firstResponseTarget = sla?.first_response_target_minutes || 0
  const firstResponsePct = firstResponseTarget > 0 && !firstResponseDone
    ? Math.min((firstResponseElapsedMin / firstResponseTarget) * 100, 150) : 0
  const firstResponseBreached = !firstResponseDone && firstResponseTarget > 0 && firstResponseElapsedMin > firstResponseTarget
  const firstResponseWarning = !firstResponseDone && firstResponseTarget > 0 && firstResponseElapsedMin >= firstResponseTarget * 0.8 && !firstResponseBreached

  const resolutionDone = !!ticket.resolved_at
  const resolutionStartRef = ticket.queue_entered_at || ticket.started_at
  const resolutionElapsedMin = useMemo(() => {
    if (!resolutionStartRef || resolutionDone) return 0
    const start = new Date(resolutionStartRef)
    if (businessHours && businessHours.length > 0) {
      return calculateBusinessMinutes(start, nowDate, businessHours)
    }
    return (nowDate.getTime() - start.getTime()) / 60000
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolutionStartRef, resolutionDone, businessHours, Math.floor(Date.now() / 60000)])
  const resolutionTarget = sla?.resolution_target_minutes || 0
  const resolutionPct = resolutionTarget > 0 && !resolutionDone
    ? Math.min((resolutionElapsedMin / resolutionTarget) * 100, 150) : 0
  const resolutionBreached = !resolutionDone && resolutionTarget > 0 && resolutionElapsedMin > resolutionTarget
  const resolutionWarning = !resolutionDone && resolutionTarget > 0 && resolutionElapsedMin >= resolutionTarget * 0.8 && !resolutionBreached

  const hasSLAIssue = isSupport && (firstResponseBreached || resolutionBreached)
  const hasSLAWarning = isSupport && (firstResponseWarning || resolutionWarning)

  const isVIP = ticket.tags?.some(t => t.toLowerCase() === 'vip') ?? false
  const isOverdue = ticket.started_at
    && ticket.status !== 'finalizado'
    && (Date.now() - new Date(ticket.started_at).getTime()) > 24 * 60 * 60 * 1000

  const category = ticket.ticket_category_id && categories?.get(ticket.ticket_category_id)
  const module = ticket.ticket_module_id && modules?.get(ticket.ticket_module_id)

  // Board-type flags
  const isCancellation = boardType === 'cancellation'

  // Billing-specific context data
  const context = (ticket as any).context || {}
  const openValue = context.valor_aberto || context.open_value
  const daysLate = context.dias_atraso || context.days_late
  const lastContact = context.ultimo_contato || context.last_contact

  // Cancellation-specific context data
  const cancellationReason = context.cancellation_reason
  const contactAttempts = context.contact_attempts || 0
  const mrrValue = context.mrr_value
  const monthsActive = context.months_active
  const finalResult = context.final_result

  // Message counts
  const totalMessages = (ticket.ai_messages_count || 0) + (ticket.human_messages_count || 0)

  // Agent display name
  const agentDisplayName = ticket.handler_type === 'ai'
    ? (ticket.ai_agent_name || 'IA')
    : (ticket.humanAgentName || 'Humano')

  // CSAT stars
  const csatRating = ticket.csat_rating

  // Awaiting human agent (AI stopped, no human assigned yet)
  const isAwaitingHuman = ticket.handler_type === 'human' && ticket.status === 'aguardando'
  const isHumanAssigned = ticket.handler_type === 'human' && !!ticket.human_agent_id && ticket.status !== 'aguardando'

  // Queue urgency thresholds (30min / 60min)
  const isQueueOver30 = (isQueue || isAwaitingHuman) && elapsed >= 1800
  const isQueueOver60 = (isQueue || isAwaitingHuman) && elapsed >= 3600

  // Configurable queue alert threshold (stage → board → default 10min)
  const alertThresholdSec = (alertThresholdMinutes ?? 10) * 60
  const isQueueOverThreshold = (isQueue || isAwaitingHuman) && elapsed >= alertThresholdSec && !isQueueOver30

  // Unread messages from customer
  const unreadCount = ticket.uazapi_unread_count ?? 0

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  const hasSelection = onToggleSelect != null

  // Priority-based left border for entry columns
  const entryPriorityBorder = isEntryColumn
    ? ticket.priority === 'urgent' || ticket.priority === 'critical'
      ? 'border-l-destructive'
      : ticket.priority === 'high'
        ? 'border-l-gms-yellow'
        : undefined
    : undefined

  // Priority-based background for entry columns
  const entryPriorityBg = isEntryColumn
    ? ticket.priority === 'urgent' || ticket.priority === 'critical'
      ? 'bg-gms-err/10 border-gms-err/30'
      : ticket.priority === 'high'
        ? 'bg-gms-yellow/10 border-gms-yellow/30'
        : ticket.priority === 'medium'
          ? 'bg-gms-yellow/[0.06] border-gms-yellow/20'
          : undefined
    : undefined

  // SLA bar status helpers
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

  // Agent initials for footer
  const agentInitials = ticket.handler_type === 'ai'
    ? 'IA'
    : (ticket.humanAgentName || 'AG').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        borderLeftColor: entryPriorityBorder ? undefined : (ticket.statusColor || undefined),
      }}
      onClick={(e) => { e.stopPropagation(); onClick(ticket) }}
      className={cn(
        'kcard',
        'w-full p-3 relative cursor-pointer active:cursor-grabbing transition-all duration-150 group/card border-l-[3px] rounded-lg border overflow-hidden max-w-full min-w-0',
        entryPriorityBg || 'bg-white border-gms-g200',
        'hover:border-gms-cyan hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-[1px]',
        isDragging && 'opacity-50 shadow-lg',
        // Queue urgency overrides awaiting human style
        isQueueOver60 && 'border-l-gms-err bg-gms-err-bg border-gms-err/40 ring-2 ring-gms-err/30 shadow-[0_2px_8px_rgba(220,38,38,0.15)]',
        isQueueOver30 && !isQueueOver60 && 'border-l-[#EA580C] bg-[#FFF7ED] border-[#EA580C]/30 ring-1 ring-[#EA580C]/20',
        // Configurable threshold alert (pulsing red glow)
        isQueueOverThreshold && 'animate-queue-alert border-l-gms-err/70',
        isAwaitingHuman && !isQueueOver30 && !isQueueOverThreshold && 'border-l-[#FFB800] bg-[#FFFBEB] border-[#FFB800]/50 ring-2 ring-[#FFB800]/40 shadow-[0_2px_8px_rgba(255,184,0,0.15)]',
        hasSLAIssue && !isQueueOver30 && ['border-gms-err/60 shadow-gms-err/10 border-l-gms-err', 'sla-err'],
        hasSLAWarning && !hasSLAIssue && !isQueueOver30 && ['border-l-gms-yellow', 'sla-warn'],
        (isSelected || isActive) && 'selected',
        isSelected && 'ring-1 ring-gms-cyan border-gms-cyan',
        isActive && 'ring-1 ring-gms-cyan border-gms-cyan bg-gms-cyan-light',
        isFinished && 'concluded',
        unreadCount > 0 && !isAwaitingHuman && !isQueueOver30 && !hasSLAIssue && !isSelected && !isActive && 'ring-2 ring-[#EA580C]/50 border-[#EA580C] border-l-[#EA580C] bg-[#FFF3E0] animate-unread-pulse shadow-[0_2px_8px_rgba(234,88,12,0.12)]',
        !hasSLAIssue && !isSelected && !isActive && !entryPriorityBg && !isAwaitingHuman && !isQueueOver30 && !(unreadCount > 0) && 'border-gms-g200',
        entryPriorityBorder,
      )}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover/card:opacity-100 transition-opacity absolute top-1.5 left-0.5 cursor-grab" />

      {/* Awaiting human banner */}
      {isAwaitingHuman && (
        <div className={cn(
          "absolute top-0 left-0 right-0 flex items-center gap-1 px-2 py-1 border-b rounded-t-[calc(var(--radius)-1px)]",
          isQueueOver60 ? 'bg-gms-err border-gms-err' :
          isQueueOver30 ? 'bg-[#EA580C] border-[#EA580C]' :
          'bg-[#FFB800] border-[#FFB800]'
        )}>
          {isQueueOver60 ? (
            <>
              <AlertTriangle className="w-3 h-3 text-white shrink-0 animate-bounce" />
              <span className="text-[9px] font-bold text-white uppercase tracking-wider">1h+ na fila — Urgente!</span>
            </>
          ) : isQueueOver30 ? (
            <>
              <AlertTriangle className="w-3 h-3 text-white shrink-0 animate-pulse" />
              <span className="text-[9px] font-bold text-white uppercase tracking-wider">30min+ na fila</span>
            </>
          ) : (
            <>
              <Headphones className="w-3 h-3 text-[#10293F] shrink-0 animate-pulse" />
              <span className="text-[9px] font-bold text-[#10293F] uppercase tracking-wider">Aguardando Atendente</span>
            </>
          )}
        </div>
      )}

      {/* Queue urgency banner for non-awaiting tickets in queue */}
      {!isAwaitingHuman && isQueueOver60 && (
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-2 py-1 bg-gms-err border-b border-gms-err rounded-t-[calc(var(--radius)-1px)]">
          <AlertTriangle className="w-3 h-3 text-white shrink-0 animate-bounce" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">1h+ na fila</span>
        </div>
      )}
      {!isAwaitingHuman && isQueueOver30 && !isQueueOver60 && (
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-2 py-1 bg-[#EA580C] border-b border-[#EA580C] rounded-t-[calc(var(--radius)-1px)]">
          <AlertTriangle className="w-3 h-3 text-white shrink-0 animate-pulse" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">30min+ na fila</span>
        </div>
      )}

      {/* Unread messages banner */}
      {unreadCount > 0 && !isAwaitingHuman && !isQueueOver30 && !isQueueOver60 && (
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-2 py-1 bg-[#FFF3E0] border-b border-[#EA580C]/30 rounded-t-[calc(var(--radius)-1px)]">
          <MessageSquare className="w-3 h-3 text-[#EA580C] shrink-0" />
          <span className="text-[9px] font-bold text-[#EA580C] uppercase tracking-wider">
            {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Unread messages badge */}
      {unreadCount > 0 && (
        <div
          className={cn(
            "absolute top-1 right-1 z-30 flex items-center justify-center",
            "min-w-[18px] h-[18px] rounded-full px-1",
            "text-xs font-bold shadow-sm ring-1 ring-card",
            "bg-gms-err text-white"
          )}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}

      {/* Selection checkbox — positioned left side to avoid overlap with unread badge and ticket number */}
      {hasSelection && (
        <div
          className={cn(
            'absolute left-1 z-20 transition-opacity',
            (isAwaitingHuman || isQueueOver30) ? 'top-8' : 'top-1.5',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
          )}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(ticket.id)}
          />
        </div>
      )}

      {/* ═══ HEADER: Avatar + Name/Phone ←→ #Ticket + Priority ═══ */}
      <div className={cn("flex items-start justify-between gap-2 mb-2", (isAwaitingHuman || isQueueOver30 || (unreadCount > 0 && !isAwaitingHuman && !isQueueOver30 && !isQueueOver60)) && "mt-5")}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className={cn(
            "w-8 h-8 shrink-0 ring-2",
            isAwaitingHuman ? 'ring-[#FFB800]' : (priority?.ringClass || 'ring-muted-foreground/20')
          )}>
            {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} alt={ticket.customer_name || ''} />}
            <AvatarFallback className="text-[13px] font-bold bg-muted text-muted-foreground">
              {(ticket.customer_name || ticket.customer_phone || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              {isVIP && <Star className="w-3.5 h-3.5 text-gms-yellow fill-gms-yellow shrink-0" />}
              {isOverdue && isSupport && <Clock className="w-3.5 h-3.5 text-gms-err shrink-0" />}
              <p className="text-[13px] font-bold text-gms-navy leading-tight line-clamp-1 min-w-0">
                {ticket.customer_name || ticket.customer_phone}
              </p>
            </div>
            <p className="text-[12px] text-gms-g500 leading-tight mt-0.5">
              {ticket.customer_phone || '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[11px] font-mono font-bold text-gms-g500">
            #{ticket.ticket_number || '—'}
          </span>
          <Badge variant="outline" className={cn('text-[10px] h-[18px] px-1.5', priority?.className)}>
            {priority?.label}
          </Badge>
        </div>
      </div>

      {/* ═══ TICKET SUBJECT ═══ */}
      {ticket.ticket_subject && (
        <p className="text-[12px] font-semibold text-gms-navy leading-snug line-clamp-1 mb-1 min-w-0">
          {ticket.ticket_subject}
        </p>
      )}

      {/* ═══ MESSAGE PREVIEW (2 lines) ═══ */}
      {ticket.last_message && (
        <p className={cn("text-[13px] text-gms-g700 leading-relaxed mb-2 min-w-0", ticket.ticket_subject ? "line-clamp-1" : "line-clamp-2")}>
          {ticket.last_message}
        </p>
      )}

      {/* ═══ COMPANY ═══ */}
      {ticket.helpdesk_client_name && (
        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-gms-g500 shrink-0" />
          <span className="text-[12px] text-gms-g500 truncate min-w-0">{ticket.helpdesk_client_name}</span>
          {/* License status badge */}
          {(() => {
            const msStatus = ticket.gl_status_mais_simples
            const mxStatus = ticket.gl_status_maxpro
            if (!msStatus && !mxStatus) return null
            const isBloqueado = msStatus === 'Bloqueado' || mxStatus === 'Bloqueado'
            const isCancelado = msStatus === 'Cancelado' || mxStatus === 'Cancelado'
            const isAtivo = msStatus === 'Ativo' || mxStatus === 'Ativo'
            const badgeStyle = isBloqueado
              ? { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)' }
              : isCancelado
              ? { backgroundColor: '#FFFBEB', color: '#10293F', borderColor: 'rgba(255,184,0,0.5)' }
              : isAtivo
              ? { backgroundColor: '#F0FDF4', color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)' }
              : null
            const label = isBloqueado ? 'Bloqueado' : isCancelado ? 'Cancelado' : isAtivo ? 'Ativo' : null
            if (!badgeStyle || !label) return null
            const productTag = ticket.subscribed_product === 'Mais Simples' ? 'MS' : ticket.subscribed_product === 'Maxpro' ? 'MX' : null
            return (
              <>
                <span className="text-[10px] font-semibold px-1.5 py-px rounded-full border shrink-0" style={badgeStyle}>
                  {label}
                </span>
                {productTag && (
                  <span className="text-[9px] font-medium text-gms-g500 shrink-0">{productTag}</span>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ═══ TAGS ROW ═══ */}
      {isSupport && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2 min-w-0">
          {/* Handler mode badge */}
          {ticket.handler_type === 'ai' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-cyan-light text-gms-navy border border-gms-cyan/40">
              <Bot className="w-3 h-3" />
              IA
            </span>
          ) : isAwaitingHuman ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-yellow-bg text-gms-warn border border-gms-yellow/30">
              <Hourglass className="w-3 h-3" />
              Aguardando
            </span>
          ) : isHumanAssigned ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-g100 text-gms-navy border border-gms-g300">
              <User className="w-3 h-3" />
              Humano
            </span>
          ) : null}

          {category && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded border"
              style={{
                borderColor: `${category.color}40`,
                backgroundColor: `${category.color}15`,
                color: category.color,
              }}
            >
              {category.name}
            </span>
          )}
          {module && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gms-g100 text-gms-g700 border border-gms-g200">
              {module.name}
            </span>
          )}
        </div>
      )}

      {/* ═══ CANCELLATION INFO (cancellation board only) ═══ */}
      {isCancellation && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2 min-w-0">
          {cancellationReason && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-err-bg text-gms-err border border-gms-err/30">
              <AlertTriangle className="w-3 h-3" />
              {({
                preco: 'Preço', fechamento: 'Fechamento', concorrente: 'Concorrente',
                falta_uso: 'Falta de uso', insatisfacao_suporte: 'Insatisfação', bug_nao_resolvido: 'Bug', outro: 'Outro'
              } as Record<string, string>)[cancellationReason] || cancellationReason}
            </span>
          )}
          {finalResult === 'revertido' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-ok-bg text-gms-ok border border-gms-ok/30">
              <CheckCircle2 className="w-3 h-3" /> Revertido
            </span>
          )}
          {finalResult === 'cancelado' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-err-bg text-gms-err border border-gms-err/30">
              Cancelado
            </span>
          )}
          {mrrValue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gms-g100 text-gms-g700 border border-gms-g200">
              <DollarSign className="w-3 h-3" /> R$ {Number(mrrValue).toFixed(2)}
            </span>
          )}
          {contactAttempts > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gms-g100 text-gms-g700 border border-gms-g200">
              <Phone className="w-3 h-3" /> {contactAttempts}x
            </span>
          )}
          {monthsActive && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gms-g100 text-gms-g500 border border-gms-g200">
              {monthsActive} meses
            </span>
          )}
        </div>
      )}

      {/* ═══ TIMER ROW: Timer ←→ Agent Badge ═══ */}
      <div className="flex items-center justify-between mb-2 min-w-0">
        {/* Timer */}
        <span className={cn(
          "flex items-center gap-1 text-[12px] font-bold",
          isFinished
            ? 'text-gms-ok'
            : isSupport
              ? (isQueue ? getWaitColor(elapsed) : 'text-gms-g500')
              : 'text-gms-g500'
        )}>
          <Timer className="w-3.5 h-3.5" />
          {isFinished ? (
            <span>Concluído</span>
          ) : isSupport ? (
            <>
              <span className="text-[11px] font-normal text-gms-g500">{isQueue ? 'Fila:' : 'Atend:'}</span>
              <span className="font-mono">{formatCompactTime(elapsed)}</span>
              {isQueueOver30 && (
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse",
                  isQueueOver60 ? 'bg-gms-err text-white' : 'bg-[#EA580C] text-white'
                )}>
                  {isQueueOver60 ? '1h+' : '30m+'}
                </span>
              )}
            </>
          ) : (
            <span className="font-mono">{formatCompactTime(stageElapsed)}</span>
          )}
        </span>

        {/* Agent badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn(
            "w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
            ticket.handler_type === 'ai'
              ? 'bg-gms-cyan text-gms-navy'
              : 'bg-gms-navy text-white'
          )}>
            {agentInitials}
          </div>
          <span className="text-[12px] text-gms-g700 font-semibold max-w-[100px] truncate">
            {agentDisplayName}
          </span>
        </div>
      </div>

      {/* ═══ SLA PROGRESS BARS (support only) ═══ */}
      {sla && !isFinished && isSupport && (
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-1.5 mb-2">
            {/* 1st Response SLA */}
            {firstResponseTarget > 0 && (
              <div className="flex flex-col gap-[3px]">
                <div className="flex items-center justify-between">
                   <span className={cn(
                    'text-[11px] font-semibold flex items-center gap-1',
                    firstResponseDone ? 'text-gms-ok' : firstResponseBreached ? 'text-gms-err' : 'text-gms-g500'
                   )}>
                     {firstResponseBreached ? <ShieldAlert className="w-3 h-3" /> : firstResponseDone ? <CheckCircle2 className="w-3 h-3" /> : null}
                     1ª Resposta
                   </span>
                   {firstResponseDone ? (
                     <span className="text-[11px] font-bold text-gms-ok">OK</span>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('text-[11px] font-bold', slaTextColor[getSLAStatus(firstResponseBreached, firstResponseWarning)])}>
                          {formatSLATime(firstResponseElapsedMin)} / {formatSLATime(firstResponseTarget)}
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
                  <div className="w-full h-[5px] rounded-full bg-gms-g200 overflow-hidden">
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
              <div className="flex flex-col gap-[3px]">
                <div className="flex items-center justify-between">
                   <span className={cn(
                    'text-[11px] font-semibold flex items-center gap-1',
                    resolutionBreached ? 'text-gms-err' : 'text-gms-g500'
                   )}>
                     {resolutionBreached && <ShieldAlert className="w-3 h-3" />}
                     Resolução
                   </span>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <span className={cn('text-[11px] font-bold', slaTextColor[getSLAStatus(resolutionBreached, resolutionWarning)])}>
                         {formatSLATime(resolutionElapsedMin)} / {formatSLATime(resolutionTarget)}
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
                <div className="w-full h-[5px] rounded-full bg-gms-g200 overflow-hidden">
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

      {/* ═══ CSAT STARS ═══ */}
      {csatRating != null && csatRating > 0 && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[11px] text-gms-g500 font-medium mr-0.5">CSAT</span>
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className={cn(
                "w-3.5 h-3.5",
                i <= csatRating ? "text-gms-yellow fill-gms-yellow" : "text-gms-g300"
              )}
            />
          ))}
        </div>
      )}

      {/* ═══ BILLING CONTEXT ═══ */}
      {boardType === 'billing' && (
        <div className="flex flex-col gap-1 mb-2">
          {openValue != null && (
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium truncate min-w-0">R$ {Number(openValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {daysLate != null && (
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-destructive font-medium truncate min-w-0">{daysLate} dias em atraso</span>
            </div>
          )}
          {lastContact && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="w-3.5 h-3.5" />
              <span className="truncate min-w-0">Último contato: {formatDaysAgo(lastContact)}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ FOOTER: Instance + Messages + CTAs (always visible) ═══ */}
      <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between pt-1.5 border-t border-gms-g200/40 min-w-0 gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {ticket.whatsapp_instance_name && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#166534] border border-[#25D366]/30 truncate max-w-[120px]">
                  <MessageSquare className="w-3 h-3 shrink-0 text-[#25D366]" />
                  <span className="truncate">{ticket.whatsapp_instance_name}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                WhatsApp: {ticket.whatsapp_instance_name} · {ticket.customer_phone || '—'}
              </TooltipContent>
            </Tooltip>
          )}
          {totalMessages > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gms-g500 px-1 py-0.5 rounded hover:bg-gms-g100 transition-colors cursor-default shrink-0">
                  <MessageSquare className="w-3 h-3" />
                  {totalMessages}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{totalMessages} mensagens no ticket</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn("flex items-center justify-center w-7 h-7 rounded-[5px] border border-gms-g200 bg-white text-gms-g500 hover:border-gms-cyan hover:text-gms-navy hover:bg-gms-cyan-light transition-colors", reclassifyMutation.isPending && "opacity-50 pointer-events-none")}
                onClick={e => { e.stopPropagation(); reclassifyMutation.mutate() }}
                onPointerDown={e => e.stopPropagation()}
                disabled={reclassifyMutation.isPending}
              >
                <Zap className={cn("w-[13px] h-[13px]", reclassifyMutation.isPending && "animate-pulse")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Reclassificar prioridade com IA</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded-[5px] border border-gms-g200 bg-white text-gms-g500 hover:border-gms-cyan hover:text-gms-navy hover:bg-gms-cyan-light transition-colors whitespace-nowrap"
                onClick={e => { e.stopPropagation(); setTransferOpen(true) }}
                onPointerDown={e => e.stopPropagation()}
              >
                <ArrowRightLeft className="w-3 h-3 shrink-0" />
                Transferir
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Transferir ticket para outro agente ou board</TooltipContent>
          </Tooltip>
        </div>
      </div>
      </TooltipProvider>

      {/* ═══ AI VALIDATION ACTIONS ═══ */}
      {isAiValidation && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gms-g200">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7C3AED]">
            <Bot className="w-3 h-3" />
            IA concluiu
          </span>
          <div className="flex-1" />
          <button
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-gms-ok text-white hover:bg-gms-ok/90 transition-colors"
            onClick={e => { e.stopPropagation(); onApproveAiClose?.(ticket.id) }}
            onPointerDown={e => e.stopPropagation()}
          >
            <CheckCircle2 className="w-3 h-3" />
            Aprovar
          </button>
          <button
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-gms-g100 text-gms-g700 border border-gms-g200 hover:bg-gms-g200 transition-colors"
            onClick={e => { e.stopPropagation(); onRejectAiClose?.(ticket.id) }}
            onPointerDown={e => e.stopPropagation()}
          >
            Reabrir
          </button>
        </div>
      )}

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        conversationId={ticket.id}
        currentBoardId={(ticket as any).kanban_board_id}
      />
    </Card>
  )
})
