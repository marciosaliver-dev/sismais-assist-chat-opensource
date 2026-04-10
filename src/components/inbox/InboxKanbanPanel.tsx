import { useState, useMemo, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search, ChevronDown, ChevronRight,
  Smartphone, X, Settings, Plus, Users, FolderOpen, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useKanbanTickets, type KanbanTicket, type KanbanFilters } from '@/hooks/useKanbanTickets'
import { useTicketStages, type TicketStage } from '@/hooks/useTicketStages'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { useAgents } from '@/hooks/useAgents'
import { useHumanAgents } from '@/hooks/useHumanAgents'
import { InboxCard } from './InboxCard'
import { NewConversationDialog } from './NewConversationDialog'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'

interface InboxKanbanPanelProps {
  selectedTicketId: string | null
  onSelectTicket: (ticket: KanbanTicket) => void
  instanceId?: string
  onConversationCreated?: (id: string) => void
  instances?: Array<{ id: string; instance_name: string; profile_name: string | null; status: string }>
  filterInstanceId: string
  onFilterInstanceChange: (id: string) => void
}

// Fetch categories
function useTicketCategories() {
  return useQuery({
    queryKey: ['ticket-categories-inbox'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ticket_categories')
        .select('id, name')
        .order('name')
      return (data || []) as Array<{ id: string; name: string }>
    },
  })
}

// Fetch modules
function useTicketModules() {
  return useQuery({
    queryKey: ['ticket-modules-inbox'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ticket_modules')
        .select('id, name')
        .order('name')
      return (data || []) as Array<{ id: string; name: string }>
    },
  })
}

export function InboxKanbanPanel({
  selectedTicketId,
  onSelectTicket,
  instanceId,
  onConversationCreated,
  instances,
  filterInstanceId,
  onFilterInstanceChange,
}: InboxKanbanPanelProps) {
  // Board selection — undefined means "all boards"
  const { data: boards = [] } = useKanbanBoards()
  const [boardId, setBoardId] = useState<string | undefined>(undefined)
  const currentBoard = boardId ? boards.find(b => b.id === boardId) : null

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 350)
  const [agentFilter, setAgentFilter] = useState<string>('')
  const [humanAgentFilter, setHumanAgentFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [moduleFilter, setModuleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [groupByStage, setGroupByStage] = useState(true)

  const { agents: humanAgents = [] } = useHumanAgents()

  const filters: KanbanFilters = useMemo(() => ({
    boardId: boardId || undefined,
    search: debouncedSearch || undefined,
    agent: agentFilter || undefined,
    humanAgent: humanAgentFilter || undefined,
    category: categoryFilter || undefined,
    module: moduleFilter || undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  }), [boardId, debouncedSearch, agentFilter, humanAgentFilter, categoryFilter, moduleFilter, priorityFilter])

  const { tickets, isLoading, ticketsByStage } = useKanbanTickets(filters)
  const { stages = [] } = useTicketStages(boardId) as { stages: TicketStage[] }
  const { agents = [] } = useAgents()
  const { data: categories = [] } = useTicketCategories()
  const { data: modules = [] } = useTicketModules()

  // Collapsible stages — exit stages collapsed by default
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (stages.length > 0) {
      const exitIds = stages.filter(s => s.is_exit).map(s => s.id)
      setCollapsedStages(new Set(exitIds))
    }
  }, [stages])

  const toggleStage = useCallback((stageId: string) => {
    setCollapsedStages(prev => {
      const next = new Set(prev)
      if (next.has(stageId)) next.delete(stageId)
      else next.add(stageId)
      return next
    })
  }, [])

  // Active AI agents only
  const activeAIAgents = useMemo(() => {
    return (agents || []).filter(a => a.is_active)
  }, [agents])

  // Status counting for pills
  const statusCounts = useMemo(() => {
    const active = tickets.filter(t => {
      const s = t.status?.toLowerCase()
      return s === 'active' || s === 'em_atendimento' || s === 'in_progress'
    }).length
    const waiting = tickets.filter(t => {
      const s = t.status?.toLowerCase()
      return s === 'waiting' || s === 'waiting_customer' || s === 'aguardando' || s === 'aguardando_cliente'
    }).length
    const queue = tickets.filter(t => {
      const s = t.status?.toLowerCase()
      return s === 'queue' || s === 'fila' || s === 'aguardando'
    }).length
    const resolved = tickets.filter(t => {
      const s = t.status?.toLowerCase()
      return s === 'finalizado' || s === 'resolved' || s === 'closed'
    }).length
    return { active, waiting, queue, resolved }
  }, [tickets])

  // Apply client-side status filter
  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets
    return tickets.filter(t => {
      const s = t.status?.toLowerCase()
      switch (statusFilter) {
        case 'active':
          return s === 'active' || s === 'em_atendimento' || s === 'in_progress'
        case 'waiting':
          return s === 'waiting' || s === 'waiting_customer' || s === 'aguardando' || s === 'aguardando_cliente'
        case 'queue':
          return s === 'queue' || s === 'fila' || s === 'aguardando'
        case 'resolved':
          return s === 'finalizado' || s === 'resolved' || s === 'closed'
        default:
          return true
      }
    })
  }, [tickets, statusFilter])

  const filteredByStage = useCallback((stageId: string) => {
    return filteredTickets.filter(t => t.stage_id === stageId)
  }, [filteredTickets])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-[#E5E5E5] bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#10293F]">
              {currentBoard?.name || 'Todos Atendimentos'}
            </h2>
            <Badge className="text-xs h-5 px-1.5 font-bold bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] hover:bg-[#E8F9F9]">
              {filteredTickets.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setGroupByStage(prev => !prev)}
              className={cn(
                'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                groupByStage
                  ? 'bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.5)]'
                  : 'text-[#666666] hover:bg-[#F5F5F5] border border-transparent'
              )}
              title={groupByStage ? 'Desagrupar etapas' : 'Agrupar por etapa'}
              aria-label={groupByStage ? 'Desagrupar etapas' : 'Agrupar por etapa'}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <NewConversationDialog
              instanceId={instanceId}
              onConversationCreated={onConversationCreated || (() => {})}
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666666]" />
          <Input
            placeholder="Buscar cliente, telefone, ticket..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="h-8 pl-8 pr-8 text-xs border-[#CCCCCC] focus-visible:ring-[#45E5E5] bg-white"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#333333]"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status count boxes */}
      <div className="shrink-0 px-3 py-2 border-b border-[#E5E5E5]">
        <div className="grid grid-cols-4 gap-1.5">
          <StatusBox label="ATIVOS" count={statusCounts.active} active={statusFilter === 'active'} color="#45E5E5" onClick={() => setStatusFilter(prev => prev === 'active' ? 'all' : 'active')} />
          <StatusBox label="ESPERA" count={statusCounts.waiting} active={statusFilter === 'waiting'} color="#FFB800" onClick={() => setStatusFilter(prev => prev === 'waiting' ? 'all' : 'waiting')} />
          <StatusBox label="FILA" count={statusCounts.queue} active={statusFilter === 'queue'} color="#2563EB" onClick={() => setStatusFilter(prev => prev === 'queue' ? 'all' : 'queue')} />
          <StatusBox label="FINALIZADOS" count={statusCounts.resolved} active={statusFilter === 'resolved'} color="#666666" onClick={() => setStatusFilter(prev => prev === 'resolved' ? 'all' : 'resolved')} />
        </div>
      </div>

      {/* Priority tabs */}
      <div className="shrink-0 px-3 py-1.5 border-b border-[#E5E5E5] flex items-center gap-1">
        {([
          { value: 'all', label: 'Todos' },
          { value: 'high', label: 'Alta' },
          { value: 'medium', label: 'Média' },
          { value: 'low', label: 'Baixa' },
        ] as const).map(p => (
          <button
            key={p.value}
            onClick={() => setPriorityFilter(p.value)}
            className={cn(
              'h-6 px-2.5 text-xs font-semibold border-b-2 transition-colors',
              priorityFilter === p.value
                ? 'text-[#10293F] border-[#45E5E5]'
                : 'text-[#666666] border-transparent hover:text-[#444444]'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Instance filter */}
      {instances && instances.length > 1 && (
        <div className="shrink-0 px-3 py-1.5 border-b border-[#E5E5E5]">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-7 px-3 rounded-full border border-[#E5E5E5] text-xs font-medium text-[#444444] hover:bg-[#F5F5F5] transition-colors">
                <Smartphone className="w-3 h-3" />
                {filterInstanceId === 'all' ? 'Todas instâncias' : instances.find(i => i.id === filterInstanceId)?.instance_name || 'Instância'}
                <ChevronDown className="w-3 h-3 text-[#999]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              <button
                onClick={() => onFilterInstanceChange('all')}
                className={cn('w-full text-left px-3 py-1.5 text-xs rounded hover:bg-[#F5F5F5]', filterInstanceId === 'all' && 'bg-[#E8F9F9] text-[#10293F] font-semibold')}
              >
                Todas instâncias
              </button>
              {instances.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => onFilterInstanceChange(inst.id)}
                  className={cn('w-full text-left px-3 py-1.5 text-xs rounded hover:bg-[#F5F5F5] flex items-center gap-1.5', filterInstanceId === inst.id && 'bg-[#E8F9F9] text-[#10293F] font-semibold')}
                >
                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', inst.status === 'connected' ? 'bg-[#16A34A]' : 'bg-[#DC2626]')} />
                  {inst.profile_name || inst.instance_name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Filter chips */}
      <div className="shrink-0 px-3 py-1.5 border-b border-[#E5E5E5] flex items-center gap-1.5 flex-wrap">
        <FilterChip icon={<Users className="w-3 h-3" />} label={agentFilter ? activeAIAgents.find(a => a.id === agentFilter)?.name || 'Agente IA' : 'Agente IA'} active={!!agentFilter} onClear={() => setAgentFilter('')} options={[{ value: '', label: 'Todos Agentes IA' }, ...activeAIAgents.map(a => ({ value: a.id, label: a.name }))]} value={agentFilter} onChange={setAgentFilter} />
        {statusFilter !== 'queue' && (
          <FilterChip icon={<Users className="w-3 h-3" />} label={humanAgentFilter ? humanAgents.find(a => a.id === humanAgentFilter)?.name || 'Humano' : 'Agente Humano'} active={!!humanAgentFilter} onClear={() => setHumanAgentFilter('')} options={[{ value: '', label: 'Todos Humanos' }, ...humanAgents.map(a => ({ value: a.id, label: a.name }))]} value={humanAgentFilter} onChange={setHumanAgentFilter} />
        )}
        <FilterChip icon={<FolderOpen className="w-3 h-3" />} label={categoryFilter ? categories.find(c => c.id === categoryFilter)?.name || 'Categoria' : 'Categoria'} active={!!categoryFilter} onClear={() => setCategoryFilter('')} options={[{ value: '', label: 'Todas Categorias' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryFilter} onChange={setCategoryFilter} />
        <FilterChip icon={<Layers className="w-3 h-3" />} label={moduleFilter ? modules.find(m => m.id === moduleFilter)?.name || 'Módulo' : 'Módulo'} active={!!moduleFilter} onClear={() => setModuleFilter('')} options={[{ value: '', label: 'Todos Módulos' }, ...modules.map(m => ({ value: m.id, label: m.name }))]} value={moduleFilter} onChange={setModuleFilter} />
      </div>

      {/* Board selector */}
      <div className="shrink-0 px-3 py-1.5 border-b border-[#E5E5E5] flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setBoardId(undefined)} className={cn('h-6 px-2.5 rounded-full text-xs font-semibold border transition-colors', !boardId ? 'bg-[#10293F] text-white border-[#10293F]' : 'bg-white text-[#444444] border-[#E5E5E5] hover:bg-[#F5F5F5]')}>
          Todos
        </button>
        {boards.map(b => (
          <button key={b.id} onClick={() => setBoardId(b.id)} className={cn('h-6 px-2.5 rounded-full text-xs font-semibold border transition-colors', boardId === b.id ? 'bg-[#10293F] text-white border-[#10293F]' : 'bg-white text-[#444444] border-[#E5E5E5] hover:bg-[#F5F5F5]')}>
            {b.name}
          </button>
        ))}
      </div>

      {/* Stages + Cards */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : stages.length === 0 && boardId ? (
          <div className="p-6 text-center text-xs text-[#666666]">Nenhum board configurado</div>
        ) : groupByStage ? (
          <div className="py-0.5">
            {(() => {
              // Group stages by board when viewing all boards
              const isAllBoards = !boardId
              const boardGroups = isAllBoards
                ? boards.map(b => ({
                    board: b,
                    boardStages: stages.filter(s => s.board_id === b.id),
                  })).filter(g => g.boardStages.length > 0)
                : [{ board: null, boardStages: stages }]

              return boardGroups.map(({ board, boardStages }) => (
                <div key={board?.id || 'single'}>
                  {board && (
                    <div className="px-3 py-1.5 bg-[#10293F]/5 border-b border-[#E5E5E5]">
                      <span className="text-xs font-bold text-[#10293F] uppercase tracking-wider">{board.name}</span>
                    </div>
                  )}
                  {boardStages.map(stage => {
                    const stageTickets = filteredByStage(stage.id)
                    const isCollapsed = collapsedStages.has(stage.id)
                    return (
                      <Collapsible key={stage.id} open={!isCollapsed} onOpenChange={() => toggleStage(stage.id)}>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F5F5F5] transition-colors" aria-label={`${isCollapsed ? 'Expandir' : 'Colapsar'} ${stage.name}`}>
                            {isCollapsed ? <ChevronRight className="w-3 h-3 text-[#666666] shrink-0" /> : <ChevronDown className="w-3 h-3 text-[#666666] shrink-0" />}
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                            <span className="text-xs font-bold text-[#666666] uppercase tracking-wider truncate">{stage.name}</span>
                            <span className="text-[9px] font-bold ml-auto shrink-0 bg-[#F5F5F5] text-[#444444] rounded-full px-1.5 py-0.5 border border-[#E5E5E5]">{stageTickets.length}</span>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {stageTickets.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-[#666666] italic">Nenhum atendimento</div>
                          ) : (
                            <div>{stageTickets.map(ticket => <InboxCard key={ticket.id} ticket={ticket} isSelected={selectedTicketId === ticket.id} onClick={() => onSelectTicket(ticket)} />)}</div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              ))
            })()}
            {(() => {
              const stageIds = new Set(stages.map(s => s.id))
              const orphaned = filteredTickets.filter(t => !t.stage_id || !stageIds.has(t.stage_id))
              if (orphaned.length === 0) return null
              return (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F5F5F5] transition-colors">
                      <ChevronDown className="w-3 h-3 text-[#666666] shrink-0" />
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#CCCCCC]" />
                      <span className="text-xs font-bold text-[#666666] uppercase tracking-wider truncate">Sem etapa</span>
                      <span className="text-[9px] font-bold ml-auto shrink-0 bg-[#F5F5F5] text-[#444444] rounded-full px-1.5 py-0.5 border border-[#E5E5E5]">{orphaned.length}</span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {orphaned.map(ticket => <InboxCard key={ticket.id} ticket={ticket} isSelected={selectedTicketId === ticket.id} onClick={() => onSelectTicket(ticket)} />)}
                  </CollapsibleContent>
                </Collapsible>
              )
            })()}
          </div>
        ) : (
          <div className="py-0.5">
            {filteredTickets.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#666666]">Nenhum atendimento encontrado</div>
            ) : (
              filteredTickets.map(ticket => <InboxCard key={ticket.id} ticket={ticket} isSelected={selectedTicketId === ticket.id} onClick={() => onSelectTicket(ticket)} />)
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

/* ─── Status Box ─── */
interface StatusBoxProps {
  label: string
  count: number
  active: boolean
  color: string
  onClick: () => void
}

function StatusBox({ label, count, active, color, onClick }: StatusBoxProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center py-1.5 rounded-lg border-2 transition-all',
        active
          ? 'shadow-sm'
          : 'border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]'
      )}
      style={active ? {
        backgroundColor: `${color}15`,
        borderColor: `${color}60`,
      } : undefined}
    >
      <span className="text-base font-bold leading-tight" style={{ color }}>{count}</span>
      <span className="text-[8px] font-bold text-[#666666] uppercase tracking-wider leading-tight">{label}</span>
    </button>
  )
}

/* ─── Filter Chip Component ─── */
interface FilterChipProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClear: () => void
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}

function FilterChip({ icon, label, active, onClear, options, value, onChange }: FilterChipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors whitespace-nowrap',
            active
              ? 'bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.5)]'
              : 'bg-white text-[#444444] border-[#E5E5E5] hover:bg-[#F5F5F5]'
          )}
        >
          {icon}
          <span className="truncate max-w-[80px]">{label}</span>
          {active ? (
            <X className="w-3 h-3 ml-0.5 hover:text-[#DC2626]" onClick={e => { e.stopPropagation(); onClear() }} />
          ) : (
            <ChevronDown className="w-3 h-3 text-[#999]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)} className={cn('w-full text-left px-3 py-1.5 text-xs rounded hover:bg-[#F5F5F5] transition-colors', value === opt.value && 'bg-[#E8F9F9] text-[#10293F] font-semibold')}>
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
