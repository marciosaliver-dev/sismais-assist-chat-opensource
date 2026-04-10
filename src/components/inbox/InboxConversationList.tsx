import { useState, useMemo, useRef, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Filter, RefreshCw, Bot, CheckSquare, X, CheckCheck, CircleDot, Tag, Headphones, Timer, User, AlertTriangle, Cpu, Camera } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { cn, normalizeText } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useContactPicture } from '@/hooks/useContactPicture'
import { useVirtualList } from '@/hooks/useVirtualList'
import { useWaitTimer, getWaitColor, formatCompactTime } from '@/hooks/useWaitTimer'
import { useSLAConfig } from '@/hooks/useSLAConfig'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { NewConversationDialog } from './NewConversationDialog'
import { GroupBadge } from './GroupBadge'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import type { Tables } from '@/integrations/supabase/types'

type Conversation = Tables<'ai_conversations'> & {
  ai_agents?: { name: string; color: string; specialty: string } | null
  human_agents?: { name: string } | null
  _last_message_preview?: string | null
  _last_message_time?: string | null
  _unread_count?: number
}

// Colors for instance badges — cycles through for up to 10+ instances
const INSTANCE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', dot: 'bg-pink-500' },
]

interface InstanceInfo {
  id: string
  instance_name: string
  profile_name: string | null
  status: string
}

interface InboxConversationListProps {
  conversations: Conversation[]
  selectedId?: string
  onSelect: (conversation: Conversation) => void
  instanceId?: string
  onConversationCreated?: (conversationId: string) => void
  isLoading?: boolean
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onSelectAll?: () => void
  onCancelSelection?: () => void
  onBulkClose?: () => void
  onToggleSelectionMode?: () => void
  instances?: InstanceInfo[]
}

const filterTabs = [
  { id: 'open', label: '📬 Ativos', tooltip: 'Conversas abertas com interação recente (não finalizadas)' },
  { id: 'human', label: '👤 Espera', tooltip: 'Conversas aguardando resposta de um agente humano' },
  { id: 'queue', label: '📥 Fila', tooltip: 'Conversas na fila de espera, ordenadas por tempo de chegada' },
  { id: 'resolved', label: '✅ Finalizados', tooltip: 'Atendimentos finalizados (somente leitura)' },
]

type ContactFilter = 'all' | 'contacts' | 'groups'

const priorityOptions = [
  { id: 'critical', label: '🔴 Crítica', color: 'text-destructive' },
  { id: 'high', label: '🟠 Alta', color: 'text-orange-500' },
  { id: 'medium', label: '🟡 Média', color: 'text-primary' },
  { id: 'low', label: '🟢 Baixa', color: 'text-muted-foreground' },
]

// ===== Section header type for grouped lists =====
type SectionItem = 
  | { type: 'header'; label: string; icon: React.ReactNode; color: string; count: number }
  | { type: 'conversation'; conv: Conversation }

function SectionHeader({ label, icon, color, count }: { label: string; icon: React.ReactNode; color: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5" style={{ height: 32 }}>
      <span className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest", color)}>
        {icon}
        {label}
      </span>
      <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full bg-secondary", color)}>
        {count}
      </span>
    </div>
  )
}

function groupConversationsIntoSections(
  convs: Conversation[],
  slaConfig?: Map<string, { first_response_target_minutes: number; resolution_target_minutes: number }>
): SectionItem[] {
  const withAgent = convs.filter(c => c.handler_type === 'human' && c.status === 'em_atendimento')
  const humanWaiting = convs.filter(c => c.handler_type === 'human' && c.status === 'aguardando')
  const aiActive = convs.filter(c => c.handler_type === 'ai' && (c.status === 'aguardando' || c.status === 'em_atendimento'))
  
  // SLA breach: conversations waiting without first human response
  const slaBreached = convs.filter(c => {
    if (c.first_human_response_at) return false
    const cfg = slaConfig?.get(c.priority || 'medium')
    if (!cfg) return false
    const elapsed = (Date.now() - new Date(c.queue_entered_at || c.started_at || Date.now()).getTime()) / 1000
    return elapsed > cfg.first_response_target_minutes * 60
  })

  // Deduplicate: remove SLA breached from the other groups to avoid duplication
  const slaIds = new Set(slaBreached.map(c => c.id))
  const withAgentClean = withAgent.filter(c => !slaIds.has(c.id))
  const humanWaitingClean = humanWaiting.filter(c => !slaIds.has(c.id))
  const aiActiveClean = aiActive.filter(c => !slaIds.has(c.id))

  // Collect all grouped IDs to find ungrouped conversations
  const groupedIds = new Set([
    ...withAgentClean.map(c => c.id),
    ...humanWaitingClean.map(c => c.id),
    ...slaBreached.map(c => c.id),
    ...aiActiveClean.map(c => c.id),
  ])
  const ungrouped = convs.filter(c => !groupedIds.has(c.id))

  const items: SectionItem[] = []

  if (withAgentClean.length > 0) {
    items.push({ type: 'header', label: 'Com Atendente', icon: <Headphones className="w-3 h-3" />, color: 'text-blue-500', count: withAgentClean.length })
    withAgentClean.forEach(conv => items.push({ type: 'conversation', conv }))
  }

  if (humanWaitingClean.length > 0) {
    items.push({ type: 'header', label: 'Aguardando Humano', icon: <Timer className="w-3 h-3" />, color: 'text-amber-500', count: humanWaitingClean.length })
    humanWaitingClean.forEach(conv => items.push({ type: 'conversation', conv }))
  }

  if (slaBreached.length > 0) {
    items.push({ type: 'header', label: 'SLA Estourado', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-destructive', count: slaBreached.length })
    slaBreached.forEach(conv => items.push({ type: 'conversation', conv }))
  }

  if (aiActiveClean.length > 0) {
    items.push({ type: 'header', label: 'IA em Andamento', icon: <Cpu className="w-3 h-3" />, color: 'text-primary', count: aiActiveClean.length })
    aiActiveClean.forEach(conv => items.push({ type: 'conversation', conv }))
  }

  // Any conversations that didn't match any group
  if (ungrouped.length > 0) {
    ungrouped.forEach(conv => items.push({ type: 'conversation', conv }))
  }

  // If nothing matched groups (edge case), return flat list
  if (items.length === 0) {
    convs.forEach(conv => items.push({ type: 'conversation', conv }))
  }

  return items
}

// ===== Single conversation item (extracted so it can use hooks) =====
function ConversationItemWithPicture({
  conv,
  isSelected,
  onSelect,
  groupInfo,
  instanceId,
  getStatusColor,
  showQueuePosition,
  itemIndex,
  selectionMode,
  isChecked,
  onToggleCheck,
  statusTypeMap,
  slaConfig,
  instanceColorMap,
}: {
  conv: Conversation
  isSelected: boolean
  onSelect: (c: Conversation) => void
  groupInfo?: { is_group: boolean; contact_name: string | null; contact_picture_url: string | null; instance_id: string | null; chat_id: string }
  instanceId?: string
  getStatusColor: (status: string | null) => string
  showQueuePosition?: boolean
  itemIndex: number
  selectionMode?: boolean
  isChecked?: boolean
  onToggleCheck?: () => void
  statusTypeMap?: Map<string, string>
  slaConfig?: Map<string, { first_response_target_minutes: number; resolution_target_minutes: number }>
  instanceColorMap?: Map<string, { name: string; colors: typeof INSTANCE_COLORS[0] }>
}) {
  const unread = conv._unread_count || 0
  const hasUnread = unread > 0
  const lastPreview = conv._last_message_preview || ''
  const lastTime = conv._last_message_time
  const isAI = conv.handler_type === 'ai'
  const convIsGroup = groupInfo?.is_group === true
  const displayName = convIsGroup
    ? (groupInfo?.contact_name || conv.customer_name || 'Grupo')
    : (conv.customer_name || conv.customer_phone)

  // Lazy-fetch profile picture — enabled for ALL conversations (not just groups)
  const effectiveInstanceId = groupInfo?.instance_id || instanceId
  const { url: contactPictureUrl, isLoading: isPictureLoading } = useContactPicture(
    conv.id,
    groupInfo?.chat_id || conv.uazapi_chat_id || undefined,
    effectiveInstanceId,
    groupInfo?.contact_picture_url,
    conv.customer_phone
  )

  // Wait timer for queue status
  const isQueueStatus = statusTypeMap?.get(conv.status || '') === 'queue'
  const timerRef = isQueueStatus ? (conv.queue_entered_at || conv.started_at) : conv.started_at
  const waitElapsed = useWaitTimer(!conv.first_human_response_at && isQueueStatus ? timerRef : null, 60000)

  // SLA breach check
  const slaCfg = slaConfig?.get(conv.priority || 'medium')
  const isSLABreached = isQueueStatus && !conv.first_human_response_at && slaCfg && waitElapsed > slaCfg.first_response_target_minutes * 60

  return (
    <button
      key={conv.id}
      role="option"
      aria-selected={isSelected}
      aria-label={`Conversa com ${displayName}${hasUnread ? `, ${unread} mensagens não lidas` : ''}`}
      onClick={() => selectionMode ? onToggleCheck?.() : onSelect(conv)}
      className={cn(
        'w-full p-3 text-left rounded-xl conv-card transition-all',
        isSelected && !selectionMode
          ? 'bg-primary/5 border border-primary/10'
          : 'hover:bg-secondary border border-transparent',
        hasUnread && !isSelected && 'bg-primary/5 border-primary/10',
        selectionMode && isChecked && 'bg-primary/10 border-primary/20',
        isSLABreached && !isSelected && 'border-l-2 border-l-destructive rounded-l-none pl-[10px]'
      )}
      style={{ height: 76 }}
    >
      <div className="flex items-start gap-3">
        {selectionMode && (
          <div className="flex items-center justify-center shrink-0 mt-2.5">
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onToggleCheck?.()}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5"
            />
          </div>
        )}
        {showQueuePosition && (
          <div className="flex flex-col items-center justify-center shrink-0 mt-1">
            <span className="text-xs font-bold text-primary w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">{itemIndex + 1}</span>
          </div>
        )}
        <div className="relative shrink-0">
          {isPictureLoading && !contactPictureUrl ? (
            <Skeleton className="w-11 h-11 rounded-2xl" />
          ) : (
            <Avatar className="w-11 h-11 rounded-2xl border border-card">
              {contactPictureUrl && (
                <AvatarImage src={contactPictureUrl} alt={displayName || ''} className="object-cover rounded-2xl" />
              )}
              <AvatarFallback className={cn(
                "rounded-2xl font-semibold text-sm",
                convIsGroup
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary"
              )}>
                {convIsGroup ? '👥' : (conv.customer_name?.[0]?.toUpperCase() || conv.customer_phone[0])}
              </AvatarFallback>
            </Avatar>
          )}
          <div className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card',
            getStatusColor(conv.status)
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={cn(
              "text-sm truncate",
              hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground"
            )}>
              {conv.ticket_number && (
                <span className="text-xs font-mono text-muted-foreground mr-1">
                  #{conv.ticket_number}
                </span>
              )}
              {displayName}
              {convIsGroup && <GroupBadge groupName={groupInfo?.contact_name} className="ml-1.5" />}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isQueueStatus && waitElapsed > 0 && (
                <span className={cn("text-[9px] font-mono font-bold flex items-center gap-0.5", getWaitColor(waitElapsed))}>
                  <Timer className="w-2.5 h-2.5" />
                  {formatCompactTime(waitElapsed)}
                </span>
              )}
              {isSLABreached && (
                <Badge className="text-[8px] px-1 py-0 h-3.5 bg-red-500 text-white animate-pulse font-bold">
                  SLA
                </Badge>
              )}
              <span className={cn(
                "text-xs",
                hasUnread ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {(lastTime || conv.started_at) && (() => {
                  const d = new Date(lastTime || conv.started_at!);
                  const now = new Date();
                  const isToday = d.toDateString() === now.toDateString();
                  return <span title={format(d, "dd/MM/yyyy 'às' HH:mm:ss")}>{isToday ? format(d, 'HH:mm') : format(d, 'dd/MM HH:mm')}</span>;
                })()}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              "text-xs truncate flex-1",
              hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {showQueuePosition && conv.started_at
                ? `Aguardando ${formatDistanceToNow(new Date(conv.started_at), { addSuffix: false, locale: ptBR })}`
                : lastPreview || (conv.ai_agents?.name || 'Sem agente')
              }
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {conv.handler_type === 'human' && (conv as any).human_agents?.name && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-500">
                  <User className="w-3 h-3" />
                  {(() => {
                    const name = (conv as any).human_agents.name as string
                    const parts = name.split(' ')
                    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
                  })()}
                </span>
              )}
              {isAI && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Bot className="w-3 h-3" />
                  IA
                </span>
              )}
              {hasUnread && (
                <Badge className="bg-primary text-primary-foreground h-5 min-w-5 px-1.5 text-xs font-bold rounded-full">
                  {unread > 99 ? '99+' : unread}
                </Badge>
              )}
            </div>
          </div>
          {/* Instance badge + Tags */}
          {(instanceColorMap && instanceColorMap.size > 1) || ((conv as any).tags && Array.isArray((conv as any).tags) && (conv as any).tags.length > 0) ? (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {instanceColorMap && instanceColorMap.size > 1 && (() => {
                const instInfo = instanceColorMap.get((conv as any).whatsapp_instance_id || '')
                if (!instInfo) return null
                return (
                  <Badge key="inst" variant="outline" className={cn("text-[9px] h-3.5 px-1.5 font-semibold border-0", instInfo.colors.bg, instInfo.colors.text)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full mr-1 inline-block", instInfo.colors.dot)} />
                    {instInfo.name}
                  </Badge>
                )
              })()}
              {(conv as any).tags && Array.isArray((conv as any).tags) && ((conv as any).tags as string[]).slice(0, 3).map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-[9px] h-3.5 px-1.5 bg-secondary/50 font-medium">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

// ===== Virtualized Conversation List =====
function VirtualConversationList({
  filtered,
  sectionItems,
  selectedId,
  onSelect,
  groupChatsMap,
  isLoading,
  instanceId,
  onConversationCreated,
  getStatusColor,
  showQueuePosition,
  selectionMode,
  selectedIds,
  onToggleSelect,
  statusTypeMap,
  slaConfig,
  instanceColorMap,
}: {
  filtered: Conversation[]
  sectionItems?: SectionItem[]
  selectedId?: string
  onSelect: (c: Conversation) => void
  groupChatsMap?: Map<string, { is_group: boolean; contact_name: string | null; contact_picture_url: string | null; instance_id: string | null; chat_id: string }>
  isLoading?: boolean
  instanceId?: string
  onConversationCreated?: (id: string) => void
  getStatusColor: (status: string | null) => string
  showQueuePosition?: boolean
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  statusTypeMap?: Map<string, string>
  slaConfig?: Map<string, { first_response_target_minutes: number; resolution_target_minutes: number }>
  instanceColorMap?: Map<string, { name: string; colors: typeof INSTANCE_COLORS[0] }>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      setContainerHeight(entries[0]?.contentRect.height ?? 400)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // When using sections, we render without virtualization for simplicity (sections have mixed heights)
  const useSections = !!sectionItems && sectionItems.length > 0
  
  const { visibleItems, totalHeight, offsetTop, onScroll } = useVirtualList(filtered, 82, containerHeight)

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden px-3">
        <div className="space-y-2 p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-secondary/50 animate-pulse space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded-lg bg-primary/10 shimmer" />
                  <div className="h-2.5 w-1/2 rounded-lg bg-primary/5 shimmer" />
                </div>
              </div>
              <div className="h-2.5 w-full rounded-lg bg-primary/5 shimmer" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const totalCount = useSections ? sectionItems.filter(i => i.type === 'conversation').length : filtered.length

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-4 opacity-60">
          <rect x="10" y="18" width="60" height="44" rx="8" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" />
          <path d="M10 30L40 48L70 30" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" />
          <circle cx="62" cy="22" r="8" fill="hsl(var(--primary))" opacity="0.2" />
          <circle cx="62" cy="22" r="4" fill="hsl(var(--primary))" opacity="0.4" />
        </svg>
        <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma conversa</p>
        <p className="text-xs text-muted-foreground mb-4">Inicie uma nova conversa para começar</p>
        <NewConversationDialog
          instanceId={instanceId}
          onConversationCreated={(id) => onConversationCreated?.(id)}
        />
      </div>
    )
  }

  // Sectioned rendering (for "Ativos" tab)
  if (useSections) {
    let convIndex = 0
    return (
      <div ref={containerRef} className="flex-1 overflow-y-auto px-3">
        {sectionItems.map((item, idx) => {
          if (item.type === 'header') {
            return <SectionHeader key={`header-${idx}`} label={item.label} icon={item.icon} color={item.color} count={item.count} />
          }
          const conv = item.conv
          const chatId = conv.uazapi_chat_id
          const groupInfo = chatId ? groupChatsMap?.get(chatId) : undefined
          const currentIndex = convIndex++
          return (
            <ConversationItemWithPicture
              key={conv.id}
              conv={conv}
              isSelected={selectedId === conv.id}
              onSelect={onSelect}
              groupInfo={groupInfo}
              instanceId={instanceId}
              getStatusColor={getStatusColor}
              showQueuePosition={showQueuePosition}
              itemIndex={currentIndex}
              selectionMode={selectionMode}
              isChecked={selectedIds?.has(conv.id)}
              onToggleCheck={() => onToggleSelect?.(conv.id)}
              statusTypeMap={statusTypeMap}
              slaConfig={slaConfig}
              instanceColorMap={instanceColorMap}
            />
          )
        })}
      </div>
    )
  }

  // Flat virtualized rendering (other tabs)
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-3"
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
          {visibleItems.map(({ item: conv, index: itemIndex }) => {
            const chatId = (conv as Record<string, unknown>).uazapi_chat_id as string | undefined
            const groupInfo = chatId ? groupChatsMap?.get(chatId) : undefined

            return (
              <ConversationItemWithPicture
                key={conv.id}
                conv={conv}
                isSelected={selectedId === conv.id}
                onSelect={onSelect}
                groupInfo={groupInfo}
                instanceId={instanceId}
                getStatusColor={getStatusColor}
                showQueuePosition={showQueuePosition}
                itemIndex={itemIndex}
                selectionMode={selectionMode}
                isChecked={selectedIds?.has(conv.id)}
                onToggleCheck={() => onToggleSelect?.(conv.id)}
                statusTypeMap={statusTypeMap}
                slaConfig={slaConfig}
                instanceColorMap={instanceColorMap}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===== Consolidated Filter Dropdown =====
function FilterDropdown({
  selectedPriorities, setSelectedPriorities,
  selectedAgents, setSelectedAgents,
  selectedStatuses, setSelectedStatuses,
  selectedTags, setSelectedTags,
  selectedHumanAgents, setSelectedHumanAgents,
  selectedStages, setSelectedStages,
  contactFilter, setContactFilter,
  showResolved, setShowResolved, resolvedCount,
  aiAgents, humanAgents, tagOptions, priorityOptions, stages,
}: {
  selectedPriorities: string[]; setSelectedPriorities: (v: string[]) => void
  selectedAgents: string[]; setSelectedAgents: (v: string[]) => void
  selectedStatuses: string[]; setSelectedStatuses: (v: string[]) => void
  selectedTags: string[]; setSelectedTags: (v: string[]) => void
  selectedHumanAgents: string[]; setSelectedHumanAgents: (v: string[]) => void
  selectedStages: string[]; setSelectedStages: (v: string[]) => void
  contactFilter: ContactFilter; setContactFilter: (v: ContactFilter) => void
  showResolved: boolean; setShowResolved: (v: boolean) => void; resolvedCount: number
  aiAgents: { id: string; name: string; color: string | null }[]
  humanAgents: { id: string; name: string }[]
  stages: { id: string; name: string; color: string }[]
  tagOptions: { id: string; label: string }[]
  priorityOptions: { id: string; label: string; color: string }[]
}) {
  const totalActive = selectedPriorities.length + selectedAgents.length + selectedStatuses.length + selectedTags.length + selectedHumanAgents.length + selectedStages.length + (contactFilter !== 'all' ? 1 : 0) + (showResolved ? 1 : 0)
  const statusOptions = [
    { id: 'aguardando', label: '⏳ Aguardando' },
    { id: 'em_atendimento', label: '🔵 Em Atendimento' },
    { id: 'finalizado', label: '✅ Finalizado' },
  ]
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant={totalActive > 0 ? 'default' : 'ghost'} className="h-8 w-8 relative">
              <Filter className="w-4 h-4" />
              {totalActive > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                  {totalActive}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[250px]">
          Filtros avançados: prioridade, status, categoria, agente e etapa
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-lg z-50 max-h-[80vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold pt-2">Tipo de Contato</DropdownMenuLabel>
        <DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()} checked={contactFilter === 'all'} onCheckedChange={() => setContactFilter('all')}>
          📋 Todos
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()} checked={contactFilter === 'contacts'} onCheckedChange={() => setContactFilter('contacts')}>
          👤 Contatos
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()} checked={contactFilter === 'groups'} onCheckedChange={() => setContactFilter('groups')}>
          👥 Grupos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Prioridade</DropdownMenuLabel>
        {priorityOptions.map((opt) => (
          <DropdownMenuCheckboxItem key={opt.id} onSelect={(e) => e.preventDefault()} checked={selectedPriorities.includes(opt.id)}
            onCheckedChange={(checked) => setSelectedPriorities(checked ? [...selectedPriorities, opt.id] : selectedPriorities.filter(p => p !== opt.id))}>
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</DropdownMenuLabel>
        {statusOptions.map((opt) => (
          <DropdownMenuCheckboxItem key={opt.id} onSelect={(e) => e.preventDefault()} checked={selectedStatuses.includes(opt.id)}
            onCheckedChange={(checked) => setSelectedStatuses(checked ? [...selectedStatuses, opt.id] : selectedStatuses.filter(s => s !== opt.id))}>
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Categoria</DropdownMenuLabel>
        {tagOptions.map((opt) => (
          <DropdownMenuCheckboxItem key={opt.id} onSelect={(e) => e.preventDefault()} checked={selectedTags.includes(opt.id)}
            onCheckedChange={(checked) => setSelectedTags(checked ? [...selectedTags, opt.id] : selectedTags.filter(t => t !== opt.id))}>
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Agente IA</DropdownMenuLabel>
        {aiAgents.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum agente ativo</div>
        ) : aiAgents.map((agent) => (
          <DropdownMenuCheckboxItem key={agent.id} onSelect={(e) => e.preventDefault()} checked={selectedAgents.includes(agent.id)}
            onCheckedChange={(checked) => setSelectedAgents(checked ? [...selectedAgents, agent.id] : selectedAgents.filter(a => a !== agent.id))}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agent.color || '#45E5E5' }} />
              {agent.name}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Agente Humano</DropdownMenuLabel>
        {humanAgents.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum agente ativo</div>
        ) : humanAgents.map((agent) => (
          <DropdownMenuCheckboxItem key={agent.id} onSelect={(e) => e.preventDefault()} checked={selectedHumanAgents.includes(agent.id)}
            onCheckedChange={(checked) => setSelectedHumanAgents(checked ? [...selectedHumanAgents, agent.id] : selectedHumanAgents.filter(a => a !== agent.id))}>
            {agent.name}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Etapa Kanban</DropdownMenuLabel>
        {stages.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma etapa configurada</div>
        ) : stages.map((stage) => (
          <DropdownMenuCheckboxItem key={stage.id} onSelect={(e) => e.preventDefault()} checked={selectedStages.includes(stage.id)}
            onCheckedChange={(checked) => setSelectedStages(checked ? [...selectedStages, stage.id] : selectedStages.filter(s => s !== stage.id))}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              {stage.name}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Atendimento</DropdownMenuLabel>
        <DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()} checked={showResolved} onCheckedChange={(checked) => setShowResolved(!!checked)}>
          ✅ Mostrar Finalizados ({resolvedCount})
        </DropdownMenuCheckboxItem>
        {totalActive > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              onClick={() => { setSelectedPriorities([]); setSelectedAgents([]); setSelectedStatuses([]); setSelectedTags([]); setSelectedHumanAgents([]); setSelectedStages([]); setContactFilter('all'); setShowResolved(false) }}
              className="w-full px-2 py-1.5 text-xs text-destructive hover:text-destructive/80 text-left font-medium"
            >
              Limpar todos os filtros
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function InboxConversationList({ conversations, selectedId, onSelect, instanceId, onConversationCreated, isLoading, selectionMode, selectedIds, onToggleSelect, onSelectAll, onCancelSelection, onBulkClose, onToggleSelectionMode, instances }: InboxConversationListProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [activeFilter, setActiveFilter] = useState('open')
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all')
  const [syncing, setSyncing] = useState(false)
  const [syncingPhotos, setSyncingPhotos] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedHumanAgents, setSelectedHumanAgents] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [showResolved, setShowResolved] = useState(false)

  // Fetch real categories from database
  const { data: categoryOptions } = useQuery({
    queryKey: ['ticket-categories-inbox-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ticket_categories')
        .select('id, name')
        .eq('active', true)
        .order('sort_order')
      return (data || []).map(c => ({ id: c.id, label: c.name }))
    }
  })

  // Fetch active AI agents for filter
  const { data: aiAgents } = useQuery({
    queryKey: ['ai-agents-inbox-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_agents').select('id, name, color').eq('is_active', true).order('name')
      return data || []
    }
  })

  // Fetch active human agents for filter
  const { data: humanAgents } = useQuery({
    queryKey: ['human-agents-inbox-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('human_agents').select('id, name').neq('is_active', false).order('name')
      return data || []
    }
  })

  // Fetch agent assignments only when human agent filter is active
  const { data: agentAssignments } = useQuery({
    queryKey: ['agent-assignments-inbox', selectedHumanAgents],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_assignments')
        .select('conversation_id, human_agent_id')
        .eq('agent_type', 'human')
        .is('unassigned_at', null)
      return data || []
    },
    enabled: selectedHumanAgents.length > 0,
  })

  // Fetch ticket stages for filter
  const { data: stages } = useQuery({
    queryKey: ['ticket-stages-inbox-filter'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('kanban_stages').select('id, name, color').eq('active', true).order('sort_order')
      return data || []
    }
  })

  // Fetch ticket status types for timer coloring
  const { data: statusTypeMap } = useQuery({
    queryKey: ['ticket-status-types-inbox'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_statuses').select('slug, status_type')
      const map = new Map<string, string>()
      for (const s of data || []) map.set(s.slug, s.status_type)
      return map
    },
    staleTime: 5 * 60 * 1000,
  })

  // SLA config
  const { data: slaConfig } = useSLAConfig()

  // Fetch group info for all conversations that have uazapi_chat_id
  const chatIds = useMemo(() =>
    conversations
      .map(c => (c as Record<string, unknown>).uazapi_chat_id as string | undefined)
      .filter(Boolean) as string[],
    [conversations]
  )

  const { data: groupChatsMap } = useQuery({
    queryKey: ['uazapi-group-chats', chatIds],
    queryFn: async () => {
      if (chatIds.length === 0) return new Map<string, { is_group: boolean; contact_name: string | null; contact_picture_url: string | null; instance_id: string | null; chat_id: string }>()
      const { data } = await supabase
        .from('uazapi_chats')
        .select('chat_id, is_group, contact_name, contact_picture_url, instance_id')
        .in('chat_id', chatIds)
      const map = new Map<string, { is_group: boolean; contact_name: string | null; contact_picture_url: string | null; instance_id: string | null; chat_id: string }>()
      for (const c of data || []) {
        map.set(c.chat_id, { is_group: c.is_group ?? false, contact_name: c.contact_name, contact_picture_url: c.contact_picture_url, instance_id: c.instance_id, chat_id: c.chat_id })
      }
      return map
    },
    enabled: chatIds.length > 0,
  })

  // Build instance color map for badges
  const instanceColorMap = useMemo(() => {
    const map = new Map<string, { name: string; colors: typeof INSTANCE_COLORS[0] }>()
    if (!instances || instances.length <= 1) return map
    instances.forEach((inst, idx) => {
      map.set(inst.id, {
        name: inst.profile_name || inst.instance_name,
        colors: INSTANCE_COLORS[idx % INSTANCE_COLORS.length],
      })
    })
    return map
  }, [instances])

  const handleSyncContacts = async () => {
    if (!instanceId) {
      toast.error('Nenhuma instância WhatsApp conectada')
      return
    }
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'fetchContacts', instanceId },
      })
      if (error) throw error
      const result = data?.data
      toast.success(`Sincronizado! ${result?.synced || 0} contatos, ${result?.lid_fixed || 0} LIDs corrigidos`)
    } catch (err) {
      toast.error('Erro ao sincronizar contatos')
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncPhotos = async () => {
    setSyncingPhotos(true)
    try {
      const { data, error } = await supabase.functions.invoke('enrich-contact', {
        body: { action: 'batch', limit: 30 },
      })
      if (error) throw error
      toast.success(`Fotos sincronizadas: ${data?.enriched || 0} de ${data?.total || 0} contatos`)
    } catch (err) {
      toast.error('Erro ao sincronizar fotos')
      console.error(err)
    } finally {
      setSyncingPhotos(false)
    }
  }

  const getStatusColor = (status: string | null) => {
    if (status === 'em_atendimento') return 'bg-blue-500'
    if (status === 'finalizado') return 'bg-emerald-500'
    if (status === 'aguardando') return 'bg-muted-foreground'
    return 'bg-warning'
  }

  const isOpenStatus = (status: string | null) =>
    status === 'aguardando' || status === 'em_atendimento'

  const tabCounts = useMemo(() => {
    const open = conversations.filter(c => isOpenStatus(c.status)).length
    const human = conversations.filter(c => isOpenStatus(c.status) && c.handler_type === 'human').length
    const queue = conversations.filter(c => isOpenStatus(c.status) && c.handler_type === 'ai').length
    const resolved = conversations.filter(c => c.status === 'finalizado').length
    return { open, human, queue, resolved }
  }, [conversations])

  const filtered = conversations
    .filter((conv) => {
      const normalizedSearch = normalizeText(debouncedSearch)
      const chatId = (conv as Record<string, unknown>).uazapi_chat_id as string | undefined
      const contactName = chatId ? groupChatsMap?.get(chatId)?.contact_name || '' : ''
      const numericSearch = debouncedSearch.replace(/\D/g, '')
      const matchesSearch =
        !debouncedSearch ||
        normalizeText(conv.customer_name || '').includes(normalizedSearch) ||
        normalizeText(conv.customer_email || '').includes(normalizedSearch) ||
        normalizeText(contactName).includes(normalizedSearch) ||
        (numericSearch.length >= 3 && conv.customer_phone.replace(/\D/g, '').includes(numericSearch)) ||
        String(conv.ticket_number || '').includes(debouncedSearch.trim())

      let matchesFilter = true
      if (activeFilter === 'resolved') matchesFilter = conv.status === 'finalizado'
      else if (activeFilter === 'human') matchesFilter = isOpenStatus(conv.status) && conv.handler_type === 'human'
      else if (activeFilter === 'queue') matchesFilter = isOpenStatus(conv.status) && conv.handler_type === 'ai'
      else matchesFilter = isOpenStatus(conv.status) || (showResolved && conv.status === 'finalizado')

      const matchesPriority = selectedPriorities.length === 0 || selectedPriorities.includes((conv as any).priority || 'medium')

      // Contact type filter
      let matchesContactType = true
      if (contactFilter !== 'all') {
        const chatId = (conv as Record<string, unknown>).uazapi_chat_id as string | undefined
        const groupInfo = chatId ? groupChatsMap?.get(chatId) : undefined
        const convIsGroup = groupInfo?.is_group === true
        if (contactFilter === 'groups') matchesContactType = convIsGroup
        else if (contactFilter === 'contacts') matchesContactType = !convIsGroup
      }

      // Agent filter
      const matchesAgent = selectedAgents.length === 0 || selectedAgents.includes(conv.current_agent_id || '')

      // Status detail filter
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(conv.status || '')

      // Category filter (via ticket_category_id)
      const matchesTag = selectedTags.length === 0 ||
        selectedTags.includes(conv.ticket_category_id || '')

      // Human agent filter via human_agent_id + agent_assignments
      // Conversations in queue (handler_type='ai') always visible regardless of human agent filter
      const matchesHumanAgent = selectedHumanAgents.length === 0 || conv.handler_type === 'ai' || (() => {
        // Direct match on conversation's human_agent_id
        if (selectedHumanAgents.includes((conv as any).human_agent_id || '')) return true
        // Fallback: check agent_assignments
        const convAssignments = agentAssignments?.filter(a => a.conversation_id === conv.id)
        return convAssignments?.some(a => selectedHumanAgents.includes(a.human_agent_id || '')) ?? false
      })()

      // Stage filter
      const matchesStage = selectedStages.length === 0 || selectedStages.includes(conv.stage_id || '')

      return matchesSearch && matchesFilter && matchesPriority && matchesContactType && matchesAgent && matchesStatus && matchesTag && matchesHumanAgent && matchesStage
    })
    .sort((a, b) => {
      const unreadA = (a as Conversation)._unread_count || 0
      const unreadB = (b as Conversation)._unread_count || 0
      if (unreadA > 0 && unreadB === 0) return -1
      if (unreadB > 0 && unreadA === 0) return 1

      const timeA = (a as Conversation)._last_message_time ? new Date((a as Conversation)._last_message_time!).getTime() : (a.started_at ? new Date(a.started_at).getTime() : 0)
      const timeB = (b as Conversation)._last_message_time ? new Date((b as Conversation)._last_message_time!).getTime() : (b.started_at ? new Date(b.started_at).getTime() : 0)
      return timeB - timeA
    })

  // Group conversations into sections for "Ativos" tab
  const sectionItems = useMemo(() => {
    if (activeFilter !== 'open') return undefined
    return groupConversationsIntoSections(filtered, slaConfig)
  }, [filtered, activeFilter, slaConfig])

  return (
    <div className="flex flex-col h-full w-full bg-card">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-foreground">Mensagens</h2>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant={selectionMode ? 'default' : 'ghost'}
              className="h-7 w-7"
              onClick={onToggleSelectionMode}
              title={selectionMode ? 'Cancelar seleção' : 'Selecionar conversas'}
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleSyncPhotos}
              disabled={syncingPhotos}
              title="Sincronizar fotos de perfil"
            >
              <Camera className={cn("w-3.5 h-3.5", syncingPhotos && 'animate-pulse')} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleSyncContacts}
              disabled={syncing}
              title="Sincronizar contatos"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && 'animate-spin')} />
            </Button>
            <FilterDropdown
              selectedPriorities={selectedPriorities}
              setSelectedPriorities={setSelectedPriorities}
              selectedAgents={selectedAgents}
              setSelectedAgents={setSelectedAgents}
              selectedStatuses={selectedStatuses}
              setSelectedStatuses={setSelectedStatuses}
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
              selectedHumanAgents={selectedHumanAgents}
              setSelectedHumanAgents={setSelectedHumanAgents}
              selectedStages={selectedStages}
              setSelectedStages={setSelectedStages}
              aiAgents={aiAgents || []}
              humanAgents={humanAgents || []}
              stages={stages || []}
              tagOptions={categoryOptions || []}
              priorityOptions={priorityOptions}
              contactFilter={contactFilter}
              setContactFilter={setContactFilter}
              showResolved={showResolved}
              setShowResolved={setShowResolved}
              resolvedCount={tabCounts.resolved}
            />
            <NewConversationDialog
              instanceId={instanceId}
              onConversationCreated={(id) => onConversationCreated?.(id)}
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-9 h-9 bg-secondary border-border rounded-lg text-sm focus-visible:ring-primary/20 focus-visible:border-primary"
          />
        </div>

        {/* Queue Stat Cards */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {filterTabs.map((tab) => {
            const count = tabCounts[tab.id as keyof typeof tabCounts] ?? 0
            const isActive = activeFilter === tab.id
            const countColors: Record<string, string> = {
              open: 'text-primary',
              human: 'text-amber-500',
              queue: 'text-violet-500',
              resolved: 'text-emerald-500',
            }
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveFilter(tab.id)}
                    className={cn(
                      'flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all',
                      isActive
                        ? 'bg-primary/5 border-primary/20 shadow-sm'
                        : 'bg-secondary/50 border-transparent hover:border-border hover:bg-secondary'
                    )}
                  >
                    <span className={cn(
                      'font-display font-bold text-base leading-none mb-1',
                      isActive ? countColors[tab.id] : (countColors[tab.id] || 'text-foreground')
                    )}>
                      {count}
                    </span>
                    <span className={cn(
                      'text-[9px] font-bold uppercase tracking-wide leading-none',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {tab.id === 'open' ? 'Ativos' :
                       tab.id === 'human' ? 'Espera' :
                       tab.id === 'queue' ? 'Fila' : 'Final.'}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  {tab.tooltip}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Priority Filter Pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedPriorities([])}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
              selectedPriorities.length === 0
                ? 'bg-primary/10 text-primary border-primary/25'
                : 'bg-transparent text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
            )}
          >
            Todos
          </button>
          {[
            { id: 'high', label: 'Alta' },
            { id: 'medium', label: 'Média' },
            { id: 'low', label: 'Baixa' },
          ].map((prio) => {
            const isActive = selectedPriorities.includes(prio.id)
            const activeColors: Record<string, string> = {
              high: 'bg-destructive/10 text-destructive border-destructive/25',
              medium: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
              low: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800',
            }
            return (
              <button
                key={prio.id}
                onClick={() => {
                  setSelectedPriorities(isActive
                    ? selectedPriorities.filter(p => p !== prio.id)
                    : [...selectedPriorities, prio.id]
                  )
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                  isActive
                    ? activeColors[prio.id]
                    : 'bg-transparent text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
                )}
              >
                {prio.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selection Action Bar */}
      {selectionMode && selectedIds && selectedIds.size > 0 && (
        <div className="mx-2 mb-2 p-2 bg-primary rounded-xl flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-primary-foreground pl-1 shrink-0">
            {selectedIds.size} sel.
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10" onClick={onSelectAll}>
                  <CheckCheck className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Selecionar todos</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10" onClick={onCancelSelection}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Cancelar seleção</TooltipContent>
            </Tooltip>
            <Button size="sm" className="h-7 text-xs bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-lg px-3" onClick={onBulkClose}>
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Queue Header */}
      {activeFilter === 'queue' && filtered.length > 0 && (
        <div className="px-6 pb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Ordem da Fila</span>
        </div>
      )}

      {/* List */}
      <VirtualConversationList
        filtered={filtered}
        sectionItems={sectionItems}
        selectedId={selectedId}
        onSelect={onSelect}
        groupChatsMap={groupChatsMap}
        isLoading={isLoading}
        instanceId={instanceId}
        onConversationCreated={onConversationCreated}
        getStatusColor={getStatusColor}
        showQueuePosition={activeFilter === 'queue'}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        statusTypeMap={statusTypeMap}
        slaConfig={slaConfig}
        instanceColorMap={instanceColorMap}
      />
    </div>
  )
}
