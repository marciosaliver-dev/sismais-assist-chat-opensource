import { useCallback, useState } from 'react'
import { ChevronDown, Bot, Headphones, Timer, CalendarClock, ArrowRightLeft, AlertTriangle, CheckCircle2, ShieldAlert, Archive, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { KanbanTicket } from '@/hooks/useKanbanTickets'
import type { ColumnConfig } from './KanbanColumn'
import { useWaitTimer, getWaitColor, formatCompactTime } from '@/hooks/useWaitTimer'
import { useContactPicture } from '@/hooks/useContactPicture'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import * as LucideIcons from 'lucide-react'

function getIconComponent(iconName?: string | null) {
  if (!iconName) return null
  const name = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }> | undefined
  return Icon || null
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgente', className: 'bg-destructive text-destructive-foreground' },
  critical: { label: 'Crítica', className: 'bg-destructive text-destructive-foreground' },
  high: { label: 'Alta', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  medium: { label: 'Média', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
}

interface CategoryInfo { name: string; color: string }
interface ModuleInfo { name: string }

interface KanbanListViewProps {
  columns: ColumnConfig[]
  ticketsByStage: (stageId: string) => KanbanTicket[]
  sortTickets: (tickets: KanbanTicket[], isEntry?: boolean, columnOverride?: string) => KanbanTicket[]
  columnSortOverrides: Record<string, string>
  selectedTickets: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: (stageId: string) => void
  onCardClick: (ticket: KanbanTicket) => void
  activeTicketId: string | null
  categories: Map<string, CategoryInfo>
  modules: Map<string, ModuleInfo>
  boardType: string
  onMoveToBoard?: (ticketId: string) => void
}

export function KanbanListView({
  columns, ticketsByStage, sortTickets, columnSortOverrides,
  selectedTickets, onToggleSelect, onSelectAll,
  onCardClick, activeTicketId, categories, modules, boardType,
  onMoveToBoard,
}: KanbanListViewProps) {
  const isSupport = boardType === 'support'

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="space-y-2 pb-4">
        {columns.map(col => {
          const stageTickets = sortTickets(ticketsByStage(col.id), col.is_entry, columnSortOverrides[col.stageId])
          const allSelected = stageTickets.length > 0 && stageTickets.every(t => selectedTickets.has(t.id))
          const someSelected = stageTickets.some(t => selectedTickets.has(t.id))
          const ColIcon = getIconComponent(col.icon)

          return (
            <Collapsible key={col.id} defaultOpen={!col.is_final}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors group">
                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || 'hsl(var(--primary))' }}
                />
                <div
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={e => { e.stopPropagation(); onSelectAll(col.id) }}
                >
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    className="mr-1"
                    onCheckedChange={() => onSelectAll(col.id)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                {ColIcon && <ColIcon className="w-4 h-4 text-muted-foreground" />}
                <span className="font-semibold text-sm text-foreground">{col.label}</span>
                <Badge variant="secondary" className="text-xs ml-1">{stageTickets.length}</Badge>
                {col.wipLimit && stageTickets.length >= col.wipLimit && (
                  <Badge variant="destructive" className="text-xs">WIP</Badge>
                )}
                <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>

              <CollapsibleContent>
                {stageTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-6 py-3">Nenhum ticket nesta etapa</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden mt-1">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-8 px-2" />
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs max-w-[200px]">Última Msg</TableHead>
                          {isSupport && <TableHead className="text-xs">Status</TableHead>}
                          {isSupport && <TableHead className="text-xs">Prioridade</TableHead>}
                          {isSupport && <TableHead className="text-xs">Categoria</TableHead>}
                          <TableHead className="text-xs">Agente</TableHead>
                          <TableHead className="text-xs">Tempo</TableHead>
                          {isSupport && <TableHead className="text-xs">SLA</TableHead>}
                          <TableHead className="text-xs w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stageTickets.map(ticket => (
                          <ListRow
                            key={ticket.id}
                            ticket={ticket}
                            isSelected={selectedTickets.has(ticket.id)}
                            isActive={activeTicketId === ticket.id}
                            onToggleSelect={onToggleSelect}
                            onClick={onCardClick}
                            categories={categories}
                            modules={modules}
                            isSupport={isSupport}
                            isEntryColumn={col.is_entry}
                            onMoveToBoard={onMoveToBoard}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </ScrollArea>
  )
}

// Individual row component
function ListRow({
  ticket, isSelected, isActive, onToggleSelect, onClick,
  categories, modules, isSupport, isEntryColumn, onMoveToBoard,
}: {
  ticket: KanbanTicket
  isSelected: boolean
  isActive: boolean
  onToggleSelect: (id: string) => void
  onClick: (t: KanbanTicket) => void
  categories: Map<string, CategoryInfo>
  modules: Map<string, ModuleInfo>
  isSupport: boolean
  isEntryColumn?: boolean
  onMoveToBoard?: (id: string) => void
}) {
  const priority = priorityConfig[ticket.priority || 'medium']
  const category = ticket.ticket_category_id ? categories.get(ticket.ticket_category_id) : null

  // Timer
  const isQueue = ticket.statusType === 'queue'
  const isInProgress = ticket.statusType === 'in_progress'
  const isFinished = ticket.statusType === 'finished'
  const timerRef = isQueue
    ? (ticket.queue_entered_at || ticket.started_at)
    : isInProgress
      ? (ticket.human_started_at || ticket.started_at)
      : ticket.started_at
  const elapsed = useWaitTimer(isSupport && !isFinished ? timerRef : null, 10000)
  const stageElapsed = useWaitTimer(!isSupport ? ticket.started_at : null, 60000)

  // SLA
  const sla = isSupport ? ticket.slaTargets : undefined
  const now = Date.now()
  const firstResponseDone = !!ticket.first_human_response_at
  const firstResponseElapsedMin = ticket.queue_entered_at && !firstResponseDone
    ? (now - new Date(ticket.queue_entered_at).getTime()) / 60000 : 0
  const firstResponseTarget = sla?.first_response_target_minutes || 0
  const firstResponseBreached = !firstResponseDone && firstResponseTarget > 0 && firstResponseElapsedMin > firstResponseTarget
  const firstResponseWarning = !firstResponseDone && firstResponseTarget > 0 && firstResponseElapsedMin >= firstResponseTarget * 0.8 && !firstResponseBreached

  const resolutionDone = !!ticket.resolved_at
  const resolutionStartRef = ticket.queue_entered_at || ticket.started_at
  const resolutionElapsedMin = resolutionStartRef && !resolutionDone
    ? (now - new Date(resolutionStartRef).getTime()) / 60000 : 0
  const resolutionTarget = sla?.resolution_target_minutes || 0
  const resolutionBreached = !resolutionDone && resolutionTarget > 0 && resolutionElapsedMin > resolutionTarget
  const resolutionWarning = !resolutionDone && resolutionTarget > 0 && resolutionElapsedMin >= resolutionTarget * 0.8 && !resolutionBreached

  // Avatar
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
    undefined, undefined, defaultInstanceId || undefined,
    ticket.avatar_url, ticket.customer_phone
  )

  return (
    <TableRow
      className={cn(
        'cursor-pointer transition-colors',
        isActive && 'bg-primary/10 hover:bg-primary/15',
        isSelected && !isActive && 'bg-accent',
      )}
      onClick={() => onClick(ticket)}
    >
      {/* Checkbox */}
      <TableCell className="px-2 w-8" onClick={e => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(ticket.id)} />
      </TableCell>

      {/* Cliente */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="w-7 h-7 shrink-0">
            {contactAvatarUrl && <AvatarImage src={contactAvatarUrl} />}
            <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
              {(ticket.customer_name || ticket.customer_phone || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
              {ticket.customer_name || ticket.customer_phone}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">{ticket.customer_phone}</span>
              <span className="text-xs text-muted-foreground font-mono">#{ticket.ticket_number || '—'}</span>
            </div>
          </div>
        </div>
      </TableCell>

      {/* Última Msg */}
      <TableCell className="max-w-[200px]">
        <p className="text-xs text-muted-foreground truncate">{ticket.last_message || '—'}</p>
      </TableCell>

      {/* Status */}
      {isSupport && (
        <TableCell>
          {ticket.statusName && (
            <Badge
              variant="outline"
              className="text-xs whitespace-nowrap"
              style={{
                borderColor: `${ticket.statusColor || '#6b7280'}60`,
                backgroundColor: `${ticket.statusColor || '#6b7280'}15`,
                color: ticket.statusColor || '#6b7280',
              }}
            >
              {ticket.statusName}
            </Badge>
          )}
        </TableCell>
      )}

      {/* Prioridade */}
      {isSupport && (
        <TableCell>
          <Badge variant="outline" className={cn('text-xs whitespace-nowrap', priority?.className)}>
            {priority?.label}
          </Badge>
        </TableCell>
      )}

      {/* Categoria */}
      {isSupport && (
        <TableCell>
          {category ? (
            <Badge
              variant="outline"
              className="text-xs whitespace-nowrap"
              style={{
                borderColor: `${category.color}60`,
                backgroundColor: `${category.color}15`,
                color: category.color,
              }}
            >
              {category.name}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      )}

      {/* Agente */}
      <TableCell>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {ticket.handler_type === 'ai' ? (
            <>
              <Bot className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate max-w-[80px]">{ticket.ai_agent_name || 'IA'}</span>
            </>
          ) : (
            <>
              <Headphones className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[80px]">{ticket.humanAgentName || 'Humano'}</span>
            </>
          )}
        </div>
      </TableCell>

      {/* Tempo */}
      <TableCell>
        <span className={cn(
          "flex items-center gap-1 text-xs font-mono",
          isSupport && isQueue ? getWaitColor(elapsed) : 'text-muted-foreground'
        )}>
          <Timer className="w-3 h-3" />
          {isSupport ? (
            isFinished ? '—' : formatCompactTime(elapsed)
          ) : (
            formatCompactTime(stageElapsed)
          )}
        </span>
      </TableCell>

      {/* SLA */}
      {isSupport && (
        <TableCell>
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5">
              {/* 1ª Resposta */}
              {sla && firstResponseTarget > 0 && !isFinished && (
                <Tooltip>
                  <TooltipTrigger>
                    {firstResponseDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : firstResponseBreached ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                    ) : firstResponseWarning ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    ) : (
                      <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    1ª Resp: {firstResponseDone ? 'OK' : `${Math.round(firstResponseElapsedMin)}/${firstResponseTarget}min`}
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Resolução */}
              {sla && resolutionTarget > 0 && !isFinished && (
                <Tooltip>
                  <TooltipTrigger>
                    {resolutionDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : resolutionBreached ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                    ) : resolutionWarning ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    ) : (
                      <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Resolução: {resolutionDone ? 'OK' : `${Math.round(resolutionElapsedMin)}/${resolutionTarget}min`}
                  </TooltipContent>
                </Tooltip>
              )}
              {(!sla || (firstResponseTarget === 0 && resolutionTarget === 0)) && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </TooltipProvider>
        </TableCell>
      )}

      {/* Ações */}
      <TableCell className="w-10 px-2" onClick={e => e.stopPropagation()}>
        {onMoveToBoard && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMoveToBoard(ticket.id)}
            title="Transferir board"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
