import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import DOMPurify from 'dompurify'
import { useContactPicture } from '@/hooks/useContactPicture'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAISuggestion } from '@/hooks/useAISuggestion'
import { useHandoff } from '@/hooks/useHandoff'
import { lazyRetryNamed } from '@/lib/lazyRetry'
// Lazy-load heavy components to avoid TDZ initialization errors with Vite code-splitting
const ChatArea = lazyRetryNamed(() => import('@/components/inbox/ChatArea'), 'ChatArea')
const ClienteTab = lazyRetryNamed(() => import('@/components/inbox/ClienteTab'), 'ClienteTab')
import { TransferDialog } from '@/components/inbox/TransferDialog'
import { MergeTicketsDialog } from '@/components/inbox/MergeTicketsDialog'
import { RequiredFieldsDialog } from '@/components/inbox/RequiredFieldsDialog'
import { AICloseValidationDialog } from '@/components/inbox/AICloseValidationDialog'
import { InternalWaitingReasonDialog } from '@/components/tickets/InternalWaitingReasonDialog'
import { useCloseValidation, type MissingField } from '@/hooks/useCloseValidation'
import { TicketTramitacaoTab } from '@/components/tickets/TicketTramitacaoTab'
import TicketDescriptionForm from '@/components/tickets/TicketDescriptionForm'
import { EditContactNamePopover } from '@/components/conversation/EditContactNamePopover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  X, MessageSquare, Ticket, User, BarChart3, History,
  Send, Phone, Bot, BotOff, Clock, Headphones, Hash, Shield,
  Timer, MoreVertical, ChevronDown, Plus, Sparkles,
  CheckCircle2, AlertCircle, FileText, Loader2, RefreshCw,
  ChevronsUp, Minus, ChevronsDown, Columns3, ArrowRightLeft,
  StickyNote, Lock, Pencil, Zap, Info, Brain, Smile, Meh, Frown, AlertTriangle,
  Eye, ChevronUp, Lightbulb, MessageCircle, Package, Search, DollarSign, GitMerge
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from '@/components/ui/command'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'
import { useWhatsAppValidation } from '@/hooks/useWhatsAppValidation'
import { useWaitTimer, formatHHMMSS } from '@/hooks/useWaitTimer'
import { useSLAConfig } from '@/hooks/useSLAConfig'
import { useCSATConfig } from '@/hooks/useCSATConfig'
import { useCSATBoardConfig } from '@/hooks/useCSATBoardConfig'
import { useTicketNotes, type TicketNote } from '@/hooks/useTicketNotes'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import CancellationRetentionTab from '@/components/tickets/CancellationRetentionTab'
import { useAuth } from '@/contexts/AuthContext'
import { triggerStageAutomations } from '@/utils/stageAutomationExecutor'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMutation } from '@tanstack/react-query'
import type { Tables } from '@/integrations/supabase/types'

type Conversation = Tables<'ai_conversations'> & {
  ai_agents?: { name: string; color: string; specialty: string } | null
  human_agents?: { name: string } | null
}

type MainTab = 'conversa' | 'analise' | 'ticket' | 'cliente' | 'historico' | 'relatorio' | 'catalogo' | 'retencao'

interface KanbanInboxPanelProps {
  conversationId: string
  onClose: () => void
}

// Helper: format seconds to human readable
function formatSeconds(s: number | null | undefined): string {
  if (!s || s <= 0) return '—'
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

const priorityConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  low: { label: 'Baixa', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20', borderColor: 'border-emerald-200 dark:border-emerald-800' },
  medium: { label: 'Média', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  high: { label: 'Alta', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-red-200 dark:border-red-800' },
  urgent: { label: 'Urgente', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-red-200 dark:border-red-800' },
  critical: { label: 'Crítica', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-red-200 dark:border-red-800' },
}

export function KanbanInboxPanel({ conversationId, onClose }: KanbanInboxPanelProps) {
  const [pendingMessage, setPendingMessage] = useState('')
  const [activeTab, setActiveTab] = useState<MainTab>('analise')
  const [transferOpen, setTransferOpen] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(false)
  const [subjectDraft, setSubjectDraft] = useState('')
  const [moveBoardId, setMoveBoardId] = useState<string | null>(null)
  const { suggestion, loading: suggestionLoading, generateSuggestion, clearSuggestion } = useAISuggestion()
  const { takeOverConversation, returnToAI, activateAIAgent } = useHandoff()
  const queryClient = useQueryClient()
  const { user: authUser } = useAuth()
  const { data: kanbanBoards = [] } = useKanbanBoards()

  // Close validation state
  const { validateForClose, closeRequirements, runAINameValidation, runAICloseReview } = useCloseValidation()
  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false)
  const [missingFields, setMissingFields] = useState<MissingField[]>([])
  const [aiValidationDialogOpen, setAIValidationDialogOpen] = useState(false)
  const [pendingAIValidations, setPendingAIValidations] = useState<string[]>([])
  const [pendingAITicket, setPendingAITicket] = useState<any>(null)
  const [pendingMoveStageId, setPendingMoveStageId] = useState<string | null>(null)
  const [internalWaitingDialogOpen, setInternalWaitingDialogOpen] = useState(false)
  const [pendingInternalWaitingStageId, setPendingInternalWaitingStageId] = useState<string | null>(null)

  // Fetch full conversation data
  const { data: conversation } = useQuery({
    queryKey: ['kanban-conversation-detail', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*, ai_agents(name, color, specialty), human_agents(name)')
        .eq('id', conversationId)
        .single()
      if (error) throw error
      return data as Conversation
    },
    enabled: !!conversationId,
  })

  // Fetch kanban stages for the board (for move stage)
  const effectiveBoardId = (conversation as any)?.kanban_board_id || null
  const currentBoardObj = kanbanBoards.find(b => b.id === effectiveBoardId)
  const isCancellationBoard = currentBoardObj?.board_type === 'cancellation'
  const { data: headerStages = [] } = useQuery({
    queryKey: ['kanban-stages-header', effectiveBoardId],
    queryFn: async () => {
      if (!effectiveBoardId) return []
      const { data } = await (supabase as any)
        .from('kanban_stages')
        .select('id, name, color, sort_order, is_final, status_type')
        .eq('board_id', effectiveBoardId)
        .eq('active', true)
        .order('sort_order')
      return data || []
    },
    enabled: !!effectiveBoardId,
  })

  // Stages for destination board (move board flow)
  const { data: moveBoardStages = [] } = useQuery({
    queryKey: ['kanban-stages-move-board', moveBoardId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('kanban_stages')
        .select('id, name, color, sort_order, is_entry')
        .eq('board_id', moveBoardId)
        .eq('active', true)
        .order('sort_order')
      return data || []
    },
    enabled: !!moveBoardId,
  })

  // Reset moveBoardId when conversation changes
  useEffect(() => {
    setMoveBoardId(null)
  }, [conversationId])

  // Subject mutation
  const updateSubject = useMutation({
    mutationFn: async (subject: string) => {
      const { error } = await supabase.from('ai_conversations').update({ ticket_subject: subject } as any).eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Assunto atualizado')
      setEditingSubject(false)
    },
    onError: () => toast.error('Erro ao atualizar assunto'),
  })

  // Assume attendance mutation — start attending a queue ticket
  const assumeAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!authUser) throw new Error('Usuário não autenticado')
      const { data: agent, error: agentErr } = await supabase
        .from('human_agents')
        .select('id')
        .eq('user_id', authUser.id)
        .limit(1)
        .single()
      if (agentErr || !agent) throw new Error('Agente humano não encontrado para este usuário')

      const { error: updateErr } = await supabase
        .from('ai_conversations')
        .update({
          status: 'em_atendimento',
          human_agent_id: agent.id,
          handler_type: 'human',
        })
        .eq('id', conversationId)
      if (updateErr) throw updateErr

      await supabase.from('agent_assignments').insert({
        conversation_id: conversationId,
        agent_type: 'human',
        human_agent_id: agent.id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Atendimento assumido com sucesso!')
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao assumir atendimento'),
  })

  // Move stage mutation (same board)
  const moveStageHeader = useMutation({
    mutationFn: async (toStageId: string) => {
      const fromStageId = (conversation as any)?.stage_id || (conversation as any)?.kanban_stage_id || null
      const { error } = await supabase
        .from('ai_conversations')
        .update({ stage_id: toStageId, kanban_stage_id: toStageId } as any)
        .eq('id', conversationId)
      if (error) throw error
      if (fromStageId && fromStageId !== toStageId) {
        triggerStageAutomations(conversationId, fromStageId, toStageId).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Etapa alterada')
    },
    onError: () => toast.error('Erro ao mover etapa'),
  })

  // Validated stage change handler
  const handleStageChange = useCallback(async (toStageId: string) => {
    const destStage = (headerStages as any[]).find(s => s.id === toStageId)
    if (!destStage) {
      moveStageHeader.mutate(toStageId)
      return
    }

    // Block move to em_atendimento if not started
    if (destStage.status_type === 'em_atendimento' && conversation?.status === 'aguardando' && !(conversation as any)?.human_started_at) {
      toast.error('Para mover para esta etapa o agente precisa clicar em Iniciar Atendimento.')
      return
    }

    // Internal waiting reason required
    if (destStage.status_type === 'internal_waiting' || destStage.status_type === 'aguardando_interno') {
      setPendingInternalWaitingStageId(toStageId)
      setInternalWaitingDialogOpen(true)
      return
    }

    // Validate close requirements for final stages (always fetch fresh data)
    if (destStage.is_final && conversation) {
      const { data: fresh, error: freshError } = await supabase
        .from('ai_conversations')
        .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
        .eq('id', conversationId)
        .single()
      if (freshError) console.warn('[KanbanChatPanel] Fresh fetch failed, using cache:', freshError.message)
      // Use latest React Query cache as base (avoids stale closure), then overlay with fresh DB data
      const cached = queryClient.getQueryData<any>(['ticket-detail', conversationId])
      const base = cached || conversation
      const conv = fresh ? { ...base, ...fresh } : base
      const result = validateForClose(conv)
      if (result.missingFields.length > 0) {
        setMissingFields(result.missingFields)
        setPendingMoveStageId(toStageId)
        setRequirementsDialogOpen(true)
        return
      }
      if (result.aiValidationsNeeded.length > 0) {
        setPendingAIValidations(result.aiValidationsNeeded)
        setPendingAITicket(conv)
        setPendingMoveStageId(toStageId)
        setAIValidationDialogOpen(true)
        return
      }
    }

    moveStageHeader.mutate(toStageId)
  }, [headerStages, conversation, validateForClose, moveStageHeader, conversationId])

  // Internal waiting reason confirmed
  const handleInternalWaitingConfirm = useCallback(async (reason: string) => {
    setInternalWaitingDialogOpen(false)
    if (pendingInternalWaitingStageId) {
      await supabase
        .from('ai_conversations')
        .update({ internal_waiting_reason: reason } as any)
        .eq('id', conversationId)
      moveStageHeader.mutate(pendingInternalWaitingStageId)
      setPendingInternalWaitingStageId(null)
    }
  }, [pendingInternalWaitingStageId, conversationId, moveStageHeader])

  // Force close after requirements dialog
  const handleForceClosePanel = useCallback(async () => {
    setRequirementsDialogOpen(false)
    if (pendingMoveStageId) {
      if (conversation) {
        // Buscar dados frescos antes de validar IA
        const { data: fresh, error: freshError } = await supabase
          .from('ai_conversations')
          .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
          .eq('id', conversationId)
          .single()
        if (freshError) console.warn('[KanbanChatPanel] Force close fresh fetch failed:', freshError.message)
        const cached = queryClient.getQueryData<any>(['ticket-detail', conversationId])
        const base = cached || conversation
        const conv = fresh ? { ...base, ...fresh } : base
        const result = validateForClose(conv)
        if (result.aiValidationsNeeded.length > 0) {
          setPendingAIValidations(result.aiValidationsNeeded)
          setPendingAITicket(conv)
          setAIValidationDialogOpen(true)
          return
        }
      }
      moveStageHeader.mutate(pendingMoveStageId)
      setPendingMoveStageId(null)
    }
  }, [pendingMoveStageId, moveStageHeader, conversation, validateForClose, conversationId, queryClient])

  // After AI validation completes
  const handleAIValidationComplete = useCallback((_result: { correctedName?: string; closeReviewNote?: string }) => {
    setAIValidationDialogOpen(false)
    if (pendingMoveStageId) {
      moveStageHeader.mutate(pendingMoveStageId)
      setPendingMoveStageId(null)
    }
  }, [pendingMoveStageId, moveStageHeader])




  // Move to different board + stage mutation
  const moveBoardAndStage = useMutation({
    mutationFn: async (toStageId: string) => {
      if (!moveBoardId) throw new Error('Board destino não selecionado')
      const fromStageId = (conversation as any)?.stage_id || (conversation as any)?.kanban_stage_id || null
      const { error } = await supabase
        .from('ai_conversations')
        .update({ kanban_board_id: moveBoardId, stage_id: toStageId, kanban_stage_id: toStageId } as any)
        .eq('id', conversationId)
      if (error) throw error
      await supabase
        .from('ticket_stage_history')
        .insert({ conversation_id: conversationId, from_stage_id: fromStageId || null, to_stage_id: toStageId, moved_by: 'board-transfer' })
        .then(() => {})
      if (fromStageId && fromStageId !== toStageId) {
        triggerStageAutomations(conversationId, fromStageId, toStageId).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-stages-header'] })
      toast.success('Ticket transferido para outro board')
      setMoveBoardId(null)
    },
    onError: () => toast.error('Erro ao transferir board'),
  })

  // Reset unread count when opening a ticket in Kanban
  useEffect(() => {
    if (!conversation?.uazapi_chat_id) return
    const chatId = (conversation as any).uazapi_chat_id
    supabase
      .from('uazapi_chats' as any)
      .update({ unread_count: 0 } as any)
      .eq('chat_id', chatId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      })
  }, [conversation?.uazapi_chat_id, queryClient])

  // Fetch message count
  const { data: messageCount } = useQuery({
    queryKey: ['message-count', conversationId],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
      return count || 0
    },
    enabled: !!conversationId,
  })

  const hasClient = !!(conversation as any)?.helpdesk_client_id
  const isInternalNoChat = conversation?.communication_channel === 'internal' && !conversation?.uazapi_chat_id
  const hasValidPhone = !!(conversation?.customer_phone && conversation.customer_phone !== 'interno')

  // Fetch helpdesk client data for CNPJ/company
  const { data: helpdeskClient } = useQuery({
    queryKey: ['helpdesk-client-header', (conversation as any)?.helpdesk_client_id],
    queryFn: async () => {
      const clientId = (conversation as any)?.helpdesk_client_id
      if (!clientId) return null
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('name, company_name, cnpj, cpf')
        .eq('id', clientId)
        .maybeSingle()
      return data
    },
    enabled: !!(conversation as any)?.helpdesk_client_id,
    staleTime: 1000 * 60 * 5,
  })

  // Contact picture
  const { url: contactPictureUrl } = useContactPicture(
    undefined,
    (conversation as any)?.uazapi_chat_id,
    conversation?.whatsapp_instance_id || undefined,
    null,
    conversation?.customer_phone
  )

  // Start contact state
  const [startContactMsg, setStartContactMsg] = useState('')
  const [startContactInstance, setStartContactInstance] = useState('')
  const [startingContact, setStartingContact] = useState(false)
  const { validateNumber, validating: validatingWhatsApp } = useWhatsAppValidation()

  const handleStartContact = async () => {
    if (!conversation || !startContactMsg.trim() || !startContactInstance) {
      toast.error('Selecione o canal e escreva a mensagem')
      return
    }
    const phone = conversation.customer_phone.replace(/\D/g, '')
    if (!phone) {
      toast.error('Telefone inválido')
      return
    }

    setStartingContact(true)
    try {
      const validation = await validateNumber(phone, startContactInstance)
      if (!validation.valid) {
        toast.error('Este número não possui WhatsApp. Verifique o telefone e tente novamente.')
        setStartingContact(false)
        return
      }
      if (validation.unknown) {
        toast.warning('Não foi possível validar o número no WhatsApp. Tentando enviar mesmo assim...')
      }

      const { data: inst } = await (supabase as any)
        .from('uazapi_instances')
        .select('id, api_url, api_token')
        .eq('id', startContactInstance)
        .single()
      if (!inst) throw new Error('Instância não encontrada')

      const apiUrl = inst.api_url.replace(/\/$/, '')
      const chatJid = validation.jid || (phone.includes('@') ? phone : `${phone}@s.whatsapp.net`)

      const sendRes = await fetch(`${apiUrl}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: inst.api_token },
        body: JSON.stringify({ number: chatJid, text: startContactMsg.trim() }),
      })
      const sendResult = await sendRes.json()

      await supabase
        .from('ai_conversations')
        .update({
          communication_channel: 'whatsapp',
          uazapi_chat_id: chatJid,
          whatsapp_instance_id: inst.id,
          status: 'em_atendimento',
          handler_type: 'human',
        })
        .eq('id', conversation.id)

      await (supabase as any).from('uazapi_chats').upsert({
        chat_id: chatJid,
        instance_id: inst.id,
        contact_name: conversation.customer_name || phone,
        contact_phone: phone,
      }, { onConflict: 'chat_id' })

      await supabase.from('ai_messages').insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: startContactMsg.trim(),
      })

      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      toast.success('Contato iniciado via WhatsApp!')
      setStartContactMsg('')
    } catch (err: any) {
      toast.error('Erro ao iniciar contato: ' + (err?.message || 'Erro'))
    } finally {
      setStartingContact(false)
    }
  }

  const handleRequestSuggestion = useCallback((mode?: 'generate' | 'context' | 'improve', context?: string) => {
    if (conversationId) {
      generateSuggestion(conversationId, pendingMessage || 'última mensagem', mode, context)
    }
  }, [conversationId, pendingMessage, generateSuggestion])

  const handleUseSuggestion = useCallback((text: string) => {
    setPendingMessage(text)
    clearSuggestion()
    setActiveTab('conversa')
  }, [clearSuggestion])

  const handleOpenClienteTab = useCallback(() => {
    setActiveTab('cliente')
  }, [])

  // Elapsed time
  const elapsedMs = conversation?.started_at
    ? Date.now() - new Date(conversation.started_at).getTime()
    : 0
  const elapsedMinutes = Math.floor(elapsedMs / 60000)
  const elapsedFormatted = (() => {
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`
    const hrs = Math.floor(elapsedMinutes / 60)
    const mins = elapsedMinutes % 60
    if (hrs < 24) return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`
    return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
  })()

  const priority = conversation?.priority || 'medium'
  const priorityInfo = priorityConfig[priority] || priorityConfig.medium

  const tabs: { id: MainTab; icon: typeof MessageSquare; label: string; count?: number; highlight?: boolean }[] = [
    { id: 'conversa', icon: MessageSquare, label: 'Conversa' },
    { id: 'analise', icon: Sparkles, label: 'Análise', highlight: true },
    { id: 'ticket', icon: Ticket, label: 'Ticket' },
    { id: 'cliente', icon: User, label: 'Cliente' },
    { id: 'historico', icon: History, label: 'Histórico' },
    { id: 'catalogo', icon: Package, label: 'Catálogo' },
    { id: 'relatorio', icon: BarChart3, label: 'Relatório' },
    ...(isCancellationBoard ? [{ id: 'retencao' as MainTab, icon: Shield, label: 'Retenção', highlight: true }] : []),
  ]

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-5 duration-300">
      {/* CTA Iniciar Atendimento removido — existe dentro do ChatArea */}

      {/* ═══ ALERT BAR — Client not linked ═══ */}
      {conversation && !hasClient && (
        <div className="shrink-0 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 flex items-center gap-3">
          <User className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
            Nenhum cliente vinculado a este atendimento.
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenClienteTab}
            className="h-7 text-xs font-semibold"
          >
            Vincular Cliente
          </Button>
        </div>
      )}

      {/* ═══ TICKET HEADER ═══ */}
      <div className="shrink-0 bg-white border-b border-gms-g200 px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-gms-cyan/40">
            {contactPictureUrl && (
              <AvatarImage src={contactPictureUrl} alt={conversation?.customer_name || 'Contato'} />
            )}
            <AvatarFallback className="bg-gms-cyan text-gms-navy text-xs font-bold">
              {(conversation?.customer_name || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 group">
              <h2 className="text-sm font-bold text-gms-g900 truncate">
                {conversation?.customer_name || 'Sem nome'}
              </h2>
              {conversation && (
                <EditContactNamePopover
                  conversationId={conversationId}
                  currentName={conversation.customer_name || ''}
                  uazapiChatId={(conversation as any).uazapi_chat_id}
                />
              )}
              {(conversation as any)?.ticket_number && (
                <span className="text-xs text-gms-g500 font-mono">#{(conversation as any).ticket_number}</span>
              )}
              <Badge className={cn('text-xs font-semibold border px-2 py-0', priorityInfo.bgColor, priorityInfo.borderColor, priorityInfo.color)}>
                {priorityInfo.label}
              </Badge>
            </div>
            {/* Ticket Subject — editable inline */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {editingSubject ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={subjectDraft}
                    onChange={e => setSubjectDraft(e.target.value)}
                    placeholder="Assunto do ticket..."
                    className="h-6 text-xs flex-1 rounded px-2"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && subjectDraft.trim()) updateSubject.mutate(subjectDraft.trim())
                      if (e.key === 'Escape') setEditingSubject(false)
                    }}
                  />
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { if (subjectDraft.trim()) updateSubject.mutate(subjectDraft.trim()) }}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingSubject(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1 text-[12px] font-medium text-gms-g700 hover:text-gms-cyan transition-colors truncate max-w-[400px]"
                  onClick={() => {
                    setSubjectDraft((conversation as any)?.ticket_subject || '')
                    setEditingSubject(true)
                  }}
                >
                  <FileText className="w-3 h-3 shrink-0 text-muted-foreground" />
                  {(conversation as any)?.ticket_subject || <span className="italic text-muted-foreground">Sem assunto — clique para editar</span>}
                  <Pencil className="w-2.5 h-2.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
            {/* Phone + CNPJ/Empresa */}
            <div className="flex items-center gap-3 mt-1">
              {conversation?.customer_phone && (
                <span className="flex items-center gap-1 text-xs text-gms-g500">
                  <Phone className="w-3 h-3" />
                  {conversation.customer_phone}
                </span>
              )}
              {(helpdeskClient?.cnpj || helpdeskClient?.cpf) && (
                <span className="flex items-center gap-1 text-xs text-gms-g500">
                  <FileText className="w-3 h-3" />
                  {helpdeskClient.cnpj || helpdeskClient.cpf}
                  {helpdeskClient.company_name && ` — ${helpdeskClient.company_name}`}
                </span>
              )}
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Board Select */}
            {kanbanBoards.length > 1 && (
              <Select
                value={moveBoardId || effectiveBoardId || ''}
                onValueChange={v => {
                  if (v === effectiveBoardId) {
                    setMoveBoardId(null)
                  } else {
                    setMoveBoardId(v)
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs font-semibold gap-1 w-auto min-w-[110px] rounded-lg border-gms-g200 bg-gms-g100 text-gms-g900 hover:bg-gms-g200">
                  <Columns3 className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Board" />
                </SelectTrigger>
                <SelectContent>
                  {kanbanBoards.map(b => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color || 'var(--primary)' }} />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Stage Select — shows destination board stages when moveBoardId is set */}
            {moveBoardId ? (
              <Select
                value=""
                onValueChange={v => moveBoardAndStage.mutate(v)}
              >
                <SelectTrigger className="h-8 text-xs font-semibold gap-1 w-auto min-w-[120px] rounded-lg border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 animate-in fade-in-50">
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Selecionar etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {(moveBoardStages as any[]).map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || 'var(--primary)' }} />
                        {s.name}{s.is_entry ? ' (entrada)' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : headerStages.length > 0 && (
              <Select
                value={(conversation as any)?.stage_id || (conversation as any)?.kanban_stage_id || ''}
                onValueChange={v => handleStageChange(v)}
              >
                <SelectTrigger className="h-8 text-xs font-semibold gap-1 w-auto min-w-[120px] rounded-lg border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
                  <Columns3 className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Mover Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {(headerStages as any[]).map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || 'var(--primary)' }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Transfer button */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs border-gms-g200 text-gms-g900 hover:bg-gms-g100"
                    onClick={() => setTransferOpen(true)}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transferir
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Transferir atendimento</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Merge tickets button */}
            {conversation?.helpdesk_client_id && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs border-gms-g200 text-gms-g900 hover:bg-gms-g100"
                      onClick={() => setMergeDialogOpen(true)}
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Mesclar
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Mesclar tickets duplicados</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Timer */}
            {conversation?.started_at && (
              <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border bg-gms-yellow/20 text-gms-yellow border-gms-yellow/40">
                <Timer className="w-3 h-3" />
                <span>{elapsedFormatted}</span>
              </div>
            )}

            {/* AI Toggle */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "h-8 w-8 rounded-md flex items-center justify-center transition-colors border",
                      conversation?.handler_type === 'ai'
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    )}
                    onClick={() => {
                      if (conversation?.handler_type === 'ai') {
                        takeOverConversation.mutateAsync({ conversationId: conversation.id }).then(() => {
                          // Auto-generate subject if empty
                          if (!(conversation as any)?.ticket_subject) {
                            supabase.functions.invoke('ticket-category-classifier', {
                              body: { conversation_id: conversation.id }
                            }).then(() => {
                              queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversation.id] })
                              queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
                            })
                          }
                        })
                      } else if (conversation) {
                        activateAIAgent.mutate({ conversationId: conversation.id })
                      }
                    }}
                  >
                    {conversation?.handler_type === 'ai' ? <BotOff className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {conversation?.handler_type === 'ai' ? 'Desativar IA' : 'Ativar IA'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Close button */}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-md flex items-center justify-center border border-gms-g200 text-gms-g500 hover:bg-gms-g100 hover:text-gms-g900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Dialog */}
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        conversationId={conversationId}
        currentBoardId={(conversation as any)?.kanban_board_id}
      />

      {/* Merge Tickets Dialog */}
      {conversation && (
        <MergeTicketsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          conversationId={conversation.id}
          ticketNumber={conversation.ticket_number}
          helpdeskClientId={(conversation as any)?.helpdesk_client_id || null}
        />
      )}

      {/* Close Validation Dialogs */}
      <RequiredFieldsDialog
        open={requirementsDialogOpen}
        onOpenChange={setRequirementsDialogOpen}
        missingFields={missingFields}
        onForceClose={handleForceClosePanel}
      />
      <AICloseValidationDialog
        open={aiValidationDialogOpen}
        onOpenChange={setAIValidationDialogOpen}
        conversationId={conversationId}
        customerName={conversation?.customer_name || null}
        aiValidationsNeeded={pendingAIValidations}
        onComplete={handleAIValidationComplete}
        runAINameValidation={runAINameValidation}
        runAICloseReview={runAICloseReview}
      />
      <InternalWaitingReasonDialog
        open={internalWaitingDialogOpen}
        onOpenChange={(open) => {
          setInternalWaitingDialogOpen(open)
          if (!open) setPendingInternalWaitingStageId(null)
        }}
        onConfirm={handleInternalWaitingConfirm}
      />

      {/* ═══ CONTENT: Split-Pane (Chat + Side Tab) + Vertical Tab Bar ═══ */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* ─── CHAT (always visible) ─── */}
        <div className={cn(
          "min-h-0 overflow-hidden flex flex-col",
          activeTab === 'conversa' ? 'flex-1' : 'flex-1 min-w-0 border-r border-gms-g200'
        )}>
          <div className="flex flex-col flex-1 min-h-0">
            {isInternalNoChat && hasValidPhone && (
              <div className="shrink-0 border-b border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="w-4 h-4 text-primary" />
                  Iniciar Contato via WhatsApp
                </div>
                <p className="text-xs text-muted-foreground">
                  Este ticket interno ainda não possui conversa. Envie a primeira mensagem para <span className="font-medium text-foreground">{conversation?.customer_phone}</span>.
                </p>
                <WhatsAppInstanceSelect
                  value={startContactInstance}
                  onChange={setStartContactInstance}
                  required
                  label="Canal de Envio"
                />
                <Textarea
                  placeholder="Escreva a primeira mensagem..."
                  value={startContactMsg}
                  onChange={e => setStartContactMsg(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleStartContact}
                  disabled={startingContact || !startContactMsg.trim() || !startContactInstance}
                  className="gap-2"
                >
                  {startingContact ? 'Enviando...' : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Enviar e Iniciar Conversa
                    </>
                  )}
                </Button>
              </div>
            )}

            {isInternalNoChat && !hasValidPhone && (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Ticket interno sem telefone vinculado. Edite o ticket para adicionar um telefone e iniciar contato.
                </p>
              </div>
            )}

            <div className="flex-1 min-h-0">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                <ChatArea
                  conversation={conversation || null}
                  onRequestSuggestion={handleRequestSuggestion}
                  pendingMessage={pendingMessage}
                  onPendingMessageChange={setPendingMessage}
                  suggestion={suggestion}
                  suggestionLoading={suggestionLoading}
                  onOpenCockpit={() => {}}
                  inputDisabled={false}
                  onOpenClienteTab={handleOpenClienteTab}
                  onConversationDeleted={onClose}
                  hideHeader
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* ─── SIDE TAB CONTENT (45% width, only when tab !== conversa) ─── */}
        {activeTab !== 'conversa' && (
          <div className="w-[420px] max-w-[40%] shrink-0 min-h-0 overflow-hidden flex flex-col border-l border-gms-g200">

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {activeTab === 'analise' && (
                <AnaliseTabContent
                  conversationId={conversationId}
                  customerName={conversation?.customer_name || 'Cliente'}
                  onUseSuggestion={handleUseSuggestion}
                />
              )}

              {activeTab === 'ticket' && (
                <ScrollArea className="flex-1">
                  <TicketTabContent conversationId={conversationId} onUseSuggestion={handleUseSuggestion} />
                </ScrollArea>
              )}

              {activeTab === 'cliente' && (
                <ScrollArea className="flex-1">
                  <ClienteTabContent conversationId={conversationId} conversation={conversation} />
                </ScrollArea>
              )}

              {activeTab === 'historico' && (
                <ScrollArea className="flex-1">
                  <HistoricoTabContent conversationId={conversationId} />
                </ScrollArea>
              )}

              {activeTab === 'catalogo' && (
                <ScrollArea className="flex-1">
                  <CatalogoTabContent />
                </ScrollArea>
              )}

              {activeTab === 'relatorio' && (
                <ScrollArea className="flex-1">
                  <RelatorioTabContent conversationId={conversationId} />
                </ScrollArea>
              )}

              {activeTab === 'retencao' && isCancellationBoard && (
                <ScrollArea className="flex-1">
                  <CancellationRetentionTab
                    conversationId={conversationId}
                    context={(conversation as any)?.context || null}
                    onUpdate={() => queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })}
                  />
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* ─── VERTICAL TAB BAR (right side icons) ─── */}
        <TooltipProvider delayDuration={200}>
          <div className="shrink-0 w-11 border-l border-gms-g200 bg-white flex flex-col items-center py-2 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveTab(isActive && tab.id !== 'conversa' ? 'conversa' : tab.id)}
                      className={cn(
                        'relative w-8 h-8 rounded-md flex items-center justify-center transition-colors',
                        isActive
                          ? 'bg-gms-cyan-light text-gms-navy border-l-2 border-l-gms-cyan'
                          : 'text-gms-g500 hover:bg-gms-g100 hover:text-gms-g900'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.count != null && (
                        <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-gms-cyan text-gms-navy rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    {tab.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════
   COLLAPSIBLE SECTION HELPER (same pattern as AIAnalysisPanel)
   ══════════════════════════════════════════════════ */

function CollapsibleSectionTicket({ icon: Icon, iconClass, label, badge, badgeHighlight, defaultOpen, children }: {
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  label: string
  badge?: number
  badgeHighlight?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors select-none"
      >
        <div className={cn('w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0', iconClass)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1 text-left">{label}</span>
        {badge != null && (
          <span className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded-full border min-w-[20px] text-center',
            badgeHighlight
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-muted text-muted-foreground border-border'
          )}>
            {badge}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   SECTION CARD HELPER (kept for other tabs)
   ══════════════════════════════════════════════════ */

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-4">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}


/* ══════════════════════════════════════════════════
   TICKET TAB CONTENT
   ══════════════════════════════════════════════════ */

function TicketTabContent({ conversationId, onUseSuggestion }: { conversationId: string; onUseSuggestion?: (text: string) => void }) {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'admin'
  const autoClassifiedRef = useRef(false)
  const [showCompletedStages, setShowCompletedStages] = useState(false)
  const [noteText, setNoteText] = useState('')
  const { notes, isLoading: notesLoading, addNote } = useTicketNotes(conversationId || undefined)

  // Fetch conversation details
  const { data: conversation } = useQuery({
    queryKey: ['ticket-detail', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, status, priority, customer_name, customer_phone, customer_email, uazapi_chat_id, tags, handler_type, started_at, resolved_at, resolution_time_seconds, current_agent_id, human_agent_id, ticket_category_id, ticket_module_id, ticket_status_id, kanban_board_id, kanban_stage_id, stage_id, context, ticket_subject, parent_ticket_id, ai_agents(name), human_agents(name), parent_ticket:parent_ticket_id(ticket_number)')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_categories').select('*').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Modules
  const { data: modules = [] } = useQuery({
    queryKey: ['ticket-modules-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_modules').select('*').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Statuses
  const { data: statuses = [] } = useQuery({
    queryKey: ['ticket-statuses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_statuses').select('*').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Kanban boards & stages
  const { data: kanbanBoards = [] } = useKanbanBoards()
  const effectiveBoardId = conversation?.kanban_board_id || null
  const { data: kanbanStages = [] } = useQuery({
    queryKey: ['kanban-stages-for-board', effectiveBoardId],
    queryFn: async () => {
      if (!effectiveBoardId) return []
      const { data } = await (supabase as any)
        .from('kanban_stages')
        .select('id, name, color, icon, sort_order, wip_limit, is_entry, is_exit, board_id')
        .eq('board_id', effectiveBoardId)
        .eq('active', true)
        .order('sort_order')
      return data || []
    },
    enabled: !!effectiveBoardId,
  })

  // First response time
  const { data: firstResponseSeconds } = useQuery({
    queryKey: ['first-response-ticket', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('role, created_at')
        .eq('conversation_id', conversationId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(20)
      if (!msgs || msgs.length < 2) return null
      const firstUser = msgs.find(m => m.role === 'user')
      const firstAssistant = msgs.find(m => m.role === 'assistant' && firstUser && new Date(m.created_at!) > new Date(firstUser.created_at!))
      if (!firstUser || !firstAssistant) return null
      return Math.max(0, Math.round((new Date(firstAssistant.created_at!).getTime() - new Date(firstUser.created_at!).getTime()) / 1000))
    },
    enabled: !!conversationId,
  })

  // Mutations
  const changeCategory = useMutation({
    mutationFn: async (categoryId: string | null) => {
      const { error } = await supabase.from('ai_conversations').update({ ticket_category_id: categoryId }).eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      toast.success('Categoria atualizada')
    },
    onError: () => toast.error('Erro ao atualizar categoria'),
  })

  const changeModule = useMutation({
    mutationFn: async (moduleId: string | null) => {
      const { error } = await supabase.from('ai_conversations').update({ ticket_module_id: moduleId }).eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      toast.success('Módulo atualizado')
    },
    onError: () => toast.error('Erro ao atualizar módulo'),
  })

  const changePriority = useMutation({
    mutationFn: async (newPriority: string) => {
      const { error } = await supabase.from('ai_conversations').update({ priority: newPriority }).eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Prioridade atualizada')
    },
    onError: () => toast.error('Erro ao atualizar prioridade'),
  })

  const changeStage = useMutation({
    mutationFn: async ({ toStageId }: { toStageId: string }) => {
      const fromStageId = conversation?.stage_id || conversation?.kanban_stage_id || null
      const { error } = await supabase
        .from('ai_conversations')
        .update({ stage_id: toStageId, kanban_stage_id: toStageId })
        .eq('id', conversationId)
      if (error) throw error
      await (supabase as any).from('ticket_stage_history').insert({
        conversation_id: conversationId,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        moved_by: 'user',
      })
      if (fromStageId && fromStageId !== toStageId) {
        triggerStageAutomations(conversationId, fromStageId, toStageId).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-stage-history', conversationId] })
      toast.success('Etapa atualizada')
    },
    onError: () => toast.error('Erro ao mover etapa'),
  })


  // Update ticket subject
  const updateSubject = useMutation({
    mutationFn: async (subject: string) => {
      const { error } = await supabase.from('ai_conversations').update({ ticket_subject: subject }).eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success('Assunto atualizado')
    },
    onError: () => toast.error('Erro ao atualizar assunto'),
  })

  // Auto-classify on first open if ticket has no subject/category
  useEffect(() => {
    if (!conversation || autoClassifiedRef.current) return
    if (!conversation.ticket_subject && !conversation.ticket_category_id) {
      autoClassifiedRef.current = true
      supabase.functions.invoke('ticket-category-classifier', {
        body: { conversation_id: conversationId }
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
        queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
        queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      }).catch(() => {})
    }
  }, [conversation?.id])

  // Reclassify with AI
  const reclassifyAI = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ticket-category-classifier', {
        body: { conversation_id: conversationId, force_reclassify: true }
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      const msg = data?.classified
        ? `Classificado: ${data.category_name || 'OK'}${data.ticket_subject ? ` — "${data.ticket_subject}"` : ''}`
        : 'Não foi possível classificar com confiança suficiente'
      toast.success(msg)
    },
    onError: () => toast.error('Erro ao reclassificar'),
  })

  if (!conversation) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
  }

  const currentStatus = statuses.find(s => s.id === conversation?.ticket_status_id) || statuses.find(s => s.slug === conversation?.status) || null
  const currentBoard = kanbanBoards.find(b => b.id === conversation?.kanban_board_id) || null
  const currentStage = kanbanStages.find((s: any) => s.id === (conversation?.stage_id || conversation?.kanban_stage_id)) || null
  const currentStageIdx = (kanbanStages as any[]).findIndex((s) => s.id === currentStage?.id)
  const currentPriority = conversation?.priority || 'medium'
  
  const isFinalized = conversation?.status === 'finalizado' || conversation?.status === 'resolvido' || conversation?.status === 'cancelado'
  const isReadOnly = isFinalized

  return (
    <div>
      {/* ── 1. Fluxo do Atendimento (Hero) ── */}
      {/* Stage flow removed — already available in chat header */}

      {/* ── 2. Classificação ── */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 bg-[#EFF6FF] text-[#2563EB]">
            <Info className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Classificação</span>
        </div>
        <div className="px-4 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">Número</div>
              <span className="text-sm font-bold text-foreground">#{conversation.ticket_number}</span>
              {(conversation as any).parent_ticket_id && (
                <span className="text-xs text-muted-foreground block mt-0.5">
                  Continuação de #{(conversation as any).parent_ticket?.ticket_number || '?'}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">Status</div>
              {currentStatus ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#45E5E5]" />
                  {currentStatus.name}
                </span>
              ) : (
                <span className="text-[#666666] text-xs">{conversation.status}</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1.5">Prioridade</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: 'high', label: 'Alta', icon: ChevronsUp, cls: 'bg-[#FEF2F2] border-[rgba(220,38,38,0.3)] text-[#DC2626]' },
                { key: 'medium', label: 'Média', icon: Minus, cls: 'bg-[#FFFBEB] border-[rgba(255,184,0,0.5)] text-[#92400E]' },
                { key: 'low', label: 'Baixa', icon: ChevronsDown, cls: 'bg-[#F0FDF4] border-[rgba(22,163,74,0.3)] text-[#16A34A]' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => !isReadOnly && changePriority.mutate(p.key)}
                  disabled={isReadOnly}
                  className={cn(
                    'flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all',
                    currentPriority === p.key ? p.cls : 'border-border text-[#666666] hover:border-[rgba(69,229,229,0.4)]'
                  )}
                >
                  <p.icon className="w-3 h-3" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">Categoria</div>
              <SearchableSelect
                items={categories.map(c => ({ value: c.id, label: c.name }))}
                value={conversation?.ticket_category_id || null}
                onChange={v => changeCategory.mutate(v)}
                placeholder="Buscar categoria..."
                emptyLabel="Sem categoria"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">Módulo</div>
              <SearchableSelect
                items={modules.map(m => ({ value: m.id, label: m.name }))}
                value={conversation?.ticket_module_id || null}
                onChange={v => changeModule.mutate(v)}
                placeholder="Buscar módulo..."
                emptyLabel="Sem módulo"
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">Criado em</div>
              <span className="text-[#666666] text-xs">
                {conversation.started_at ? format(new Date(conversation.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">Responsável</div>
              <span className="text-sm font-medium text-foreground">
                {conversation.handler_type === 'ai' ? (conversation as any)?.ai_agents?.name || 'Agente IA' : ((conversation as any)?.human_agents?.name || 'Agente Humano')}
              </span>
            </div>
          </div>

          {/* Descrição do Problema */}
          <div className="border-t border-border pt-3 mt-3">
            <TicketDescriptionForm
              conversationId={conversationId}
              ticketSubject={conversation?.ticket_subject || ''}
              onSubjectChange={(subject) => updateSubject.mutate(subject)}
            />
          </div>

        </div>
      </div>

      {/* ── Tempos & SLA ── */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 bg-[#F0FDF4] text-[#16A34A]">
            <Timer className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Tempos & SLA</span>
        </div>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-[#F8FAFC] border border-border rounded-lg p-3 text-center">
              <p className={cn('text-xl font-bold', firstResponseSeconds != null && firstResponseSeconds < 300 ? 'text-[#16A34A]' : 'text-foreground')}>
                {firstResponseSeconds != null ? formatSeconds(firstResponseSeconds) : '—'}
              </p>
              <p className="text-xs text-[#666666] mt-1 font-medium">1ª Resposta</p>
              {firstResponseSeconds != null && firstResponseSeconds < 300 && (
                <p className="text-xs text-[#16A34A] font-semibold mt-0.5">✅ OK</p>
              )}
            </div>
            <div className="bg-[#F8FAFC] border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">
                {conversation.resolution_time_seconds != null
                  ? formatSeconds(conversation.resolution_time_seconds)
                  : conversation.started_at
                    ? formatSeconds(Math.round((Date.now() - new Date(conversation.started_at).getTime()) / 1000))
                    : '—'}
              </p>
              <p className="text-xs text-[#666666] mt-1 font-medium">Tempo Total</p>
              {!conversation.resolved_at && (
                <p className="text-xs text-[#FFB800] font-semibold mt-0.5">⏳ Em andamento</p>
              )}
            </div>
          </div>
          {conversation.started_at && !conversation.resolved_at && (
            <div>
              <div className="text-xs font-semibold text-[#666666] mb-1.5">Progresso de Resolução</div>
              <Progress value={Math.min(100, Math.round((Date.now() - new Date(conversation.started_at).getTime()) / (8 * 3600000) * 100))} className="h-1.5" />
              <p className="text-xs text-[#666666] mt-1">
                {Math.min(100, Math.round((Date.now() - new Date(conversation.started_at).getTime()) / (8 * 3600000) * 100))}% do prazo estimado de 8h
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Observações Internas ── */}
      <SectionCard icon={StickyNote} title="Observações Internas">
        <div className="space-y-3">
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Escreva uma nota interna (não enviada ao cliente)..."
            className="min-h-[72px] text-xs resize-none rounded-lg border-border bg-muted/50 focus:bg-card"
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { if (noteText.trim()) { addNote.mutate(noteText.trim()); setNoteText('') } } }}
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            Visível apenas para a equipe
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => setNoteText('')}>Descartar</Button>
            <Button size="sm" className="flex-1 h-8 text-xs rounded-lg gap-1.5" onClick={() => { if (noteText.trim()) { addNote.mutate(noteText.trim()); setNoteText('') } }} disabled={!noteText.trim() || addNote.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Salvar Nota
            </Button>
          </div>
          {notes.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              {notes.slice().reverse().slice(0, 5).map((note, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-1 border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{note.author}</span>
                    <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                  {note.text?.startsWith('<') ? (
                    <div
                      className="text-xs text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert overflow-hidden rounded-lg [&_table]:w-full [&_table]:border-collapse [&_td]:p-1.5 [&_td]:border [&_td]:border-border [&_td]:text-xs [&_th]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:text-xs [&_th]:font-semibold [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        // Content is sanitized with DOMPurify before rendering
                        __html: DOMPurify.sanitize(note.text, {
                          ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'mark'],
                          ALLOWED_ATTR: ['style', 'class', 'href', 'target']
                        })
                      }}
                    />
                  ) : (
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}


/* ══════════════════════════════════════════════════
   CLIENTE TAB CONTENT
   ══════════════════════════════════════════════════ */

function ClienteTabContent({ conversationId, conversation }: { conversationId: string; conversation: Conversation | null | undefined }) {
  return (
    <div className="p-0">
      <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
        <ClienteTab
          conversationId={conversationId}
          conversationName={conversation?.customer_name ?? undefined}
          conversationPhone={conversation?.customer_phone ?? undefined}
        />
      </Suspense>
    </div>
  )
}


/* ══════════════════════════════════════════════════
   HISTÓRICO TAB CONTENT
   ══════════════════════════════════════════════════ */

function HistoricoTabContent({ conversationId }: { conversationId: string }) {
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)

  // Fetch stage history with human agent names
  const { data: stageHistory = [] } = useQuery({
    queryKey: ['ticket-stage-history', conversationId],
    queryFn: async () => {
      if (!conversationId) return []
      const { data } = await (supabase as any)
        .from('ticket_stage_history')
        .select(`
          id, moved_at, moved_by, human_agent_id, notes,
          from_stage:from_stage_id(name, color),
          to_stage:to_stage_id(name, color),
          human_agents(name)
        `)
        .eq('conversation_id', conversationId)
        .order('moved_at', { ascending: false })
      return data || []
    },
    enabled: !!conversationId,
  })

  // Fetch human agents map for names in timeline
  const { data: humanAgentsMap } = useQuery({
    queryKey: ['human-agents-name-map-historico'],
    queryFn: async () => {
      const { data } = await supabase.from('human_agents').select('id, user_id, name').neq('is_active', false)
      const map = new Map<string, string>()
      ;(data || []).forEach((a: any) => {
        map.set(a.id, a.name)
        if (a.user_id) map.set(a.user_id, a.name)
      })
      return map
    },
  })

  // Fetch related tickets
  const { data: conversation } = useQuery({
    queryKey: ['historico-conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('ticket_number, customer_phone, started_at, status, human_agent_id')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  const { data: relatedTickets = [] } = useQuery({
    queryKey: ['related-tickets', conversation?.customer_phone],
    queryFn: async () => {
      if (!conversation?.customer_phone) return []
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, status, priority, customer_name, started_at, conversation_summary')
        .eq('customer_phone', conversation.customer_phone)
        .neq('id', conversationId)
        .order('started_at', { ascending: false })
        .limit(10)
      return data || []
    },
    enabled: !!conversation?.customer_phone,
  })

  const movedByLabel: Record<string, string> = {
    user: 'Agente', 'board-transfer': 'Transfer. Board', automation: 'Automação', 'kanban-bulk': 'Bulk', 'kanban-drag': 'Kanban',
  }

  const statusLabels: Record<string, { label: string; className: string }> = {
    novo: { label: 'Novo', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    aguardando: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    em_atendimento: { label: 'Em Atendimento', className: 'bg-primary/10 text-primary' },
    finalizado: { label: 'Finalizado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    resolvido: { label: 'Resolvido', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  }

  // Resolve user name for moved_by field
  const resolveUserName = (movedBy: string) => {
    // If it's a UUID, look it up in agents map
    if (movedBy && /^[0-9a-f-]{36}$/i.test(movedBy) && humanAgentsMap) {
      return humanAgentsMap.get(movedBy) || movedByLabel[movedBy] || movedBy
    }
    return movedByLabel[movedBy] || movedBy || 'Sistema'
  }

  return (
    <div className="p-4 space-y-4">
      {/* Timeline */}
      <SectionCard icon={History} title={`Linha do Tempo — Ticket #${conversation?.ticket_number || ''}`}>
        <TicketTramitacaoTab conversationId={conversationId} />
      </SectionCard>

      {/* Stage Movement History */}
      {stageHistory.length > 0 && (
        <SectionCard icon={ArrowRightLeft} title="Movimentações de Etapa">
          <div className="space-y-0">
            {stageHistory.map((entry: any, idx: number) => (
              <div key={entry.id} className="flex items-start gap-3 relative pb-3">
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-border bg-muted"
                    style={{ borderColor: `${entry.to_stage?.color || '#888'}40`, backgroundColor: `${entry.to_stage?.color || '#888'}15` }}>
                    <ArrowRightLeft className="w-3 h-3" style={{ color: entry.to_stage?.color || 'var(--muted-foreground)' }} />
                  </div>
                  {idx < stageHistory.length - 1 && (
                    <div className="w-[1.5px] flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-foreground">
                      Movido para <strong>{entry.to_stage?.name || '—'}</strong>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {entry.moved_at ? formatDistanceToNow(new Date(entry.moved_at), { addSuffix: true, locale: ptBR }) : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.from_stage?.name || 'início'} → {entry.to_stage?.name || '—'} · <strong>{entry.human_agents?.name || resolveUserName(entry.moved_by)}</strong>
                  </p>
                  {entry.moved_at && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {entry.moved_at && !isNaN(new Date(entry.moved_at).getTime()) ? format(new Date(entry.moved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Related Tickets with AI Summary + Conversation Viewer */}
      {relatedTickets.length > 0 && (
        <SectionCard icon={Ticket} title={`Histórico de Tickets (${relatedTickets.length})`}>
          <div className="space-y-2">
            {relatedTickets.map(rt => {
              const st = statusLabels[rt.status || ''] || { label: rt.status || '', className: 'bg-muted text-muted-foreground' }
              const isExpanded = expandedTicketId === rt.id
              return (
                <div key={rt.id} className="bg-muted/50 border border-border rounded-lg overflow-hidden">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">#{rt.ticket_number}</span>
                      <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', st.className)}>{st.label}</span>
                      <span className="flex-1 text-xs text-muted-foreground truncate">{rt.customer_name || ''}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {rt.started_at ? format(new Date(rt.started_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </span>
                    </div>
                    {(rt as any).conversation_summary && (
                      <div className="bg-card border border-border rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Brain className="w-3 h-3 text-primary" />
                          <span className="text-xs font-bold text-primary uppercase">Resumo IA</span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed line-clamp-3">{(rt as any).conversation_summary}</p>
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedTicketId(isExpanded ? null : rt.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {isExpanded ? 'Ocultar Conversa' : 'Ver Conversa'}
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                  {isExpanded && (
                    <TicketConversationViewer ticketId={rt.id} />
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
function TicketConversationViewer({ ticketId }: { ticketId: string }) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['ticket-messages-viewer', ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', ticketId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(50)
      return data || []
    },
    enabled: !!ticketId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 border-t border-border">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="px-3 py-3 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">Nenhuma mensagem encontrada</p>
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-card max-h-[300px] overflow-y-auto">
      <div className="p-3 space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-2', msg.role === 'assistant' && 'flex-row-reverse')}>
            <div className={cn(
              'max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-muted border border-border text-foreground'
                : 'bg-primary/10 border border-primary/20 text-foreground'
            )}>
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p className="text-[9px] text-muted-foreground mt-1">
                {msg.created_at ? format(new Date(msg.created_at), 'HH:mm', { locale: ptBR }) : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════
   RELATÓRIO TAB CONTENT
   ══════════════════════════════════════════════════ */

function CsatManualButton({
  conversationId,
  csatSentAt,
  csatRespondedAt,
  csatConfigId,
  onSuccess,
}: {
  conversationId: string
  csatSentAt: string | null
  csatRespondedAt: string | null
  csatConfigId: string
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const label = !csatSentAt ? 'Enviar CSAT' : (!csatRespondedAt ? 'Reenviar CSAT' : null)
  if (!label) return (
    <p className="text-xs text-muted-foreground">CSAT já respondido pelo cliente.</p>
  )

  const handleClick = async () => {
    if (cooldown || loading) return
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('csat-processor', {
        body: {
          action: 'send',
          conversationId,
          configId: csatConfigId,
          trigger_source: 'manual',
        },
      })
      if (error) throw error
      toast.success('CSAT enviado com sucesso!')
      onSuccess()
      setCooldown(true)
      setTimeout(() => setCooldown(false), 30000)
    } catch {
      toast.error('Erro ao enviar CSAT')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-1.5"
      onClick={handleClick}
      disabled={loading || cooldown}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
      {cooldown ? 'Aguarde 30s...' : label}
    </Button>
  )
}

function RelatorioTabContent({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const { data: slaMap } = useSLAConfig()
  const csatConfig = useCSATConfig()

  // Fetch ticket data
  const { data: ticket } = useQuery({
    queryKey: ['relatorio-ticket', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('queue_entered_at, first_human_response_at, first_human_response_seconds, resolved_at, resolution_seconds, priority, human_agent_id, csat_score, csat_comment, csat_rating, csat_feedback, status, started_at, customer_phone, ai_messages_count, human_messages_count, handler_type, conversation_summary, kanban_board_id, problem_summary, solution_summary, parent_ticket_id, csat_sent_at, csat_responded_at, whatsapp_instance_id')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  // CSAT board-specific config
  const csatBoardConfig = useCSATBoardConfig(ticket?.kanban_board_id || undefined)
  const { data: agentName } = useQuery({
    queryKey: ['relatorio-agent', ticket?.human_agent_id],
    queryFn: async () => {
      if (!ticket?.human_agent_id) return null
      const { data } = await supabase.from('human_agents').select('name').eq('id', ticket.human_agent_id).maybeSingle()
      return data?.name || null
    },
    enabled: !!ticket?.human_agent_id,
  })

  // Fetch analysis data
  const { data: analysisData } = useQuery({
    queryKey: ['message-analysis', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_messages')
        .select('sentiment, sentiment_score, urgency, intent')
        .eq('conversation_id', conversationId)
        .eq('role', 'user')
        .not('sentiment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)
      if (!data || data.length === 0) return null
      const latest = data[0]
      const scores = data.filter(d => d.sentiment_score !== null).map(d => d.sentiment_score as number)
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      return {
        sentiment: (latest.sentiment as 'positive' | 'neutral' | 'negative') || 'neutral',
        sentimentScore: avgScore,
        urgency: (latest.urgency as 'low' | 'medium' | 'high' | 'critical') || 'medium',
        intent: latest.intent || 'general_inquiry',
      }
    },
    enabled: !!conversationId,
  })

  // First response time
  const { data: firstResponseSeconds } = useQuery({
    queryKey: ['first-response-ticket', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('role, created_at')
        .eq('conversation_id', conversationId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(20)
      if (!msgs || msgs.length < 2) return null
      const firstUser = msgs.find(m => m.role === 'user')
      const firstAssistant = msgs.find(m => m.role === 'assistant' && firstUser && new Date(m.created_at!) > new Date(firstUser.created_at!))
      if (!firstUser || !firstAssistant) return null
      return Math.max(0, Math.round((new Date(firstAssistant.created_at!).getTime() - new Date(firstUser.created_at!).getTime()) / 1000))
    },
    enabled: !!conversationId,
  })

  // Message count
  const { data: messageCounts } = useQuery({
    queryKey: ['message-counts-relatorio', conversationId],
    queryFn: async () => {
      if (!conversationId) return { user: 0, assistant: 0, total: 0 }
      const { data } = await supabase
        .from('ai_messages')
        .select('role')
        .eq('conversation_id', conversationId)
        .in('role', ['user', 'assistant'])
      const userMsgs = data?.filter(m => m.role === 'user').length || 0
      const assistantMsgs = data?.filter(m => m.role === 'assistant').length || 0
      return { user: userMsgs, assistant: assistantMsgs, total: userMsgs + assistantMsgs }
    },
    enabled: !!conversationId,
  })

  if (!ticket) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
  }

  const sla = slaMap?.get(ticket.priority || 'medium')
  const elapsedSeconds = ticket.started_at ? Math.round((Date.now() - new Date(ticket.started_at).getTime()) / 1000) : 0
  const totalResolutionSeconds = ticket.resolution_seconds ?? elapsedSeconds
  const resolutionSlaMinutes = sla?.resolution_target_minutes
  const resolutionBreached = resolutionSlaMinutes != null && totalResolutionSeconds > resolutionSlaMinutes * 60
  const firstResponseSlaMinutes = sla?.first_response_target_minutes
  const firstResponseBreached = firstResponseSlaMinutes != null && firstResponseSeconds != null && firstResponseSeconds > firstResponseSlaMinutes * 60

  const sentimentConfig: Record<string, { label: string; emoji: string; color: string }> = {
    positive: { label: 'Positivo', emoji: '😊', color: 'text-emerald-600' },
    neutral: { label: 'Neutro', emoji: '😐', color: 'text-amber-600' },
    negative: { label: 'Negativo', emoji: '😟', color: 'text-red-600' },
  }

  const sentiment = sentimentConfig[analysisData?.sentiment || 'neutral'] || sentimentConfig.neutral
  const csatScore = ticket.csat_score ?? (ticket.csat_rating && ticket.csat_rating <= 5 ? ticket.csat_rating : null)

  return (
    <div className="p-4 space-y-4">
      {/* ── Métricas Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-foreground text-background rounded-xl p-4 text-center">
          <div className="text-lg mb-1">⏱</div>
          <div className="text-xl font-bold text-primary">{formatSeconds(totalResolutionSeconds)}</div>
          <div className="text-xs text-background/60 mt-1">Tempo de atendimento</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-lg mb-1">💬</div>
          <div className="text-xl font-bold text-foreground">{messageCounts?.total || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Mensagens trocadas</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-lg mb-1">⚡</div>
          <div className="text-xl font-bold text-foreground">{firstResponseSeconds != null ? formatSeconds(firstResponseSeconds) : '—'}</div>
          <div className="text-xs text-muted-foreground mt-1">Tempo 1ª resposta</div>
        </div>
      </div>

      {/* ── Distribuição de Mensagens ── */}
      <SectionCard icon={MessageSquare} title="Distribuição de Mensagens">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">Cliente</span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${messageCounts?.total ? Math.round((messageCounts.user / messageCounts.total) * 100) : 0}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground w-16 shrink-0">{messageCounts?.user || 0} msgs</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">Agente</span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${messageCounts?.total ? Math.round((messageCounts.assistant / messageCounts.total) * 100) : 0}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground w-16 shrink-0">{messageCounts?.assistant || 0} msgs</span>
          </div>
        </div>
      </SectionCard>

      {/* ── Status dos SLAs ── */}
      <SectionCard icon={Shield} title="Status dos SLAs">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">1ª Resposta</span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
            </div>
            <span className={cn('text-xs font-semibold w-16 shrink-0', firstResponseBreached ? 'text-red-600' : 'text-emerald-600')}>
              {firstResponseBreached ? '⚠ Atrasado' : '✅ OK'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">Resolução</span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div className={cn('h-full rounded-full', resolutionBreached ? 'bg-red-500' : 'bg-amber-500')}
                style={{ width: `${resolutionSlaMinutes ? Math.min(100, Math.round(totalResolutionSeconds / (resolutionSlaMinutes * 60) * 100)) : 50}%` }} />
            </div>
            <span className={cn('text-xs font-semibold w-16 shrink-0', resolutionBreached ? 'text-red-600' : 'text-amber-600')}>
              {resolutionSlaMinutes ? `${Math.min(100, Math.round(totalResolutionSeconds / (resolutionSlaMinutes * 60) * 100))}%` : '—'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Sentimento, Modo, Avaliação ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-2xl mb-1">{sentiment.emoji}</div>
          <div className={cn('text-sm font-bold', sentiment.color)}>{sentiment.label}</div>
          <div className="text-xs text-muted-foreground mt-1">Sentimento do cliente</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-2xl mb-1">{ticket.handler_type === 'ai' ? '🤖' : '👤'}</div>
          <div className="text-sm font-bold text-foreground">{ticket.handler_type === 'ai' ? 'IA' : 'Humano'}</div>
          <div className="text-xs text-muted-foreground mt-1">Modo atual</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-2xl mb-1">⭐</div>
          <div className="text-sm font-bold text-foreground">{csatScore ? `${csatScore}/5` : '—'}</div>
          <div className="text-xs text-muted-foreground mt-1">{csatScore ? 'Avaliação' : 'Pendente'}</div>
        </div>
      </div>

      {/* ── Análise IA do Atendimento ── */}
      <SectionCard icon={Brain} title="Análise IA do Atendimento">
        {ticket.conversation_summary ? (
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs text-foreground leading-relaxed">
              <strong>Resumo:</strong> {ticket.conversation_summary}
            </p>
          </div>
        ) : (
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground italic">
              Nenhum resumo disponível ainda.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={async () => {
                toast.info('Gerando resumo...')
                try {
                  const { error } = await supabase.functions.invoke('summarize-conversation', {
                    body: { conversation_id: conversationId },
                  })
                  if (error) throw error
                  queryClient.invalidateQueries({ queryKey: ['relatorio-ticket', conversationId] })
                  toast.success('Resumo gerado com sucesso!')
                } catch {
                  toast.error('Erro ao gerar resumo')
                }
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Gerar Resumo IA
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ── Classificação IA ── */}
      {((ticket as any).solution_summary || (ticket as any).problem_summary) && (
        <SectionCard icon={CheckCircle2} title="Classificação IA">
          {(ticket as any).problem_summary && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Problema</p>
              <p className="text-xs text-foreground leading-relaxed bg-muted/50 rounded-lg p-2.5">
                {(ticket as any).problem_summary}
              </p>
            </div>
          )}
          {(ticket as any).solution_summary && (
            <div className="space-y-1 mt-3">
              <p className="text-xs font-medium text-muted-foreground">Solução aplicada</p>
              <p className="text-xs text-foreground leading-relaxed bg-muted/50 rounded-lg p-2.5">
                {(ticket as any).solution_summary}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 mt-1"
                onClick={async () => {
                  toast.info('Regenerando...')
                  try {
                    const { error } = await supabase.functions.invoke('ticket-solution-classifier', {
                      body: {
                        conversation_id: conversationId,
                        resolution_summary: (ticket as any).solution_summary,
                      },
                    })
                    if (error) throw error
                    queryClient.invalidateQueries({ queryKey: ['relatorio-ticket', conversationId] })
                    toast.success('Solução regenerada!')
                  } catch {
                    toast.error('Erro ao regenerar solução')
                  }
                }}
              >
                <RefreshCw className="w-3 h-3" />
                Regenerar
              </Button>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── CSAT Manual ── */}
      {csatBoardConfig.config?.enabled && csatBoardConfig.config?.send_on_close && (ticket as any).whatsapp_instance_id && (
        <SectionCard icon={MessageCircle} title="Envio de CSAT">
          <CsatManualButton
            conversationId={conversationId}
            csatSentAt={(ticket as any).csat_sent_at || null}
            csatRespondedAt={(ticket as any).csat_responded_at || null}
            csatConfigId={csatBoardConfig.config.id}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['relatorio-ticket', conversationId] })}
          />
        </SectionCard>
      )}

      {/* ── CSAT ── */}
      {csatScore && (
        <SectionCard icon={Smile} title="Avaliação CSAT">
          <div className="flex items-center gap-2">
            {['😡', '😟', '😐', '😊', '🤩'].map((emoji, i) => (
              <span key={i} className={cn('text-2xl transition-all', i + 1 <= csatScore ? 'opacity-100 scale-110' : 'opacity-30 grayscale')}>
                {emoji}
              </span>
            ))}
            <span className="text-sm font-bold text-foreground ml-2">{csatScore}/5</span>
          </div>
          {(ticket.csat_comment || ticket.csat_feedback) && (
            <p className="text-xs text-foreground italic mt-2">"{ticket.csat_comment || ticket.csat_feedback}"</p>
          )}
        </SectionCard>
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════
   ANÁLISE IA TAB - Real-time AI Analysis
   ══════════════════════════════════════════════════ */

interface AnalysisCard {
  type: 'context' | 'message' | 'interpretation' | 'suggestion' | 'insight' | 'response'
  title: string
  content: string
  bullets?: string[]
  timestamp?: string
}

function AnaliseTabContent({ conversationId, customerName, onUseSuggestion }: {
  conversationId: string
  customerName: string
  onUseSuggestion?: (text: string) => void
}) {
  const queryClient = useQueryClient()
  const [adjustInput, setAdjustInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisCards, setAnalysisCards] = useState<AnalysisCard[]>([])
  const [analysisHistory, setAnalysisHistory] = useState<{ cards: AnalysisCard[]; messageCount: number }[]>([])
  const autoAnalyzedRef = useRef<string | null>(null)
  const lastMsgCountRef = useRef<number>(0)

  // Clear state when conversation changes
  useEffect(() => {
    setAnalysisCards([])
    setAnalysisHistory([])
    autoAnalyzedRef.current = null
    lastMsgCountRef.current = 0
  }, [conversationId])

  // Realtime subscription — detect new messages instantly
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`analysis-rt-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Invalidate all analysis queries to trigger re-fetch
          queryClient.invalidateQueries({ queryKey: ['analysis-message-count', conversationId] })
          queryClient.invalidateQueries({ queryKey: ['analysis-sentiment', conversationId] })
          queryClient.invalidateQueries({ queryKey: ['conversation-summary', conversationId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])

  // Fetch message count to detect new messages
  const { data: messageCount } = useQuery({
    queryKey: ['analysis-message-count', conversationId],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
      return count || 0
    },
    enabled: !!conversationId,
    // Fallback polling — realtime handles most updates, this is a safety net
    refetchInterval: 15000,
  })

  // Fetch sentiment data from analyzed messages
  const { data: sentimentData } = useQuery({
    queryKey: ['analysis-sentiment', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_messages')
        .select('sentiment, sentiment_score, urgency, intent')
        .eq('conversation_id', conversationId)
        .eq('role', 'user')
        .not('sentiment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!data || data.length === 0) return { sentiment: 'neutral', score: 5, urgency: 'medium' }
      const scores = data.filter(d => d.sentiment_score !== null).map(d => d.sentiment_score as number)
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 5
      return {
        sentiment: (data[0].sentiment as string) || 'neutral',
        score: avgScore,
        urgency: (data[0].urgency as string) || 'medium',
        intent: (data[0].intent as string) || 'general_inquiry',
      }
    },
    enabled: !!conversationId,
    // Realtime handles invalidation — this is just a safety net
    refetchInterval: 30000,
  })

  // Fetch conversation summary + history
  const { data: conversationData } = useQuery({
    queryKey: ['conversation-summary', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('conversation_summary, summary_history')
        .eq('id', conversationId)
        .maybeSingle()
      return data || null
    },
    enabled: !!conversationId,
    staleTime: 10000,
    // Realtime handles invalidation
    refetchInterval: 30000,
  })

  const summaryData = conversationData?.conversation_summary || null
  const summaryHistory = (Array.isArray(conversationData?.summary_history) ? conversationData.summary_history : []) as Array<{
    ts: string; summary: string; sentiment: string; urgency: string; priority: string; model?: string
  }>

  // Auto-analyze when new messages arrive
  const runAnalysis = useCallback(async (customPrompt?: string) => {
    if (!conversationId || isAnalyzing) return
    setIsAnalyzing(true)
    try {
      const { data, error } = await supabase.functions.invoke('copilot-suggest', {
        body: {
          conversation_id: conversationId,
          pending_message: customPrompt || '',
          mode: 'generate',
        },
      })
      if (error) throw error

      const cards: AnalysisCard[] = []
      const now = format(new Date(), 'HH:mm', { locale: ptBR })

      // Context card
      if (data?.summary) {
        cards.push({
          type: 'context',
          title: 'Contexto: Problema Interno',
          content: data.summary,
          timestamp: `Análise · ${now}`,
        })
      }

      // Interpretation based on sentiment
      const sentLabel = data?.sentiment === 'positive' ? 'satisfeito e engajado'
        : data?.sentiment === 'negative' ? 'frustrado ou insatisfeito'
        : 'neutro e aguardando resolução'
      cards.push({
        type: 'interpretation',
        title: 'Interpretação',
        content: `O cliente está ${sentLabel}, demonstrando ${data?.urgency === 'high' || data?.urgency === 'critical' ? 'urgência alta' : 'um tom receptivo'} na conversa.`,
        timestamp: `Análise · ${now}`,
      })

      // Suggestion based on priority
      const suggestionText = data?.suggested_priority === 'high' || data?.suggested_priority === 'critical'
        ? 'O atendimento requer atenção prioritária. Responda de forma rápida e direta.'
        : data?.sentiment === 'positive'
        ? 'O atendimento está fluindo bem. Mantenha o ritmo e finalize com clareza.'
        : 'Mantenha o foco na resolução do problema e acompanhe de perto.'
      cards.push({
        type: 'suggestion',
        title: 'Sugestão',
        content: suggestionText,
        timestamp: `Análise · ${now}`,
      })

      // Insight card
      const insightBullets: string[] = []
      if (data?.sentiment === 'positive') {
        insightBullets.push('Avaliar oportunidade de upsell ou cross-sell')
        insightBullets.push('Registrar feedback positivo no CRM')
      }
      if (data?.urgency === 'high' || data?.urgency === 'critical') {
        insightBullets.push('Priorizar resolução imediata')
        insightBullets.push('Escalar se necessário para segundo nível')
      }
      insightBullets.push('Manter acompanhamento para o próximo contato')
      cards.push({
        type: 'insight',
        title: 'Insight (Pós-Venda)',
        content: data?.sentiment === 'positive'
          ? 'O nível de satisfação indica momento ideal para fortalecimento de marca.'
          : 'Foque na resolução para garantir a satisfação do cliente.',
        bullets: insightBullets,
        timestamp: `Análise · ${now}`,
      })

      // Response suggestion card — the actual suggested reply
      if (data?.text) {
        cards.push({
          type: 'response',
          title: 'Resposta Sugerida',
          content: data.text,
          timestamp: `Análise · ${now}`,
        })
      }

      setAnalysisCards(cards)
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [conversationId, isAnalyzing])

  // Auto-analyze on mount and when message count changes (triggered by realtime)
  useEffect(() => {
    if (!conversationId || !messageCount) return
    // Only re-analyze if message count actually increased
    if (messageCount > lastMsgCountRef.current) {
      const prevCount = lastMsgCountRef.current
      lastMsgCountRef.current = messageCount
      // Save current cards to history before generating new ones (skip first load)
      if (prevCount > 0 && analysisCards.length > 0) {
        setAnalysisHistory(prev => [...prev, { cards: analysisCards, messageCount: prevCount }].slice(-10))
      }
      runAnalysis()
    } else if (lastMsgCountRef.current === 0) {
      // First load
      lastMsgCountRef.current = messageCount
      if (analysisCards.length === 0) {
        runAnalysis()
      }
    }
  }, [conversationId, messageCount, runAnalysis]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdjustSubmit = () => {
    if (!adjustInput.trim()) return
    runAnalysis(adjustInput.trim())
    setAdjustInput('')
  }

  const sentimentConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    positive: { label: 'Positiva', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-950/30' },
    neutral: { label: 'Neutra', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-950/30' },
    negative: { label: 'Negativa', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-950/30' },
  }
  const sentiment = sentimentConfig[sentimentData?.sentiment || 'neutral'] || sentimentConfig.neutral

  const cardStyles: Record<string, { borderColor: string; iconBg: string; icon: typeof AlertCircle }> = {
    context: { borderColor: 'border-l-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-900/30', icon: AlertCircle },
    message: { borderColor: 'border-l-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-950/30', icon: MessageCircle },
    interpretation: { borderColor: 'border-l-purple-500', iconBg: 'bg-purple-100 dark:bg-purple-950/30', icon: Brain },
    suggestion: { borderColor: 'border-l-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-950/30', icon: Lightbulb },
    insight: { borderColor: 'border-l-primary', iconBg: 'bg-primary/10', icon: Sparkles },
    response: { borderColor: 'border-l-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-950/30', icon: Send },
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Análise em Tempo Real</span>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
              Sempre ativo
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', sentiment.bgColor, sentiment.color)}>
              {sentiment.label}
            </span>
            <span className="text-xs font-bold text-foreground">
              {sentimentData?.score?.toFixed(1) || '5.0'} <span className="text-muted-foreground font-normal">/10</span>
            </span>
            <button
              onClick={() => runAnalysis()}
              disabled={isAnalyzing}
              className="h-6 w-6 rounded-md flex items-center justify-center border border-border hover:bg-muted transition-colors"
            >
              {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <RefreshCw className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Cards */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isAnalyzing && analysisCards.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Analisando conversa...</p>
            </div>
          )}

          {/* Summary card if exists */}
          {summaryData && analysisCards.length === 0 && !isAnalyzing && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 border-l-4 border-l-slate-400">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Contexto: Problema Interno</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>{summaryData}</p>
            </div>
          )}

          {analysisCards.map((card, idx) => {
            const style = cardStyles[card.type] || cardStyles.context
            const CardIcon = style.icon
            return (
              <div key={idx} className={cn('bg-muted/50 border border-border rounded-lg p-3 border-l-4', style.borderColor)}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CardIcon className={cn('w-3.5 h-3.5', card.type === 'message' || card.type === 'response' ? 'text-emerald-600' : card.type === 'interpretation' ? 'text-purple-600' : card.type === 'suggestion' ? 'text-amber-600' : card.type === 'insight' ? 'text-primary' : 'text-slate-600')} />
                  <span className={cn('text-xs font-bold', card.type === 'message' || card.type === 'response' ? 'text-emerald-600' : card.type === 'interpretation' ? 'text-purple-600' : card.type === 'suggestion' ? 'text-amber-600' : card.type === 'insight' ? 'text-primary' : 'text-slate-600')}>
                    {card.title}
                  </span>
                </div>
                <p className="text-xs text-foreground leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>{card.content}</p>
                {card.bullets && card.bullets.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {card.bullets.map((b, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                {/* "Usar resposta" button for response cards */}
                {card.type === 'response' && onUseSuggestion && (
                  <button
                    onClick={() => onUseSuggestion(card.content)}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    Usar resposta
                  </button>
                )}

                {card.timestamp && (
                  <p className="text-[9px] text-muted-foreground mt-2">{card.timestamp}</p>
                )}
              </div>
            )
          })}

          {analysisCards.length === 0 && !isAnalyzing && !summaryData && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">A análise será gerada automaticamente conforme a conversa avança.</p>
              <Button size="sm" onClick={() => runAnalysis()} className="gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                Analisar Agora
              </Button>
            </div>
          )}

          {/* Análises anteriores (acumuladas a cada interação) */}
          {analysisHistory.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <History className="w-3 h-3" />
                Análises anteriores ({analysisHistory.length})
                <ChevronDown className="w-3 h-3 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-2">
                  {[...analysisHistory].reverse().map((entry, idx) => (
                    <div key={idx} className="space-y-1.5 opacity-70">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Interação #{analysisHistory.length - idx} · {entry.messageCount} msgs
                      </p>
                      {entry.cards.map((card, cardIdx) => {
                        const style = cardStyles[card.type] || cardStyles.context
                        const CardIcon = style.icon
                        return (
                          <div key={cardIdx} className={cn('bg-muted/30 border border-border/50 rounded-md p-2 border-l-4', style.borderColor)}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <CardIcon className={cn('w-3 h-3', card.type === 'interpretation' ? 'text-purple-500' : card.type === 'suggestion' ? 'text-amber-500' : card.type === 'insight' ? 'text-primary' : 'text-slate-500')} />
                              <span className="text-[10px] font-bold text-muted-foreground">{card.title}</span>
                            </div>
                            <p className="text-[10px] text-foreground/70 leading-relaxed line-clamp-2">{card.content}</p>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Histórico de Análises */}
          {summaryHistory.length > 1 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <Clock className="w-3 h-3" />
                Histórico de Análises ({summaryHistory.length})
                <ChevronDown className="w-3 h-3 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-1">
                  {[...summaryHistory].reverse().map((snap, idx) => {
                    const prevSnap = summaryHistory[summaryHistory.length - 1 - idx - 1]
                    const sentColors: Record<string, string> = {
                      positive: 'text-emerald-600',
                      neutral: 'text-amber-600',
                      negative: 'text-red-600',
                    }
                    const trendIcon = prevSnap
                      ? snap.sentiment === 'positive' && prevSnap.sentiment !== 'positive' ? '↑'
                      : snap.sentiment === 'negative' && prevSnap.sentiment !== 'negative' ? '↓'
                      : '→'
                      : '•'
                    return (
                      <div key={idx} className="bg-muted/30 border border-border/50 rounded-md p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] text-muted-foreground">
                            {snap.ts && !isNaN(new Date(snap.ts).getTime()) ? format(new Date(snap.ts), 'dd/MM HH:mm', { locale: ptBR }) : '—'}
                          </span>
                          <span className={cn('text-[9px] font-bold', sentColors[snap.sentiment] || 'text-muted-foreground')}>
                            {trendIcon} {snap.sentiment === 'positive' ? 'Positiva' : snap.sentiment === 'negative' ? 'Negativa' : 'Neutra'}
                          </span>
                          <span className="text-[9px] text-muted-foreground ml-auto">
                            {snap.priority}
                          </span>
                        </div>
                        {snap.summary && (
                          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{snap.summary}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>

      {/* Bottom input for adjustments */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            value={adjustInput}
            onChange={e => setAdjustInput(e.target.value)}
            placeholder="Peça ajustes na resposta..."
            className="h-9 text-xs flex-1 rounded-lg"
            onKeyDown={e => { if (e.key === 'Enter') handleAdjustSubmit() }}
          />
          <button
            onClick={handleAdjustSubmit}
            disabled={!adjustInput.trim() || isAnalyzing}
            className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Dica: "seja mais formal", "adicione emojis", "resuma"
        </p>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════
   SEARCHABLE SELECT (Popover + Command)
   ══════════════════════════════════════════════════ */

function SearchableSelect({ items, value, onChange, placeholder, emptyLabel, disabled }: {
  items: { value: string; label: string }[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = items.find(i => i.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            'flex items-center justify-between w-full h-8 px-3 text-xs rounded-lg border border-border bg-background hover:bg-accent transition-colors text-left',
            disabled && 'opacity-50 cursor-not-allowed',
            !selected && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{selected?.label || emptyLabel}</span>
          <ChevronDown className="w-3 h-3 shrink-0 ml-1 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">Nenhum resultado</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onChange(null); setOpen(false) }}
                className="text-xs text-muted-foreground"
              >
                {emptyLabel}
              </CommandItem>
              {items.map(item => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => { onChange(item.value); setOpen(false) }}
                  className={cn('text-xs', value === item.value && 'font-semibold text-primary')}
                >
                  {value === item.value && <CheckCircle2 className="w-3 h-3 mr-1.5 text-primary shrink-0" />}
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}


/* ══════════════════════════════════════════════════
   CATÁLOGO DE SERVIÇOS TAB
   ══════════════════════════════════════════════════ */

const CATALOG_CATEGORY_STYLES: Record<string, string> = {
  'Infraestrutura de TI': 'bg-muted text-foreground',
  'Impressoras': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Hardware Fiscal': 'bg-destructive/10 text-destructive',
  'Certificados Digitais': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'Banco de Dados': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Servidores': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
}

function CatalogoTabContent() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas')

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['service-catalog-panel'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('service_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
      return data || []
    },
  })

  const categories: string[] = [...new Set(services.map((s: any) => s.category as string))].filter(Boolean) as string[]

  const filtered = services.filter((s: any) => {
    const matchesSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())
    const matchesCat = categoryFilter === 'Todas' || s.category === categoryFilter
    return matchesSearch && matchesCat
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <SectionCard icon={Package} title="Catálogo de Serviços">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar serviço..."
              className="h-8 text-xs pl-8 rounded-lg"
            />
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setCategoryFilter('Todas')}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors',
                  categoryFilter === 'Todas'
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                Todas ({services.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors',
                    categoryFilter === cat
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="text-center py-6">
              <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum serviço encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((service: any) => (
                <div key={service.id} className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-foreground">{service.name}</h4>
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{service.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {service.price != null && service.price > 0 ? (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sob consulta</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', CATALOG_CATEGORY_STYLES[service.category] || 'bg-muted text-muted-foreground')}>
                      {service.category}
                    </span>
                    {service.estimated_time && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {service.estimated_time}
                      </span>
                    )}
                  </div>
                  {service.notes && (
                    <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-1.5 mt-1">{service.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
