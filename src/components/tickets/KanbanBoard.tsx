import { useState, useCallback, useMemo, useDeferredValue, useEffect, useRef } from 'react'
import { ArrowDownAZ, Volume2, VolumeX, Sparkles, X, RefreshCw, User, Tag, Flag, Users, SortAsc, Box, CalendarDays, Smartphone, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'
import { KanbanColumn, type ColumnConfig } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { KanbanInboxPanel } from './KanbanChatPanel'
import { BulkActionsBar } from './BulkActionsBar'
import { BulkCloseDialog } from '@/components/inbox/BulkCloseDialog'
import { BulkDeleteDialog } from './BulkDeleteDialog'
import { BulkMergeDialog } from './BulkMergeDialog'
import { SmartMergeDialog, type SmartMergeTicket } from './SmartMergeDialog'
import { useAuth } from '@/contexts/AuthContext'
import { TransferBoardDialog } from './TransferBoardDialog'
import { useKanbanTickets, type KanbanFilters, type KanbanTicket } from '@/hooks/useKanbanTickets'
import { useDebounce } from '@/hooks/useDebounce'
import { useKanbanNotificationSound } from '@/hooks/useKanbanNotificationSound'
import { useTicketStages } from '@/hooks/useTicketStages'
import { useAgents } from '@/hooks/useAgents'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Columns3, Search, Settings, Filter, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import * as LucideIcons from 'lucide-react'
import { RequiredFieldsDialog } from '@/components/inbox/RequiredFieldsDialog'
import { AICloseValidationDialog } from '@/components/inbox/AICloseValidationDialog'
import { useCloseValidation } from '@/hooks/useCloseValidation'
import { InternalWaitingReasonDialog } from './InternalWaitingReasonDialog'
import { useBusinessHours } from '@/hooks/useBusinessHours'
import { CreateTicketDialog } from './CreateTicketDialog'
import { CancellationTicketForm } from './CancellationTicketForm'
import { SearchableFilterSelect } from './SearchableFilterSelect'
import { KPIWidget } from './KPIWidget'
import { CancellationKPIWidget } from './CancellationKPIWidget'
import { AIStatusBar } from '@/components/helpdesk/AIStatusBar'
import { toast } from 'sonner'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { useErrorHandler } from '@/hooks/useErrorHandler'



interface KanbanBoardProps {
  boardId?: string
  boardType?: string
  boardName?: string
  boardIcon?: string | null
  boardColor?: string
  boardAlertThresholdMinutes?: number | null
  initialTicketId?: string
}

function getIconComponent(iconName?: string | null) {
  if (!iconName) return null
  const name = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }> | undefined
  return Icon || null
}

export function KanbanBoard({ boardId, boardType = 'support', boardName, boardIcon, boardColor, boardAlertThresholdMinutes, initialTicketId }: KanbanBoardProps) {
  const [filters, setFilters] = useState<KanbanFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false)
  const [missingFields, setMissingFields] = useState<{ field_name: string; field_label: string }[]>([])
  const [pendingMove, setPendingMove] = useState<{ ticketId: string; toStageId: string; fromStageId?: string | null } | null>(null)
  const [internalWaitingDialogOpen, setInternalWaitingDialogOpen] = useState(false)
  const [pendingInternalWaitingMove, setPendingInternalWaitingMove] = useState<{ ticketId: string; toStageId: string; fromStageId?: string | null } | null>(null)
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [bulkCloseOpen, setBulkCloseOpen] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId ?? null)

  // Close panel on ESC
  useEffect(() => {
    if (!selectedTicketId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTicketId(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedTicketId])
  const [transferBoardOpen, setTransferBoardOpen] = useState(false)
  const [transferBoardTicketId, setTransferBoardTicketId] = useState<string | null>(null)
  const [bulkTransferBoardOpen, setBulkTransferBoardOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkMergeOpen, setBulkMergeOpen] = useState(false)
  const [smartMergeOpen, setSmartMergeOpen] = useState(false)
  const [smartMergeTickets, setSmartMergeTickets] = useState<SmartMergeTicket[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ─── Panel resize state (persisted to localStorage) ───
  const PANEL_WIDTH_KEY = 'kanban-panel-width'
  const MIN_PANEL_WIDTH = 600
  const DEFAULT_PANEL_WIDTH = 780
  const containerRef = useRef<HTMLDivElement>(null)

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    return saved ? Math.max(MIN_PANEL_WIDTH, parseInt(saved, 10)) : DEFAULT_PANEL_WIDTH
  })

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth))
  }, [panelWidth])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    const container = containerRef.current
    const maxWidth = container ? container.clientWidth * 0.92 : 1400

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const newWidth = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, startWidth + delta))
      setPanelWidth(newWidth)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [panelWidth])

  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const [sortBy, setSortBy] = useState<string>('arrival')
  const [columnSortOverrides, setColumnSortOverrides] = useState<Record<string, string>>({})

  const debouncedSearch = useDebounce(searchInput, 350)
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()
  const effectiveFilters = useMemo(() => ({ ...filters, search: debouncedSearch || undefined, boardId, dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined, dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined }), [filters, debouncedSearch, boardId, dateFrom, dateTo])
  const { tickets, isLoading, isError, error, ticketsByStage, moveTicket, moveToBoard } = useKanbanTickets(effectiveFilters)

  const { ErrorDisplay, retry } = useErrorHandler()

  // Notification sound
  const ticketMap = useMemo(() => {
    const m = new Map<string, { customer_name: string | null; customer_phone: string }>()
    for (const t of tickets) m.set(t.id, { customer_name: t.customer_name, customer_phone: t.customer_phone })
    return m
  }, [tickets])
  const ticketIds = useMemo(() => tickets.map(t => t.id), [tickets])
  const queueTickets = useMemo(() =>
    tickets.map(t => ({
      id: t.id,
      queue_entered_at: t.queue_entered_at,
      handler_type: t.handler_type,
      status: t.status,
      customer_name: t.customer_name,
      customer_phone: t.customer_phone,
    })),
    [tickets]
  )
  const { soundEnabled, toggleSound } = useKanbanNotificationSound(ticketIds, ticketMap, queueTickets)

  const sortTickets = useCallback((stageTickets: KanbanTicket[], isEntry?: boolean, columnOverride?: string) => {
    const sorted = [...stageTickets]
    // Entry columns always sort by arrival (newest first)
    if (isEntry) {
      return sorted.sort((a, b) =>
        new Date(a.started_at || 0).getTime() - new Date(b.started_at || 0).getTime()
      )
    }
    const effectiveSort = columnOverride || sortBy
    switch (effectiveSort) {
      case 'priority': {
        const order: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 }
        return sorted.sort((a, b) => (order[a.priority || 'medium'] ?? 2) - (order[b.priority || 'medium'] ?? 2))
      }
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.started_at || 0).getTime() - new Date(b.started_at || 0).getTime())
      case 'customer_name':
        return sorted.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''))
      case 'agent':
        return sorted.sort((a, b) => {
          const nameA = a.handler_type === 'ai' ? (a.ai_agent_name || '') : (a.humanAgentName || '')
          const nameB = b.handler_type === 'ai' ? (b.ai_agent_name || '') : (b.humanAgentName || '')
          return nameA.localeCompare(nameB)
        })
      case 'human_agent':
        return sorted.sort((a, b) => (a.humanAgentName || '').localeCompare(b.humanAgentName || ''))
      default: // arrival
        return sorted.sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
    }
  }, [sortBy])

  const handleColumnSortChange = useCallback((stageId: string, value: string) => {
    setColumnSortOverrides(prev => {
      if (value === 'default') {
        const next = { ...prev }
        delete next[stageId]
        return next
      }
      return { ...prev, [stageId]: value }
    })
  }, [])
  const { stages, isLoading: stagesLoading } = useTicketStages(boardId)
  const { agents } = useAgents()
  const { data: allBoards = [] } = useKanbanBoards()

  // Dynamic categories
  const { data: categoriesRaw = [] } = useQuery({
    queryKey: ['ticket-categories-kanban'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_categories').select('id, name, color').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Dynamic modules
  const { data: modulesRaw = [] } = useQuery({
    queryKey: ['ticket-modules-kanban'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_modules').select('id, name').eq('active', true).order('name')
      return data || []
    },
  })

  // Close validation (centralized)
  const { validateForClose, runAINameValidation, runAICloseReview } = useCloseValidation()

  // Business hours for SLA calculations
  const { data: businessHours = [] } = useBusinessHours(boardId)
  const [aiValidationDialogOpen, setAIValidationDialogOpen] = useState(false)
  const [pendingAIValidations, setPendingAIValidations] = useState<string[]>([])
  const [pendingAITicket, setPendingAITicket] = useState<KanbanTicket | null>(null)

  const { data: humanAgents } = useQuery({
    queryKey: ['human-agents-kanban-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('human_agents').select('id, name').neq('is_active', false).order('name')
      return data || []
    },
  })

  const { data: waInstances = [] } = useQuery({
    queryKey: ['uazapi-instances-public'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('uazapi_instances_public').select('id, instance_name').order('instance_name')
      return (data as any[]) || []
    },
    staleTime: 1000 * 60 * 5,
  })

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.agent && filters.agent !== 'all') count++
    if (filters.category && filters.category !== 'all') count++
    if (filters.module && filters.module !== 'all') count++
    if (filters.priority && filters.priority !== 'all') count++
    if (filters.humanAgent && filters.humanAgent !== 'all') count++
    if (filters.whatsappInstance && filters.whatsappInstance !== 'all') count++
    if (dateFrom) count++
    if (dateTo) count++
    return count
  }, [filters, dateFrom, dateTo])

  // Auto-expand filters when any filter is active
  useEffect(() => {
    if (activeFilterCount > 0) setFiltersOpen(true)
  }, [activeFilterCount])

  const categoriesMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>()
    for (const c of categoriesRaw) m.set(c.id, { name: c.name, color: c.color })
    return m
  }, [categoriesRaw])

  const modulesMap = useMemo(() => {
    const m = new Map<string, { name: string }>()
    for (const mod of modulesRaw) m.set(mod.id, { name: mod.name })
    return m
  }, [modulesRaw])

  // Build columns from stages with WIP limit and alert threshold
  const columns: ColumnConfig[] = useMemo(() =>
    stages.map(s => ({
      id: s.id,
      stageId: s.id,
      label: s.name,
      color: s.color,
      icon: s.icon,
      is_final: s.is_final,
      wipLimit: s.wip_limit,
      is_entry: s.is_entry,
      is_exit: s.is_exit,
      is_ai_validation: s.is_ai_validation,
      alertThresholdMinutes: s.queue_alert_threshold_minutes ?? boardAlertThresholdMinutes ?? null,
    })),
    [stages, boardAlertThresholdMinutes]
  )

  const activeTicket = draggingId ? tickets.find(t => t.id === draggingId) : null
  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) : null
  const BoardIcon = getIconComponent(boardIcon)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingId(null)
    if (!over) return

    const ticketId = String(active.id)
    const toStageId = String(over.id)
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket || ticket.stage_id === toStageId) return

    // WIP limit check
    const destCol = columns.find(c => c.id === toStageId)
    if (destCol?.wipLimit && ticketsByStage(toStageId).length >= destCol.wipLimit) {
      toast.error(`Limite WIP atingido nesta etapa (${destCol.wipLimit})`)
      return
    }

    // Check if destination is a final stage
    const destStage = stages.find(s => s.id === toStageId)

    // Status type validation
    if (destStage?.status_type === 'em_atendimento' && ticket.status === 'aguardando' && !ticket.human_started_at) {
      toast.error('Para mover para esta etapa o agente precisa clicar em Iniciar Atendimento.')
      return
    }

    // Internal waiting reason required
    if (destStage?.status_type === 'internal_waiting' || destStage?.status_type === 'aguardando_interno') {
      setPendingInternalWaitingMove({ ticketId, toStageId, fromStageId: ticket.stage_id })
      setInternalWaitingDialogOpen(true)
      return
    }

    if (destStage?.is_final) {
      // Buscar dados frescos do DB para evitar stale data na validação
      const { data: fresh, error: freshError } = await supabase
        .from('ai_conversations')
        .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
        .eq('id', ticketId)
        .single()
      if (freshError) console.warn('[KanbanBoard] Fresh fetch failed, using ticket data:', freshError.message)
      const freshTicket = fresh ? { ...ticket, ...fresh } : ticket
      const result = validateForClose(freshTicket)
      if (result.missingFields.length > 0) {
        setMissingFields(result.missingFields)
        setPendingMove({ ticketId, toStageId, fromStageId: ticket.stage_id })
        setRequirementsDialogOpen(true)
        return
      }
      if (result.aiValidationsNeeded.length > 0) {
        setPendingAIValidations(result.aiValidationsNeeded)
        setPendingAITicket(freshTicket)
        setPendingMove({ ticketId, toStageId, fromStageId: ticket.stage_id })
        setAIValidationDialogOpen(true)
        return
      }
    }

    moveTicket.mutate({ ticketId, toStageId, fromStageId: ticket.stage_id, statusType: destStage?.status_type })
  }, [tickets, moveTicket, stages, validateForClose, columns, ticketsByStage])

  const handleInternalWaitingConfirm = useCallback(async (reason: string) => {
    setInternalWaitingDialogOpen(false)
    if (pendingInternalWaitingMove) {
      // Save the reason to the conversation
      await supabase
        .from('ai_conversations')
        .update({ internal_waiting_reason: reason } as any)
        .eq('id', pendingInternalWaitingMove.ticketId)
      moveTicket.mutate({
        ticketId: pendingInternalWaitingMove.ticketId,
        toStageId: pendingInternalWaitingMove.toStageId,
        fromStageId: pendingInternalWaitingMove.fromStageId,
      })
      setPendingInternalWaitingMove(null)
    }
  }, [pendingInternalWaitingMove, moveTicket])

  const handleForceClose = useCallback(async () => {
    setRequirementsDialogOpen(false)
    if (pendingMove) {
      // Buscar dados frescos antes de validar IA
      const { data: fresh, error: freshError } = await supabase
        .from('ai_conversations')
        .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
        .eq('id', pendingMove.ticketId)
        .single()
      if (freshError) console.warn('[KanbanBoard] Force close fresh fetch failed:', freshError.message)
      const ticket = tickets.find(t => t.id === pendingMove.ticketId)
      const freshTicket = fresh && ticket ? { ...ticket, ...fresh } : ticket
      if (freshTicket) {
        const result = validateForClose(freshTicket)
        if (result.aiValidationsNeeded.length > 0) {
          setPendingAIValidations(result.aiValidationsNeeded)
          setPendingAITicket(freshTicket)
          setAIValidationDialogOpen(true)
          return
        }
      }
      moveTicket.mutate(pendingMove)
      setPendingMove(null)
    }
  }, [pendingMove, moveTicket, tickets, validateForClose])

  const handleForceCloseWithNote = useCallback(async (note: string) => {
    setRequirementsDialogOpen(false)
    // Save the resolution note as an annotation before proceeding
    if (pendingMove) {
      const ticket = tickets.find(t => t.id === pendingMove.ticketId)
      if (ticket?.helpdesk_client_id) {
        void supabase.from('helpdesk_client_annotations').insert({
          client_id: ticket.helpdesk_client_id,
          content: note,
          author: 'Nota de Encerramento',
        })
      }
      // Buscar dados frescos antes de validar IA
      if (ticket) {
        const { data: freshData } = await supabase
          .from('ai_conversations')
          .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
          .eq('id', pendingMove.ticketId)
          .single()
        const freshTicket = freshData ? { ...ticket, ...freshData } : ticket
        const result = validateForClose(freshTicket)
        if (result.aiValidationsNeeded.length > 0) {
          setPendingAIValidations(result.aiValidationsNeeded)
          setPendingAITicket(freshTicket)
          setAIValidationDialogOpen(true)
          return
        }
      }
      moveTicket.mutate(pendingMove)
      setPendingMove(null)
    }
  }, [pendingMove, tickets, moveTicket, validateForClose])

  const handleAIValidationComplete = useCallback(async (result: { correctedName?: string; closeReviewNote?: string }) => {
    // Save corrected name if provided
    if (result.correctedName && pendingAITicket) {
      await supabase
        .from('ai_conversations')
        .update({ customer_name: result.correctedName })
        .eq('id', pendingAITicket.id)
    }

    // Save AI close review note as annotation
    if (result.closeReviewNote && pendingAITicket?.helpdesk_client_id) {
      void supabase.from('helpdesk_client_annotations').insert({
        client_id: pendingAITicket.helpdesk_client_id,
        content: result.closeReviewNote,
        author: 'IA - Nota de Encerramento',
      })
    }

    // Proceed with the move
    if (pendingMove) {
      moveTicket.mutate(pendingMove)
      setPendingMove(null)
    }
    setPendingAITicket(null)
  }, [pendingMove, pendingAITicket, moveTicket])

  const handleCardClick = useCallback((ticket: KanbanTicket) => {
    setSelectedTicketId(prev => prev === ticket.id ? null : ticket.id)
  }, [])

  // Bulk selection handlers
  const toggleTicketSelection = useCallback((id: string) => {
    setSelectedTickets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllInStage = useCallback((stageId: string) => {
    const stageTickets = ticketsByStage(stageId)
    setSelectedTickets(prev => {
      const next = new Set(prev)
      const allSelected = stageTickets.every(t => next.has(t.id))
      if (allSelected) {
        stageTickets.forEach(t => next.delete(t.id))
      } else {
        stageTickets.forEach(t => next.add(t.id))
      }
      return next
    })
  }, [ticketsByStage])

  const clearSelection = useCallback(() => setSelectedTickets(new Set()), [])

  // Bulk actions
  const handleBulkMoveToStage = useCallback(async (toStageId: string) => {
    setBulkProcessing(true)
    const ids = Array.from(selectedTickets)
    const destStage = stages.find(s => s.id === toStageId)
    try {
      for (const id of ids) {
        const ticket = tickets.find(t => t.id === id)
        if (!ticket || ticket.stage_id === toStageId) continue
        await moveTicket.mutateAsync({ ticketId: id, toStageId, fromStageId: ticket.stage_id, statusType: destStage?.status_type })
      }
      toast.success(`${ids.length} ticket(s) movido(s)`)
      clearSelection()
    } catch {
      toast.error('Erro ao mover tickets')
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedTickets, tickets, stages, moveTicket, clearSelection])

  const handleBulkTransfer = useCallback(async (agentId: string | null) => {
    setBulkProcessing(true)
    const ids = Array.from(selectedTickets)
    try {
      for (const id of ids) {
        await supabase.from('ai_conversations').update({ handler_type: 'human' }).eq('id', id)
        if (agentId) {
          await supabase.from('agent_assignments').update({ unassigned_at: new Date().toISOString() }).eq('conversation_id', id).is('unassigned_at', null)
          await supabase.from('agent_assignments').insert({ conversation_id: id, agent_type: 'human', human_agent_id: agentId, assigned_by: 'kanban-bulk' })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success(`${ids.length} ticket(s) transferido(s)`)
      clearSelection()
    } catch {
      toast.error('Erro ao transferir tickets')
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedTickets, queryClient, clearSelection])

  const handleBulkChangePriority = useCallback(async (priority: string) => {
    setBulkProcessing(true)
    const ids = Array.from(selectedTickets)
    try {
      const { error } = await supabase.from('ai_conversations').update({ priority }).in('id', ids)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success(`Prioridade alterada para ${ids.length} ticket(s)`)
      clearSelection()
    } catch {
      toast.error('Erro ao alterar prioridade')
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedTickets, queryClient, clearSelection])

  const handleBulkClose = useCallback(async (_sendCsat: boolean) => {
    setBulkProcessing(true)
    const ids = Array.from(selectedTickets)
    try {
      // Validate each ticket before closing
      const ticketsToClose = tickets.filter(t => ids.includes(t.id))
      const failedTickets: { id: string; name: string; fields: string[] }[] = []
      const validIds: string[] = []

      // Buscar dados frescos de todos os tickets para validação
      const { data: freshRows } = await supabase
        .from('ai_conversations')
        .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
        .in('id', ticketsToClose.map(t => t.id))
      const freshMap = new Map((freshRows || []).map(r => [r.id, r]))

      for (const ticket of ticketsToClose) {
        const fresh = freshMap.get(ticket.id)
        const merged = fresh ? { ...ticket, ...fresh } : ticket
        const result = validateForClose(merged)
        if (result.missingFields.length > 0) {
          failedTickets.push({
            id: ticket.id,
            name: ticket.customer_name || ticket.customer_phone || `#${ticket.ticket_number}`,
            fields: result.missingFields.map(f => f.field_label),
          })
        } else {
          validIds.push(ticket.id)
        }
      }

      if (failedTickets.length > 0) {
        const names = failedTickets.map(t => `• ${t.name}: ${t.fields.join(', ')}`).join('\n')
        toast.error(`${failedTickets.length} ticket(s) com campos obrigatórios pendentes:\n${names}`, { duration: 8000 })
        if (validIds.length === 0) {
          setBulkProcessing(false)
          return
        }
      }

      if (validIds.length > 0) {
        const { error } = await supabase.from('ai_conversations').update({ status: 'finalizado', resolved_at: new Date().toISOString() }).in('id', validIds)
        if (error) throw error
        for (const id of validIds) {
          supabase.functions.invoke('summarize-conversation', { body: { conversation_id: id } }).catch(() => {})
          supabase.functions.invoke('evaluate-service', { body: { conversation_id: id } }).catch(() => {})
        }

        // Enviar CSAT em bulk se toggle ativo — busca config por board de cada ticket
        if (_sendCsat) {
          const { data: convRows } = await supabase
            .from('ai_conversations')
            .select('id, kanban_board_id, customer_phone, uazapi_instance_id')
            .in('id', validIds)
            .not('customer_phone', 'is', null)
          if (convRows?.length) {
            const boardIds = [...new Set(convRows.map(c => c.kanban_board_id).filter(Boolean))]
            const { data: csatConfigs } = await supabase
              .from('csat_board_configs')
              .select('id, board_id, enabled, send_on_close')
              .in('board_id', boardIds as string[])
              .eq('enabled', true)
              .eq('send_on_close', true)
            const configMap = new Map((csatConfigs || []).map(c => [c.board_id, c.id]))
            for (const conv of convRows) {
              const configId = configMap.get(conv.kanban_board_id)
              if (configId && conv.uazapi_instance_id) {
                supabase.functions.invoke('csat-processor', {
                  body: { action: 'send', conversationId: conv.id, configId }
                }).catch(() => {})
              }
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
        toast.success(`${validIds.length} ticket(s) finalizado(s)${failedTickets.length > 0 ? ` (${failedTickets.length} bloqueados)` : ''}`)
      }

      clearSelection()
      setBulkCloseOpen(false)
    } catch {
      toast.error('Erro ao finalizar tickets')
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedTickets, queryClient, clearSelection, tickets, validateForClose])

  // Single card -> move to board
  const handleCardMoveToBoard = useCallback((ticketId: string) => {
    setTransferBoardTicketId(ticketId)
    setTransferBoardOpen(true)
  }, [])

  const handleConfirmMoveToBoard = useCallback((toBoardId: string, instanceId?: string) => {
    if (transferBoardTicketId) {
      const ticket = tickets.find(t => t.id === transferBoardTicketId)
      moveToBoard.mutate({ ticketId: transferBoardTicketId, toBoardId, fromStageId: ticket?.stage_id, instanceId })
    }
    setTransferBoardOpen(false)
    setTransferBoardTicketId(null)
  }, [transferBoardTicketId, tickets, moveToBoard])

  // Bulk -> move to board
  const handleBulkMoveToBoard = useCallback(async (toBoardId: string) => {
    setBulkProcessing(true)
    const ids = Array.from(selectedTickets)
    try {
      for (const id of ids) {
        const ticket = tickets.find(t => t.id === id)
        await moveToBoard.mutateAsync({ ticketId: id, toBoardId, fromStageId: ticket?.stage_id })
      }
      toast.success(`${ids.length} ticket(s) movido(s) para outro board`)
      clearSelection()
      setBulkTransferBoardOpen(false)
    } catch {
      toast.error('Erro ao mover tickets')
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedTickets, tickets, moveToBoard, clearSelection])

  const handleBulkDelete = useCallback(async (reason: string) => {
    setBulkProcessing(true)
    const ids = Array.from(selectedTickets)
    try {
      // Log each deletion
      for (const id of ids) {
        const ticket = tickets.find(t => t.id === id)
        if (!ticket) continue
        await supabase.from('conversation_deletion_logs').insert({
          conversation_id: id,
          ticket_number: ticket.ticket_number || 0,
          deleted_by: user!.id,
          reason: reason || null,
          customer_name: ticket.customer_name,
          customer_phone: ticket.customer_phone,
          conversation_snapshot: ticket as any,
        })
      }
      // Delete messages then conversations
      await supabase.from('ai_messages').delete().in('conversation_id', ids)
      await supabase.from('ai_conversations').delete().in('id', ids)

      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success(`${ids.length} ticket(s) excluído(s)`)
      clearSelection()
      setBulkDeleteOpen(false)
    } catch {
      toast.error('Erro ao excluir tickets')
    } finally {
      setBulkProcessing(false)
    }
  }, [selectedTickets, tickets, user, queryClient, clearSelection])

  // AI validation: approve (move to final stage) or reject (reopen to em_atendimento)
  const handleApproveAiClose = useCallback(async (ticketId: string) => {
    const exitStage = stages.find(s => s.is_exit)
    if (!exitStage) { toast.error('Etapa final não encontrada'); return }
    const ticket = tickets.find(t => t.id === ticketId)
    moveTicket.mutate({ ticketId, toStageId: exitStage.id, fromStageId: ticket?.stage_id || '', statusType: exitStage.status_type })
    toast.success('Ticket aprovado e movido para Concluído')
  }, [stages, tickets, moveTicket])

  const handleRejectAiClose = useCallback(async (ticketId: string) => {
    // Buscar etapa de atendimento (em_atendimento, não entry e não exit)
    const activeStage = stages.find(s => !s.is_entry && !s.is_exit && !s.is_ai_validation && s.status_type === 'em_atendimento')
    const fallbackStage = stages.find(s => s.is_entry)
    const targetStage = activeStage || fallbackStage
    if (!targetStage) { toast.error('Etapa de atendimento não encontrada'); return }
    const ticket = tickets.find(t => t.id === ticketId)
    // Limpar ai_resolved para reabrir
    await supabase.from('ai_conversations').update({ ai_resolved: false, resolved_at: null }).eq('id', ticketId)
    moveTicket.mutate({ ticketId, toStageId: targetStage.id, fromStageId: ticket?.stage_id || '', statusType: targetStage.status_type })
    toast.success('Ticket reaberto para atendimento')
  }, [stages, tickets, moveTicket])

  if (isLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <ErrorDisplay
          title="Erro ao carregar tickets"
          message="Não foi possível carregar os tickets do kanban."
          onRetry={() => retry()}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Board Header — GMS styled topbar */}
      <div className="bg-card border-b border-gms-g200 px-5 pb-0 shadow-[0_1px_3px_rgba(16,41,63,0.06)] flex-shrink-0">
        {/* Top row: title, actions, search, view toggle */}
        <div className="flex items-center gap-3 h-[52px]">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-lg bg-gms-cyan-light flex items-center justify-center">
              {BoardIcon ? (
                <BoardIcon className="w-[17px] h-[17px] text-gms-navy" />
              ) : (
                <Columns3 className="w-[17px] h-[17px] text-gms-navy" />
              )}
            </div>
            <h2 className="text-base font-bold text-gms-g900 font-display">
              {boardName || 'Kanban'}
            </h2>
            <Badge className="text-xs font-bold bg-gms-navy text-white rounded-full px-2 py-0.5">{tickets.length}</Badge>
          </div>

          <div className="flex items-center gap-1.5 ml-1">
            {boardId && (
              boardType === 'cancellation'
                ? <CancellationTicketForm boardId={boardId} stages={stages} />
                : <CreateTicketDialog boardId={boardId} stages={stages} />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-gms-g200 hover:border-gms-g300"
                >
                  <MoreVertical className="w-4 h-4 text-gms-g500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={toggleSound} className="text-xs gap-2">
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-gms-cyan-dark" /> : <VolumeX className="w-3.5 h-3.5 text-gms-g500" />}
                  {soundEnabled ? 'Desativar som' : 'Ativar som'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Configurar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Board tabs (inline) */}
          {allBoards.length > 1 && (
            <div className="flex items-center gap-1 ml-2">
              {allBoards.map(b => {
                const isActive = b.id === boardId
                return (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/kanban/${b.slug}`)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
                      isActive
                        ? 'bg-gms-navy text-white font-semibold shadow-sm'
                        : 'border border-gms-g200 text-gms-g500 hover:text-gms-g900 hover:border-gms-g300'
                    )}
                  >
                    <span>{b.name}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex-1" />

          {/* Filter toggle + Search */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 px-3 text-xs gap-1.5 rounded-lg',
              filtersOpen || activeFilterCount > 0
                ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                : 'border-gms-g200 text-gms-g500 hover:border-gms-g300 hover:text-gms-g900'
            )}
            onClick={() => setFiltersOpen(o => !o)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-gms-navy text-white text-xs font-bold px-1">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gms-g500" />
            <Input
              placeholder="Nome, email, telefone, CNPJ..."
              className="pl-9 pr-10 h-9 rounded-lg bg-gms-g100 border-gms-g200 text-gms-g900 placeholder:text-gms-g500 focus:border-gms-cyan focus:ring-gms-cyan/20 focus:bg-white"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                className="absolute right-2.5 top-2.5 text-gms-g500 hover:text-gms-g900"
                onClick={() => setSearchInput('')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-gms-g200 hover:border-gms-g300"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })}
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gms-g500" />
          </Button>
        </div>

        {/* Collapsible filter chips row */}
        {filtersOpen && (
          <div className="flex items-center gap-1.5 pb-2.5 pt-1 overflow-x-auto scrollbar-none animate-in fade-in slide-in-from-top-1 duration-200">
            {boardType === 'support' && (
              <>
                <Select value={filters.agent || 'all'} onValueChange={v => setFilters(f => ({ ...f, agent: v }))}>
                  <SelectTrigger className={cn(
                    'h-[28px] rounded-full border-[1.5px] text-xs font-medium gap-1.5 px-3 w-auto min-w-0',
                    filters.agent && filters.agent !== 'all'
                      ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                      : 'border-gms-g200 text-gms-g500 hover:border-gms-cyan hover:text-gms-g900'
                  )}>
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <SelectValue placeholder="Agentes IA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Agentes</SelectItem>
                    {(agents || []).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <SearchableFilterSelect
                  value={filters.category || 'all'}
                  onValueChange={v => setFilters(f => ({ ...f, category: v }))}
                  options={categoriesRaw.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="Categoria"
                  allLabel="Todas Categorias"
                  icon={<Tag className="w-3.5 h-3.5 shrink-0" />}
                  isActive={!!filters.category && filters.category !== 'all'}
                />

                <SearchableFilterSelect
                  value={filters.module || 'all'}
                  onValueChange={v => setFilters(f => ({ ...f, module: v }))}
                  options={modulesRaw.map(m => ({ value: m.id, label: m.name }))}
                  placeholder="Módulo"
                  allLabel="Todos Módulos"
                  icon={<Box className="w-3.5 h-3.5 shrink-0" />}
                  isActive={!!filters.module && filters.module !== 'all'}
                />

                <Select value={filters.priority || 'all'} onValueChange={v => setFilters(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className={cn(
                    'h-[28px] rounded-full border-[1.5px] text-xs font-medium gap-1.5 px-3 w-auto min-w-0',
                    filters.priority && filters.priority !== 'all'
                      ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                      : 'border-gms-g200 text-gms-g500 hover:border-gms-cyan hover:text-gms-g900'
                  )}>
                    <Flag className="w-3.5 h-3.5 shrink-0" />
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            <Select value={filters.humanAgent || 'all'} onValueChange={v => setFilters(f => ({ ...f, humanAgent: v }))}>
              <SelectTrigger className={cn(
                'h-[28px] rounded-full border-[1.5px] text-xs font-medium gap-1.5 px-3 w-auto min-w-0',
                filters.humanAgent && filters.humanAgent !== 'all'
                  ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                  : 'border-gms-g200 text-gms-g500 hover:border-gms-cyan hover:text-gms-g900'
              )}>
                <Users className="w-3.5 h-3.5 shrink-0" />
                <SelectValue placeholder="Humanos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Humanos</SelectItem>
                {(humanAgents || []).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {waInstances.length > 1 && (
              <Select value={filters.whatsappInstance || 'all'} onValueChange={v => setFilters(f => ({ ...f, whatsappInstance: v }))}>
                <SelectTrigger className={cn(
                  'h-[28px] rounded-full border-[1.5px] text-xs font-medium gap-1.5 px-3 w-auto min-w-0',
                  filters.whatsappInstance && filters.whatsappInstance !== 'all'
                    ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                    : 'border-gms-g200 text-gms-g500 hover:border-gms-cyan hover:text-gms-g900'
                )}>
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Instância" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas instâncias</SelectItem>
                  {waInstances.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-[28px] rounded-full border-[1.5px] text-xs font-medium gap-1.5 px-3 w-auto min-w-0 border-gms-g200 text-gms-g500 hover:border-gms-cyan hover:text-gms-g900">
                <SortAsc className="w-3.5 h-3.5 shrink-0" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="arrival">Ordem de chegada</SelectItem>
                <SelectItem value="date_asc">Mais antigos primeiro</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
                <SelectItem value="customer_name">Nome do contato</SelectItem>
                <SelectItem value="agent">Agente IA</SelectItem>
                <SelectItem value="human_agent">Agente Humano</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'h-[28px] rounded-full border-[1.5px] text-xs font-medium px-2.5 inline-flex items-center gap-1 outline-none transition-colors',
                      dateFrom
                        ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                        : 'border-gms-g200 text-gms-g500 hover:border-gms-cyan bg-transparent'
                    )}
                  >
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: ptBR }) : 'De'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <span className="text-xs text-gms-g500">a</span>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'h-[28px] rounded-full border-[1.5px] text-xs font-medium px-2.5 inline-flex items-center gap-1 outline-none transition-colors',
                      dateTo
                        ? 'bg-gms-cyan-light border-gms-cyan text-gms-navy font-semibold'
                        : 'border-gms-g200 text-gms-g500 hover:border-gms-cyan bg-transparent'
                    )}
                  >
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    {dateTo ? format(dateTo, 'dd/MM/yy', { locale: ptBR }) : 'Até'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-[28px] px-2 text-xs text-gms-g500 hover:text-gms-err ml-auto"
                onClick={() => { setFilters({}); setDateFrom(undefined); setDateTo(undefined) }}
              >
                <X className="w-3 h-3 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* AI Status Bar — visible for support boards */}
      {boardType === 'support' && (
        <AIStatusBar boardId={boardId} periodHours={24} />
      )}

      {/* Cancellation KPI Widget */}
      {boardType === 'cancellation' && boardId && (
        <CancellationKPIWidget boardId={boardId} />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div ref={containerRef} className="relative flex-1 overflow-hidden">
          {/* ─── Kanban Columns (always full width, extra padding when panel is open) ─── */}
          <div
            className="flex gap-[12px] overflow-x-auto pb-4 pt-4 px-3 h-full"
            style={{}}
          >
            {columns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                tickets={sortTickets(ticketsByStage(col.id), col.is_entry, columnSortOverrides[col.stageId])}
                draggingId={draggingId}
                onCardClick={handleCardClick}
                humanAgents={humanAgents}
                categories={categoriesMap}
                modules={modulesMap}
                boardType={boardType}
                selectedTickets={selectedTickets}
                onToggleSelect={toggleTicketSelection}
                onSelectAll={selectAllInStage}
                activeTicketId={selectedTicketId}
                isEntryColumn={col.is_entry}
                sortOverride={columnSortOverrides[col.stageId]}
                onChangeSortBy={handleColumnSortChange}
                onMoveToBoard={handleCardMoveToBoard}
                collapsedByDefault={col.is_final}
                businessHours={businessHours}
                onApproveAiClose={col.is_ai_validation ? handleApproveAiClose : undefined}
                onRejectAiClose={col.is_ai_validation ? handleRejectAiClose : undefined}
              />
            ))}
          </div>

          {/* ─── Attendance Panel (overlay on top of columns) ─── */}
          {selectedTicketId && selectedTicket && (
            <div
              className="fixed top-0 right-0 bottom-0 z-50 bg-card border-l border-gms-g200 shadow-[-8px_0_40px_rgba(16,41,63,0.15)] overflow-hidden animate-in slide-in-from-right-5 duration-300"
              style={{ width: `${panelWidth}px` }}
            >
              {/* Resize handle */}
              <div
                className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize z-40 group/resize hover:bg-gms-cyan/30 active:bg-gms-cyan/50 transition-colors"
                onMouseDown={handleResizeStart}
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-8 rounded-full bg-gms-g300 group-hover/resize:bg-gms-cyan group-active/resize:bg-gms-cyan transition-colors" />
              </div>
              <KanbanInboxPanel
                conversationId={selectedTicketId}
                onClose={() => setSelectedTicketId(null)}
              />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <div className="w-[280px] opacity-90 overflow-hidden">
              <KanbanCard ticket={activeTicket} onClick={() => {}} categories={categoriesMap} modules={modulesMap} boardType={boardType} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <RequiredFieldsDialog
        open={requirementsDialogOpen}
        onOpenChange={setRequirementsDialogOpen}
        missingFields={missingFields}
        onForceClose={handleForceClose}
        showResolutionNote={missingFields.some(f => f.field_name === 'resolution_note')}
        onForceCloseWithNote={handleForceCloseWithNote}
        onGoToTicket={() => {
          setRequirementsDialogOpen(false)
          setPendingMove(null)
          if (pendingMove?.ticketId) {
            navigate(`/inbox?ticket=${pendingMove.ticketId}`)
          }
        }}
      />
      <AICloseValidationDialog
        open={aiValidationDialogOpen}
        onOpenChange={(open) => {
          setAIValidationDialogOpen(open)
          if (!open) {
            setPendingMove(null)
            setPendingAITicket(null)
          }
        }}
        conversationId={pendingAITicket?.id ?? ''}
        customerName={pendingAITicket?.customer_name ?? null}
        aiValidationsNeeded={pendingAIValidations}
        onComplete={handleAIValidationComplete}
        runAINameValidation={runAINameValidation}
        runAICloseReview={runAICloseReview}
      />

      <InternalWaitingReasonDialog
        open={internalWaitingDialogOpen}
        onOpenChange={(open) => {
          setInternalWaitingDialogOpen(open)
          if (!open) setPendingInternalWaitingMove(null)
        }}
        onConfirm={handleInternalWaitingConfirm}
      />

      <BulkActionsBar
        count={selectedTickets.size}
        columns={columns}
        humanAgents={humanAgents || []}
        onClear={clearSelection}
        onMoveToStage={handleBulkMoveToStage}
        onTransfer={handleBulkTransfer}
        onChangePriority={handleBulkChangePriority}
        onFinalize={() => setBulkCloseOpen(true)}
        onMoveToBoard={() => setBulkTransferBoardOpen(true)}
        onBulkDelete={isAdmin ? () => setBulkDeleteOpen(true) : undefined}
        onMerge={selectedTickets.size >= 2 ? () => {
          if (selectedTickets.size === 2) {
            const smartTickets = Array.from(selectedTickets).map((id) => {
              const t = tickets.find((tk) => tk.id === id);
              return {
                id,
                ticket_number: t?.ticket_number,
                customer_name: t?.customer_name,
                ticket_subject: t?.ticket_subject,
                status: t?.status,
                agent_name: t?.humanAgentName ?? t?.ai_agent_name ?? undefined,
                helpdesk_client_name: t?.helpdesk_client_name ?? undefined,
                helpdesk_client_id: t?.helpdesk_client_id ?? undefined,
                ticket_category_id: t?.ticket_category_id ?? undefined,
                ticket_category_name: t?.ticket_category_id ? categoriesMap.get(t.ticket_category_id)?.name ?? undefined : undefined,
                ticket_module_id: t?.ticket_module_id ?? undefined,
                ticket_module_name: t?.ticket_module_id ? modulesMap.get(t.ticket_module_id)?.name ?? undefined : undefined,
                handler_type: t?.handler_type ?? undefined,
              } satisfies SmartMergeTicket;
            });
            setSmartMergeTickets(smartTickets);
            setSmartMergeOpen(true);
          } else {
            setBulkMergeOpen(true);
          }
        } : undefined}
        isAdmin={isAdmin}
        isProcessing={bulkProcessing}
      />

      <BulkMergeDialog
        open={bulkMergeOpen}
        onOpenChange={setBulkMergeOpen}
        tickets={Array.from(selectedTickets).map((id) => {
          const ticket = tickets.find((t) => t.id === id);
          return { id, ticket_number: ticket?.ticket_number, customer_name: ticket?.customer_name };
        })}
        onSuccess={clearSelection}
      />

      <SmartMergeDialog
        open={smartMergeOpen}
        onOpenChange={setSmartMergeOpen}
        tickets={smartMergeTickets}
        onSuccess={clearSelection}
      />

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        count={selectedTickets.size}
        isDeleting={bulkProcessing}
      />

      <BulkCloseDialog
        open={bulkCloseOpen}
        onOpenChange={setBulkCloseOpen}
        onConfirm={handleBulkClose}
        count={selectedTickets.size}
        isClosing={bulkProcessing}
      />

      <TransferBoardDialog
        open={transferBoardOpen}
        onOpenChange={setTransferBoardOpen}
        currentBoardId={boardId}
        onConfirm={handleConfirmMoveToBoard}
        isProcessing={moveToBoard.isPending}
      />

      <TransferBoardDialog
        open={bulkTransferBoardOpen}
        onOpenChange={setBulkTransferBoardOpen}
        currentBoardId={boardId}
        onConfirm={handleBulkMoveToBoard}
        isProcessing={bulkProcessing}
        title={`Mover ${selectedTickets.size} ticket(s) para Board`}
      />
    </div>
  )
}
