import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { KanbanCard } from './KanbanCard'
import { StageAutomationsDialog } from './StageAutomationsDialog'
import type { KanbanTicket } from '@/hooks/useKanbanTickets'
import { AlertTriangle, Settings, ArrowDownAZ, ChevronRight, ChevronsLeftRight, MoreVertical, Clock } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export interface ColumnConfig {
  id: string
  stageId: string
  label: string
  color: string
  icon?: string | null
  is_final?: boolean
  wipLimit?: number | null
  is_entry?: boolean
  is_exit?: boolean
  is_ai_validation?: boolean
  alertThresholdMinutes?: number | null
}

export interface HumanAgentOption {
  id: string
  name: string
}

interface CategoryInfo {
  name: string
  color: string
}

interface ModuleInfo {
  name: string
}

interface Props {
  column: ColumnConfig
  tickets: KanbanTicket[]
  draggingId: string | null
  onCardClick: (ticket: KanbanTicket) => void
  humanAgents?: HumanAgentOption[]
  categories?: Map<string, CategoryInfo>
  modules?: Map<string, ModuleInfo>
  boardType?: string
  selectedTickets?: Set<string>
  onToggleSelect?: (id: string) => void
  onSelectAll?: (stageId: string) => void
  activeTicketId?: string | null
  isEntryColumn?: boolean
  sortOverride?: string
  onChangeSortBy?: (stageId: string, value: string) => void
  onMoveToBoard?: (ticketId: string) => void
  collapsedByDefault?: boolean
  businessHours?: import('@/utils/calculateBusinessMinutes').BusinessHourEntry[]
  onApproveAiClose?: (ticketId: string) => void
  onRejectAiClose?: (ticketId: string) => void
}

const COLLAPSED_STORAGE_KEY = 'kanban-collapsed-columns'

function getCollapsedColumns(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveCollapsedColumns(set: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...set]))
  } catch { /* ignore */ }
}

function getIconComponent(iconName?: string | null) {
  if (!iconName) return null
  const name = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }> | undefined
  return Icon || null
}

export function KanbanColumn({ column, tickets, draggingId, onCardClick, humanAgents = [], categories, modules, boardType, selectedTickets, onToggleSelect, onSelectAll, activeTicketId, isEntryColumn, sortOverride, onChangeSortBy, onMoveToBoard, collapsedByDefault, businessHours, onApproveAiClose, onRejectAiClose }: Props) {
  const [automationsOpen, setAutomationsOpen] = useState(false)

  // Initialize collapsed state from localStorage, fallback to collapsedByDefault
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = getCollapsedColumns()
    if (stored.has(column.stageId)) return true
    return !!collapsedByDefault
  })

  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  // Persist collapse state to localStorage
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev
      const stored = getCollapsedColumns()
      if (next) {
        stored.add(column.stageId)
      } else {
        stored.delete(column.stageId)
      }
      saveCollapsedColumns(stored)
      return next
    })
  }, [column.stageId])

  const urgentCount = tickets.filter(t =>
    t.priority === 'urgent' || t.priority === 'critical'
  ).length

  const hasUrgent = urgentCount > 0
  const count = tickets.length
  const IconComponent = getIconComponent(column.icon)

  // Real-time counter: tickets awaiting human 30min+
  const [queueOver30Count, setQueueOver30Count] = useState(0)

  const queueTickets = useMemo(() =>
    tickets.filter(t => t.handler_type === 'human' && t.status === 'aguardando' && t.queue_entered_at),
    [tickets]
  )

  useEffect(() => {
    if (queueTickets.length === 0) { setQueueOver30Count(0); return }
    const THRESHOLD = 30 * 60 * 1000
    const calc = () => {
      const now = Date.now()
      const c = queueTickets.filter(t => now - new Date(t.queue_entered_at!).getTime() >= THRESHOLD).length
      setQueueOver30Count(c)
    }
    calc()
    const id = setInterval(calc, 15000)
    return () => clearInterval(id)
  }, [queueTickets])

  const allSelected = tickets.length > 0 && selectedTickets && tickets.every(t => selectedTickets.has(t.id))
  const someSelected = selectedTickets && tickets.some(t => selectedTickets.has(t.id)) && !allSelected

  const wipLimit = column.wipLimit
  const isAtWipLimit = wipLimit != null && count >= wipLimit

  const sortOptions = [
    { value: 'default', label: 'Padrão (global)' },
    { value: 'arrival', label: 'Chegada' },
    { value: 'date_asc', label: 'Mais antigos' },
    { value: 'priority', label: 'Prioridade' },
    { value: 'customer_name', label: 'Nome' },
    { value: 'agent', label: 'Agente' },
  ]

  // ─── COLLAPSED VIEW ───────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col items-center w-[56px] flex-shrink-0 rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer group/collapsed',
          'border-gms-g200 bg-gms-g100 hover:bg-white hover:border-gms-cyan/50',
          isOver && 'ring-2 ring-gms-cyan/50 bg-gms-cyan-light scale-[1.02]',
        )}
        onClick={toggleCollapse}
        title={`${column.label} — ${count} ticket${count !== 1 ? 's' : ''}. Clique para expandir.`}
      >
        {/* Color indicator top bar */}
        <div
          className="w-full h-[3px] shrink-0"
          style={{ backgroundColor: column.color }}
        />

        {/* Count badge */}
        <div className="pt-3 pb-2">
          <span
            className={cn(
              'text-xs font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center block',
              count === 0
                ? 'text-gms-g500 bg-gms-g200'
                : hasUrgent
                  ? 'text-white bg-gms-err'
                  : 'text-white bg-gms-navy'
            )}
          >
            {count}
          </span>
        </div>

        {/* Vertical label */}
        <div className="flex-1 flex items-center justify-center min-h-0 py-2">
          <span
            className="text-[11px] font-semibold text-gms-g500 group-hover/collapsed:text-gms-g900 transition-colors whitespace-nowrap"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              maxHeight: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {column.label}
          </span>
        </div>

        {/* Expand hint */}
        <div className="pb-3 pt-1">
          <ChevronRight className="w-4 h-4 text-gms-g300 group-hover/collapsed:text-gms-cyan transition-colors" />
        </div>

        <StageAutomationsDialog
          open={automationsOpen}
          onOpenChange={setAutomationsOpen}
          stageId={column.stageId}
          stageLabel={column.label}
        />
      </div>
    )
  }

  // ─── EXPANDED VIEW ────────────────────────────────────────────────
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'kb-col flex flex-col flex-shrink-0 rounded-xl border transition-all duration-200 overflow-hidden',
        'border-gms-g200 bg-gms-g100',
        isOver && !isAtWipLimit && 'ring-2 ring-gms-cyan/50 scale-[1.01]',
        isOver && isAtWipLimit && 'ring-2 ring-gms-err/50',
        isAtWipLimit && 'border-gms-err/60 shadow-[0_0_0_1px_rgba(220,38,38,0.2)]',
        !isAtWipLimit && hasUrgent && 'border-gms-err/50 shadow-[0_0_0_1px_rgba(220,38,38,0.2)]'
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 border-b-[3px] bg-white',
          isAtWipLimit ? 'border-gms-err/30' : hasUrgent ? 'border-gms-err/30' : ''
        )}
        style={{
          borderBottomColor: isAtWipLimit || hasUrgent ? undefined : column.color,
        }}
      >
        {onSelectAll && (
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={() => onSelectAll(column.stageId)}
            onClick={e => e.stopPropagation()}
            className="shrink-0"
          />
        )}
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        {IconComponent && <IconComponent className="w-4 h-4 text-muted-foreground shrink-0" />}
        <h3 className="text-[13px] font-semibold text-gms-g900 truncate flex-1">{column.label}</h3>

        {hasUrgent && (
          <span className="flex items-center gap-0.5 text-xs font-bold text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-1.5 py-0.5 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            {urgentCount}
          </span>
        )}

        {queueOver30Count > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-white bg-[#EA580C] rounded-full px-1.5 py-0.5 animate-pulse" title={`${queueOver30Count} ticket(s) aguardando há mais de 30min`}>
            <Clock className="w-3 h-3" />
            {queueOver30Count} &gt;30m
          </span>
        )}

        {/* Collapse button */}
        <button
          onClick={toggleCollapse}
          className="p-1 rounded hover:bg-gms-g100 text-gms-g500 hover:text-gms-navy transition-colors"
          title="Colapsar coluna"
        >
          <ChevronsLeftRight className="w-3.5 h-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded hover:bg-gms-g100 text-gms-g500 hover:text-gms-navy transition-colors"
              title="Opções da etapa"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!isEntryColumn && onChangeSortBy && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs gap-2">
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    Ordenar
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36">
                    {sortOptions.map(opt => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => onChangeSortBy(column.stageId, opt.value)}
                        className={cn(
                          'text-xs',
                          (sortOverride || 'default') === opt.value && 'font-bold text-primary'
                        )}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setAutomationsOpen(true)} className="text-xs gap-2">
              <Settings className="w-3.5 h-3.5" />
              Automações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span
          className={cn(
            'text-xs font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center transition-colors',
            isAtWipLimit
              ? 'text-white bg-gms-err'
              : count === 0
                ? 'text-gms-g500 bg-gms-g200'
                : hasUrgent
                  ? 'text-white bg-gms-err'
                  : 'text-white bg-gms-navy'
          )}
        >
          {wipLimit != null ? `${count}/${wipLimit}` : count}
        </span>
      </div>

      <div className="kb-col-body flex-1 min-h-0 scrollbar-thin">
        <div className="p-2 space-y-2">
          {tickets.map(ticket => (
            <KanbanCard
              key={ticket.id}
              ticket={ticket}
              isDragging={draggingId === ticket.id}
              onClick={onCardClick}
              humanAgents={humanAgents}
              categories={categories}
              modules={modules}
              boardType={boardType}
              isSelected={selectedTickets?.has(ticket.id)}
              isActive={activeTicketId === ticket.id}
              onToggleSelect={onToggleSelect}
              isEntryColumn={isEntryColumn}
              onMoveToBoard={onMoveToBoard}
              alertThresholdMinutes={column.alertThresholdMinutes}
              businessHours={businessHours}
              isAiValidation={column.is_ai_validation}
              onApproveAiClose={onApproveAiClose}
              onRejectAiClose={onRejectAiClose}
            />
          ))}
          {tickets.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-10 mx-1 rounded-lg border-2 border-dashed"
              style={{ borderColor: `${column.color}30` }}
            >
              {IconComponent ? (
                <div className="mb-1.5" style={{ color: `${column.color}40` }}>
                  <IconComponent className="w-7 h-7" />
                </div>
              ) : (
                <div
                  className="w-7 h-7 rounded-full mb-1.5 flex items-center justify-center"
                  style={{ backgroundColor: `${column.color}10`, color: `${column.color}50` }}
                >
                  <span className="text-sm font-medium">0</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground/40">Nenhum ticket</p>
            </div>
          )}
        </div>
      </div>

      <StageAutomationsDialog
        open={automationsOpen}
        onOpenChange={setAutomationsOpen}
        stageId={column.stageId}
        stageLabel={column.label}
      />
    </div>
  )
}
