import { useState, useMemo, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'
import { useHumanAgents } from '@/hooks/useHumanAgents'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRightLeft, LayoutGrid, Search, Clock, AlertTriangle } from 'lucide-react'

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  currentBoardId?: string | null
}

const statusColors: Record<string, string> = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  away: 'bg-muted-foreground',
  offline: 'bg-muted-foreground',
}

const statusLabels: Record<string, string> = {
  online: 'Online',
  busy: 'Ocupado',
  away: 'Ausente',
  offline: 'Offline',
}

export function TransferDialog({ open, onOpenChange, conversationId, currentBoardId }: TransferDialogProps) {
  const { agents, isLoading } = useHumanAgents()
  const { data: boards = [] } = useKanbanBoards()
  const queryClient = useQueryClient()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [instanceId, setInstanceId] = useState<string>('__keep__')
  const [transferring, setTransferring] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [internalWaitingReason, setInternalWaitingReason] = useState('')

  const MIN_REASON_LENGTH = 10

  // Fetch stages for the selected board
  const { data: boardStages = [] } = useQuery({
    queryKey: ['transfer-board-stages', selectedBoard],
    queryFn: async () => {
      if (!selectedBoard) return []
      const { data } = await (supabase as any)
        .from('kanban_stages')
        .select('id, name, color, sort_order, is_entry, status_type, is_final')
        .eq('board_id', selectedBoard)
        .eq('active', true)
        .order('sort_order')
      return data || []
    },
    enabled: !!selectedBoard,
  })

  // Count active conversations per human agent via agent_assignments
  const { data: activeCountMap = {} } = useQuery({
    queryKey: ['agent-active-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_assignments')
        .select('human_agent_id')
        .eq('agent_type', 'human')
        .is('unassigned_at', null)
      if (!data) return {} as Record<string, number>
      const counts: Record<string, number> = {}
      for (const row of data) {
        if (row.human_agent_id) {
          counts[row.human_agent_id] = (counts[row.human_agent_id] || 0) + 1
        }
      }
      return counts
    },
    enabled: open,
  })

  const selectedBoardName = useMemo(() => {
    if (!selectedBoard) return null
    return boards.find(b => b.id === selectedBoard)?.name?.toLowerCase() || null
  }, [selectedBoard, boards])

  const sortedAgents = useMemo(() => {
    if (!agents) return []
    if (!selectedBoardName) return agents

    const matched: typeof agents = []
    const others: typeof agents = []

    for (const agent of agents) {
      const specs = agent.specialties || []
      const isMatch = specs.some(s => s.toLowerCase().includes(selectedBoardName) || selectedBoardName.includes(s.toLowerCase()))
      if (isMatch) matched.push(agent)
      else others.push(agent)
    }

    return [...matched, ...others]
  }, [agents, selectedBoardName])

  const matchedCount = useMemo(() => {
    if (!selectedBoardName || !agents) return 0
    return agents.filter(a => (a.specialties || []).some(s => s.toLowerCase().includes(selectedBoardName) || selectedBoardName.includes(s.toLowerCase()))).length
  }, [agents, selectedBoardName])

  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) return sortedAgents
    const term = searchTerm.toLowerCase()
    return sortedAgents.filter(a =>
      a.name?.toLowerCase().includes(term) ||
      (a.specialties || []).some((s: string) => s.toLowerCase().includes(term))
    )
  }, [sortedAgents, searchTerm])

  const selectedStageData = useMemo(() => {
    if (!selectedStage || !boardStages) return null
    return (boardStages as any[]).find((s: any) => s.id === selectedStage) || null
  }, [selectedStage, boardStages])

  const needsInternalWaitingReason = selectedStageData?.status_type === 'internal_waiting' || selectedStageData?.status_type === 'aguardando_interno'
  const internalWaitingValid = !needsInternalWaitingReason || internalWaitingReason.trim().length >= MIN_REASON_LENGTH

  const canTransfer = !!(selectedAgent || selectedBoard) && internalWaitingValid

  const handleTransfer = async () => {
    if (!canTransfer) return
    setTransferring(true)
    try {
      // 1. Fetch current context for audit log
      const [{ data: conversation }, { data: prevAssignment }, { data: authUser }] = await Promise.all([
        supabase
          .from('ai_conversations')
          .select('ticket_number, customer_name, customer_phone, kanban_stage_id')
          .eq('id', conversationId)
          .maybeSingle(),
        supabase
          .from('agent_assignments')
          .select('human_agent_id')
          .eq('conversation_id', conversationId)
          .eq('agent_type', 'human')
          .is('unassigned_at', null)
          .maybeSingle(),
        supabase.auth.getUser(),
      ])

      const fromAgentId = prevAssignment?.human_agent_id || null
      const fromAgent = fromAgentId ? agents?.find(a => a.id === fromAgentId) : null
      const toAgent = agents?.find(a => a.id === selectedAgent)

      const fromBoard = currentBoardId ? boards.find(b => b.id === currentBoardId) : null
      const toBoard = selectedBoard ? boards.find(b => b.id === selectedBoard) : null

      // 2. Build update payload
      const updatePayload: Record<string, unknown> = {}

      if (selectedAgent) {
        updatePayload.handler_type = 'human'
        updatePayload.status = 'em_atendimento'
        updatePayload.human_agent_id = selectedAgent
      }

      if (needsInternalWaitingReason) {
        updatePayload.internal_waiting_reason = internalWaitingReason.trim()
      }

      const instanceChanged = !!(instanceId && instanceId !== '__keep__' && instanceId !== '__same_channel__')
      if (instanceChanged) {
        updatePayload.whatsapp_instance_id = instanceId
      }

      // If board changed, use selected stage or find entry stage
      const boardChanged = !!(selectedBoard && selectedBoard !== currentBoardId)
      let newStageId: string | null = null
      if (boardChanged) {
        updatePayload.kanban_board_id = selectedBoard

        if (selectedStage) {
          // User explicitly chose a stage
          newStageId = selectedStage
        } else {
          // Fallback: find entry stage
          const { data: entryStage } = await (supabase as any)
            .from('kanban_stages')
            .select('id')
            .eq('board_id', selectedBoard)
            .eq('is_entry', true)
            .eq('active', true)
            .order('sort_order')
            .limit(1)
            .maybeSingle()
          newStageId = entryStage?.id || null
        }

        if (newStageId) {
          updatePayload.kanban_stage_id = newStageId
          updatePayload.stage_id = newStageId
        }
      }

      // 3. Update conversation
      const { error } = await supabase
        .from('ai_conversations')
        .update(updatePayload as any)
        .eq('id', conversationId)
      if (error) throw error

      // 4. Record stage history if board changed
      if (boardChanged && newStageId) {
        await supabase
          .from('ticket_stage_history')
          .insert({
            conversation_id: conversationId,
            from_stage_id: null,
            to_stage_id: newStageId,
            moved_by: 'transfer',
          })
      }

      // 5. Agent assignment (only if agent selected)
      if (selectedAgent) {
        // Unassign previous
        await supabase
          .from('agent_assignments')
          .update({ unassigned_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .is('unassigned_at', null)

        // Create new assignment
        const { error: assignError } = await supabase
          .from('agent_assignments')
          .insert({
            conversation_id: conversationId,
            human_agent_id: selectedAgent,
            agent_type: 'human',
            reason: note || 'Transferência manual',
          })
        if (assignError) console.error('Assignment error:', assignError)
      }

      // 7. Insert transfer audit log
      await (supabase as any)
        .from('transfer_audit_logs')
        .insert({
          conversation_id: conversationId,
          ticket_number: conversation?.ticket_number || null,
          customer_name: conversation?.customer_name || null,
          customer_phone: conversation?.customer_phone || null,
          from_agent_id: fromAgentId,
          from_agent_name: fromAgent?.name || null,
          to_agent_id: selectedAgent,
          to_agent_name: toAgent?.name || null,
          from_board_id: currentBoardId || null,
          from_board_name: fromBoard?.name || null,
          to_board_id: boardChanged ? selectedBoard : null,
          to_board_name: boardChanged ? toBoard?.name || null : null,
          from_stage_id: conversation?.kanban_stage_id || null,
          to_stage_id: newStageId,
          whatsapp_instance_changed: instanceChanged,
          new_instance_id: instanceChanged ? instanceId : null,
          note: note || null,
          transferred_by: authUser?.user?.id || null,
        })

      // 8. Insert transfer chat message (visible in conversation)
      const transferParts: string[] = []
      if (fromAgent?.name) transferParts.push(`De: ${fromAgent.name}`)
      if (selectedAgent) transferParts.push(`Para: ${toAgent?.name || 'Agente'}`)
      if (boardChanged && toBoard?.name) {
        const stageName = selectedStage ? (boardStages as any[]).find((s: any) => s.id === selectedStage)?.name : null
        transferParts.push(`Board: ${toBoard.name}${stageName ? ` → ${stageName}` : ''}`)
      }
      if (note) transferParts.push(`Nota: ${note}`)

      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'transfer_log',
        content: `🔄 Transferência realizada\n${transferParts.join('\n')}`,
      })

      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['agent-active-counts'] })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast.success('Conversa transferida com sucesso!')
      onOpenChange(false)
      setSelectedAgent(null)
      setSelectedBoard(null)
      setSelectedStage(null)
      setInstanceId('__keep__')
      setNote('')
      setInternalWaitingReason('')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erro ao transferir')
    } finally {
      setTransferring(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Transferir Conversa
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-0 h-full">
            {/* Left column: Agent selection */}
            <div className="p-4 sm:border-r space-y-1.5 flex flex-col min-h-0">
              <label className="text-xs font-medium text-muted-foreground">
                Selecione o agente
                {filteredAgents.length > 0 && <span className="ml-1 text-muted-foreground/70">({filteredAgents.length} disponíveis)</span>}
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar agente por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <ScrollArea className="flex-1 max-h-[280px] sm:max-h-[420px]">
                <div className="space-y-2 pr-2">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : filteredAgents.length > 0 ? (
                    filteredAgents.map((agent, index) => {
                      const status = (agent as any).status || 'online'
                      const isSelected = selectedAgent === agent.id
                      const specs = agent.specialties || []
                      const isRecommended = selectedBoardName && specs.some(s => s.toLowerCase().includes(selectedBoardName) || selectedBoardName.includes(s.toLowerCase()))
                      const showSeparator = selectedBoardName && matchedCount > 0 && index === matchedCount && matchedCount < filteredAgents.length

                      return (
                        <div key={agent.id}>
                          {showSeparator && (
                            <div className="flex items-center gap-2 py-2">
                              <div className="h-px flex-1 bg-border" />
                              <span className="text-xs text-muted-foreground font-medium">Outros agentes</span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedAgent(agent.id)}
                            className={cn(
                              'w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border',
                              isSelected
                                ? 'bg-primary/5 border-primary/20'
                                : isRecommended
                                  ? 'bg-primary/[0.03] border-primary/10 hover:bg-primary/5'
                                  : 'bg-secondary/50 border-transparent hover:bg-secondary'
                            )}
                          >
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {agent.name?.[0]?.toUpperCase() || 'A'}
                              </div>
                              <div className={cn(
                                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                                statusColors[status] || statusColors.online
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground truncate">{agent.name}</span>
                                {isRecommended && (
                                  <Badge className="text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-0">
                                    Recomendado
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                  {statusLabels[status] || 'Online'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {specs.length > 0 && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {specs.slice(0, 2).join(', ')}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  • {activeCountMap[agent.id] || 0}/{agent.max_concurrent_conversations || 5} conversas
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum agente disponível</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right column: Board, Channel, Note */}
            <div className="p-4 space-y-4 border-t sm:border-t-0">
              {/* Board selection */}
              {boards.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Mover para Board (opcional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {boards.map(board => {
                      const isCurrent = board.id === currentBoardId
                      const isSelected = selectedBoard === board.id
                      return (
                        <button
                          key={board.id}
                          onClick={() => {
                            setSelectedBoard(isSelected ? null : board.id)
                            setSelectedStage(null)
                          }}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : isCurrent
                                ? 'border-border bg-muted text-muted-foreground cursor-default opacity-60'
                                : 'border-border hover:bg-accent text-foreground'
                          )}
                          disabled={isCurrent}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: board.color }}
                          />
                          {board.name}
                          {isCurrent && <span className="text-[9px] text-muted-foreground">(atual)</span>}
                        </button>
                      )
                    })}
                  </div>

                  {/* Stage selector for selected board */}
                  {selectedBoard && (boardStages as any[]).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Etapa de destino</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(boardStages as any[]).map((stage: any) => {
                          const isSelected = selectedStage === stage.id
                          return (
                            <button
                              key={stage.id}
                              onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                              className={cn(
                                'flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:bg-accent text-foreground'
                              )}
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color || 'var(--primary)' }} />
                              {stage.name}
                              {stage.is_entry && !isSelected && <span className="text-[9px] text-muted-foreground">(entrada)</span>}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedStage ? 'Etapa selecionada manualmente' : 'Nenhuma selecionada — usará etapa de entrada'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Internal waiting reason (conditional) */}
              {needsInternalWaitingReason && (
                <div className="space-y-1.5 p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    Motivo do aguardo interno <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={internalWaitingReason}
                    onChange={(e) => setInternalWaitingReason(e.target.value)}
                    placeholder="Ex: Aguardando resposta do time de desenvolvimento..."
                    className="min-h-[60px] text-xs resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Min. {MIN_REASON_LENGTH} caracteres
                    </span>
                    <span className={cn('text-[10px]', internalWaitingReason.trim().length < MIN_REASON_LENGTH ? 'text-destructive' : 'text-green-600')}>
                      {internalWaitingReason.trim().length}/{MIN_REASON_LENGTH}
                    </span>
                  </div>
                  {internalWaitingReason.trim().length > 0 && !internalWaitingValid && (
                    <div className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      Descreva com mais detalhes
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp instance selection */}
              <Separator />
              <div className="space-y-1.5">
                <WhatsAppInstanceSelect
                  value={instanceId}
                  onChange={setInstanceId}
                  showSameChannel
                  label="Canal de Envio após transferência"
                />
                <p className="text-xs text-muted-foreground">
                  Selecione "Mesmo canal" para manter a instância atual ou escolha uma nova.
                </p>
              </div>

              {/* Transfer note */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Nota de transferência (opcional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Motivo da transferência..."
                  className="min-h-[60px] text-xs resize-none rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!canTransfer || transferring}
            className="rounded-xl bg-primary text-primary-foreground"
          >
            {transferring ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1.5" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
