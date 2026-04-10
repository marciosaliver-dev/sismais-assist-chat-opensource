import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Send, Bot, BotOff, User as UserIcon, Phone, Mail, MessageSquare, Paperclip, Mic, MicOff, X, FileText, Image as ImageIcon, Video, Volume2, CheckCircle2, Smile, Reply, CornerDownRight, Copy, ChevronDown, ChevronLeft, ChevronRight, Play, Pause, ZoomIn, Download, Sparkles, Loader2, ArrowRightLeft, Clock, Zap, Smartphone, Wand2, RefreshCw, Headphones, Timer, Forward, History, Trash2, AlertTriangle, StickyNote, BookOpen, Search, Maximize2, Minimize2, EyeOff, Eye, GitMerge } from 'lucide-react'
import { ConversationTimerIndicators } from './ConversationTimerIndicators'
import { EditContactNamePopover } from '@/components/conversation/EditContactNamePopover'
import { EditContactPhonePopover } from '@/components/conversation/EditContactPhonePopover'
import { useWaitTimer, formatCompactTime, formatHHMMSS } from '@/hooks/useWaitTimer'
import { useSLAConfig } from '@/hooks/useSLAConfig'
import { Progress } from '@/components/ui/progress'
import { useQueryClient } from '@tanstack/react-query'
import { InteractiveMessageDialog, type InteractivePayload } from './InteractiveMessageDialog'
import { LinkPreview, extractFirstUrl } from './LinkPreview'
import { DeliveryStatus } from './DeliveryStatus'
import { TransferDialog } from './TransferDialog'
import { CloseConversationDialog } from './CloseConversationDialog'
import { DeleteConversationDialog } from './DeleteConversationDialog'
import { DiscardTicketDialog } from './DiscardTicketDialog'
import { MergeTicketsDialog } from './MergeTicketsDialog'
import { RequiredFieldsDialog } from './RequiredFieldsDialog'
import { LinkClientBeforeCloseDialog } from './LinkClientBeforeCloseDialog'
import { AICloseValidationDialog } from './AICloseValidationDialog'
import { useCloseValidation } from '@/hooks/useCloseValidation'
import { ForwardMessageDialog } from './ForwardMessageDialog'
import { ReopenTicketModal } from './ReopenTicketModal'
import { closeConversation as closeConversationHelper } from '@/utils/closeConversation'
import { isClosedStatus } from '@/utils/statusTransitions'
import type { CloseReason } from '@/utils/statusTransitions'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useConversationMessages } from '@/hooks/useConversationMessages'
import { useHandoff } from '@/hooks/useHandoff'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'
import { useQuery } from '@tanstack/react-query'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useContactPicture } from '@/hooks/useContactPicture'
import { useCSATConfig } from '@/hooks/useCSATConfig'
import { useCSATBoardConfig } from '@/hooks/useCSATBoardConfig'
import { usePreviousTickets } from '@/hooks/usePreviousTickets'
import { useTicketNotes } from '@/hooks/useTicketNotes'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'
import { ThumbsUp, ThumbsDown, Pencil } from 'lucide-react'
import { AIFeedbackDialog } from './AIFeedbackDialog'
import { useAIFeedback } from '@/hooks/useAIFeedback'
import { ChannelBadge } from './ChannelBadge'
import { MetaWindowIndicator } from './MetaWindowIndicator'
import { WindowClosedComposer } from './WindowClosedComposer'
import { SwitchToUazapiDialog } from './SwitchToUazapiDialog'
import { useMetaWindow } from '@/hooks/useMetaWindow'

// Extracted components and utilities
import { TicketSeparator } from './TicketSeparator'
import { EmojiPickerGrid } from './EmojiPickerGrid'
import { InlineSLA } from './InlineSLA'
import { TranscriptionBlock } from './TranscriptionBlock'
import { ChatLightbox } from './ChatLightbox'
import { GroupSenderName } from './GroupSenderName'
import { MediaContent } from './MediaContent'
import {
  linkifyText, isEmojiOnly, getEmojiSize,
  priorityBadgeConfig, getInitialsColor, formatElapsedTime,
  EMOJI_LIST,
  type ReplyInfo, type PendingMedia, type AISuggestionMode, type LightboxImage,
} from './chat-utils'

// Types used in this file (interfaces imported from chat-utils)

type Conversation = Tables<'ai_conversations'> & {
  ai_agents?: { name: string; color: string; specialty: string } | null
}

interface ChatAreaProps {
  conversation: Conversation | null
  onRequestSuggestion: (mode?: AISuggestionMode, context?: string) => void
  pendingMessage: string
  onPendingMessageChange: (msg: string) => void
  suggestion?: { text: string; confidence: number } | null
  suggestionLoading?: boolean
  onOpenCockpit?: () => void
  inputDisabled?: boolean
  onOpenClienteTab?: () => void
  onConversationDeleted?: () => void
  onAttendanceStarted?: () => void
  directSendText?: string
  onDirectSendConsumed?: () => void
  hideHeader?: boolean
}

// Helper functions, constants, and types are imported from ./chat-utils


// InlineSLA and TranscriptionBlock imported from separate files

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function ChatArea({ conversation, onRequestSuggestion, pendingMessage, onPendingMessageChange, suggestion, suggestionLoading, onOpenCockpit, inputDisabled, onOpenClienteTab, onConversationDeleted, onAttendanceStarted, directSendText, onDirectSendConsumed, hideHeader }: ChatAreaProps) {
  const { user } = useSupabaseAuth()
  const queryClient = useQueryClient()
  const { messages, sendMessage, loadMore, hasMore, isLoadingMore } = useConversationMessages(conversation?.id || '')

  // Fetch all human agents to map user_id -> name AND id -> name
  const { data: humanAgents } = useQuery({
    queryKey: ['human-agents-name-map'],
    queryFn: async () => {
      const { data } = await supabase.from('human_agents').select('id, user_id, name').neq('is_active', false)
      return (data || []) as { id: string; user_id: string | null; name: string }[]
    },
  })

  // Fetch WhatsApp instances for instance badge on messages
  const { data: whatsappInstances } = useQuery({
    queryKey: ['whatsapp-instances-map'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('uazapi_instances_public')
        .select('id, instance_name, phone_number')
        .eq('is_active', true)
      return (data || []) as { id: string; instance_name: string; phone_number: string | null }[]
    },
  })
  const instanceNameMap = useMemo(() => {
    const map = new Map<string, string>()
    whatsappInstances?.forEach(i => {
      const label = i.phone_number ? `${i.instance_name} (${i.phone_number})` : i.instance_name
      map.set(i.id, label)
    })
    return map
  }, [whatsappInstances])
  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>()
    humanAgents?.forEach(a => { if (a.user_id) map.set(a.user_id, a.name) })
    return map
  }, [humanAgents])

  const agentIdNameMap = useMemo(() => {
    const map = new Map<string, string>()
    humanAgents?.forEach(a => map.set(a.id, a.name))
    return map
  }, [humanAgents])

  // Fetch show_agent_name config
  const { data: showAgentNameConfig } = useQuery({
    queryKey: ['platform_ai_config', 'show_agent_name'],
    queryFn: async () => {
      const { data } = await db.from('platform_ai_config').select('enabled').eq('feature', 'show_agent_name').maybeSingle()
      return data?.enabled ?? false
    },
  })
  const { takeOverConversation, returnToAI } = useHandoff()

  // Auth for read-only check
  const { user: authUser, hasPermission } = useAuth()
  const isAdmin = authUser?.role === 'admin'
  const canTrainAI = authUser?.role === 'admin' || authUser?.role === 'lider'

  // Status-based state
  const isAguardando = conversation?.status === 'aguardando'
  const isEmAtendimento = conversation?.status === 'em_atendimento'
  const isFinalized = conversation?.status === 'finalizado' || conversation?.status === 'resolvido' || conversation?.status === 'cancelado'
  const isReadOnly = isFinalized
  const isInputBlocked = isAguardando || isReadOnly

  // Wait timer for queue
  const queueElapsed = useWaitTimer(isAguardando ? conversation?.queue_entered_at ?? null : null, 1000)
  // TMA timer
  const tmaElapsed = useWaitTimer(isEmAtendimento ? conversation?.human_started_at ?? null : null, 1000)

  // Previous tickets history
  const { data: previousTickets } = usePreviousTickets(
    conversation?.id,
    conversation?.uazapi_chat_id,
    conversation?.customer_phone
  )



  // Human agent name for header
  const currentAgentName = conversation?.human_agent_id ? agentIdNameMap.get(conversation.human_agent_id) : null

  // Internal notes
  const { notes: ticketNotes, addNote: addTicketNote } = useTicketNotes(conversation?.id)

  // Macros for quick-reply
  const { data: macrosList } = useQuery({
    queryKey: ['macros-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('macros')
        .select('id, name, message, description, color')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      return data || []
    },
  })

  // Start attendance handler
  const [startingAttendance, setStartingAttendance] = useState(false)
  const handleStartAttendance = async () => {
    if (!conversation || !user || startingAttendance) return
    setStartingAttendance(true)
    try {
      // Race condition check: verify no other agent has already taken this ticket
      const { data: freshConv } = await supabase
        .from('ai_conversations')
        .select('human_agent_id, status')
        .eq('id', conversation.id)
        .single()
      if (freshConv?.human_agent_id && freshConv.status === 'em_atendimento') {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
        queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
        queryClient.invalidateQueries({ queryKey: ['queue-tickets'] })
        toast.error('Este atendimento já foi assumido por outro agente')
        return
      }

      // Find human agent for logged user
      const { data: agent } = await supabase
        .from('human_agents')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (!agent) throw new Error('Agente humano não encontrado para este usuário')

      const now = new Date().toISOString()
      const queueSeconds = conversation.queue_entered_at
        ? Math.round((Date.now() - new Date(conversation.queue_entered_at).getTime()) / 1000)
        : null

      // Find first em_atendimento stage for this board
      let stageId: string | undefined
      if (conversation.kanban_board_id) {
        const { data: stages } = await (supabase as any)
          .from('kanban_stages')
          .select('id')
          .eq('board_id', conversation.kanban_board_id)
          .eq('status_type', 'em_atendimento')
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .limit(1)
        if (stages?.[0]) stageId = stages[0].id
      }

      const updates: Record<string, unknown> = {
        status: 'em_atendimento',
        handler_type: 'human',
        human_agent_id: agent.id,
      }
      // Only set SLA/lock fields if not already locked (avoids fn_protect_locked_fields trigger error)
      if (!conversation.is_data_locked) {
        updates.human_started_at = now
        updates.first_human_response_at = now
        updates.is_data_locked = true
        if (queueSeconds != null) updates.first_human_response_seconds = queueSeconds
      }
      if (stageId) updates.stage_id = stageId

      const { error } = await supabase
        .from('ai_conversations')
        .update(updates)
        .eq('id', conversation.id)
      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversation.id] })
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
      queryClient.invalidateQueries({ queryKey: ['reasoning', conversation.id] })
      queryClient.invalidateQueries({ queryKey: ['queue-tickets'] })
      onAttendanceStarted?.()
      toast.success('Atendimento iniciado!')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erro ao iniciar atendimento')
    } finally {
      setStartingAttendance(false)
    }
  }
  const [sending, setSending] = useState(false)
  const [improvingText, setImprovingText] = useState(false)
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null)
  const [lightboxState, setLightboxState] = useState<{ images: LightboxImage[]; index: number } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [replyingTo, setReplyingTo] = useState<ReplyInfo | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [contextPromptOpen, setContextPromptOpen] = useState(false)
  const [contextInput, setContextInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [contextModalOpen, setContextModalOpen] = useState(false)
  const [contextMessageType, setContextMessageType] = useState('resposta')
  const [contextTone, setContextTone] = useState('profissional')
  const [textareaHeight, setTextareaHeight] = useState(() =>
    parseInt(localStorage.getItem('chatInputHeight') || '60', 10)
  )
  const [isDraggingResize, setIsDraggingResize] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  
  // When AI suggestion arrives and we were generating, insert into textarea
  useEffect(() => {
    if (isGenerating && suggestion?.text && !suggestionLoading) {
      onPendingMessageChange(suggestion.text)
      setIsGenerating(false)
      setHasGenerated(true)
      textareaRef.current?.focus()
    }
  }, [suggestion, suggestionLoading, isGenerating])

  // Textarea resize drag handler
  useEffect(() => {
    if (!isDraggingResize) return
    const onMove = (e: MouseEvent) => {
      const diff = e.clientY - dragStartY.current
      const newHeight = Math.max(36, Math.min(500, dragStartHeight.current + diff))
      setTextareaHeight(newHeight)
    }
    const onUp = (e: MouseEvent) => {
      const diff = e.clientY - dragStartY.current
      const newHeight = Math.max(36, Math.min(500, dragStartHeight.current + diff))
      localStorage.setItem('chatInputHeight', String(newHeight))
      setIsDraggingResize(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDraggingResize])

  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false)
  const [missingFields, setMissingFields] = useState<{ field_name: string; field_label: string }[]>([])
  const [linkClientDialogOpen, setLinkClientDialogOpen] = useState(false)
  const [aiValidationDialogOpen, setAIValidationDialogOpen] = useState(false)
  const [pendingAIValidations, setPendingAIValidations] = useState<string[]>([])
  const [aiCloseReviewNote, setAICloseReviewNote] = useState<string | undefined>()
  const { validateForClose, runAINameValidation, runAICloseReview } = useCloseValidation()
  const [forwardingMessage, setForwardingMessage] = useState<any>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ id: string; content: string; agent_id: string; conversation_id: string } | null>(null)
  const aiFeedback = useAIFeedback()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)

  // Build ordered list of image messages for lightbox navigation
  const lightboxImages = useMemo<LightboxImage[]>(() => {
    return (messages as any[])
      .filter((m) => m.media_type === 'image' && m.media_url && !m.media_url.includes('/thumbnails/'))
      .map((m) => ({
        url: m.media_url as string,
        caption: m.content && !m.content.startsWith('[') ? m.content : undefined,
        senderName: m.role === 'user' ? (conversation?.customer_name || conversation?.customer_phone || 'Cliente') : (m.user_id && agentNameMap.get(m.user_id)) || (m.ai_agents?.name) || 'Atendente',
        time: m.created_at,
      }))
  }, [messages, conversation?.customer_name, conversation?.customer_phone])

  const openLightbox = useCallback((url: string) => {
    const idx = lightboxImages.findIndex((img) => img.url === url)
    setLightboxState({ images: lightboxImages, index: idx >= 0 ? idx : 0 })
  }, [lightboxImages])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxState) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setLightboxState(null); return }
      if (e.key === 'ArrowLeft' && lightboxState.index > 0) {
        setLightboxState((prev) => prev ? { ...prev, index: prev.index - 1 } : null)
      }
      if (e.key === 'ArrowRight' && lightboxState.index < lightboxState.images.length - 1) {
        setLightboxState((prev) => prev ? { ...prev, index: prev.index + 1 } : null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxState])

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const uazapiChatId = (conversation as Record<string, unknown>)?.uazapi_chat_id as string | undefined

  // === Typing indicator state ===
  const [remoteIsTyping, setRemoteIsTyping] = useState(false)
  useEffect(() => {
    if (!uazapiChatId) return
    let cancelled = false
    let pollInterval: ReturnType<typeof setInterval> | null = null

    const fetchTypingStatus = async () => {
      if (cancelled) return
      const { data: chat } = await supabase
        .from('uazapi_chats')
        .select('is_typing')
        .eq('chat_id', uazapiChatId)
        .maybeSingle()
      if (!cancelled && chat) {
        setRemoteIsTyping(chat.is_typing ?? false)
      }
    }

    // Initial fetch
    fetchTypingStatus()
    // Poll every 2 seconds (realtime-like without full channel)
    pollInterval = setInterval(fetchTypingStatus, 2000)

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [uazapiChatId])

  // === Enrich contact trigger ===
  const [enriching, setEnriching] = useState(false)
  useEffect(() => {
    if (!conversation?.id || !uazapiChatId) return
    const checkEnrich = async () => {
      const { data: chat } = await supabase
        .from('uazapi_chats')
        .select('enriched_at, instance_id')
        .eq('chat_id', uazapiChatId)
        .maybeSingle()
      if (chat && !chat.enriched_at && chat.instance_id && conversation.customer_phone) {
        setEnriching(true)
        try {
          await supabase.functions.invoke('enrich-contact', {
            body: { phone: conversation.customer_phone, instance_id: chat.instance_id, conversation_id: conversation.id },
          })
        } catch { /* silent */ }
        setEnriching(false)
        queryClient.invalidateQueries({ queryKey: ['uazapi-chat-info'] })
        queryClient.invalidateQueries({ queryKey: ['contact-picture'] })
      }
    }
    checkEnrich()
  }, [conversation?.id, uazapiChatId])

  // === History banner state ===
   const [historyBannerDismissed, setHistoryBannerDismissed] = useState(false)
   const [showCnpjAlert, setShowCnpjAlert] = useState(true)
  const [importingHistory, setImportingHistory] = useState(false)
  const [showInstancePicker, setShowInstancePicker] = useState(false)
  const [availableInstances, setAvailableInstances] = useState<Array<{ id: string; instance_name: string; phone_number: string | null }>>([])
  const [pendingImportConversation, setPendingImportConversation] = useState<Conversation | null>(null)

  // Internal notes & macros state
  const [composerMode, setComposerMode] = useState<'message' | 'note'>('message')
  const [noteText, setNoteText] = useState('')
  const [macroPickerOpen, setMacroPickerOpen] = useState(false)
  const [macroSearch, setMacroSearch] = useState('')

  const showHistoryBanner = useMemo(() => {
    if (historyBannerDismissed || !conversation) return false
    if (previousTickets && previousTickets.length === 0) return true
    return false
  }, [previousTickets, historyBannerDismissed, conversation])

  const handleImportWithInstance = async (instanceId: string, conv: Conversation) => {
    setShowInstancePicker(false)
    setImportingHistory(true)
    try {
      const { data, error } = await supabase.functions.invoke('import-chat-history', {
        body: {
          phone: conv.customer_phone,
          instance_id: instanceId,
          conversation_id: conv.id,
          limit: 100,
        },
      })
      if (error) throw error
      const imported = data?.imported || 0
      if (imported > 0) {
        toast.success(`${imported} mensagens importadas com sucesso!`)
        queryClient.invalidateQueries({ queryKey: ['messages', conv.id] })
        queryClient.invalidateQueries({ queryKey: ['reasoning', conv.id] })
      } else {
        toast.info('Nenhum histórico anterior encontrado para este contato')
      }
      setHistoryBannerDismissed(true)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erro ao importar histórico')
    } finally {
      setImportingHistory(false)
    }
  }

  const handleImportHistory = async () => {
    if (!conversation || importingHistory) return
    setImportingHistory(true)
    try {
      const { data: chat } = await supabase
        .from('uazapi_chats')
        .select('instance_id, history_imported_at')
        .eq('chat_id', uazapiChatId!)
        .maybeSingle()
      if (chat?.history_imported_at) {
        toast.info('Histórico já foi importado anteriormente')
        setHistoryBannerDismissed(true)
        setImportingHistory(false)
        return
      }
      if (chat?.instance_id) {
        await handleImportWithInstance(chat.instance_id, conversation)
        return
      }
      // No instance_id found — fetch active instances
      const { data: instances } = await (supabase as any)
        .from('uazapi_instances_public')
        .select('id, instance_name, phone_number')
        .eq('is_active', true)
      if (!instances || instances.length === 0) {
        toast.error('Nenhuma instância ativa encontrada')
        setImportingHistory(false)
        return
      }
      if (instances.length === 1) {
        await handleImportWithInstance(instances[0].id, conversation)
        return
      }
      // Multiple instances — show picker
      setAvailableInstances(instances)
      setPendingImportConversation(conversation)
      setShowInstancePicker(true)
      setImportingHistory(false)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erro ao importar histórico')
      setImportingHistory(false)
    }
  }

  const proceedAfterFieldValidation = (conv: any) => {
    const result = validateForClose(conv)
    if (result.aiValidationsNeeded.length > 0) {
      setPendingAIValidations(result.aiValidationsNeeded)
      setAIValidationDialogOpen(true)
    } else {
      setCloseDialogOpen(true)
    }
  }

  const handleFinalizarClick = async () => {
    if (!conversation) return

    // Aguardar mutations pendentes (ex: categoria/módulo sendo salvos) antes de validar
    if (queryClient.isMutating() > 0) {
      await new Promise<void>((resolve) => {
        const unsub = queryClient.getMutationCache().subscribe(() => {
          if (queryClient.isMutating() === 0) {
            unsub()
            resolve()
          }
        })
        // Timeout de segurança: 3s
        setTimeout(() => { unsub(); resolve() }, 3000)
      })
    }

    // Buscar dados frescos do DB para evitar stale data
    const { data: fresh, error: freshError } = await supabase
      .from('ai_conversations')
      .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
      .eq('id', conversation.id)
      .single()
    if (freshError) console.warn('[ChatArea] Fresh fetch failed, using cache/prop:', freshError.message)
    // Use latest React Query cache as base (avoids stale closure), then overlay with fresh DB data
    const cached = queryClient.getQueryData<any>(['ticket-detail', conversation.id]) ||
                   queryClient.getQueryData<any>(['kanban-conversation-detail', conversation.id])
    const base = cached || conversation
    const conv = fresh ? { ...base, ...fresh } : base

    // Always require a linked client before closing
    if (!conv.helpdesk_client_id) {
      setLinkClientDialogOpen(true)
      return
    }

    // Check required fields
    const result = validateForClose(conv)
    if (result.missingFields.length > 0) {
      setMissingFields(result.missingFields)
      setRequirementsDialogOpen(true)
      return
    }

    // Check AI validations
    if (result.aiValidationsNeeded.length > 0) {
      setPendingAIValidations(result.aiValidationsNeeded)
      setAIValidationDialogOpen(true)
    } else {
      setCloseDialogOpen(true)
    }
  }

  const handleReopenConversation = async () => {
    if (!conversation) return
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({
          status: 'em_atendimento',
          handler_type: 'human',
          resolved_at: null,
          ai_resolved: false,
        })
        .eq('id', conversation.id)

      if (error) throw error
      toast.success('Atendimento reaberto com sucesso')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      toast.error('Erro ao reabrir atendimento')
      console.error(err)
    }
  }

  // Called after the client is successfully linked via LinkClientBeforeCloseDialog
  const handleClientLinkedAndContinue = async () => {
    if (!conversation) return
    // Invalidar cache e buscar dados frescos após vinculação
    queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversation.id] })
    queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversation.id] })
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })

    // Aguardar mutations pendentes antes de validar
    if (queryClient.isMutating() > 0) {
      await new Promise<void>((resolve) => {
        const unsub = queryClient.getMutationCache().subscribe(() => {
          if (queryClient.isMutating() === 0) { unsub(); resolve() }
        })
        setTimeout(() => { unsub(); resolve() }, 3000)
      })
    }

    const { data: fresh, error: freshError } = await supabase
      .from('ai_conversations')
      .select('id, helpdesk_client_id, ticket_category_id, ticket_module_id, ticket_subject')
      .eq('id', conversation.id)
      .single()
    if (freshError) console.warn('[ChatArea] Client linked fresh fetch failed:', freshError.message)
    const cached = queryClient.getQueryData<any>(['ticket-detail', conversation.id]) ||
                   queryClient.getQueryData<any>(['kanban-conversation-detail', conversation.id])
    const base = cached || conversation
    const conv = fresh ? { ...base, ...fresh } : base
    const result = validateForClose(conv)
    if (result.missingFields.length > 0) {
      setMissingFields(result.missingFields)
      setRequirementsDialogOpen(true)
    } else {
      proceedAfterFieldValidation(conv)
    }
  }

  const handleAIValidationComplete = async (result: { correctedName?: string; closeReviewNote?: string }) => {
    if (!conversation) return

    // Save corrected name if provided
    if (result.correctedName) {
      await supabase
        .from('ai_conversations')
        .update({ customer_name: result.correctedName })
        .eq('id', conversation.id)
    }

    // Store review note for later use when closing
    if (result.closeReviewNote) {
      setAICloseReviewNote(result.closeReviewNote)
    }

    setCloseDialogOpen(true)
  }

  // Check if this is a group chat
  const { data: uazapiChatInfo } = useQuery({
    queryKey: ['uazapi-chat-info', uazapiChatId],
    queryFn: async () => {
      const { data } = await supabase
        .from('uazapi_chats')
        .select('id, is_group, contact_name, contact_picture_url, instance_id, chat_id')
        .eq('chat_id', uazapiChatId!)
        .maybeSingle()
      return data
    },
    enabled: !!uazapiChatId,
  })

  const isGroup = uazapiChatInfo?.is_group === true

  // Lazy-fetch profile picture if not available
  const { url: contactPictureUrl } = useContactPicture(
    uazapiChatInfo?.id,
    uazapiChatInfo?.chat_id,
    uazapiChatInfo?.instance_id,
    uazapiChatInfo?.contact_picture_url,
    conversation?.customer_phone
  )
  const csatConfig = useCSATConfig()
  const csatBoardConfig = useCSATBoardConfig((conversation as any)?.kanban_board_id)

  // First response time metric
  const { data: firstResponseTime } = useQuery({
    queryKey: ['first-response-time', conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return null
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('role, created_at')
        .eq('conversation_id', conversation.id)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(20)
      if (!msgs || msgs.length < 2) return null
      const firstUser = msgs.find(m => m.role === 'user')
      const firstAssistant = msgs.find(m => m.role === 'assistant' && firstUser && new Date(m.created_at!) > new Date(firstUser.created_at!))
      if (!firstUser || !firstAssistant) return null
      const diffMs = new Date(firstAssistant.created_at!).getTime() - new Date(firstUser.created_at!).getTime()
      return Math.max(0, Math.round(diffMs / 1000))
    },
    enabled: !!conversation?.id,
  })

  // For group chats, load sender names from uazapi_messages
  const { data: uazapiMessages } = useQuery({
    queryKey: ['uazapi-group-senders', uazapiChatInfo?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('uazapi_messages')
        .select('message_id, sender_name, sender_phone')
        .eq('chat_id', uazapiChatInfo!.id)
      return data || []
    },
    enabled: isGroup && !!uazapiChatInfo?.id,
  })

  // Map uazapi_message_id -> sender_name
  const senderNameMap = useMemo(() => {
    if (!uazapiMessages) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const m of uazapiMessages) {
      if (m.sender_name) map.set(m.message_id, m.sender_name)
    }
    return map
  }, [uazapiMessages])

  // Map uazapi_message_id -> sender_phone (fallback for GroupSenderName)
  const senderPhoneMap = useMemo(() => {
    if (!uazapiMessages) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const m of uazapiMessages) {
      if (m.sender_phone) map.set(m.message_id, m.sender_phone)
    }
    return map
  }, [uazapiMessages])

  // Stable color per sender name for group messages
  const getSenderColor = useCallback((name: string) => {
    const colors = [
      'hsl(25, 100%, 52%)',   // orange
      'hsl(280, 70%, 55%)',   // purple
      'hsl(160, 70%, 40%)',   // teal
      'hsl(340, 75%, 55%)',   // pink
      'hsl(200, 80%, 50%)',   // blue
      'hsl(45, 90%, 45%)',    // gold
      'hsl(120, 50%, 42%)',   // green
      'hsl(0, 70%, 55%)',     // red
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }, [])

  // Scroll to top when opening a new conversation, smooth-scroll to bottom on new messages
  const prevConvIdRef = useRef<string | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  useEffect(() => {
    const isNewConversation = conversation?.id !== prevConvIdRef.current
    prevConvIdRef.current = conversation?.id || null

    // Use rAF + timeout to ensure DOM is fully rendered before scrolling
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        if (isNewConversation) {
          // Scroll to top so agent reads from the beginning of the attendance
          sentinelRef.current?.scrollIntoView({ behavior: 'instant' })
        } else {
          // New message arrived in current conversation — scroll to bottom
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }, isNewConversation ? 100 : 0)
    })
    return () => cancelAnimationFrame(raf)
  }, [messages, conversation?.id])

  // Track whether user is scrolled away from bottom to show floating button
  useEffect(() => {
    const target = scrollRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollToBottom(!entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [conversation?.id])

  // Infinite scroll - load newer messages when sentinel at bottom is visible
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const isWhatsAppConversation = !!(conversation as Record<string, unknown>)?.uazapi_chat_id
  const isMetaWhatsAppConversation = (conversation as Record<string, unknown>)?.communication_channel === 'meta_whatsapp'
  const isAnyWhatsAppConversation = isWhatsAppConversation || isMetaWhatsAppConversation

  const metaWindow = useMetaWindow(
    (conversation as Record<string, unknown>)?.communication_channel as string,
    (conversation as Record<string, unknown>)?.last_customer_message_at as string,
  )
  const [showSwitchToUazapi, setShowSwitchToUazapi] = useState(false)

  // ===== Upload helper =====
  const uploadToStorage = async (file: File | Blob, filename: string): Promise<string | null> => {
    if (!conversation) return null
    const filePath = `${conversation.id}/${Date.now()}-${filename}`
    const { data, error } = await supabase.storage.from('whatsapp-media').upload(filePath, file)
    if (error) {
      toast.error('Erro no upload: ' + error.message)
      return null
    }
    const { data: signedData, error: signError } = await supabase.storage.from('whatsapp-media').createSignedUrl(data.path, 31536000) // 365 days
    if (signError || !signedData?.signedUrl) {
      toast.error('Erro ao gerar URL de mídia')
      return null
    }
    return signedData.signedUrl
  }

  // ===== Get UAZAPI chat info =====
  const getUazapiChat = async () => {
    if (!conversation) return null
    const chatId = (conversation as Record<string, unknown>).uazapi_chat_id as string
    if (!chatId) return null

    // Filter by instance_id when available to avoid maybeSingle() errors
    // when the same chat_id exists across multiple instances
    const instanceId = (conversation as Record<string, unknown>).whatsapp_instance_id as string | undefined
    let query = supabase
      .from('uazapi_chats')
      .select('id, chat_id, instance_id')
      .eq('chat_id', chatId)
    if (instanceId) {
      query = query.eq('instance_id', instanceId)
    }
    const { data, error } = await query.maybeSingle()
    if (!error && data) return data

    if (error) {
      console.error('[getUazapiChat] Query error:', error)
      // Fallback: try with limit(1) if maybeSingle found multiple rows
      const { data: fallback } = await supabase
        .from('uazapi_chats')
        .select('id, chat_id, instance_id')
        .eq('chat_id', chatId)
        .order('last_message_time', { ascending: false })
        .limit(1)
      if (fallback?.[0]) return fallback[0]
    }

    // Final fallback: use conversation data directly when no uazapi_chats record exists
    if (instanceId) {
      console.warn('[getUazapiChat] No uazapi_chats record found, using conversation data as fallback')
      return { id: null, chat_id: chatId, instance_id: instanceId }
    }

    return null
  }

  // ===== Send media message =====
  const sendMediaMessage = async (mediaUrl: string, mediaType: string, caption: string, filename?: string) => {
    if (!conversation || !user) return

    if (isWhatsAppConversation) {
      const uazapiChat = await getUazapiChat()
      if (!uazapiChat) {
        toast.error('Não foi possível encontrar o chat WhatsApp.')
        return
      }
      const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'sendMessage',
          instanceId: uazapiChat.instance_id,
          chatJid: uazapiChat.chat_id,
          type: mediaType,
          text: caption || '',
          mediaUrl,
          filename,
        },
      })
      if (proxyError || proxyResult?.error) {
        console.error('[sendMediaMessage] uazapi-proxy error:', proxyError || proxyResult?.error)
        toast.error('Erro ao enviar mídia via WhatsApp.')
        return
      }
    }

    await sendMessage.mutateAsync({
      conversation_id: conversation.id,
      role: 'assistant',
      content: caption || `[${mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : mediaType === 'ptt' ? 'Áudio' : 'Documento'}]`,
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
    })
  }

  // ===== Handle send =====
  const handleSend = async () => {
    if (!conversation || !user) return
    if (sending) return // Prevent double-send
    if (!pendingMessage.trim() && !pendingMedia) return
    if (conversation.status !== 'em_atendimento') {
      toast.error('Inicie o atendimento antes de enviar mensagens')
      return
    }

    const replyContext = replyingTo
    setReplyingTo(null)

    // Capturar valores e limpar input IMEDIATAMENTE para evitar envio duplicado
    const messageToSend = pendingMessage
    const mediaToSend = pendingMedia
    onPendingMessageChange('')
    if (mediaToSend) setPendingMedia(null)

    setSending(true)
    try {
      // Build content with quote prefix if replying
      const replyDisplayContent = replyContext?.mediaType === 'audio' || replyContext?.mediaType === 'ptt'
        ? '🎤 Áudio'
        : replyContext ? replyContext.content.substring(0, 100) + (replyContext.content.length > 100 ? '...' : '') : ''
      const quotedPrefix = replyContext
        ? `> _${replyContext.senderName || (replyContext.role === 'user' ? 'Cliente' : 'Atendente')}_: ${replyDisplayContent}\n\n`
        : ''

      // Send pending media first
      if (mediaToSend) {
        const url = await uploadToStorage(mediaToSend.file, mediaToSend.file.name || `media-${Date.now()}`)
        if (url) {
          await sendMediaMessage(url, mediaToSend.type, messageToSend, mediaToSend.file.name)
        }
      } else if (messageToSend.trim()) {
        const fullContent = quotedPrefix + messageToSend

        if (isMetaWhatsAppConversation) {
          // ── META WHATSAPP CLOUD API ──
          const convData = conversation as Record<string, unknown>
          const channelInstanceId = convData.channel_instance_id as string
          const recipient = (convData.customer_phone as string) || (convData.channel_chat_id as string)

          if (!channelInstanceId || !recipient) {
            toast.error('Dados de canal Meta WhatsApp incompletos. Tente recarregar.')
            return
          }

          const savedMsg = await sendMessage.mutateAsync({
            conversation_id: conversation.id,
            role: 'assistant',
            content: fullContent,
            user_id: user.id,
            delivery_status: 'pending' as any,
            channel_type: 'meta_whatsapp' as any,
            ...(replyContext ? {
              quoted_message_id: replyContext.messageId,
              quoted_content: replyContext.content.substring(0, 200),
              quoted_sender_name: replyContext.senderName || (replyContext.role === 'user' ? 'Cliente' : 'Atendente'),
            } : {}),
          })

          const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('meta-whatsapp-proxy', {
            body: {
              action: 'sendMessage',
              instanceId: channelInstanceId,
              recipient,
              type: 'text',
              text: fullContent,
              ...(replyContext?.uazapiMessageId ? { quotedMsgId: replyContext.uazapiMessageId } : {}),
            },
          })

          if (proxyError || proxyResult?.error) {
            const errMsg = proxyError?.message || proxyResult?.error || 'Erro desconhecido'
            console.error('[handleSend] meta-whatsapp-proxy error:', errMsg)
            toast.error(`Erro ao enviar Meta WhatsApp: ${errMsg}`)
            if (savedMsg?.id) {
              await supabase.from('ai_messages').update({ delivery_status: 'failed' }).eq('id', savedMsg.id)
            }
            return
          }

          const metaMsgId = proxyResult?.data?._msgId || proxyResult?._msgId || null
          if (savedMsg?.id) {
            await supabase.from('ai_messages').update({
              delivery_status: 'sent',
              ...(metaMsgId ? { uazapi_message_id: metaMsgId } : {}),
            }).eq('id', savedMsg.id)
          }
        } else if (isWhatsAppConversation) {
          // ── UAZAPI (legado) ──
          const uazapiChat = await getUazapiChat()
          if (!uazapiChat) {
            toast.error('Não foi possível encontrar o chat WhatsApp. Tente recarregar a página.')
            return
          }

          const savedMsg = await sendMessage.mutateAsync({
            conversation_id: conversation.id,
            role: 'assistant',
            content: fullContent,
            user_id: user.id,
            delivery_status: 'pending' as any,
            ...(replyContext ? {
              quoted_message_id: replyContext.messageId,
              quoted_content: replyContext.content.substring(0, 200),
              quoted_sender_name: replyContext.senderName || (replyContext.role === 'user' ? 'Cliente' : 'Atendente'),
            } : {}),
          })

          const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
            body: {
              action: 'sendMessage',
              instanceId: uazapiChat.instance_id,
              chatJid: uazapiChat.chat_id,
              type: 'text',
              text: fullContent,
              ...(replyContext?.uazapiMessageId ? { quotedMsgId: replyContext.uazapiMessageId } : {}),
            },
          })

          if (proxyError || proxyResult?.error) {
            const errMsg = proxyError?.message || proxyResult?.error || 'Erro desconhecido'
            console.error('[handleSend] uazapi-proxy error:', errMsg)
            toast.error(`Erro ao enviar WhatsApp: ${errMsg}`)
            if (savedMsg?.id) {
              await supabase.from('ai_messages').update({ delivery_status: 'failed' }).eq('id', savedMsg.id)
            }
            return
          }

          const whatsappMsgId = proxyResult?.data?._msgId || proxyResult?._msgId || null
          if (savedMsg?.id) {
            await supabase.from('ai_messages').update({
              delivery_status: 'sent',
              ...(whatsappMsgId ? { uazapi_message_id: whatsappMsgId } : {}),
            }).eq('id', savedMsg.id)
          }
        } else {
          await sendMessage.mutateAsync({
            conversation_id: conversation.id,
            role: 'assistant',
            content: fullContent,
            user_id: user.id,
            ...(replyContext ? {
              quoted_message_id: replyContext.messageId,
              quoted_content: replyContext.content.substring(0, 200),
              quoted_sender_name: replyContext.senderName || (replyContext.role === 'user' ? 'Cliente' : 'Atendente'),
            } : {}),
          })
        }
      }
    } catch (error: unknown) {
      // Restaurar texto para o usuário não perder em caso de erro
      onPendingMessageChange(messageToSend)
      toast.error((error as Error).message || 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  // ===== Send internal note =====
  const handleSendNote = async () => {
    if (!noteText.trim() || !conversation) return
    try {
      await addTicketNote.mutateAsync(noteText.trim())
      setNoteText('')
      setComposerMode('message')
    } catch {
      // error already handled by hook
    }
  }

  // ===== Insert macro into composer =====
  const handleInsertMacro = (macroMessage: string) => {
    // Replace {nome} template variable with customer name
    const replaced = macroMessage.replace(/\{nome\}/gi, conversation?.customer_name?.split(' ')[0] || 'Cliente')
    onPendingMessageChange(pendingMessage + replaced)
    setMacroPickerOpen(false)
    setMacroSearch('')
    textareaRef.current?.focus()
  }

  // ===== Ctrl+V paste image =====
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const previewUrl = URL.createObjectURL(file)
          setPendingMedia({ file, type: 'image', previewUrl })
        }
        return
      }
    }
  }, [])

  // ===== File upload via Paperclip =====
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const type = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio'
          : 'document'

    const previewUrl = file.type.startsWith('image/') || file.type.startsWith('video/')
      ? URL.createObjectURL(file)
      : ''

    setPendingMedia({ file, type, previewUrl })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ===== Audio recording =====
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' })
        const previewUrl = URL.createObjectURL(blob)
        setPendingMedia({ file, type: 'ptt', previewUrl })
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch {
      toast.error('Não foi possível acessar o microfone')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setIsRecording(false)
    setRecordingTime(0)
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ===== Interactive =====
  const handleSendInteractive = async (payload: InteractivePayload) => {
    if (!conversation || !user || !isWhatsAppConversation) return
    if (conversation.status !== 'em_atendimento') {
      toast.error('Inicie o atendimento antes de enviar mensagens')
      return
    }
    setSending(true)
    try {
      const uazapiChat = await getUazapiChat()
      if (!uazapiChat) {
        toast.error('Não foi possível encontrar o chat WhatsApp.')
        return
      }
      const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'sendInteractive',
          instanceId: uazapiChat.instance_id,
          chatJid: uazapiChat.chat_id,
          interactive: payload,
        },
      })
      if (proxyError || proxyResult?.error) {
        const errMsg = proxyError?.message || proxyResult?.error || 'Erro desconhecido'
        console.error('[handleSendInteractive] uazapi-proxy error:', errMsg)
        toast.error(`Erro ao enviar mensagem interativa: ${errMsg}`)
        const label = payload.type === 'buttons' ? `[Botões] ${payload.body}` : `[Lista] ${payload.body}`
        await sendMessage.mutateAsync({
          conversation_id: conversation.id,
          role: 'assistant',
          content: label,
          user_id: user.id,
          delivery_status: 'failed',
        })
        return
      }
      const label = payload.type === 'buttons' ? `[Botões] ${payload.body}` : `[Lista] ${payload.body}`
      await sendMessage.mutateAsync({
        conversation_id: conversation.id,
        role: 'assistant',
        content: label,
        user_id: user.id,
      })
      toast.success('Mensagem interativa enviada!')
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Erro ao enviar mensagem interativa')
    } finally {
      setSending(false)
    }
  }

  const handleTakeOver = async () => {
    if (!conversation) return
    try {
      await takeOverConversation.mutateAsync({ conversationId: conversation.id })
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Erro ao assumir conversa')
    }
  }

  // ===== Improve text with AI =====
  const handleImproveWithAI = async () => {
    if (!pendingMessage.trim() || improvingText || !conversation) return
    setImprovingText(true)
    try {
      const { data, error } = await supabase.functions.invoke('copilot-suggest', {
        body: {
          conversation_id: conversation.id,
          pending_message: `MELHORE O SEGUINTE TEXTO como resposta profissional, clara e empática, mantendo a intenção original. Retorne APENAS o texto melhorado sem explicações: "${pendingMessage}"`,
        },
      })
      if (error) throw error
      const improved = data?.text || data?.suggestion
      if (improved && improved !== pendingMessage) {
        onPendingMessageChange(improved)
        toast.success('Texto melhorado com IA!')
      } else {
        toast.info('Nenhuma melhoria encontrada')
      }
    } catch {
      toast.error('Erro ao melhorar texto')
    } finally {
      setImprovingText(false)
    }
  }

  // ===== Send suggestion directly =====
  const handleSendDirect = async (text: string) => {
    if (!conversation || !user || !text.trim()) return
    if (conversation.status !== 'em_atendimento') {
      toast.error('Inicie o atendimento antes de enviar mensagens')
      return
    }
    setSending(true)
    try {
      // Insert-first: salvar no banco ANTES de enviar
      const savedMsg = await sendMessage.mutateAsync({
        conversation_id: conversation.id,
        role: 'assistant',
        content: text,
        user_id: user.id,
        delivery_status: isWhatsAppConversation ? ('pending' as any) : undefined,
      })

      if (isWhatsAppConversation) {
        const uazapiChat = await getUazapiChat()
        if (!uazapiChat) {
          toast.error('Não foi possível encontrar o chat WhatsApp.')
          if (savedMsg?.id) {
            await supabase.from('ai_messages').update({ delivery_status: 'failed' }).eq('id', savedMsg.id)
          }
          return
        }
        const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            action: 'sendMessage',
            instanceId: uazapiChat.instance_id,
            chatJid: uazapiChat.chat_id,
            type: 'text',
            text,
          },
        })
        if (proxyError || proxyResult?.error) {
          const errMsg = proxyError?.message || proxyResult?.error || 'Erro desconhecido'
          console.error('[handleSendDirect] uazapi-proxy error:', errMsg)
          toast.error(`Erro ao enviar WhatsApp: ${errMsg}`)
          if (savedMsg?.id) {
            await supabase.from('ai_messages').update({ delivery_status: 'failed' }).eq('id', savedMsg.id)
          }
          return
        }
        // Sucesso: atualizar status
        const whatsappMsgId = proxyResult?.data?._msgId || proxyResult?._msgId || null
        if (savedMsg?.id) {
          await supabase.from('ai_messages').update({
            delivery_status: 'sent',
            ...(whatsappMsgId ? { uazapi_message_id: whatsappMsgId } : {}),
          }).eq('id', savedMsg.id)
        }
      }
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  // ===== Direct send from external trigger (e.g. billing button) =====
  useEffect(() => {
    if (directSendText && directSendText.trim()) {
      handleSendDirect(directSendText).then(() => {
        onDirectSendConsumed?.()
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directSendText])

  const handleCloseConversation = async (resolutionSummary?: string) => {
    if (!conversation) return
    try {
      // Send CSAT survey via WhatsApp (non-blocking — closeConversationHelper must always run)
      // Use board config if available, otherwise fall back to global config
      const boardCsatEnabled = csatBoardConfig.config?.enabled && csatBoardConfig.config?.send_on_close
      const shouldSendCsat = isWhatsAppConversation && boardCsatEnabled

      let csatSentViaWhatsApp = false
      if (shouldSendCsat && boardCsatEnabled) {
        try {
          const uazapiChat = await getUazapiChat()
          if (uazapiChat) {
            // Use board-specific message template
            const csatMessage = csatBoardConfig.config?.message_template || csatConfig.message_template

            await supabase.functions.invoke('uazapi-proxy', {
              body: {
                action: 'sendInteractive',
                instanceId: uazapiChat.instance_id,
                chatJid: uazapiChat.chat_id,
                interactive: {
                  type: 'list',
                  body: csatMessage,
                  footer: 'Sua opinião é muito importante para nós',
                  listTitle: 'Avaliação',
                  listButtonText: 'Avaliar atendimento',
                  listSections: [
                    {
                      title: 'Notas',
                      rows: [
                        { id: 'csat_1', title: '1 ⭐', description: 'Péssimo' },
                        { id: 'csat_2', title: '2 ⭐', description: 'Muito ruim' },
                        { id: 'csat_3', title: '3 ⭐', description: 'Ruim' },
                        { id: 'csat_4', title: '4 ⭐', description: 'Regular' },
                        { id: 'csat_5', title: '5 ⭐', description: 'Mediano' },
                        { id: 'csat_6', title: '6 ⭐', description: 'Satisfatório' },
                        { id: 'csat_7', title: '7 ⭐', description: 'Bom' },
                        { id: 'csat_8', title: '8 ⭐', description: 'Muito bom' },
                        { id: 'csat_9', title: '9 ⭐', description: 'Ótimo' },
                        { id: 'csat_10', title: '10 ⭐', description: 'Excelente' },
                      ],
                    },
                  ],
                },
              },
            })

            await sendMessage.mutateAsync({
              conversation_id: conversation.id,
              role: 'assistant',
              content: '📊 Pesquisa de satisfação enviada ao cliente (escala 1-10)',
              user_id: user?.id,
            })
            csatSentViaWhatsApp = true
          }
        } catch (csatErr) {
          console.error('[handleCloseConversation] Falha ao enviar CSAT interativo:', csatErr)
        }
      }

      // Close conversation using centralized helper (ALWAYS runs, even if interactive send failed)
      const result = await closeConversationHelper({
        conversationId: conversation.id,
        currentStatus: conversation.status || 'em_atendimento',
        startedAt: conversation.started_at,
        humanStartedAt: (conversation as any).human_started_at,
        resolutionSummary: resolutionSummary || 'Atendimento finalizado',
        sendCsat: isWhatsAppConversation, // This triggers board-level CSAT in closeConversationHelper
        isWhatsApp: isWhatsAppConversation,
        helpdeskClientId: conversation.helpdesk_client_id,
        aiCloseReviewNote,
      })

      if (!result.success) throw new Error(result.error)
      setAICloseReviewNote(undefined)

      toast.success(csatSentViaWhatsApp ? 'Pesquisa CSAT enviada! Aguardando resposta do cliente.' : 'Atendimento encerrado com sucesso')
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Erro ao encerrar atendimento')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (pendingMessage === '/ai') {
      onPendingMessageChange('')
      onRequestSuggestion('generate')
    }
  }, [pendingMessage])

  const handleCockpitSendNow = (text: string) => onPendingMessageChange(text)
  const handleCockpitSendLater = (text: string) => {
    onPendingMessageChange(text)
    toast.info('Mensagem adicionada ao campo. Edite e envie quando quiser.')
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-xs">
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="mx-auto mb-6 opacity-70">
            <rect x="15" y="20" width="90" height="60" rx="12" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" fill="none" />
            <rect x="25" y="35" width="40" height="6" rx="3" fill="hsl(var(--primary))" opacity="0.2" />
            <rect x="25" y="47" width="55" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.15" />
            <rect x="25" y="57" width="30" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.1" />
            <circle cx="95" cy="25" r="10" fill="hsl(var(--primary))" opacity="0.15" />
            <path d="M91 25L94 28L99 22" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          </svg>
          <p className="font-display font-semibold text-foreground mb-1">Selecione uma conversa</p>
          <p className="text-sm text-muted-foreground">Escolha uma conversa na lista ao lado para começar o atendimento</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
      {/* Header — hidden when used inside KanbanChatPanel to avoid duplication */}
      {!hideHeader && <div className="px-5 py-3 border-b border-border bg-card shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            <Avatar className="w-11 h-11 ring-2 ring-primary/20 ring-offset-2 ring-offset-background shrink-0">
              {contactPictureUrl && (
                <AvatarImage src={contactPictureUrl} alt={conversation.customer_name || ''} />
              )}
              <AvatarFallback className={cn("font-bold text-base", getInitialsColor(conversation.customer_name || 'C'))}>
                {isGroup ? '👥' : (conversation.customer_name?.[0]?.toUpperCase() || 'C')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 group min-w-0">
                <h3 className="font-display font-bold text-foreground text-sm leading-tight truncate max-w-[200px]">
                  {isGroup ? (uazapiChatInfo?.contact_name || conversation.customer_name || 'Grupo') : (conversation.customer_name || conversation.customer_phone)}
                </h3>
                {!isGroup && conversation.id && (
                  <EditContactNamePopover
                    conversationId={conversation.id}
                    currentName={conversation.customer_name || ''}
                    uazapiChatId={(conversation as Record<string, unknown>).uazapi_chat_id as string | undefined}
                  />
                )}
                <ChannelBadge channelType={(conversation as any)?.communication_channel} size="sm" />
                <MetaWindowIndicator
                  channelType={(conversation as any)?.communication_channel}
                  lastCustomerMessageAt={(conversation as any)?.last_customer_message_at}
                />
                {(conversation as any).priority && priorityBadgeConfig[(conversation as any).priority] && (
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 font-bold border shrink-0', priorityBadgeConfig[(conversation as any).priority].className)}>
                    {priorityBadgeConfig[(conversation as any).priority].label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap min-w-0 overflow-hidden max-w-full">
                <Badge variant="outline" className="text-[9px] font-mono font-bold px-1.5 h-4 border-primary/20 text-primary bg-primary/5">
                  #{conversation.ticket_number}
                </Badge>
                {conversation.is_discarded && (
                  <Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4 border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                    <EyeOff className="w-2.5 h-2.5 mr-0.5" /> Descartado
                  </Badge>
                )}
                {conversation.is_merged && (
                  <Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4 border-purple-300 text-purple-600 bg-purple-50 dark:bg-purple-950/30">
                    <GitMerge className="w-2.5 h-2.5 mr-0.5" /> Mesclado
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1 group">
                  <Phone className="w-2.5 h-2.5" />
                  {conversation.customer_phone}
                  {!isGroup && conversation.id && (
                    <EditContactPhonePopover
                      conversationId={conversation.id}
                      currentPhone={conversation.customer_phone}
                      uazapiChatId={(conversation as Record<string, unknown>).uazapi_chat_id as string | undefined}
                    />
                  )}
                </span>
                {isEmAtendimento && currentAgentName && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5 font-semibold border-primary/30 bg-primary/5 text-primary">
                    <Headphones className="w-2.5 h-2.5" />
                    {currentAgentName}
                  </Badge>
                )}
                {conversation.handler_type === 'ai' ? (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5 font-semibold border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <Bot className="w-2.5 h-2.5" />
                    IA Ativa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5 font-semibold border-border bg-muted text-muted-foreground">
                    <UserIcon className="w-2.5 h-2.5" />
                    Modo Humano
                  </Badge>
                )}
                {conversation.whatsapp_instance_id && instanceNameMap.get(conversation.whatsapp_instance_id) && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5 font-semibold border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
                    <Smartphone className="w-2.5 h-2.5" />
                    {instanceNameMap.get(conversation.whatsapp_instance_id)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end shrink-0">
            {/* Inline Timer */}
            {isAguardando && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                <Timer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">Fila</span>
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                  {formatHHMMSS(queueElapsed)}
                </span>
              </div>
            )}
            {isEmAtendimento && conversation.human_started_at && (() => {
              // Color code: green < 30min, amber 30-60min, red > 60min
              const tmaMinutes = Math.floor(tmaElapsed / 60)
              const tmaColorClass = tmaMinutes >= 60
                ? 'text-destructive bg-destructive/10 border-destructive/20'
                : tmaMinutes >= 30
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
                  : 'text-primary bg-primary/10 border-primary/20'
              return (
                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border", tmaColorClass)}>
                  <Timer className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase">Atendimento</span>
                  <span className="text-xs font-mono font-bold">
                    {formatHHMMSS(tmaElapsed)}
                  </span>
                </div>
              )
            })()}
            {/* Inline SLA */}
            <InlineSLA conversation={conversation} />
            {/* Kebab menu for secondary actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!isReadOnly && conversation.handler_type === 'ai' && (
                  <DropdownMenuItem
                    onClick={() => takeOverConversation.mutateAsync({ conversationId: conversation.id })}
                    className="gap-2"
                  >
                    <BotOff className="w-4 h-4" /> Desativar IA
                  </DropdownMenuItem>
                )}
                {!isReadOnly && conversation.handler_type !== 'ai' && (
                  <DropdownMenuItem
                    onClick={() => returnToAI.mutateAsync({ conversationId: conversation.id })}
                    className="gap-2"
                  >
                    <Bot className="w-4 h-4" /> Ativar IA
                  </DropdownMenuItem>
                )}
                {!isReadOnly && (
                  <DropdownMenuItem onClick={() => setTransferOpen(true)} className="gap-2">
                    <ArrowRightLeft className="w-4 h-4" /> Transferir
                  </DropdownMenuItem>
                )}
                {!isFinalized && (
                  <DropdownMenuItem onClick={handleFinalizarClick} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Finalizar
                  </DropdownMenuItem>
                )}
                {conversation && isClosedStatus(conversation.status || '') && conversation.status !== 'cancelado' && (
                  <DropdownMenuItem onClick={handleReopenConversation} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Reabrir Atendimento
                  </DropdownMenuItem>
                )}
                {/* Mesclar tickets — disponível quando vinculado a cliente */}
                {conversation?.helpdesk_client_id && (
                  <DropdownMenuItem onClick={() => setMergeDialogOpen(true)} className="gap-2">
                    <GitMerge className="w-4 h-4" /> Mesclar tickets
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    {conversation?.is_discarded ? (
                      <DropdownMenuItem
                        onClick={async () => {
                          await supabase.from('ai_conversations').update({
                            is_discarded: false, discarded_at: null, discard_reason: null, discarded_by: null
                          }).eq('id', conversation.id)
                          queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
                          toast('Descarte revertido — ticket voltou às estatísticas')
                        }}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" /> Desfazer descarte
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setDiscardDialogOpen(true)} className="gap-2 text-amber-600 focus:text-amber-600">
                        <EyeOff className="w-4 h-4" /> Descartar ticket
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4" /> Excluir ticket
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>}

      {/* Timer Indicators removed — integrated into header */}

      {/* Iniciar Atendimento Banner — prominent CTA when ticket is in queue */}
      {isAguardando && !isFinalized && (
        <div className="px-4 py-3 border-b-2 border-[#45E5E5] bg-[#E8F9F9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#45E5E5]/20 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4 text-[#10293F]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#10293F]">
                Este ticket está na fila aguardando atendimento
              </p>
              <p className="text-xs text-[#10293F]/60">
                Clique no botão para assumir e iniciar o atendimento
              </p>
            </div>
          </div>
          <Button
            onClick={handleStartAttendance}
            disabled={startingAttendance}
            className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] font-bold shadow-md px-5"
            aria-label="Iniciar Atendimento"
          >
            {startingAttendance ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Headphones className="w-4 h-4 mr-2" />}
            Iniciar Atendimento
          </Button>
        </div>
      )}

      {/* CNPJ Alert Banner */}
      {showCnpjAlert && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#FEF2F2] border-b-2 border-[#DC2626] shrink-0 animate-cnpj-alert" role="alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#DC2626] animate-bounce flex-shrink-0" />
            <span className="text-[14px] font-bold text-[#991B1B]">
              😤 Antes de Pedir CNPJ ao Cliente consulte o cadastro na aba Cliente pelo Telefone ou Nome
            </span>
          </div>
          <button
            onClick={() => setShowCnpjAlert(false)}
            className="p-1 rounded hover:bg-[#DC2626]/20 transition-colors flex-shrink-0"
            aria-label="Fechar alerta"
          >
            <X className="w-4 h-4 text-[#991B1B]" />
          </button>
        </div>
      )}

      {/* Finalized Banner */}
      {isFinalized && (
        <div className="px-6 py-4 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Este atendimento foi {conversation?.status === 'cancelado' ? 'cancelado' : 'finalizado'} — somente leitura
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                Nenhuma informação pode ser alterada após a conclusão
              </p>
            </div>
          </div>
          {hasPermission('reopenTickets') && conversation?.status !== 'cancelado' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReopenDialogOpen(true)}
              className="gap-2 shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Reabrir
            </Button>
          )}
        </div>
      )}

      {conversation && (
        <ReopenTicketModal
          open={reopenDialogOpen}
          onOpenChange={setReopenDialogOpen}
          conversationId={conversation.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
          }}
        />
      )}

      {/* Dialogs */}
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} conversationId={conversation.id} currentBoardId={(conversation as any).kanban_board_id} />
      <CloseConversationDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        conversationSummary={(conversation as any).conversation_summary}
        boardId={(conversation as any).kanban_board_id}
        isWhatsApp={isWhatsAppConversation || isMetaWhatsAppConversation}
        validationError={isClosedStatus(conversation.status || '') ? 'Este atendimento já foi finalizado.' : null}
        onConfirm={(sendCsat, resolutionSummary) => {
          if (sendCsat) {
            handleCloseConversation(resolutionSummary)
          } else {
            // Close without CSAT — use centralized helper
            (async () => {
              try {
                const result = await closeConversationHelper({
                  conversationId: conversation.id,
                  currentStatus: conversation.status || 'em_atendimento',
                  startedAt: conversation.started_at,
                  humanStartedAt: (conversation as any).human_started_at,
                  resolutionSummary,
                  sendCsat: false,
                  isWhatsApp: false,
                  helpdeskClientId: conversation.helpdesk_client_id,
                  aiCloseReviewNote,
                })
                if (!result.success) throw new Error(result.error)
                setAICloseReviewNote(undefined)
                toast.success('Atendimento encerrado sem CSAT')
              } catch (err: unknown) {
                toast.error((err as Error).message || 'Erro ao encerrar')
              }
            })()
          }
        }}
      />
      <RequiredFieldsDialog
        open={requirementsDialogOpen}
        onOpenChange={setRequirementsDialogOpen}
        missingFields={missingFields}
        isAdmin={isAdmin}
        onForceClose={() => {
          setRequirementsDialogOpen(false)
          proceedAfterFieldValidation(conversation)
        }}
      />
      <LinkClientBeforeCloseDialog
        open={linkClientDialogOpen}
        onOpenChange={setLinkClientDialogOpen}
        conversationId={conversation?.id ?? ''}
        conversationPhone={conversation?.customer_phone}
        onClientLinked={handleClientLinkedAndContinue}
      />
      <AICloseValidationDialog
        open={aiValidationDialogOpen}
        onOpenChange={setAIValidationDialogOpen}
        conversationId={conversation?.id ?? ''}
        customerName={conversation?.customer_name ?? null}
        aiValidationsNeeded={pendingAIValidations}
        onComplete={handleAIValidationComplete}
        runAINameValidation={runAINameValidation}
        runAICloseReview={runAICloseReview}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-5 space-y-5" style={{ background: '#FDFDFD' }}>
          {/* Top of message list — oldest messages start here */}

          {/* History Import Banner */}
          {showHistoryBanner && (
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card shadow-sm mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <History className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Primeiro contato recente</p>
                <p className="text-xs text-muted-foreground mt-0.5">Este contato não possui conversas recentes no sistema</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHistoryBannerDismissed(true)}
                  className="text-xs text-muted-foreground"
                >
                  Ignorar
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportHistory}
                  disabled={importingHistory}
                  className="text-xs gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {importingHistory ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando histórico...</>
                  ) : (
                    <><History className="w-3.5 h-3.5" /> Importar últimas 100 mensagens</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Enriching indicator */}
          {enriching && (
            <div className="flex items-center gap-2 justify-center py-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Buscando dados do contato...
            </div>
          )}
          {/* Previous tickets history */}
          {previousTickets && previousTickets.length > 0 && previousTickets.map(({ ticket, messages: prevMsgs }) => (
            <div key={ticket.id}>
              <TicketSeparator
                ticketNumber={ticket.ticket_number}
                startedAt={ticket.started_at}
                status={ticket.status}
              />
              {prevMsgs.map((msg) => {
                const isUser = msg.role === 'user'
                const isOutbound = !isUser
                const emojiOnly = isEmojiOnly(msg.content)
                return (
                  <div key={msg.id} className={cn("flex mb-4", isOutbound ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[70%] px-4 py-2.5 opacity-70 overflow-hidden min-w-0",
                      isOutbound
                        ? "bg-primary/10 text-foreground rounded-2xl rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-2xl rounded-bl-md shadow-sm"
                    )}>
                      <MediaContent
                        mediaUrl={msg.media_url}
                        mediaType={msg.media_type}
                        content={msg.content}
                        onOpenLightbox={openLightbox}
                        messageId={msg.id}
                        conversationId={ticket.id}
                        createdAt={msg.created_at}
                        whatsappInstanceId={(ticket as any).whatsapp_instance_id}
                      />
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Current ticket separator */}
          {previousTickets && previousTickets.length > 0 && conversation && (
            <TicketSeparator
              ticketNumber={conversation.ticket_number}
              startedAt={conversation.started_at}
              status={conversation.status}
              isCurrent
            />
          )}

          {/* Date separators are now rendered dynamically inside the message loop */}

          {/* Build reaction map and filter messages */}
          {(() => {
            // Separate reactions from normal messages
            const reactionMessages = messages.filter((m: any) => m.reaction_to_message_id && m.reaction_emoji)
            const filteredMessages = messages.filter((m: any) => {
              if (m.reaction_to_message_id && m.reaction_emoji) return false
              // Filter out duplicate transcription echo rows (no media_type but content is transcription)
              if (!m.media_type && !m.media_url && m.content?.startsWith('[Áudio transcrito] ')) return false
              // Filter out all system messages (summaries, transcriptions, logs) from chat display
              if (m.role === 'system') return false
              return true
            })

            // Mesclar notas internas com mensagens na ordem cronológica
            const notesAsMessages = ticketNotes.map((note, idx) => ({
              id: `note-${idx}`,
              conversation_id: conversation?.id || '',
              role: 'internal_note' as const,
              content: note.text,
              created_at: note.created_at,
              updated_at: note.created_at,
              ai_agents: null,
              _noteAuthor: note.author,
            }))
            const normalMessages = [...filteredMessages, ...notesAsMessages]
              .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())

            // Build reaction map: uazapi_message_id -> { emoji, count, senders }[]
            const reactionMap = new Map<string, { emoji: string; count: number; senders: string[] }[]>()
            for (const r of reactionMessages) {
              const targetId = (r as any).reaction_to_message_id as string
              const emoji = (r as any).reaction_emoji as string
              const sender = r.role === 'agent' || r.role === 'assistant' ? 'Você' : (conversation?.customer_name || conversation?.customer_phone || 'Contato')
              if (!reactionMap.has(targetId)) reactionMap.set(targetId, [])
              const list = reactionMap.get(targetId)!
              const existing = list.find(e => e.emoji === emoji)
              if (existing) { existing.count++; if (!existing.senders.includes(sender)) existing.senders.push(sender) }
              else list.push({ emoji, count: 1, senders: [sender] })
            }

            return normalMessages.map((msg, index) => {
            // Dynamic date separator between messages of different days
            const msgDate = msg.created_at ? new Date(msg.created_at) : null;
            const prevMsg = index > 0 ? normalMessages[index - 1] : null;
            const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at) : null;
            const showDateSep = msgDate && (!prevDate || msgDate.toDateString() !== prevDate.toDateString());
            const dateSepLabel = (() => {
              if (!msgDate) return '';
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              if (msgDate.toDateString() === today.toDateString()) return 'Hoje';
              if (msgDate.toDateString() === yesterday.toDateString()) return 'Ontem';
              return format(msgDate, 'dd/MM/yyyy');
            })();
            const dateSeparator = showDateSep ? (
              <div className="flex justify-center my-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-card px-3 py-1 rounded-full border border-border shadow-sm">
                  {dateSepLabel}
                </span>
              </div>
            ) : null;

            // Transfer log: render as centered system event
            if (msg.role === 'transfer_log') {
              return (
                <React.Fragment key={msg.id}>
                  {dateSeparator}
                  <div className="flex justify-center my-3">
                    <div className="bg-muted/60 border border-border rounded-xl px-4 py-2.5 max-w-[80%] text-center">
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{msg.content}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              )
            }
            // Nota interna: renderizar inline na ordem cronológica
            if (msg.role === 'internal_note') {
              return (
                <React.Fragment key={msg.id}>
                  {dateSeparator}
                  <div className="flex justify-center my-3">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 max-w-[80%]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Nota Interna</span>
                        <span className="text-xs text-amber-600/70 dark:text-amber-400/60">— {(msg as any)._noteAuthor || 'Agente'}</span>
                      </div>
                      {msg.content && /<[a-z][\s\S]*>/i.test(msg.content) ? (
                        <div
                          className="text-xs text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert overflow-hidden [&_table]:w-full [&_table]:border-collapse [&_td]:p-1.5 [&_td]:border [&_td]:border-border [&_td]:text-xs [&_th]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:text-xs [&_th]:font-semibold [&_strong]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content, {
                            ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'mark'],
                            ALLOWED_ATTR: ['style', 'class', 'href', 'target']
                          }) }}
                        />
                      ) : (
                        <p className="text-xs text-foreground whitespace-pre-line">{msg.content}</p>
                      )}
                      <p className="text-xs text-amber-600/50 dark:text-amber-400/40 mt-1 text-right">
                        {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              )
            }
            const isUser = msg.role === 'user'
            const isAI = msg.role === 'assistant' && !!msg.agent_id
            const isViaWhatsApp = msg.role === 'agent' // Sent directly from WhatsApp/WhatsApp Web
            const isOutbound = !isUser // assistant, agent, or system
            const msgAny = msg as Record<string, unknown>
            const groupSenderName = isGroup && isUser && msg.uazapi_message_id
              ? senderNameMap.get(msg.uazapi_message_id) || null
              : null
            const groupSenderPhone = isGroup && isUser && msg.uazapi_message_id
              ? senderPhoneMap.get(msg.uazapi_message_id) || null
              : null

            // Use DB fields for quoted content, fallback to regex parsing
            let quotedBlock: { name: string; text: string } | null = null
            let displayContent = msg.content
            const dbQuotedContent = (msg as any).quoted_content as string | null
            const dbQuotedSenderName = (msg as any).quoted_sender_name as string | null
            if (dbQuotedContent) {
              quotedBlock = { name: dbQuotedSenderName || 'Contato', text: dbQuotedContent }
              // Strip the text prefix if present (legacy format: > _Name_: text\n\n)
              const prefixMatch = displayContent.match(/^> _.*?_: .*?\n\n([\s\S]*)$/)
              if (prefixMatch) displayContent = prefixMatch[1]
            } else {
              const quoteMatch = msg.content.match(/^> _(.+?)_: (.+?)(?:\.\.\.)?\n\n([\s\S]*)$/)
              if (quoteMatch) {
                quotedBlock = { name: quoteMatch[1], text: quoteMatch[2] }
                displayContent = quoteMatch[3]
              }
            }

            // Image/video-only messages render without bubble background (WhatsApp style)
            const isMediaBubble = ['image', 'sticker', 'video'].includes(msg.media_type ?? '') && !!msg.media_url && !quotedBlock

            // Get reactions for this message
            const msgReactions = msg.uazapi_message_id ? reactionMap.get(msg.uazapi_message_id) || [] : []

            const handleReply = () => {
              const senderName = isUser
                ? conversation?.customer_name || 'Cliente'
                : isAI
                  ? (msgAny.ai_agents ? (msgAny.ai_agents as { name: string }).name : 'Assistente IA')
                  : 'Atendente'
              setReplyingTo({
                messageId: msg.id,
                uazapiMessageId: msg.uazapi_message_id,
                content: msg.content.replace(/^> _.*?_: .*?\n\n/, ''), // strip existing quote
                role: msg.role,
                senderName,
                mediaType: msg.media_type,
              })
              textareaRef.current?.focus()
            }

            const emojiOnly = !msg.media_type && !msg.media_url && isEmojiOnly(displayContent)

            return (
              <React.Fragment key={msg.id}>
              {dateSeparator}
              <div className={cn('group flex gap-2.5 message-bubble', isUser ? 'justify-start' : 'justify-end', msgReactions.length > 0 && 'mb-3')}>
                {isUser && (
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 font-bold text-xs", getInitialsColor(groupSenderName || conversation?.customer_name || 'C'))}>
                    {(groupSenderName || conversation?.customer_name)?.[0]?.toUpperCase() || 'C'}
                  </div>
                )}
                <div className="relative max-w-[75%] overflow-hidden min-w-0">
                  <div className={cn(
                    emojiOnly
                      ? 'px-1 py-0.5'
                      : isMediaBubble
                        ? 'p-0 overflow-hidden shadow-sm'
                        : 'px-4 py-2.5 shadow-sm',
                    !emojiOnly && !isMediaBubble && (isUser
                      ? 'bg-card text-foreground rounded-2xl rounded-tl-sm border border-border'
                      : isViaWhatsApp
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-foreground rounded-2xl rounded-tr-sm border border-emerald-200 dark:border-emerald-800/50 border-dashed'
                        : isAI
                          ? 'bg-violet-50 dark:bg-violet-950/30 text-foreground rounded-2xl rounded-tr-sm border border-violet-200 dark:border-violet-800/50'
                          : 'bg-sky-100 dark:bg-sky-950/30 text-foreground rounded-2xl rounded-tr-sm border border-sky-200 dark:border-sky-800/50'),
                    isMediaBubble && (isUser
                      ? 'rounded-2xl rounded-tl-sm'
                      : 'rounded-2xl rounded-tr-sm'),
                    msgReactions.length > 0 && 'pb-4',
                    (msg as any).deleted_by_sender && 'border-l-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                  )}>
                    {/* Group sender name for incoming messages */}
                    {isUser && isGroup && (groupSenderName || groupSenderPhone) && (
                      <GroupSenderName senderName={groupSenderName} senderPhone={groupSenderPhone} />
                    )}
                    {!isUser && (
                      <p className={cn("text-xs font-medium mb-1 flex items-center gap-1 flex-wrap",
                        isViaWhatsApp ? "text-emerald-600 dark:text-emerald-400"
                        : isAI ? "text-violet-600 dark:text-violet-400"
                        : "text-sky-700 dark:text-sky-400"
                      )}>
                        {isViaWhatsApp
                          ? <span className="inline-flex items-center gap-1"><Smartphone className="w-3 h-3" /> Via WhatsApp</span>
                          : isAI
                            ? <span className="inline-flex items-center gap-1">
                                <Bot className="w-3 h-3" />
                                {msgAny.ai_agents ? (msgAny.ai_agents as { name: string }).name : 'Assistente IA'}
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold bg-violet-200/80 dark:bg-violet-800/50 text-violet-700 dark:text-violet-300">
                                  <Sparkles className="w-2.5 h-2.5" /> IA
                                </span>
                              </span>
                            : <span className="inline-flex items-center gap-1"><Headphones className="w-3 h-3" /> {msg.user_id && agentNameMap.get(msg.user_id) ? agentNameMap.get(msg.user_id) : 'Atendente'}</span>}
                        {msg.confidence != null && (() => {
                          const conf = Math.round(Number(msg.confidence) * 100)
                          const confColor = conf < 70
                            ? "text-amber-600 dark:text-amber-400"
                            : conf >= 90
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isAI ? "text-violet-500 dark:text-violet-400" : "text-primary-foreground/60"
                          return (
                            <span
                              className={cn("ml-1 inline-flex items-center gap-0.5 cursor-help", confColor)}
                              title={(msg as any).confidence_reason || `Confiança: ${conf}%`}
                            >
                              {conf < 70 && <AlertTriangle className="w-2.5 h-2.5" />}
                              {conf >= 90 && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {conf}%
                            </span>
                          )
                        })()}
                      </p>
                    )}

                    {/* Flagged for review banner */}
                    {(msg as any).flagged_for_review && (
                      <div className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Resposta com baixa confiança — revisar</span>
                        {(msg as any).confidence_reason && (
                          <span className="text-amber-500/60 ml-1">({(msg as any).confidence_reason})</span>
                        )}
                      </div>
                    )}

                    {/* Forwarded badge */}
                    {(msg as any).is_forwarded && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1 italic">
                        <CornerDownRight className="w-3 h-3" /> Encaminhada
                      </p>
                    )}

                    {/* Deleted by sender banner */}
                    {(msg as any).deleted_by_sender && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 mb-1.5 cursor-help">
                              <span>🚫</span>
                              <span className="font-medium">Esta mensagem foi apagada pelo contato</span>
                              <span className="ml-auto text-amber-500 dark:text-amber-500 text-[9px]">🔒 Preservada</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px]">
                            <p className="text-xs">O conteúdo original foi preservado por segurança e não é visível para o cliente</p>
                            {(msg as any).deleted_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Apagada em {new Date((msg as any).deleted_at).toLocaleString('pt-BR')}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* Quoted message block */}
                    {quotedBlock && (
                      <div className="mb-2 pl-2 border-l-2 border-primary/40 bg-primary/5 rounded-r-lg py-1 pr-2">
                        <p className="text-xs font-semibold text-primary">{quotedBlock.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{quotedBlock.text}</p>
                      </div>
                    )}

                    <MediaContent
                      mediaUrl={msg.media_url}
                      mediaType={msg.media_type}
                      content={displayContent}
                      onOpenLightbox={openLightbox}
                      messageId={msg.id}
                      uazapiMessageId={msg.uazapi_message_id}
                      conversationId={conversation?.id}
                      createdAt={msg.created_at}
                      whatsappInstanceId={conversation?.whatsapp_instance_id}
                      isMediaBubble={isMediaBubble}
                      deliveryStatus={(msg as any).delivery_status}
                      isOutbound={isOutbound}
                    />

                    {msg.tools_used && msg.tools_used.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.tools_used.map((tool, i) => (
                          <Badge key={i} variant="outline" className="text-xs h-4 px-1.5">🛠️ {tool}</Badge>
                        ))}
                      </div>
                    )}

                    <p className={cn("text-xs text-right flex items-center justify-end gap-1 flex-wrap", isViaWhatsApp ? "text-muted-foreground" : "text-muted-foreground", isMediaBubble ? "px-3 pb-1.5 pt-0.5" : "mt-1.5")}>
                      <span>{msg.created_at && format(new Date(msg.created_at), 'HH:mm:ss')}</span>
                      {/* Edited badge */}
                      {(msg as any).edited_by_sender && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground/70 italic cursor-help">(editada)</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[350px]">
                              <p className="text-xs font-medium mb-1">Histórico de edições:</p>
                              {Array.isArray((msg as any).edit_history) && (msg as any).edit_history.length > 0 ? (
                                <div className="space-y-1">
                                  {((msg as any).edit_history as Array<{ body: string; edited_at: string }>).map((entry, i) => (
                                    <div key={i} className="text-xs">
                                      <span className="text-muted-foreground">{new Date(entry.edited_at).toLocaleString('pt-BR')}:</span>{' '}
                                      <span className="italic">"{entry.body?.substring(0, 80)}{(entry.body?.length || 0) > 80 ? '...' : ''}"</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Sem histórico disponível</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(msg as any).delivery_status && <DeliveryStatus status={(msg as any).delivery_status} />}
                      {(msg as any).delivery_status === 'failed' && (
                        <button
                          onClick={async () => {
                            if (!conversation || !isWhatsAppConversation) return
                            try {
                              const uazapiChat = await getUazapiChat()
                              if (!uazapiChat) { toast.error('Chat WhatsApp não encontrado'); return }
                              const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
                                body: { action: 'sendMessage', instanceId: uazapiChat.instance_id, chatJid: uazapiChat.chat_id, type: 'text', text: msg.content },
                              })
                              if (proxyError || proxyResult?.error) {
                                toast.error('Falha ao reenviar')
                                return
                              }
                              await supabase.from('ai_messages').update({ delivery_status: 'sent' }).eq('id', msg.id)
                              queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
                              queryClient.invalidateQueries({ queryKey: ['reasoning', conversation.id] })
                              toast.success('Mensagem reenviada!')
                            } catch { toast.error('Erro ao reenviar') }
                          }}
                          className="text-[9px] font-semibold text-destructive hover:underline flex items-center gap-0.5"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Reenviar
                        </button>
                      )}
                      {(msg as any).whatsapp_instance_id && instanceNameMap.get((msg as any).whatsapp_instance_id) && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/80 italic truncate max-w-[120px]">
                          <Smartphone className="w-[10px] h-[10px] shrink-0" />
                          Via {instanceNameMap.get((msg as any).whatsapp_instance_id)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Reaction pills (WhatsApp-style, overlapping bottom edge) */}
                  {msgReactions.length > 0 && (
                    <div className={cn("absolute -bottom-3 flex gap-1 z-10", isUser ? "left-2" : "right-2")}>
                      <TooltipProvider delayDuration={200}>
                        {msgReactions.map((r, i) => {
                          const isAgentReacted = r.senders.includes('Você')
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={async () => {
                                    if (!isWhatsAppConversation || !msg.uazapi_message_id) return
                                    try {
                                      const uazapiChat = await getUazapiChat()
                                      if (uazapiChat) {
                                        const { data: proxyData, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
                                          body: {
                                            action: 'sendReaction',
                                            instanceId: uazapiChat.instance_id,
                                            chatJid: uazapiChat.chat_id,
                                            emoji: isAgentReacted ? '' : r.emoji,
                                            messageId: msg.uazapi_message_id,
                                          },
                                        })
                                        if (proxyError || proxyData?.success === false) {
                                          toast.error('Erro ao enviar reação: ' + (proxyData?.error || proxyError?.message || 'falha'))
                                          return
                                        }
                                        // Removal: delete existing reaction records for this message
                                        if (isAgentReacted) {
                                          await supabase.from('ai_messages').delete()
                                            .eq('conversation_id', conversation!.id)
                                            .eq('reaction_to_message_id', msg.uazapi_message_id)
                                            .eq('role', 'assistant')
                                            .not('reaction_emoji', 'is', null)
                                        }
                                        queryClient.invalidateQueries({ queryKey: ['messages', conversation?.id] })
                                        queryClient.invalidateQueries({ queryKey: ['reasoning', conversation?.id] })
                                        toast.success(isAgentReacted ? 'Reação removida!' : `Reação ${r.emoji} enviada!`)
                                      }
                                    } catch {
                                      toast.error('Erro ao reagir')
                                    }
                                  }}
                                  className={cn(
                                    "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border shadow-sm cursor-pointer transition-colors hover:scale-105",
                                    isAgentReacted
                                      ? "bg-primary/10 border-primary/30 dark:bg-primary/20 dark:border-primary/40"
                                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                  )}
                                >
                                  <span className="text-sm leading-none">{r.emoji}</span>
                                  {r.count > 1 && <span className="text-xs text-muted-foreground">{r.count}</span>}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {r.senders.join(', ')}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </TooltipProvider>
                    </div>
                  )}
                  {/* WhatsApp-style context menu */}
                  {/* Floating reaction button on hover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-card/90 border border-border shadow-sm hover:bg-secondary',
                          isUser ? '-right-[52px]' : '-left-[52px]'
                        )}
                      >
                        <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-auto p-1.5 flex gap-1">
                      {['👍','❤️','😂','😮','😢','🙏','🔥'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={async () => {
                            if (!isWhatsAppConversation || !msg.uazapi_message_id) {
                              toast.info(`Reação ${emoji} registrada`)
                              return
                            }
                            try {
                              const uazapiChat = await getUazapiChat()
                              if (uazapiChat) {
                                const { data: proxyData, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
                                  body: {
                                    action: 'sendReaction',
                                    instanceId: uazapiChat.instance_id,
                                    chatJid: uazapiChat.chat_id,
                                    emoji,
                                    messageId: msg.uazapi_message_id,
                                  },
                                })
                                if (proxyError || proxyData?.success === false) {
                                  toast.error('Erro ao enviar reação: ' + (proxyData?.error || proxyError?.message || 'falha'))
                                  return
                                }
                                queryClient.invalidateQueries({ queryKey: ['messages', conversation?.id] })
                                queryClient.invalidateQueries({ queryKey: ['reasoning', conversation?.id] })
                                toast.success(`Reação ${emoji} enviada!`)
                              }
                            } catch {
                              toast.error('Erro ao enviar reação')
                            }
                          }}
                          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded-full transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  {/* Context menu dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          'absolute top-7 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-card/90 border border-border shadow-sm hover:bg-secondary',
                          isUser ? '-right-[52px]' : '-left-[52px]'
                        )}
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isUser ? 'end' : 'start'} className="w-52">
                      {/* Quick reactions row */}
                      <div className="flex items-center justify-center gap-1 px-2 py-1.5">
                        {['👍','❤️','😂','😮','😢','🙏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={async () => {
                              if (!isWhatsAppConversation || !msg.uazapi_message_id) {
                                toast.info(`Reação ${emoji} registrada`)
                                return
                              }
                              try {
                                const uazapiChat = await getUazapiChat()
                                if (uazapiChat) {
                                  const { data: proxyData, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
                                    body: {
                                      action: 'sendReaction',
                                      instanceId: uazapiChat.instance_id,
                                      chatJid: uazapiChat.chat_id,
                                      emoji,
                                      messageId: msg.uazapi_message_id,
                                    },
                                  })
                                  if (proxyError || proxyData?.success === false) {
                                    toast.error('Erro ao enviar reação: ' + (proxyData?.error || proxyError?.message || 'falha'))
                                    return
                                  }
                                  toast.success(`Reação ${emoji} enviada!`)
                                }
                              } catch {
                                toast.error('Erro ao enviar reação')
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded-full transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleReply} className="gap-2">
                        <Reply className="w-4 h-4" /> Responder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content)
                          toast.success('Texto copiado!')
                        }}
                        className="gap-2"
                      >
                        <Copy className="w-4 h-4" /> Copiar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setForwardingMessage(msg)}
                        className="gap-2"
                      >
                        <Forward className="w-4 h-4" /> Encaminhar
                      </DropdownMenuItem>
                      {canTrainAI && isAI && msg.agent_id && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => aiFeedback.quickFeedback.mutate({
                              messageId: msg.id,
                              agentId: msg.agent_id!,
                              conversationId: conversation!.id,
                              content: msg.content,
                              helpful: true,
                            })}
                            className="gap-2 text-emerald-600"
                          >
                            <ThumbsUp className="w-4 h-4" /> Resposta útil
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => aiFeedback.quickFeedback.mutate({
                              messageId: msg.id,
                              agentId: msg.agent_id!,
                              conversationId: conversation!.id,
                              content: msg.content,
                              helpful: false,
                            })}
                            className="gap-2 text-red-500"
                          >
                            <ThumbsDown className="w-4 h-4" /> Resposta ruim
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setFeedbackMsg({
                              id: msg.id,
                              content: msg.content,
                              agent_id: msg.agent_id!,
                              conversation_id: conversation!.id,
                            })}
                            className="gap-2 text-cyan-600"
                          >
                            <Pencil className="w-4 h-4" /> Melhorar resposta
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {!isUser && (() => {
                  const outboundName = isViaWhatsApp
                    ? 'WhatsApp'
                    : isAI
                      ? (msgAny.ai_agents ? (msgAny.ai_agents as { name: string }).name : 'Assistente IA')
                      : (msg.user_id && agentNameMap.get(msg.user_id)) || 'Atendente'
                  const initials = isViaWhatsApp
                    ? 'WA'
                    : outboundName.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'A'
                  return (
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 font-bold text-xs",
                      isAI
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                        : isViaWhatsApp
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : getInitialsColor(outboundName)
                    )}>
                      {isAI ? <Sparkles className="w-3.5 h-3.5" /> : initials}
                    </div>
                  )
                })()}
              </div>
              </React.Fragment>
            )
          })
          })()}

          {/* Notas internas agora são renderizadas inline com as mensagens na ordem cronológica */}

          {/* Typing indicator - show when AI is processing OR when remote user is typing */}
          {(conversation?.handler_type === 'ai' || remoteIsTyping) && (
            <div className="flex items-center gap-2 px-2 py-1 message-bubble">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {remoteIsTyping ? (
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                {remoteIsTyping ? (
                  <span className="text-xs text-muted-foreground italic">digitando...</span>
                ) : (
                  <>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </>
                )}
              </div>
            </div>
          )}
          {/* CTA Iniciar Atendimento inline removido — existe no banner acima */}
          {/* Infinite scroll sentinel — load newer messages */}
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          )}
          <div ref={sentinelRef} className="h-1" />
          <div ref={scrollRef} />
        </div>
        {/* Floating scroll-to-bottom button */}
        {showScrollToBottom && (
          <button
            onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-20 right-6 z-10 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors"
            style={{ background: '#10293F', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a3d5c')}
            onMouseLeave={e => (e.currentTarget.style.background = '#10293F')}
            aria-label="Ir para mensagens mais recentes"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </ScrollArea>

      {/* Fullscreen image lightbox */}
      {lightboxState && (
        <ChatLightbox
          images={lightboxState.images}
          index={lightboxState.index}
          onClose={() => setLightboxState(null)}
          onNavigate={(newIndex) => setLightboxState(prev => prev ? { ...prev, index: newIndex } : null)}
        />
      )}





      {/* Media Preview */}
      {pendingMedia && (
        <div className="px-4 py-2 border-t border-border bg-card/50 flex items-center gap-3 shrink-0">
          {pendingMedia.type === 'image' && pendingMedia.previewUrl ? (
            <img src={pendingMedia.previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-border" />
          ) : pendingMedia.type === 'video' && pendingMedia.previewUrl ? (
            <video src={pendingMedia.previewUrl} className="w-16 h-16 object-cover rounded-lg border border-border" />
          ) : (pendingMedia.type === 'ptt' || pendingMedia.type === 'audio') && pendingMedia.previewUrl ? (
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary shrink-0" />
              <audio src={pendingMedia.previewUrl} controls className="h-8 max-w-[200px]" preload="metadata" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-secondary rounded-lg border border-border flex items-center justify-center">
              {pendingMedia.type === 'document' ? <FileText className="w-6 h-6 text-muted-foreground" /> :
                <ImageIcon className="w-6 h-6 text-muted-foreground" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{pendingMedia.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(pendingMedia.file.size / 1024).toFixed(0)} KB • {pendingMedia.type === 'ptt' ? 'áudio' : pendingMedia.type}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { URL.revokeObjectURL(pendingMedia.previewUrl); setPendingMedia(null) }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <div className="px-4 py-2 border-t border-border bg-card/80 flex items-center gap-3 shrink-0">
          <div className="flex-1 pl-3 border-l-2 border-primary rounded-r-md bg-primary/5 py-1.5 pr-2">
            <p className="text-xs font-semibold text-primary flex items-center gap-1">
              <CornerDownRight className="w-3 h-3" />
              {replyingTo.senderName || (replyingTo.role === 'user' ? 'Cliente' : 'Atendente')}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1">{replyingTo.mediaType === 'audio' || replyingTo.mediaType === 'ptt' ? '🎤 Áudio' : replyingTo.content.substring(0, 120)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Client required banner */}
      {inputDisabled && (
        <div className="shrink-0 px-4 py-2 border-t border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 flex items-center gap-3">
          <UserIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
            Vincule ou cadastre um cliente para iniciar o atendimento.
          </p>
          {onOpenClienteTab && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              onClick={onOpenClienteTab}
            >
              <UserIcon className="w-3 h-3 mr-1" />
              Vincular Cliente
            </Button>
          )}
        </div>
      )}

      {/* Meta 24h window closed — show template composer instead */}
      {isMetaWhatsAppConversation && !metaWindow.isOpen && (
        <WindowClosedComposer
          onSwitchToUazapi={() => setShowSwitchToUazapi(true)}
          instanceId={(conversation as Record<string, unknown>)?.channel_instance_id as string}
          recipient={(conversation as Record<string, unknown>)?.customer_phone as string || (conversation as Record<string, unknown>)?.channel_chat_id as string}
        />
      )}

      {/* Input */}
      <div className={cn("shrink-0 px-3 pb-2 pt-1.5 relative", (isInputBlocked || inputDisabled || (isMetaWhatsAppConversation && !metaWindow.isOpen)) && "pointer-events-none opacity-50")}>
        {isInputBlocked && !inputDisabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-2xl">
            <p className="text-sm font-medium text-muted-foreground">
              {isReadOnly ? 'Atendimento concluído — nenhuma alteração permitida' : 'Use o botão "Iniciar Atendimento" acima para responder'}
            </p>
          </div>
        )}
        {isRecording ? (
          <div className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-2xl">
            <Button variant="ghost" size="icon" onClick={cancelRecording} className="text-destructive">
              <X className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">Gravando {formatTime(recordingTime)}</span>
            </div>
            <Button size="icon" onClick={stopRecording} className="bg-primary hover:bg-primary-dark rounded-2xl h-11 w-11 shadow-lg shadow-primary/20 transition-transform hover:scale-105">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className={cn("w-full bg-card border rounded-2xl focus-within:ring-4 focus-within:ring-primary/5 transition-all", composerMode === 'note' ? 'border-amber-400 focus-within:border-amber-400' : 'border-border focus-within:border-primary')}>
            {/* Composer Mode Tabs */}
            <div className="flex items-center border-b border-secondary rounded-t-2xl overflow-hidden">
              <button
                onClick={() => setComposerMode('message')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2",
                  composerMode === 'message'
                    ? "border-primary text-primary bg-secondary/50"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                )}
              >
                <Send className="w-3.5 h-3.5" />
                Mensagem
              </button>
              <button
                onClick={() => setComposerMode('note')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2",
                  composerMode === 'note'
                    ? "border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                )}
              >
                <StickyNote className="w-3.5 h-3.5" />
                Nota Interna
              </button>
              <div className="flex-1" />
              {/* Macro Picker Button */}
              <Popover open={macroPickerOpen} onOpenChange={setMacroPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 mr-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                    title="Mensagens padronizadas (Macros)"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Macros</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-[320px] p-0">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={macroSearch}
                        onChange={(e) => setMacroSearch(e.target.value)}
                        placeholder="Buscar macro..."
                        className="w-full h-8 pl-8 pr-3 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    {macrosList?.filter(m =>
                      !macroSearch || m.name?.toLowerCase().includes(macroSearch.toLowerCase()) || m.message?.toLowerCase().includes(macroSearch.toLowerCase())
                    ).map(macro => (
                      <button
                        key={macro.id}
                        onClick={() => macro.message && handleInsertMacro(macro.message)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: macro.color || '#45E5E5' }}
                          />
                          <span className="text-sm font-medium text-foreground truncate">{macro.name}</span>
                        </div>
                        {macro.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 pl-4">{macro.message}</p>
                        )}
                      </button>
                    )) || []}
                    {macrosList?.filter(m =>
                      !macroSearch || m.name?.toLowerCase().includes(macroSearch.toLowerCase()) || m.message?.toLowerCase().includes(macroSearch.toLowerCase())
                    ).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhuma macro encontrada</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Note mode warning banner */}
            {composerMode === 'note' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
                <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Nota interna — visível apenas para o time de atendimento
                </span>
              </div>
            )}

            {/* Toolbar — only for message mode */}
            {composerMode === 'message' && (
            <div className="flex items-center gap-1 px-3 py-2.5 border-b border-secondary bg-secondary/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
                title="Negrito (Ctrl+B)"
                onClick={() => {
                  const ta = textareaRef.current
                  if (!ta) return
                  const start = ta.selectionStart
                  const end = ta.selectionEnd
                  const selected = pendingMessage.substring(start, end)
                  if (selected) {
                    const newMsg = pendingMessage.substring(0, start) + `*${selected}*` + pendingMessage.substring(end)
                    onPendingMessageChange(newMsg)
                  }
                }}
              >
                <span className="font-bold text-sm">B</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
                title="Itálico (Ctrl+I)"
                onClick={() => {
                  const ta = textareaRef.current
                  if (!ta) return
                  const start = ta.selectionStart
                  const end = ta.selectionEnd
                  const selected = pendingMessage.substring(start, end)
                  if (selected) {
                    const newMsg = pendingMessage.substring(0, start) + `_${selected}_` + pendingMessage.substring(end)
                    onPendingMessageChange(newMsg)
                  }
                }}
              >
                <span className="italic text-sm">I</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
                title="Lista"
                onClick={() => {
                  onPendingMessageChange(pendingMessage + '\n• ')
                  textareaRef.current?.focus()
                }}
              >
                <span className="text-sm">☰</span>
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              {onOpenCockpit && (
                <>
                  <div className="flex-1" />
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          className="h-7 px-2.5 gap-1 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                          disabled={isGenerating}
                          onClick={() => {
                            setIsGenerating(true)
                            setHasGenerated(false)
                            onRequestSuggestion('generate')
                          }}
                        >
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          <span className="hidden sm:inline">{isGenerating ? 'Gerando...' : 'Gerar'}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Gerar resposta com IA direto no campo de texto</TooltipContent>
                    </Tooltip>
                    {hasGenerated && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 gap-1 rounded-full text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
                            disabled={isGenerating}
                            onClick={() => {
                              setIsGenerating(true)
                              setHasGenerated(false)
                              onRequestSuggestion('generate')
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span className="hidden sm:inline">Gerar novamente</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Gerar outra resposta com IA</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 gap-1 rounded-full text-xs font-bold border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          onClick={() => setContextModalOpen(true)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span className="hidden sm:inline">Contexto</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Gerar com contexto e tom de voz</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 gap-1 rounded-full text-xs font-bold border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
                          disabled={!pendingMessage.trim() || isGenerating}
                          onClick={() => {
                            setIsGenerating(true)
                            setHasGenerated(false)
                            onRequestSuggestion('improve', pendingMessage)
                          }}
                        >
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          <span className="hidden sm:inline">{isGenerating ? 'Melhorando...' : 'Melhorar'}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Melhorar texto digitado com IA</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
            )}

            {/* Drag handle for textarea resize */}
            <div
              className="h-1 cursor-ns-resize hover:bg-primary/20 active:bg-primary/30 transition-colors mx-3 rounded-full"
              onMouseDown={(e) => {
                e.preventDefault()
                dragStartY.current = e.clientY
                dragStartHeight.current = textareaHeight
                setIsDraggingResize(true)
              }}
              title="Arraste para redimensionar"
            />

            {/* Textarea row */}
            {composerMode === 'message' ? (
            <div className="px-4 py-2 relative">
              <textarea
                ref={textareaRef}
                value={pendingMessage}
                onChange={(e) => onPendingMessageChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={replyingTo ? "Escreva sua resposta..." : pendingMedia ? "Adicione uma legenda..." : `Responda para ${conversation?.customer_name?.split(' ')[0] || 'cliente'}...`}
                className="w-full bg-transparent border-none px-1 py-1.5 text-sm resize-none focus:outline-none placeholder:text-muted-foreground"
                style={{ height: `${textareaHeight}px`, scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-3 h-6 w-6 text-muted-foreground hover:text-foreground rounded opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => {
                  const newHeight = textareaHeight > 100 ? 60 : 200
                  setTextareaHeight(newHeight)
                  localStorage.setItem('chatInputHeight', String(newHeight))
                }}
                title={textareaHeight > 100 ? "Reduzir campo" : "Expandir campo"}
              >
                {textareaHeight > 100 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
            ) : (
            <div className="px-4 py-2 relative">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendNote()
                  }
                }}
                placeholder="Digite uma nota interna (visível apenas para a equipe)..."
                className="w-full bg-transparent border-none px-1 py-1.5 text-sm resize-none focus:outline-none placeholder:text-amber-500/60"
                style={{ height: `${textareaHeight}px`, scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-3 h-6 w-6 text-muted-foreground hover:text-foreground rounded opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => {
                  const newHeight = textareaHeight > 100 ? 60 : 200
                  setTextareaHeight(newHeight)
                  localStorage.setItem('chatInputHeight', String(newHeight))
                }}
                title={textareaHeight > 100 ? "Reduzir campo" : "Expandir campo"}
              >
                {textareaHeight > 100 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
            )}


            {/* Action buttons row */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
              {composerMode === 'message' ? (
              <>
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg" title="Emojis">
                      <Smile className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-[340px] p-0">
                    <EmojiPickerGrid onSelect={(emoji) => {
                      onPendingMessageChange(pendingMessage + emoji)
                      textareaRef.current?.focus()
                    }} />
                  </PopoverContent>
                </Popover>
                {isWhatsAppConversation && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                      onChange={handleFileSelect}
                    />
                  </>
                )}
                {!pendingMessage.trim() && !pendingMedia && isWhatsAppConversation ? (
                  <Button
                    onClick={startRecording}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                    title="Gravar áudio"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
              <Button
                onClick={handleSend}
                disabled={sending || isInputBlocked || (!pendingMessage.trim() && !pendingMedia)}
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-transform hover:scale-105 gap-2"
              >
                Enviar
                <Send className="w-4 h-4" />
              </Button>
              </>
              ) : (
              <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <StickyNote className="w-3 h-3" />
                  {ticketNotes.length} nota{ticketNotes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Button
                onClick={handleSendNote}
                disabled={!noteText.trim() || addTicketNote.isPending}
                className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-transform hover:scale-105 gap-2"
              >
                {addTicketNote.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                Salvar Nota
              </Button>
              </>
              )}
            </div>


          </div>
        )}
      </div>
    </div>
      {/* Context Modal */}
      <Dialog open={contextModalOpen} onOpenChange={setContextModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              Gerar com Contexto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contexto / Instruções</Label>
              <Textarea
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                placeholder="Ex: cliente perguntou sobre valores do plano premium, responda com os preços atuais..."
                rows={3}
                className="resize-none text-sm"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de mensagem</Label>
                <Select value={contextMessageType} onValueChange={setContextMessageType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resposta">Resposta</SelectItem>
                    <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="encerramento">Encerramento</SelectItem>
                    <SelectItem value="suporte">Suporte técnico</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tom de voz</Label>
                <Select value={contextTone} onValueChange={setContextTone}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="amigavel">Amigável</SelectItem>
                    <SelectItem value="informal">Informal</SelectItem>
                    <SelectItem value="empatico">Empático</SelectItem>
                    <SelectItem value="direto">Direto e objetivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setContextModalOpen(false); setContextInput('') }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!contextInput.trim() || isGenerating}
                className="gap-1.5"
                onClick={() => {
                  const fullContext = `[Tipo: ${contextMessageType}] [Tom: ${contextTone}] ${contextInput.trim()}`
                  setIsGenerating(true)
                  setHasGenerated(false)
                  onRequestSuggestion('context', fullContext)
                  setContextModalOpen(false)
                  setContextInput('')
                }}
              >
                {isGenerating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Gerar mensagem</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ForwardMessageDialog
        open={!!forwardingMessage}
        onOpenChange={(open) => !open && setForwardingMessage(null)}
        message={forwardingMessage}
        instanceId={uazapiChatInfo?.instance_id || undefined}
      />
      <AIFeedbackDialog
        open={!!feedbackMsg}
        onOpenChange={(open) => !open && setFeedbackMsg(null)}
        message={feedbackMsg}
      />
      {isAdmin && conversation && (
        <DeleteConversationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          conversation={conversation}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
            onConversationDeleted?.()
          }}
        />
      )}
      {isAdmin && conversation && (
        <DiscardTicketDialog
          open={discardDialogOpen}
          onOpenChange={setDiscardDialogOpen}
          ticketNumber={conversation.ticket_number ?? undefined}
          onConfirm={async (reason) => {
            await supabase.from('ai_conversations').update({
              is_discarded: true,
              discarded_at: new Date().toISOString(),
              discard_reason: reason,
              discarded_by: user?.email || 'admin',
            }).eq('id', conversation.id)
            queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
            toast('Ticket descartado — excluído das estatísticas')
          }}
        />
      )}
      {conversation && (
        <MergeTicketsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          conversationId={conversation.id}
          ticketNumber={conversation.ticket_number}
          helpdeskClientId={conversation.helpdesk_client_id || null}
        />
      )}
      {/* Instance Picker Dialog */}
      <Dialog open={showInstancePicker} onOpenChange={setShowInstancePicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar instância</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha qual instância usar para importar o histórico:</p>
          <div className="flex flex-col gap-2 mt-2">
            {availableInstances.map((inst) => (
              <Button
                key={inst.id}
                variant="outline"
                className="justify-start gap-3 h-auto py-3"
                onClick={() => {
                  if (pendingImportConversation) {
                    handleImportWithInstance(inst.id, pendingImportConversation)
                  }
                }}
              >
                <Smartphone className="w-4 h-4 shrink-0 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium">{inst.instance_name}</p>
                  {inst.phone_number && (
                    <p className="text-xs text-muted-foreground">{inst.phone_number}</p>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <SwitchToUazapiDialog
        open={showSwitchToUazapi}
        onOpenChange={setShowSwitchToUazapi}
        metaConversationId={conversation?.id || ''}
        customerPhone={(conversation as any)?.customer_phone || ''}
        customerName={conversation?.customer_name || ''}
        onSwitched={(convId) => {
          window.location.href = `/inbox?conversation=${convId}`
        }}
      />
    </>
  )
}