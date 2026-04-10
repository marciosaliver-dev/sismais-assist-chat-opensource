import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare, Ticket, CheckCircle2, FileText, StickyNote,
  DollarSign, Settings, Phone, Mail, Globe, Smartphone,
  Bot, User, Cpu
} from 'lucide-react'
import type { TimelineEvent } from '@/hooks/useCustomer360'

const EVENT_ICONS: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  ticket_created: Ticket,
  ticket_resolved: CheckCircle2,
  contract_change: FileText,
  annotation: StickyNote,
  payment: DollarSign,
  system: Settings,
  call: Phone,
  email: Mail,
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40',
  web: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40',
  phone: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/40',
  email: 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700/40',
  instagram: 'text-pink-600 bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-900/40',
  internal: 'text-[#10293F] bg-[#E8F9F9] border-[rgba(69,229,229,0.4)]',
}

const ACTOR_ICONS: Record<string, typeof User> = {
  client: User,
  ai_agent: Bot,
  human_agent: User,
  system: Cpu,
}

interface TimelineItemProps {
  event: TimelineEvent
  compact?: boolean
  className?: string
}

export function TimelineItem({ event, compact, className }: TimelineItemProps) {
  const Icon = EVENT_ICONS[event.event_type] || Settings
  const ActorIcon = ACTOR_ICONS[event.actor_type || 'system'] || Cpu
  const channelClass = CHANNEL_COLORS[event.channel || 'internal'] || CHANNEL_COLORS.internal

  const timeAgo = formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true, locale: ptBR })

  if (compact) {
    return (
      <div className={cn('flex items-start gap-2.5 py-1.5', className)}>
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 border', channelClass)}>
          <Icon className="w-3 h-3" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-foreground truncate">{event.title}</p>
          <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-3 group', className)}>
      {/* Linha vertical + icone */}
      <div className="flex flex-col items-center">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 border', channelClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="w-px flex-1 bg-border group-last:bg-transparent" />
      </div>

      {/* Conteudo */}
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{event.title}</p>
          {event.channel && (
            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border', channelClass)}>
              {event.channel}
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          {event.actor_name && (
            <span className="flex items-center gap-1">
              <ActorIcon className="w-3 h-3" />
              {event.actor_name}
            </span>
          )}
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  )
}
