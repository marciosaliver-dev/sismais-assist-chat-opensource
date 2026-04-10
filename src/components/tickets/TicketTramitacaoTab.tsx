import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Ticket,
  Bot,
  Headphones,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  ArrowRightLeft,
  Zap,
  Circle,
  Loader2,
  GitBranch,
  FolderKanban,
  UserPlus,
  AlertTriangle,
  Flag,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

interface TimelineEvent {
  id: string
  timestamp: string
  type: string
  label: string
  description?: string
  actor?: string
  icon: React.ElementType
  color: string
  dotColor: string
  isCurrentState?: boolean
  isPulsing?: boolean
}

const statusLabels: Record<string, string> = {
  novo: 'Novo',
  aguardando: 'Aguardando',
  aguardando_cliente: 'Aguardando Cliente',
  em_atendimento: 'Em Atendimento',
  finalizado: 'Finalizado',
  resolvido: 'Resolvido',
}

const assignedByLabels: Record<string, string> = {
  kanban: 'Via Kanban',
  manual: 'Transferência manual',
  auto: 'Automático',
  orchestrator: 'Via Orquestrador',
  'board-transfer': 'Transferência de board',
  system: 'Sistema',
}

const movedByLabels: Record<string, string> = {
  user: 'Movido manualmente',
  'board-transfer': 'Transferência de board',
  automation: 'Via automação',
  system: 'Sistema',
}

function formatTs(ts: string | null | undefined): string {
  if (!ts) return ''
  try {
    return format(new Date(ts), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return ''
  }
}

function formatTsRelative(ts: string | null | undefined): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Agora'
    if (diffMin < 60) return `${diffMin}min atrás`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h atrás`
    const diffD = Math.floor(diffH / 24)
    return `${diffD}d atrás`
  } catch {
    return ''
  }
}

export function TicketTramitacaoTab({ conversationId }: { conversationId: string }) {
  // Fetch main conversation data
  const { data: conv } = useQuery({
    queryKey: ['tramitacao-conv', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, started_at, resolved_at, queue_entered_at, human_started_at, first_human_response_at, status, handler_type, priority, human_agent_id, current_agent_id, ai_agents(name), human_agents(name)')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  // Fetch agent assignments
  const { data: assignments } = useQuery({
    queryKey: ['tramitacao-assignments', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_assignments')
        .select('id, agent_type, ai_agent_id, human_agent_id, assigned_at, unassigned_at, assigned_by, reason, ai_agents(name, color, specialty), human_agents(name)')
        .eq('conversation_id', conversationId)
        .order('assigned_at', { ascending: true })
      return data || []
    },
    enabled: !!conversationId,
  })

  // Fetch ticket_stage_history
  const { data: stageHistory } = useQuery({
    queryKey: ['tramitacao-stages', conversationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ticket_stage_history')
        .select('id, from_stage_id, to_stage_id, moved_at, moved_by, human_agent_id, kanban_stages!ticket_stage_history_to_stage_id_fkey(name, color), human_agents(name)')
        .eq('conversation_id', conversationId)
        .order('moved_at', { ascending: true })
      return data || []
    },
    enabled: !!conversationId,
  })

  // Fetch ticket_status_history for status changes with actor info
  const { data: statusHistory } = useQuery({
    queryKey: ['tramitacao-status-history', conversationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ticket_status_history')
        .select('id, change_type, from_value, to_value, changed_by, human_agent_id, changed_at, human_agents(name)')
        .eq('conversation_id', conversationId)
        .order('changed_at', { ascending: true })
      return data || []
    },
    enabled: !!conversationId,
  })

  // Fetch relevant AI logs (escalation, routing, classification)
  const { data: aiLogs } = useQuery({
    queryKey: ['tramitacao-ailogs', conversationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ticket_ai_logs')
        .select('id, evento_tipo, criado_em, confianca, metadata, agente_id, ai_agents(name, color)')
        .eq('ticket_id', conversationId)
        .in('evento_tipo', ['escalonamento', 'routing', 'classificacao'])
        .order('criado_em', { ascending: true })
      return data || []
    },
    enabled: !!conversationId,
  })

  const isLoading = !conv && !assignments && !stageHistory && !aiLogs && !statusHistory

  const events: TimelineEvent[] = []

  if (conv) {
    // 1. Ticket created
    if (conv.started_at) {
      events.push({
        id: 'created',
        timestamp: conv.started_at,
        type: 'created',
        label: `Ticket #${conv.ticket_number || '—'} criado`,
        actor: 'Sistema',
        icon: Ticket,
        color: 'text-blue-600 dark:text-blue-400',
        dotColor: 'bg-blue-500',
      })
    }

    // 2. Agent assignments
    for (const a of assignments || []) {
      const assignedAt = (a as any).assigned_at
      if (!assignedAt) continue

      if ((a as any).agent_type === 'ai') {
        const agentName = (a as any).ai_agents?.name || 'IA'
        const specialty = (a as any).ai_agents?.specialty || ''
        events.push({
          id: `assign-ai-${(a as any).id}`,
          timestamp: assignedAt,
          type: 'ai_assigned',
          label: `IA assumiu atendimento`,
          description: `Agente: ${agentName}${specialty ? ` (${specialty})` : ''}`,
          actor: agentName,
          icon: Bot,
          color: 'text-emerald-600 dark:text-emerald-400',
          dotColor: 'bg-emerald-500',
        })
      } else {
        const humanName = (a as any).human_agents?.name || 'Humano'
        const assignedBy = (a as any).assigned_by
        const reason = (a as any).reason
        const assignedByLabel = assignedBy ? (assignedByLabels[assignedBy] || assignedBy) : undefined
        const descParts: string[] = []
        if (assignedByLabel) descParts.push(assignedByLabel)
        if (reason && reason !== 'Transferência manual') descParts.push(reason)
        events.push({
          id: `assign-human-${(a as any).id}`,
          timestamp: assignedAt,
          type: 'human_assigned',
          label: `${humanName} assumiu atendimento`,
          description: descParts.length > 0 ? descParts.join(' — ') : undefined,
          actor: humanName,
          icon: UserCheck,
          color: 'text-sky-600 dark:text-sky-400',
          dotColor: 'bg-sky-500',
        })
      }
    }

    // 3. Relevant AI log events
    for (const log of aiLogs || []) {
      const ts = (log as any).criado_em
      if (!ts) continue
      const tipo = (log as any).evento_tipo

      if (tipo === 'escalonamento') {
        const confianca = (log as any).confianca
        const agentName = (log as any).ai_agents?.name
        events.push({
          id: `ailog-${(log as any).id}`,
          timestamp: ts,
          type: 'escalation',
          label: 'IA escalou para humano',
          description: confianca != null ? `Confiança: ${Math.round(confianca * 100)}%` : undefined,
          actor: agentName || undefined,
          icon: AlertTriangle,
          color: 'text-amber-600 dark:text-amber-400',
          dotColor: 'bg-amber-500',
          isPulsing: conv.handler_type === 'human' && conv.status === 'aguardando',
        })
      } else if (tipo === 'classificacao') {
        const meta = (log as any).metadata as any
        const newPriority = meta?.priority || meta?.nova_prioridade
        events.push({
          id: `ailog-${(log as any).id}`,
          timestamp: ts,
          type: 'classification',
          label: 'Prioridade classificada',
          description: newPriority ? `Prioridade: ${newPriority}` : undefined,
          icon: Zap,
          color: 'text-orange-600 dark:text-orange-400',
          dotColor: 'bg-orange-500',
        })
      } else if (tipo === 'routing') {
        const agentName = (log as any).ai_agents?.name
        events.push({
          id: `ailog-${(log as any).id}`,
          timestamp: ts,
          type: 'routing',
          label: 'Roteamento de agente',
          description: agentName ? `Agente selecionado: ${agentName}` : undefined,
          actor: agentName || undefined,
          icon: ArrowRightLeft,
          color: 'text-violet-600 dark:text-violet-400',
          dotColor: 'bg-violet-500',
        })
      }
    }

    // 4. Stage movements from stage_history
    for (const sh of stageHistory || []) {
      const ts = (sh as any).moved_at
      if (!ts) continue
      const stageName = (sh as any).kanban_stages?.name || 'Etapa'
      const stageColor = (sh as any).kanban_stages?.color
      const movedBy = (sh as any).moved_by
      const movedByLabel = movedBy ? (movedByLabels[movedBy] || movedBy) : undefined
      const humanActorName = (sh as any).human_agents?.name as string | undefined
      const descParts: string[] = []
      if (humanActorName) descParts.push(`Movido por ${humanActorName}`)
      else if (movedBy === 'automation') descParts.push('Via automação')
      else if (movedBy === 'system') descParts.push('Via sistema')
      else if (movedByLabel) descParts.push(movedByLabel)
      events.push({
        id: `stage-${(sh as any).id}`,
        timestamp: ts,
        type: 'stage_move',
        label: `Movido para "${stageName}"`,
        description: descParts.length > 0 ? descParts.join(' · ') : undefined,
        actor: humanActorName,
        icon: FolderKanban,
        color: 'text-purple-600 dark:text-purple-400',
        dotColor: stageColor || 'bg-purple-500',
      })
    }

    // 5. Status changes from ticket_status_history
    for (const sh of statusHistory || []) {
      const ts = (sh as any).changed_at
      if (!ts) continue
      const changeType = (sh as any).change_type
      if (changeType !== 'status_change') continue // stage_change already covered above
      const fromVal = (sh as any).from_value || '—'
      const toVal = (sh as any).to_value || '—'
      const changedBy = (sh as any).changed_by
      const humanName = (sh as any).human_agents?.name as string | undefined
      const actorLabel = humanName || (changedBy === 'human_agent' ? 'Agente' : changedBy === 'system' ? 'Sistema' : changedBy === 'automation' ? 'Automação' : changedBy || 'Sistema')
      const fromLabel = statusLabels[fromVal] || fromVal
      const toLabel = statusLabels[toVal] || toVal
      events.push({
        id: `status-hist-${(sh as any).id}`,
        timestamp: ts,
        type: 'status_change',
        label: `Status: ${fromLabel} → ${toLabel}`,
        description: humanName ? `Alterado por ${humanName}` : (changedBy === 'automation' ? 'Via automação' : changedBy === 'system' ? 'Via sistema' : undefined),
        actor: actorLabel,
        icon: ArrowRightLeft,
        color: 'text-indigo-600 dark:text-indigo-400',
        dotColor: 'bg-indigo-500',
      })
    }

    // 5. Key timestamps from conversation
    if (conv.human_started_at) {
      const alreadyCovered = events.some(
        e => e.type === 'human_assigned' &&
          Math.abs(new Date(e.timestamp).getTime() - new Date(conv.human_started_at!).getTime()) < 60000
      )
      if (!alreadyCovered) {
        const humanName = (conv as any).human_agents?.name || 'Agente'
        events.push({
          id: 'human-started',
          timestamp: conv.human_started_at,
          type: 'human_started',
          label: 'Atendimento humano iniciado',
          actor: humanName,
          icon: Headphones,
          color: 'text-sky-600 dark:text-sky-400',
          dotColor: 'bg-sky-400',
        })
      }
    }

    if (conv.first_human_response_at) {
      const humanName = (conv as any).human_agents?.name || 'Agente'
      events.push({
        id: 'first-response',
        timestamp: conv.first_human_response_at,
        type: 'first_response',
        label: 'Primeira resposta humana',
        actor: humanName,
        icon: MessageSquare,
        color: 'text-sky-600 dark:text-sky-400',
        dotColor: 'bg-sky-300',
      })
    }

    if (conv.resolved_at) {
      events.push({
        id: 'resolved',
        timestamp: conv.resolved_at,
        type: 'resolved',
        label: 'Ticket finalizado',
        actor: 'Sistema',
        icon: CheckCircle2,
        color: 'text-emerald-600 dark:text-emerald-400',
        dotColor: 'bg-emerald-500',
      })
    }

    // 6. Current state indicator (only if not resolved)
    if (!conv.resolved_at && conv.status) {
      const isAwaiting = conv.handler_type === 'human' && conv.status === 'aguardando'
      const currentActorName = conv.handler_type === 'ai'
        ? ((conv as any).ai_agents?.name || 'IA')
        : ((conv as any).human_agents?.name || 'Agente')
      events.push({
        id: 'current',
        timestamp: new Date().toISOString(),
        type: 'current',
        label: statusLabels[conv.status] || conv.status,
        description: isAwaiting ? 'Aguardando atendente humano' : undefined,
        actor: currentActorName,
        icon: isAwaiting ? AlertTriangle : Circle,
        color: isAwaiting ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        dotColor: isAwaiting ? 'bg-amber-500' : 'bg-muted-foreground/40',
        isCurrentState: true,
        isPulsing: isAwaiting,
      })
    }
  }

  // Sort events by timestamp, deduplicate by proximity
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Deduplicate: remove events within 5 seconds of each other with same type
  const deduped: TimelineEvent[] = []
  for (const ev of events) {
    const last = deduped[deduped.length - 1]
    if (
      last &&
      last.type === ev.type &&
      Math.abs(new Date(last.timestamp).getTime() - new Date(ev.timestamp).getTime()) < 5000
    ) {
      continue
    }
    deduped.push(ev)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">Carregando tramitação...</span>
      </div>
    )
  }

  if (deduped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
        <GitBranch className="w-8 h-8 opacity-40" />
        <span className="text-xs font-medium">Nenhuma movimentação registrada</span>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 space-y-0">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Tramitação do Ticket</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
            {deduped.length} evento{deduped.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="relative">
          {deduped.map((event, index) => {
            const Icon = event.icon
            const isLast = index === deduped.length - 1
            const isCurrent = event.isCurrentState

            return (
              <div key={event.id} className="flex gap-3 group/event">
                {/* Timeline spine */}
                <div className="flex flex-col items-center shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-background z-10 shrink-0',
                        isCurrent ? 'ring-border/60 bg-muted' : 'bg-background border border-border',
                        event.isPulsing && 'animate-pulse',
                      )}>
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          isCurrent ? '' : event.dotColor,
                        )}>
                          <Icon className={cn('w-3.5 h-3.5', isCurrent ? event.color : 'text-white')} />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      {formatTs(event.timestamp)}
                    </TooltipContent>
                  </Tooltip>
                  {!isLast && (
                    <div className="w-px flex-1 bg-border/50 my-0.5 min-h-[20px]" />
                  )}
                </div>

                {/* Event content */}
                <div className={cn(
                  'flex-1 pb-4 min-w-0',
                  isLast && 'pb-0',
                )}>
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className={cn(
                        'text-xs font-semibold leading-tight',
                        isCurrent ? event.color : 'text-foreground',
                        event.isPulsing && 'animate-pulse',
                      )}>
                        {event.label}
                      </p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                          {event.description}
                        </p>
                      )}
                      {event.actor && (
                        <p className="text-xs mt-0.5 leading-tight">
                          <span className="text-muted-foreground">por </span>
                          <span className="font-semibold text-foreground/80">{event.actor}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap shrink-0 mt-0.5">
                      {isCurrent ? 'agora' : formatTsRelative(event.timestamp)}
                    </span>
                  </div>
                  {!isCurrent && (
                    <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
                      {formatTs(event.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
