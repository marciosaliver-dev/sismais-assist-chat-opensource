import { useState, useCallback, useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useHumanAgents } from '@/hooks/useHumanAgents'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { triggerStageAutomations } from '@/utils/stageAutomationExecutor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Brain, Smile, Meh, Frown, AlertTriangle, CheckCircle2,
  HelpCircle, BarChart3, History, Wand2, Clock, Zap,
  AlertCircle, Ticket, User, Search, Plus, StickyNote,
  Building2, Mail, Phone, FileText, RefreshCw, Loader2,
  ExternalLink, Forward, MessageSquare, Bot, Tag, X, Sparkles, Send, Pencil,
  Columns3, CircleDot, ArrowRightLeft, Info, Play, Heart, ClipboardList,
  Lock, ChevronDown, ChevronRight, ChevronLeft, Mic, Image, Activity, GitBranch,
  ChevronsUp, Minus, ChevronsDown, Timer, Tag as LabelIcon, Lightbulb
} from 'lucide-react'
import { ReasoningTab } from '@/components/inbox/ReasoningTab'
import AILogsTab from '@/components/conversation/AILogsTab'
import TicketDescriptionForm from '@/components/tickets/TicketDescriptionForm'
import { TicketTramitacaoTab } from '@/components/tickets/TicketTramitacaoTab'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ForwardContactDialog } from '@/components/inbox/ForwardContactDialog'
import { cn } from '@/lib/utils'
import { useWaitTimer, formatHHMMSS } from '@/hooks/useWaitTimer'
import { useSLAConfig } from '@/hooks/useSLAConfig'
import { useCSATConfig } from '@/hooks/useCSATConfig'
import { useCSATBoardConfig } from '@/hooks/useCSATBoardConfig'
import { useTicketNotes, type TicketNote } from '@/hooks/useTicketNotes'
import { ClienteTab } from '@/components/inbox/ClienteTab'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { Json } from '@/integrations/supabase/types'

interface AIAnalysisPanelProps {
  conversationId: string
  currentAgentId?: string
  activeTabOverride?: TabValue
  onUseSuggestion?: (text: string) => void
  onSendDirect?: (text: string) => void
  onClose?: () => void
  /** Render as inline flex column instead of absolute overlay */
  inline?: boolean
}

type TabValue = 'analysis' | 'cockpit' | 'reasoning' | 'ticket' | 'cliente' | 'metricas' | 'historico' | 'ia_logs' | 'tramitacao'

// Helper: format seconds to human readable
function formatSeconds(s: number | null | undefined): string {
  if (!s || s <= 0) return '—'
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

const satisfactionConfig = {
  satisfied: { icon: Smile, label: 'Satisfeito', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', barColor: 'bg-emerald-500', desc: 'Cliente demonstra satisfação com o atendimento.' },
  neutral: { icon: Meh, label: 'Neutro', color: 'text-amber-600 bg-amber-50 border-amber-200', barColor: 'bg-amber-500', desc: 'Cliente está neutro, sem sinais claros de satisfação ou insatisfação.' },
  frustrated: { icon: Frown, label: 'Frustrado', color: 'text-orange-600 bg-orange-50 border-orange-200', barColor: 'bg-orange-500', desc: 'Cliente demonstra sinais de frustração. Recomenda-se atenção redobrada.' },
  angry: { icon: AlertTriangle, label: 'Insatisfeito', color: 'text-destructive bg-destructive/10 border-destructive/30', barColor: 'bg-destructive', desc: 'Cliente está insatisfeito. Priorize resolução imediata.' },
}

const sentimentConfig = {
  positive: { label: 'Positivo', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  neutral: { label: 'Neutro', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  negative: { label: 'Negativo', color: 'text-destructive bg-destructive/10 border-destructive/30' },
}

const urgencyConfig = {
  low: { label: 'Baixa', color: 'text-muted-foreground bg-muted border-border', desc: 'Sem urgência.' },
  medium: { label: 'Média', color: 'text-primary bg-primary/10 border-primary/30', desc: 'Prioridade moderada.' },
  high: { label: 'Alta', color: 'text-orange-600 bg-orange-50 border-orange-200', desc: 'Requer atenção prioritária.' },
  critical: { label: 'Crítica', color: 'text-destructive bg-destructive/10 border-destructive/30', desc: 'Urgência máxima!' },
}

const kanbanLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  active: { label: 'Em Atendimento', color: 'text-primary bg-primary/10 border-primary/30' },
  in_progress: { label: 'Em Atendimento', color: 'text-primary bg-primary/10 border-primary/30' },
  waiting: { label: 'Aguardando Cliente', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  waiting_customer: { label: 'Aguardando Cliente', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  waiting_internal: { label: 'Aguardando Interno', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  resolved: { label: 'Resolvido', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  escalated: { label: 'Escalado', color: 'text-destructive bg-destructive/10 border-destructive/30' },
  awaiting_csat: { label: 'Aguardando CSAT', color: 'text-amber-600 bg-amber-50 border-amber-200' },
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground bg-muted border-border' },
  medium: { label: 'Média', color: 'text-primary bg-primary/10 border-primary/30' },
  high: { label: 'Alta', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  critical: { label: 'Crítica', color: 'text-destructive bg-destructive/10 border-destructive/30' },
  urgent: { label: 'Urgente', color: 'text-destructive bg-destructive/10 border-destructive/30' },
}

const dbStatusMap: Record<string, string> = {
  novo: 'novo',
  em_andamento: 'em_andamento',
  aguardando_cliente: 'aguardando_cliente',
  aguardando_interno: 'aguardando_interno',
  escalado: 'escalado',
  resolvido: 'resolvido',
  fechado: 'fechado',
}

export function AIAnalysisPanel({ conversationId, currentAgentId, activeTabOverride, onUseSuggestion, onSendDirect, onClose, inline }: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('cockpit')
  const [cockpitTrigger, setCockpitTrigger] = useState(0)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const handleTabClick = (tab: TabValue) => {
    if (activeTab === tab && isPanelOpen) {
      setIsPanelOpen(false)
    } else {
      setActiveTab(tab)
      setIsPanelOpen(true)
    }
  }

  // When parent signals to open a specific tab, switch to it
  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride)
      setIsPanelOpen(true)
      if (activeTabOverride === 'cockpit') {
        setCockpitTrigger(prev => prev + 1)
      }
    }
  }, [activeTabOverride])

  // Fetch custom billing message template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbConfig = supabase as any
  const { data: billingTemplateData } = useQuery({
    queryKey: ['platform_ai_config', 'billing_message_template'],
    queryFn: async () => {
      const { data } = await dbConfig.from('platform_ai_config').select('extra_config').eq('feature', 'billing_message_template').maybeSingle()
      return (data?.extra_config?.value as string) || undefined
    },
  })

  const tabs: { id: TabValue; icon: typeof Brain; label: string }[] = [
    { id: 'analysis', icon: Brain, label: 'Análise' },
    { id: 'cockpit', icon: Wand2, label: 'Cockpit' },
    { id: 'reasoning', icon: Lightbulb, label: 'Raciocínio' },
    { id: 'ticket', icon: Ticket, label: 'Ticket' },
    { id: 'cliente', icon: User, label: 'Cliente' },
    { id: 'metricas', icon: BarChart3, label: 'Métricas' },
    { id: 'historico', icon: History, label: 'Histórico' },
    { id: 'ia_logs', icon: Activity, label: 'IA Logs' },
    { id: 'tramitacao', icon: GitBranch, label: 'Tramitação' },
  ]

  // Realtime subscription — detect new messages and re-analyze
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`ai-analysis-rt-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['message-analysis', conversationId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])

  // Fetch real analysis data from last user messages
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
      // Use the most recent analyzed message
      const latest = data[0]
      // Calculate avg sentiment score
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
    // Realtime handles most invalidation — this is a safety net for when audio transcription completes
    refetchInterval: (query) => {
      return query.state.data === null ? 15000 : 60000
    },
  })

  // On-demand analysis trigger for conversations without sentiment data
  const queryClient = useQueryClient()
  const triggerAnalysis = useMutation({
    mutationFn: async () => {
      const { data: messages } = await supabase
        .from('ai_messages')
        .select('id, content')
        .eq('conversation_id', conversationId)
        .eq('role', 'user')
        .is('sentiment', null)
        .order('created_at', { ascending: false })
        .limit(5)
      if (!messages || messages.length === 0) throw new Error('Nenhuma mensagem encontrada para analisar')
      for (const msg of messages) {
        await supabase.functions.invoke('message-analyzer', {
          body: { conversation_id: conversationId, message_id: msg.id, content: msg.content }
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-analysis', conversationId] })
      toast.success('Análise concluída!')
    },
    onError: () => toast.error('Erro ao analisar conversa'),
  })

  // Auto-trigger analysis when panel opens and there's no analysis data yet
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (analysisData === null && conversationId && !autoTriggeredRef.current && !triggerAnalysis.isPending) {
      autoTriggeredRef.current = true
      triggerAnalysis.mutate()
    }
    if (analysisData !== null) {
      autoTriggeredRef.current = false
    }
  }, [analysisData, conversationId])

  // Derive satisfaction from sentiment
  const sentimentVal = analysisData?.sentiment || 'neutral'
  const satisfactionLevel = sentimentVal === 'positive' ? 'satisfied' : sentimentVal === 'negative' ? 'frustrated' : 'neutral'
  const satisfactionScore = sentimentVal === 'positive' ? 80 : sentimentVal === 'negative' ? 30 : 55

  const satisfaction = satisfactionConfig[satisfactionLevel]
  const SatisfactionIcon = satisfaction.icon
  const sentiment = sentimentConfig[sentimentVal]
  const urgencyVal = analysisData?.urgency || 'medium'
  const urgency = urgencyConfig[urgencyVal]

  // Fetch conversation for resolution probability + contact data
  const { data: convForAnalysis } = useQuery({
    queryKey: ['conv-analysis', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('handler_type, ai_messages_count, human_messages_count, priority, customer_name, customer_phone')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  const resolutionProbability = convForAnalysis?.handler_type === 'ai' ? 75 : 90

  // Tab groups for the vertical strip
  const tabGroups = [
    { label: 'IA',  tabs: [tabs[0], tabs[1], tabs[2]] },
    { label: 'TKT', tabs: [tabs[3], tabs[4]] },
    { label: 'REL', tabs: [tabs[5], tabs[6], tabs[7], tabs[8]] },
  ]

  return (
    <div className={cn(
      'flex flex-row',
      inline
        ? 'relative h-full'
        : 'absolute inset-y-0 right-0 pointer-events-none z-20'
    )}>

      {/* ── CONTENT PANEL (overlay or inline, expands/collapses) ── */}
      <div
        className={cn(
          'flex flex-col h-full bg-card/95 backdrop-blur-sm border-l border-border overflow-hidden transition-all duration-300',
          !inline && 'pointer-events-auto shadow-2xl',
          inline
            ? (isPanelOpen ? 'flex-1' : 'w-0')
            : (isPanelOpen ? 'w-[360px]' : 'w-0')
        )}
      >
        {/* Contact Header */}
        {convForAnalysis && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-primary-foreground",
              "bg-primary"
            )}>
              {convForAnalysis.customer_name?.[0]?.toUpperCase() || convForAnalysis.customer_phone?.[0] || 'C'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">
                {convForAnalysis.customer_name || convForAnalysis.customer_phone}
              </div>
              {convForAnalysis.customer_phone && convForAnalysis.customer_name && (
                <div className="text-xs text-muted-foreground truncate">{convForAnalysis.customer_phone}</div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsPanelOpen(false)} aria-label="Fechar painel">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {!convForAnalysis && (
          <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {tabs.find(t => t.id === activeTab)?.label || 'Painel'}
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPanelOpen(false)} aria-label="Fechar painel">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── HORIZONTAL TAB BAR ── */}
        <div className="flex overflow-x-auto border-b border-border shrink-0 bg-card scrollbar-hide">
          {tabs.map((tab) => {
            const TabIcon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-2 shrink-0 border-b-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45E5E5]',
                  isActive
                    ? 'border-[#45E5E5] text-[#10293F] dark:text-cyan-400 bg-[#45E5E5]/10'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <TabIcon className="w-4 h-4" />
                <span className="text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
        {/* ─── ANÁLISE ─── */}
        {activeTab === 'analysis' && (
          <div className="p-4 space-y-4" key="analysis">
            <ConversationSummarySection conversationId={conversationId} />
            {!analysisData && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Análise IA indisponível</span>
                </div>
                <p className="text-[12px] text-amber-700 dark:text-amber-400">
                  As mensagens desta conversa ainda não foram analisadas. Clique abaixo para gerar a análise agora.
                </p>
                <Button
                  size="sm"
                  onClick={() => triggerAnalysis.mutate()}
                  disabled={triggerAnalysis.isPending}
                  className="h-8 text-xs bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
                >
                  {triggerAnalysis.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Analisando...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Analisar agora</>
                  )}
                </Button>
              </div>
            )}
            <Section title="Nível de Satisfação">
              <div className="bg-secondary rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SatisfactionIcon className={cn('w-5 h-5', satisfaction.color.split(' ')[0])} />
                    <span className="text-sm font-semibold text-foreground">{satisfaction.label}</span>
                  </div>
                  <Badge className={cn('text-xs font-bold border', satisfaction.color)}>
                    {satisfactionScore}%
                  </Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', satisfaction.barColor)} style={{ width: `${satisfactionScore}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{satisfaction.desc}</p>
              </div>
            </Section>

            <Section title="Probabilidade de Resolução">
              <div className="bg-secondary rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-display font-bold text-primary">{resolutionProbability}%</span>
                  <div className="flex-1"><Progress value={resolutionProbability} className="h-2" /></div>
                </div>
                <p className="text-xs text-muted-foreground">Chance de resolver sem escalar para humano</p>
              </div>
            </Section>

            <Section title="Sentimento da Conversa">
              <div className="bg-secondary rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={cn('text-xs font-bold border', sentiment.color)}>{sentiment.label}</Badge>
                  <span className="text-xs font-semibold text-muted-foreground">{analysisData?.sentimentScore ?? 55}/100</span>
                </div>
                <Progress value={analysisData?.sentimentScore ?? 55} className="h-2" />
                <p className="text-xs text-muted-foreground">Análise do tom e emoção das mensagens</p>
              </div>
            </Section>

            {analysisData?.intent && (
              <Section title="Intenção Detectada">
                <div className="bg-secondary rounded-2xl p-4">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {analysisData.intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Badge>
                </div>
              </Section>
            )}

            <Section title="Urgência">
              <div className="bg-secondary rounded-2xl p-4 space-y-3">
                <Badge className={cn('text-xs font-bold border px-3 py-1', urgency.color)}>{urgency.label}</Badge>
                <p className="text-xs text-muted-foreground">{urgency.desc}</p>
              </div>
            </Section>

            <TranscriptionsSection conversationId={conversationId} />
          </div>
        )}

        {/* ─── COCKPIT ─── */}
        {activeTab === 'cockpit' && (
          <CockpitTab conversationId={conversationId} onUseSuggestion={onUseSuggestion} autoFetchTrigger={cockpitTrigger} />
        )}

        {/* ─── RACIOCÍNIO ─── */}
        {activeTab === 'reasoning' && (
          <ReasoningTab conversationId={conversationId} />
        )}

        {/* ─── TICKET ─── */}
        {activeTab === 'ticket' && (
          <TicketTab conversationId={conversationId} onUseSuggestion={onUseSuggestion} onSendDirect={onSendDirect} billingTemplate={billingTemplateData} />
        )}

        {/* ─── CLIENTE ─── */}
        {activeTab === 'cliente' && (
          <ClienteTab conversationId={conversationId} conversationName={convForAnalysis?.customer_name ?? undefined} conversationPhone={convForAnalysis?.customer_phone ?? undefined} />
        )}

        {/* ─── MÉTRICAS ─── */}
         {activeTab === 'metricas' && (
          <MetricasTab conversationId={conversationId} />
        )}

        {/* ─── HISTÓRICO ─── */}
        {activeTab === 'historico' && (
          <HistoricoTab conversationId={conversationId} />
        )}
        {activeTab === 'ia_logs' && (
          <AILogsTab conversationId={conversationId} />
        )}
        {activeTab === 'tramitacao' && (
          <TicketTramitacaoTab conversationId={conversationId} />
        )}
      </ScrollArea>
      </div>{/* end content panel */}

      {/* ── VERTICAL ICON STRIP ── */}
      <div
        className={cn(
          'w-12 shrink-0 bg-[#10293F] flex flex-col border-l border-[#1e3f5a]',
          !inline && 'pointer-events-auto'
        )}
        role="tablist"
        aria-label="Abas do painel"
      >
        {tabGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="mx-2 h-px bg-white/10" />}
            <div className="px-1 pt-3 pb-1">
              <p className="text-center text-[7px] font-bold uppercase tracking-widest text-white/35 mb-1 leading-none">
                {group.label}
              </p>
              {group.tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id && isPanelOpen
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={tab.label}
                    title={tab.label}
                    onClick={() => handleTabClick(tab.id)}
                    className={cn(
                      'w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg mb-0.5 transition-all',
                      isActive
                        ? 'bg-[#45E5E5] text-[#10293F]'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>{/* end strip */}

    </div>
  )
}

/* ══════════════════════════════════════════════════
   BILLING MESSAGE HELPERS
   ══════════════════════════════════════════════════ */

interface BillingData {
  nome: string
  valor: string
  vencimento: string
  plano: string
}

function extractBillingData(html: string): BillingData | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Extract from table cells — billing notes use <td> pairs (label + value)
    const cells = Array.from(doc.querySelectorAll('td'))
    let nome = '', valor = '', vencimento = '', plano = ''

    for (let i = 0; i < cells.length - 1; i++) {
      const label = cells[i].textContent?.trim().toLowerCase() || ''
      const value = cells[i + 1].textContent?.trim() || ''
      if (label.includes('cliente') || label.includes('nome')) nome = value
      if (label.includes('valor') || label.includes('total')) valor = value
      if (label.includes('vencimento') || label.includes('data')) vencimento = value
      if (label.includes('plano') || label.includes('produto') || label.includes('descrição')) plano = value
    }

    // Fallback: extract value from <mark> tag
    if (!valor) {
      const mark = doc.querySelector('mark')
      if (mark) valor = mark.textContent?.trim() || ''
    }

    if (!nome && !valor) return null
    return { nome: nome || 'Cliente', valor: valor || '—', vencimento: vencimento || '—', plano: plano || '—' }
  } catch {
    return null
  }
}

const DEFAULT_BILLING_TEMPLATE = `Olá, {nome}! Tudo bem? 😊

Identificamos uma pendência referente ao plano *{plano}* no valor de *{valor}*, com vencimento em *{vencimento}*.

Gostaríamos de verificar se houve algum problema com o pagamento. Podemos ajudá-lo(a) a regularizar essa situação?

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Ficamos à disposição! 🙏`

function buildBillingMessage(data: BillingData, template?: string): string {
  const tpl = template || DEFAULT_BILLING_TEMPLATE
  return tpl
    .replace(/{nome}/g, data.nome)
    .replace(/{plano}/g, data.plano)
    .replace(/{valor}/g, data.valor)
    .replace(/{vencimento}/g, data.vencimento)
}

/* ══════════════════════════════════════════════════
   TICKET TAB - Status, Notes, Related Tickets
   ══════════════════════════════════════════════════ */

function TicketTab({ conversationId, onUseSuggestion, onSendDirect, billingTemplate }: { conversationId: string; onUseSuggestion?: (text: string) => void; onSendDirect?: (text: string) => void; billingTemplate?: string }) {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'admin'
  const [noteText, setNoteText] = useState('')
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const { notes, isLoading: notesLoading, addNote } = useTicketNotes(conversationId || undefined)

  // Fetch conversation details
  const { data: conversation } = useQuery({
    queryKey: ['ticket-detail', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, status, priority, customer_name, customer_phone, customer_email, uazapi_chat_id, tags, handler_type, started_at, resolved_at, resolution_time_seconds, current_agent_id, human_agent_id, ticket_category_id, ticket_module_id, ticket_status_id, kanban_board_id, kanban_stage_id, stage_id, context, ai_agents(name), human_agents(name)')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  // Fetch categories from ticket_categories
  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_categories').select('*').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Fetch modules from ticket_modules
  const { data: modules = [] } = useQuery({
    queryKey: ['ticket-modules-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_modules').select('*').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Fetch statuses from ticket_statuses
  const { data: statuses = [] } = useQuery({
    queryKey: ['ticket-statuses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_statuses').select('*').eq('active', true).order('sort_order')
      return data || []
    },
  })

  // Fetch kanban boards
  const { data: kanbanBoards = [] } = useKanbanBoards()

  // Fetch kanban stages for current board
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

  const [expandedInsight, setExpandedInsight] = useState<string | null>('churn')
  const [showStageSelector, setShowStageSelector] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [newPhone, setNewPhone] = useState('')

  // Fetch suggested agent (online, lowest load)
  const { data: suggestedAgent } = useQuery({
    queryKey: ['suggested-agent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('human_agents')
        .select('id, name, specialties, current_conversations_count')
        .neq('is_active', false)
        .eq('is_online', true)
        .order('current_conversations_count', { ascending: true })
        .limit(1)
      return (data?.[0] as any) || null
    },
  })

  // Fetch helpdesk client data for insights
  const { data: helpdeskClient } = useQuery({
    queryKey: ['helpdesk-client-insight', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('helpdesk_client_id')
        .eq('id', conversationId)
        .maybeSingle()
      if (!conv?.helpdesk_client_id) return null
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('*')
        .eq('id', conv.helpdesk_client_id)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  // Fetch analysis data for churn insight
  const { data: insightAnalysis } = useQuery({
    queryKey: ['insight-analysis', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_messages')
        .select('sentiment, sentiment_score, urgency')
        .eq('conversation_id', conversationId)
        .eq('role', 'user')
        .not('sentiment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)
      if (!data || data.length === 0) return { churnRisk: 15, sentiment: 'neutral' }
      const negCount = data.filter(d => d.sentiment === 'negative').length
      const highUrgency = data.filter(d => d.urgency === 'high' || d.urgency === 'critical').length
      const churnRisk = Math.min(95, Math.round((negCount / data.length) * 60 + (highUrgency / data.length) * 35 + 5))
      return { churnRisk, sentiment: data[0]?.sentiment || 'neutral' }
    },
    enabled: !!conversationId,
  })

  // Fetch stage history
  const { data: stageHistory = [] } = useQuery({
    queryKey: ['ticket-stage-history', conversationId],
    queryFn: async () => {
      if (!conversationId) return []
      const { data } = await (supabase as any)
        .from('ticket_stage_history')
        .select(`
          id, moved_at, moved_by, notes,
          from_stage:from_stage_id(name, color),
          to_stage:to_stage_id(name, color)
        `)
        .eq('conversation_id', conversationId)
        .order('moved_at', { ascending: false })
      return data || []
    },
    enabled: !!conversationId,
  })

  // Fetch contact picture for ticket tab
  const { data: ticketContactPicture } = useQuery({
    queryKey: ['ticket-contact-picture', conversation?.uazapi_chat_id],
    queryFn: async () => {
      if (!conversation?.uazapi_chat_id) return null
      const { data } = await supabase
        .from('uazapi_chats')
        .select('contact_picture_url')
        .eq('chat_id', conversation.uazapi_chat_id)
        .maybeSingle()
      return data?.contact_picture_url || null
    },
    enabled: !!conversation?.uazapi_chat_id,
  })

  // Fetch first response time
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

  // Fetch related tickets (same customer phone)
  const { data: relatedTickets = [] } = useQuery({
    queryKey: ['related-tickets', conversation?.customer_phone],
    queryFn: async () => {
      if (!conversation?.customer_phone) return []
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, ticket_number, status, priority, customer_name, started_at')
        .eq('customer_phone', conversation.customer_phone)
        .neq('id', conversationId)
        .order('started_at', { ascending: false })
        .limit(10)
      return data || []
    },
    enabled: !!conversation?.customer_phone,
  })

  // Mutation: change status (via ticket_status_id)
  const changeStatus = useMutation({
    mutationFn: async (statusId: string) => {
      const status = statuses.find(s => s.id === statusId)
      if (!status) throw new Error('Status not found')
      const { error } = await supabase
        .from('ai_conversations')
        .update({ ticket_status_id: statusId, status: status.slug })
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-status-history', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-status-history-full', conversationId] })
      toast.success('Status atualizado')
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  // Mutation: change kanban stage
  const changeStage = useMutation({
    mutationFn: async ({ toStageId }: { toStageId: string }) => {
      const fromStageId = conversation?.stage_id || conversation?.kanban_stage_id || null
      const { error } = await supabase
        .from('ai_conversations')
        .update({ stage_id: toStageId, kanban_stage_id: toStageId })
        .eq('id', conversationId)
      if (error) throw error

      // Record history
      await (supabase as any)
        .from('ticket_stage_history')
        .insert({
          conversation_id: conversationId,
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
          moved_by: 'user',
        })

      // Fire automations
      if (fromStageId && fromStageId !== toStageId) {
        triggerStageAutomations(conversationId, fromStageId, toStageId).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-status-history', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-status-history-full', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-stage-history', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
      toast.success('Etapa atualizada')
    },
    onError: () => toast.error('Erro ao mover etapa'),
  })

  // Mutation: change kanban board
  const changeBoard = useMutation({
    mutationFn: async (newBoardId: string) => {
      const fromStageId = conversation?.stage_id || conversation?.kanban_stage_id || null

      // Find entry stage of new board
      const { data: entryStages } = await (supabase as any)
        .from('kanban_stages')
        .select('id')
        .eq('board_id', newBoardId)
        .eq('active', true)
        .eq('is_entry', true)
        .limit(1)

      let toStageId = entryStages?.[0]?.id || null
      if (!toStageId) {
        // Fallback: first stage by sort_order
        const { data: firstStage } = await (supabase as any)
          .from('kanban_stages')
          .select('id')
          .eq('board_id', newBoardId)
          .eq('active', true)
          .order('sort_order')
          .limit(1)
        toStageId = firstStage?.[0]?.id || null
      }

      const { error } = await supabase
        .from('ai_conversations')
        .update({
          kanban_board_id: newBoardId,
          stage_id: toStageId,
          kanban_stage_id: toStageId,
        })
        .eq('id', conversationId)
      if (error) throw error

      // Record history
      if (toStageId) {
        await (supabase as any)
          .from('ticket_stage_history')
          .insert({
            conversation_id: conversationId,
            from_stage_id: fromStageId,
            to_stage_id: toStageId,
            moved_by: 'user',
          })
      }

      // Fire automations
      if (fromStageId && toStageId && fromStageId !== toStageId) {
        triggerStageAutomations(conversationId, fromStageId, toStageId).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-stages-for-board'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-status-history', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-status-history-full', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-stage-history', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
      toast.success('Board atualizado')
    },
    onError: () => toast.error('Erro ao mover para outro board'),
  })

  // Mutation: change category
  const changeCategory = useMutation({
    mutationFn: async (categoryId: string | null) => {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ ticket_category_id: categoryId })
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      toast.success('Categoria atualizada')
    },
    onError: () => toast.error('Erro ao atualizar categoria'),
  })

  // Mutation: change module
  const changeModule = useMutation({
    mutationFn: async (moduleId: string | null) => {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ ticket_module_id: moduleId })
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-conversation-detail', conversationId] })
      toast.success('Módulo atualizado')
    },
    onError: () => toast.error('Erro ao atualizar módulo'),
  })

  // Mutation: change priority
  const changePriority = useMutation({
    mutationFn: async (newPriority: string) => {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ priority: newPriority })
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
      toast.success('Prioridade atualizada')
    },
    onError: () => toast.error('Erro ao atualizar prioridade'),
  })

  // Mutation: update tags
  const updateTags = useMutation({
    mutationFn: async (tags: string[]) => {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ tags })
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      toast.success('Tags atualizadas')
    },
    onError: () => toast.error('Erro ao atualizar tags'),
  })

  const handleAddNote = () => {
    if (!noteText.trim()) return
    addNote.mutate(noteText.trim())
    setNoteText('')
  }

  const handleAddTag = () => {
    if (!newTag.trim()) return
    const currentTags = ((conversation as any)?.tags as string[]) || []
    if (!currentTags.includes(newTag.trim())) {
      updateTags.mutate([...currentTags, newTag.trim()])
    }
    setNewTag('')
    setAddingTag(false)
  }

  const handleRemoveTag = (tag: string) => {
    const currentTags = ((conversation as any)?.tags as string[]) || []
    updateTags.mutate(currentTags.filter(t => t !== tag))
  }

  if (!conversationId) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Selecione uma conversa</div>
  }

  const currentStatus = statuses.find(s => s.id === conversation?.ticket_status_id) || statuses.find(s => s.slug === conversation?.status) || statuses.find(s => s.is_default) || null
  const currentBoard = kanbanBoards.find(b => b.id === conversation?.kanban_board_id) || null
  const currentStage = kanbanStages.find((s: any) => s.id === (conversation?.stage_id || conversation?.kanban_stage_id)) || null
  const currentPriority = conversation?.priority || 'medium'
  const tags = ((conversation as any)?.tags as string[]) || []
  const isFinalized = conversation?.status === 'finalizado'
  const isReadOnly = isFinalized && !isAdmin


  // Stage flow helpers
  const currentStageIdx = (kanbanStages as any[]).findIndex((s) => s.id === currentStage?.id)

  return (
    <div className="space-y-0" key="ticket">
      {/* ═══ Contact Header (always visible) ═══ */}
      {conversation && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Avatar className="h-10 w-10 shrink-0">
            {ticketContactPicture ? (
              <AvatarImage src={ticketContactPicture} alt={conversation.customer_name || ''} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {(conversation.customer_name || 'C').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate">{conversation.customer_name || 'Cliente'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{conversation.customer_phone}</p>
          </div>
          <span className="text-sm font-bold text-muted-foreground">#{conversation.ticket_number}</span>
        </div>
      )}

      {/* ═══ Phone Alert Banner ═══ */}
      {conversation && (() => {
        const ctx = (conversation as any)?.context as Record<string, any> | null
        const billing = ctx?.billing as Record<string, any> | null
        const isPhoneMissing = billing?.phone_missing === true || conversation.customer_phone === 'sem-telefone'
        const isPhoneInvalid = billing?.phone_validated === false
        if (!isPhoneMissing && !isPhoneInvalid) return null
        return (
          <div className="mx-4 mt-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {isPhoneMissing ? 'Telefone ausente' : 'Número WhatsApp inválido'}
            </div>
            {editingPhone ? (
              <div className="flex gap-2">
                <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ex: 5511999998888" className="h-8 text-xs flex-1" />
                <Button size="sm" className="h-8 text-xs" disabled={!newPhone.trim()} onClick={async () => {
                  const { error } = await supabase.from('ai_conversations').update({ customer_phone: newPhone.replace(/\D/g, '') }).eq('id', conversationId)
                  if (error) { toast.error('Erro ao atualizar telefone'); return }
                  queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
                  queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
                  toast.success('Telefone atualizado!')
                  setEditingPhone(false); setNewPhone('')
                }}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditingPhone(false); setNewPhone('') }}><X className="w-3.5 h-3.5" /></Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300" onClick={() => { setEditingPhone(true); setNewPhone(conversation.customer_phone === 'sem-telefone' ? '' : conversation.customer_phone || '') }}>
                <Pencil className="w-3 h-3 mr-1" />
                {isPhoneMissing ? 'Adicionar Telefone' : 'Corrigir Telefone'}
              </Button>
            )}
          </div>
        )
      })()}

      {/* ═══ COLLAPSIBLE SECTIONS ═══ */}
      <div>
        {/* ── Classificação ── */}
        <CollapsibleSection icon={LabelIcon} iconClass="bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" label="Classificação" defaultOpen>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">Categoria</label>
              <Select value={conversation?.ticket_category_id || 'none'} onValueChange={v => changeCategory.mutate(v === 'none' ? null : v)} disabled={isReadOnly}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">Módulo</label>
              <Select value={conversation?.ticket_module_id || 'none'} onValueChange={v => changeModule.mutate(v === 'none' ? null : v)} disabled={isReadOnly}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Sem módulo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem módulo</SelectItem>
                  {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Prioridade</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { key: 'high', label: 'Alta', icon: ChevronsUp, cls: 'bg-destructive/10 border-destructive/30 text-destructive' },
              { key: 'medium', label: 'Média', icon: Minus, cls: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' },
              { key: 'low', label: 'Baixa', icon: ChevronsDown, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => !isReadOnly && changePriority.mutate(p.key)}
                disabled={isReadOnly}
                className={cn(
                  'flex items-center justify-center gap-1 py-2 rounded-lg border-[1.5px] text-xs font-semibold transition-all',
                  currentPriority === p.key ? p.cls : 'border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                <p.icon className="w-3.5 h-3.5" />
                {p.label}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── Tags ── */}
        <CollapsibleSection icon={Tag} iconClass="bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400" label="Tags" badge={tags.length > 0 ? tags.length : undefined}>
          <div className="flex flex-wrap gap-1.5 items-center">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/30 border border-purple-300/30 text-xs font-medium text-purple-700 dark:text-purple-400">
                {tag}
                {!isReadOnly && (
                  <button onClick={() => handleRemoveTag(tag)} className="text-purple-400 hover:text-destructive"><X className="w-3 h-3" /></button>
                )}
              </span>
            ))}
            {!isReadOnly && (
              addingTag ? (
                <div className="flex items-center gap-1">
                  <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Tag..." className="h-6 text-xs w-24 rounded-full px-2" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTag('') } }} />
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleAddTag}><CheckCircle2 className="w-3 h-3" /></Button>
                </div>
              ) : (
                <button onClick={() => setAddingTag(true)} className="flex items-center gap-1 px-2 py-0.5 rounded-full border-[1.5px] border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                  <Plus className="w-3 h-3" />
                  Adicionar tag
                </button>
              )
            )}
          </div>
        </CollapsibleSection>

        {/* ── Nota Interna ── */}
        <CollapsibleSection icon={StickyNote} iconClass="bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400" label="Nota Interna">
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Escreva uma nota interna (não enviada ao cliente)..."
            className="min-h-[72px] text-xs resize-none rounded-lg border-border bg-muted/50 focus:bg-card"
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote() }}
          />
          <div className="flex items-center gap-1 mt-1 mb-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            Visível apenas para a equipe, não aparece no chat do cliente
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => setNoteText('')}>Descartar</Button>
            <Button size="sm" className="flex-1 h-8 text-xs rounded-lg gap-1.5" onClick={handleAddNote} disabled={!noteText.trim() || addNote.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Salvar Nota
            </Button>
          </div>
          {notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {notes.slice().reverse().slice(0, 3).map((note, i) => {
                const isBillingNote = note.author === 'Sistema de Cobrança' && note.text?.startsWith('<')
                const billingData = isBillingNote ? extractBillingData(note.text) : null
                return (
                  <div key={i} className="bg-muted/50 rounded-lg p-2.5 space-y-1 border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{note.author}</span>
                      <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    {note.text?.startsWith('<') ? (
                      <div className="text-xs text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert overflow-hidden rounded-lg [&_table]:w-full [&_table]:border-collapse [&_td]:p-1.5 [&_td]:border [&_td]:border-border [&_td]:text-xs [&_th]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:text-xs [&_th]:font-semibold [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.text, {
                        ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'mark'],
                        ALLOWED_ATTR: ['style', 'class', 'href', 'target']
                      }) }} />
                    ) : (
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
                    )}
                    {billingData && (onUseSuggestion || onSendDirect) && (
                      <div className="mt-2 flex gap-2">
                        {onUseSuggestion && <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onUseSuggestion(buildBillingMessage(billingData, billingTemplate))}><Pencil className="w-3 h-3 mr-1" />Editar</Button>}
                        {onSendDirect && <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => onSendDirect(buildBillingMessage(billingData, billingTemplate))}><Send className="w-3 h-3 mr-1" />Enviar</Button>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Descrição Estruturada ── */}
        {conversationId && (
          <CollapsibleSection icon={FileText} iconClass="bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" label="Descrição">
            <TicketDescriptionForm conversationId={conversationId} />
          </CollapsibleSection>
        )}

        {/* ── Movimentações ── */}
        <CollapsibleSection
          icon={History}
          iconClass="bg-primary/10 text-primary"
          label="Movimentações"
          badge={stageHistory.length > 0 ? stageHistory.length : undefined}
          badgeHighlight
          defaultOpen
        >
          {stageHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma movimentação registrada</p>
          ) : (
            <div className="space-y-0">
              {(showAllHistory ? stageHistory : stageHistory.slice(0, 5)).map((entry: any) => {
                const movedByLabel: Record<string, string> = { user: 'Agente', 'board-transfer': 'Transfer. Board', automation: 'Automação', 'kanban-bulk': 'Bulk', 'kanban-drag': 'Kanban' }
                return (
                  <div key={entry.id} className="flex items-start gap-2.5 relative">
                    <div className="flex flex-col items-center pt-0.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-[1.5px] border-border bg-muted" style={{ borderColor: `${entry.to_stage?.color || '#888'}40`, backgroundColor: `${entry.to_stage?.color || '#888'}15` }}>
                        <ArrowRightLeft className="w-3 h-3" style={{ color: entry.to_stage?.color || 'var(--muted-foreground)' }} />
                      </div>
                      <div className="w-[1.5px] flex-1 bg-border mt-1" />
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-foreground">
                          Movido para <strong>{entry.to_stage?.name || '—'}</strong>
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {entry.moved_at ? formatDistanceToNow(new Date(entry.moved_at), { addSuffix: false, locale: ptBR }) : '—'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.from_stage?.name || 'início'} → {entry.to_stage?.name || '—'} · {movedByLabel[entry.moved_by] || entry.moved_by || 'Sistema'}
                      </p>
                    </div>
                  </div>
                )
              })}
              {stageHistory.length > 5 && (
                <button onClick={() => setShowAllHistory(v => !v)} className="w-full text-xs font-bold text-primary hover:text-primary/80 py-1.5 transition-colors text-center">
                  {showAllHistory ? 'Ver menos' : `Ver mais ${stageHistory.length - 5}`}
                </button>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Tempos & SLA ── */}
        <CollapsibleSection icon={Timer} iconClass="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" label="Tempos & SLA">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-muted-foreground">{firstResponseSeconds != null ? formatSeconds(firstResponseSeconds) : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">1ª Resposta</p>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary">{conversation?.resolution_time_seconds != null ? formatSeconds(conversation.resolution_time_seconds) : (conversation?.started_at ? formatSeconds(Math.round((Date.now() - new Date(conversation.started_at).getTime()) / 1000)) : '—')}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Tempo Total</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Handler ── */}
        <CollapsibleSection icon={User} iconClass="bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" label="Responsável">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {conversation?.handler_type === 'ai' ? <Bot className="w-3.5 h-3.5" /> : ((conversation as any)?.human_agents?.name?.[0]?.toUpperCase() || 'A')}
            </div>
            <span className="text-sm font-medium text-foreground truncate flex-1">
              {conversation?.handler_type === 'ai' ? (conversation as any)?.ai_agents?.name || 'Agente IA' : ((conversation as any)?.human_agents?.name || 'Agente Humano')}
            </span>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          {suggestedAgent && (
            <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-dashed border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px]">{suggestedAgent.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <p className="text-[8px] font-bold text-primary uppercase">Sugerido</p>
                  <span className="text-xs text-foreground font-semibold">{suggestedAgent.name}</span>
                </div>
              </div>
              <button className="text-[9px] bg-primary text-primary-foreground px-2 py-1 rounded-md font-bold">Trocar</button>
            </div>
          )}
        </CollapsibleSection>

        {/* ── Mover para outro Board ── */}
        <CollapsibleSection icon={Columns3} iconClass="bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400" label="Board">
          <Select value={currentBoard?.id || ''} onValueChange={v => { if (v !== currentBoard?.id) changeBoard.mutate(v) }} disabled={isReadOnly}>
            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Selecionar board..." /></SelectTrigger>
            <SelectContent>
              {kanbanBoards.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span>{b.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CollapsibleSection>

        {/* ── Outros Tickets ── */}
        {relatedTickets.length > 0 && (
          <CollapsibleSection icon={Ticket} iconClass="bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400" label="Outros Tickets" badge={relatedTickets.length} badgeHighlight>
            <div className="space-y-1.5">
              {relatedTickets.map(rt => (
                <div key={rt.id} className="flex items-center gap-2.5 p-2.5 bg-muted/50 border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
                  <span className="text-sm font-bold text-foreground">#{rt.ticket_number}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {kanbanLabels[rt.status]?.label || rt.status}
                  </span>
                  <span className="flex-1 text-xs text-muted-foreground truncate">{rt.customer_name || 'Sem título'}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {rt.started_at ? formatDistanceToNow(new Date(rt.started_at), { addSuffix: false, locale: ptBR }) : '—'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════
   COLLAPSIBLE SECTION HELPER
   ══════════════════════════════════════════════════ */

function CollapsibleSection({ icon: Icon, iconClass, label, badge, badgeHighlight, defaultOpen, children }: {
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
   MÉTRICAS TAB - Agent performance metrics
   ══════════════════════════════════════════════════ */

// Helper: map icon name string to Lucide component
function getIcon(name: string) {
  const icons: Record<string, typeof Zap> = {
    zap: Zap, heart: Heart, 'clipboard-list': ClipboardList, send: Send,
    sparkles: Sparkles, play: Play, check: CheckCircle2, bot: Bot,
    user: User, tag: Tag, forward: Forward, phone: Phone, mail: Mail,
    'refresh-cw': RefreshCw, 'alert-triangle': AlertTriangle, star: Sparkles,
  }
  return icons[name] || Zap
}

function CockpitTab({ conversationId, onUseSuggestion, autoFetchTrigger }: { conversationId: string; onUseSuggestion?: (text: string) => void; autoFetchTrigger?: number }) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [executingMacro, setExecutingMacro] = useState<string | null>(null)
  const [actions, setActions] = useState<{ id: string; title: string; description: string; confidence: number; prompt: string; priority: 'primary' | 'secondary' }[]>([])

  // Fetch macros from DB
  const { data: macros = [] } = useQuery({
    queryKey: ['macros-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('macros' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      return (data || []) as any[]
    },
  })

  // Fetch conversation for macro execution context
  const { data: convForMacro } = useQuery({
    queryKey: ['conv-macro-context', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, uazapi_chat_id, customer_phone, kanban_board_id, kanban_stage_id, tags')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  const fetchSuggestions = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('copilot-suggest', {
        body: { conversation_id: conversationId },
      })
      if (error) throw error
      if (data?.text) {
        setActions([
          {
            id: '1',
            title: 'Resposta Sugerida',
            description: data.summary || 'Sugestão baseada no contexto da conversa.',
            confidence: Math.round((data.confidence || 0.8) * 100),
            prompt: data.text,
            priority: 'primary',
          },
          ...(data.sources?.length ? [{
            id: '2',
            title: 'Fontes da Base de Conhecimento',
            description: `${data.sources.length} artigo(s) relevante(s) encontrado(s).`,
            confidence: 90,
            prompt: data.sources.map((s: { title: string }) => `• ${s.title}`).join('\n'),
            priority: 'secondary' as const,
          }] : []),
        ])
      }
    } catch (err) {
      console.error('Cockpit error:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // Trigger fetch when parent increments autoFetchTrigger
  useEffect(() => {
    if (autoFetchTrigger && autoFetchTrigger > 0) {
      fetchSuggestions()
    }
  }, [autoFetchTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Execute macro
  const executeMacro = async (macro: any) => {
    if (!convForMacro || executingMacro) return
    setExecutingMacro(macro.id)
    try {
      const actions = (macro.actions as any[]) || []
      const messageToSend = macro.message || actions.find((a: any) => a.type === 'send_message')?.message

      // Send message if exists — load into textarea for editing instead of sending directly
      if (messageToSend) {
        if (onUseSuggestion) {
          onUseSuggestion(messageToSend)
          toast.success(`Macro "${macro.name}" carregada no campo de texto — edite e envie.`)
        }
      }

      // Execute other actions
      for (const action of actions) {
        if (action.type === 'send_message') continue // already handled

        if (action.type === 'change_stage' && action.stage_id) {
          let targetStageId = action.stage_id
          // Handle special "exit" value
          if (targetStageId === 'exit' && convForMacro.kanban_board_id) {
            const { data: exitStage } = await (supabase as any)
              .from('kanban_stages')
              .select('id')
              .eq('board_id', convForMacro.kanban_board_id)
              .eq('is_exit', true)
              .eq('active', true)
              .limit(1)
            if (exitStage?.[0]) targetStageId = exitStage[0].id
            else continue
          }
          await supabase
            .from('ai_conversations')
            .update({ kanban_stage_id: targetStageId })
            .eq('id', conversationId)
        }

        if (action.type === 'add_tag' && action.tag) {
          const currentTags = (convForMacro.tags as string[]) || []
          if (!currentTags.includes(action.tag)) {
            await supabase
              .from('ai_conversations')
              .update({ tags: [...currentTags, action.tag] })
              .eq('id', conversationId)
          }
        }

        if (action.type === 'assign_agent' && action.agent_id) {
          await supabase
            .from('ai_conversations')
            .update({ human_agent_id: action.agent_id })
            .eq('id', conversationId)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
      toast.success(`Macro "${macro.name}" executada!`)
    } catch (err) {
      console.error('Macro error:', err)
      toast.error(`Erro ao executar macro "${macro.name}"`)
    } finally {
      setExecutingMacro(null)
    }
  }

  // Icon resolver
  const getIcon = (iconName: string) => {
    const icons: Record<string, typeof Zap> = {
      'zap': Zap, 'heart': Heart, 'clipboard-list': ClipboardList,
      'message-circle': MessageSquare, 'send': Send, 'check-circle': CheckCircle2,
      'play': Play, 'sparkles': Sparkles, 'bot': Bot,
    }
    return icons[iconName] || Zap
  }

  return (
    <div className="p-4 space-y-4" key="cockpit">
      {/* MACROS */}
      {macros.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Macros</span>
          </div>
          <div className="space-y-2">
            {macros.map((macro: any) => {
              const MacroIcon = getIcon(macro.icon || 'zap')
              const isExecuting = executingMacro === macro.id
              return (
                <button
                  key={macro.id}
                  onClick={() => executeMacro(macro)}
                  disabled={isExecuting}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${macro.color}20` }}>
                    {isExecuting ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: macro.color }} />
                    ) : (
                      <MacroIcon className="w-4 h-4" style={{ color: macro.color }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{macro.name}</p>
                    {macro.description && (
                      <p className="text-xs text-muted-foreground">{macro.description}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* AI SUGGESTIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Sugestões da IA</span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetchSuggestions} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
        </div>
        {loading && actions.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Clique para gerar sugestões de resposta</p>
            <Button size="sm" onClick={fetchSuggestions} className="gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Gerar Sugestões
            </Button>
          </div>
        ) : (
          actions.map((action, idx) => {
            const ActionIcon = [CheckCircle2, HelpCircle, AlertCircle][idx % 3]
            return (
              <div key={action.id} className="bg-secondary rounded-2xl p-4 space-y-3 mb-2">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ActionIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{action.title}</span>
                      {action.priority === 'primary' && (
                        <Badge className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20">Recomendado</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold shrink-0">{action.confidence}%</Badge>
                </div>
                <div className="border-l-2 border-primary/40 pl-3 py-2 bg-primary/5 rounded-r-lg">
                  <p className="text-xs italic text-muted-foreground leading-relaxed whitespace-pre-wrap">{action.prompt}</p>
                </div>
                {onUseSuggestion && action.priority === 'primary' && (
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => onUseSuggestion(action.prompt)}>
                      <Send className="w-3 h-3" />
                      Usar Resposta
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => onUseSuggestion(action.prompt)}>
                      <Pencil className="w-3 h-3" />
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function MetricasTab({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'admin'
  const { data: slaMap } = useSLAConfig()

  // Fetch ticket data
  const { data: ticket, refetch: refetchTicket } = useQuery({
    queryKey: ['metricas-ticket', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const { data } = await supabase
        .from('ai_conversations')
        .select('queue_entered_at, first_human_response_at, first_human_response_seconds, resolved_at, resolution_seconds, priority, human_agent_id, queue_position, csat_score, csat_comment, csat_rating, csat_sent_at, csat_responded_at, csat_feedback, status, started_at, customer_phone, kanban_board_id')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
    refetchInterval: 10000,
  })

  // CSAT configs - use board config if available
  const csatConfig = useCSATConfig()
  const csatBoardConfig = useCSATBoardConfig(ticket?.kanban_board_id || undefined)
  const [sendingCsat, setSendingCsat] = useState(false)

  // Check if CSAT should be available based on board config
  const csatAvailable = csatBoardConfig.config?.enabled && csatBoardConfig.config?.send_on_close

  // Fetch agent name
  const { data: agentName } = useQuery({
    queryKey: ['metricas-agent', ticket?.human_agent_id],
    queryFn: async () => {
      if (!ticket?.human_agent_id) return null
      const { data } = await supabase
        .from('human_agents')
        .select('name')
        .eq('id', ticket.human_agent_id)
        .maybeSingle()
      return data?.name || null
    },
    enabled: !!ticket?.human_agent_id,
  })

  // SLA config for ticket priority
  const sla = slaMap?.get(ticket?.priority || 'medium')

  // Timers
  const queueTimerRef = ticket?.queue_entered_at && !ticket?.first_human_response_at ? ticket.queue_entered_at : null
  const queueElapsed = useWaitTimer(queueTimerRef, 1000)

  const resolutionTimerRef = ticket?.started_at && !ticket?.resolved_at ? ticket.started_at : null
  const resolutionElapsed = useWaitTimer(resolutionTimerRef, 1000)

  // First response time
  const firstResponseSeconds = ticket?.first_human_response_seconds ?? (queueTimerRef ? queueElapsed : null)
  const firstResponseSlaMinutes = sla?.first_response_target_minutes
  const firstResponseBreached = firstResponseSlaMinutes != null && firstResponseSeconds != null && firstResponseSeconds > firstResponseSlaMinutes * 60

  // Resolution time
  const totalResolutionSeconds = ticket?.resolution_seconds ?? (resolutionTimerRef ? resolutionElapsed : null)
  const resolutionSlaMinutes = sla?.resolution_target_minutes
  const resolutionBreached = resolutionSlaMinutes != null && totalResolutionSeconds != null && totalResolutionSeconds > resolutionSlaMinutes * 60

  // SLA status
  const slaBreached = firstResponseBreached || resolutionBreached

  // CSAT
  const csatScore = ticket?.csat_score ?? (ticket?.csat_rating && ticket.csat_rating <= 5 ? ticket.csat_rating : null)
  const csatComment = ticket?.csat_comment || ticket?.csat_feedback || null
  const csatAlreadySent = !!ticket?.csat_sent_at
  const isFinalized = ticket?.status === 'finalizado'
  const isReadOnly = isFinalized && !isAdmin

  const handleSendCsat = async () => {
    if (!ticket?.customer_phone || !conversationId) return
    setSendingCsat(true)
    try {
      // Use board config message template if available, otherwise fall back to global
      const csatMessage = csatBoardConfig.config?.message_template || csatConfig.message_template

      // Use csat-processor edge function for proper CSAT handling
      if (csatBoardConfig.config?.id && csatBoardConfig.config?.enabled) {
        supabase.functions.invoke('csat-processor', {
          body: { action: 'send', conversationId, configId: csatBoardConfig.config.id }
        })
      } else {
        // Fallback to direct WhatsApp send if no board config
        await supabase.functions.invoke('whatsapp-send', {
          body: { phone: ticket.customer_phone, message: csatMessage },
        })
      }

      await supabase.from('ai_conversations').update({
        csat_sent_at: new Date().toISOString(),
        status: 'aguardando_cliente',
      } as any).eq('id', conversationId)

      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: '📊 Pesquisa de satisfação enviada ao cliente',
      })

      toast.success('Pesquisa CSAT enviada!')
      refetchTicket()
    } catch (err) {
      toast.error('Erro ao enviar pesquisa CSAT')
    } finally {
      setSendingCsat(false)
    }
  }

  if (!ticket) {
    return (
      <div className="p-4 flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4" key="metricas">
      {/* First Response */}
      <Section title="Primeira Resposta Humana">
        <div className={cn('rounded-2xl p-4', firstResponseBreached ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800' : 'bg-secondary')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tempo de resposta</span>
            </div>
            {firstResponseSlaMinutes && (
              <Badge className={cn('text-xs font-bold border', firstResponseBreached ? 'text-white bg-red-500 border-red-500' : !ticket?.first_human_response_at ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200')}>
                {firstResponseBreached ? 'SLA ESTOURADO' : !ticket?.first_human_response_at ? 'EM ANDAMENTO' : 'No prazo'}
              </Badge>
            )}
          </div>
          <p className={cn('text-lg font-display font-bold mt-2', firstResponseBreached ? 'text-red-600 dark:text-red-400' : ticket?.first_human_response_seconds ? 'text-emerald-600' : 'text-foreground')}>
            {ticket?.first_human_response_seconds
              ? formatHHMMSS(ticket.first_human_response_seconds)
              : queueTimerRef
                ? formatHHMMSS(queueElapsed)
                : '—'}
          </p>
          {!ticket?.first_human_response_at && queueTimerRef && (
            <p className="text-xs text-amber-600 mt-1">⏳ Aguardando primeira resposta...</p>
          )}
          {firstResponseSlaMinutes && (
            <p className="text-xs text-muted-foreground mt-1">Meta SLA: {firstResponseSlaMinutes}min</p>
          )}
        </div>
      </Section>

      {/* Resolution Time */}
      <Section title="Tempo de Resolução">
        <div className={cn('rounded-2xl p-4', resolutionBreached ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800' : 'bg-secondary')}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tempo total</span>
            </div>
            {resolutionSlaMinutes && (
              <Badge className={cn('text-xs font-bold border', resolutionBreached ? 'text-white bg-red-500 border-red-500' : !ticket?.resolved_at ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200')}>
                {resolutionBreached ? 'SLA ESTOURADO' : !ticket?.resolved_at ? 'EM ANDAMENTO' : 'No prazo'}
              </Badge>
            )}
          </div>
          <p className={cn('text-lg font-display font-bold', resolutionBreached ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
            {ticket?.resolution_seconds
              ? formatHHMMSS(ticket.resolution_seconds)
              : resolutionTimerRef
                ? formatHHMMSS(resolutionElapsed)
                : '—'}
          </p>
          {!ticket?.resolved_at && resolutionTimerRef && (
            <p className="text-xs text-muted-foreground mt-1">Em andamento...</p>
          )}
          {resolutionSlaMinutes && (
            <p className="text-xs text-muted-foreground mt-1">Meta SLA: {resolutionSlaMinutes}min</p>
          )}
        </div>
      </Section>

      {/* SLA Status */}
      <Section title="Status do SLA">
        <div className="bg-secondary rounded-2xl p-4">
          <Badge className={cn('text-xs font-bold border px-3 py-1', slaBreached ? 'text-destructive bg-destructive/10 border-destructive/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200')}>
            {slaBreached ? '🔴 SLA Estourado' : '🟢 Dentro do prazo'}
          </Badge>
          {!sla && (
            <p className="text-xs text-muted-foreground mt-2">Nenhum SLA configurado para esta prioridade</p>
          )}
        </div>
      </Section>

      {/* CSAT */}
      <Section title="Nota CSAT">
        <div className="bg-secondary rounded-2xl p-4">
          {csatScore ? (
            <div>
              <div className="flex items-center gap-2">
                {['😡', '😟', '😐', '😊', '🤩'].map((emoji, i) => (
                  <span key={i} className={cn('text-2xl transition-all', i + 1 <= csatScore ? 'opacity-100 scale-110' : 'opacity-30 grayscale')}>
                    {emoji}
                  </span>
                ))}
                <span className="text-sm font-bold text-foreground ml-2">{csatScore}/5</span>
              </div>
              {ticket?.csat_responded_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Respondido {formatDistanceToNow(new Date(ticket.csat_responded_at), { addSuffix: true, locale: ptBR })}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Não avaliado</p>
              {csatAlreadySent ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <Clock className="w-3 h-3" />
                  <span>Pesquisa enviada {ticket?.csat_sent_at ? formatDistanceToNow(new Date(ticket.csat_sent_at), { addSuffix: true, locale: ptBR }) : ''}</span>
                </div>
              ) : csatAvailable ? (
                <Button size="sm" variant="outline" onClick={handleSendCsat} disabled={sendingCsat || isReadOnly} className="w-full gap-1.5">
                  {sendingCsat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar Pesquisa CSAT
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">CSAT não disponível para este board</p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* CSAT Comment */}
      {csatComment && (
        <Section title="Comentário CSAT">
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-xs text-foreground italic">"{csatComment}"</p>
          </div>
        </Section>
      )}

      {/* Agent */}
      <Section title="Agente Responsável">
        <div className="bg-secondary rounded-2xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
            {agentName?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
          </div>
          <span className="text-sm font-semibold text-foreground">{agentName || 'Não atribuído'}</span>
        </div>
      </Section>

      {/* Queue Position */}
      {ticket?.queue_position != null && (
        <Section title="Posição na Fila">
          <div className="bg-secondary rounded-2xl p-4 flex items-center gap-2">
            <span className="text-lg font-display font-bold text-primary">#{ticket.queue_position}</span>
            <span className="text-xs text-muted-foreground">quando assumido</span>
          </div>
        </Section>
      )}
    </div>
  )
}



/* ─── Conversation Summary Section ─── */

function ConversationSummarySection({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const [lastResult, setLastResult] = useState<{ messages_processed: number; is_fresh: boolean } | null>(null)
  const autoGeneratedRef = useRef<string | null>(null)

  const { data: savedData, isLoading: summaryLoading } = useQuery({
    queryKey: ['conversation-summary', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('conversation_summary, summary_last_message_id')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  })

  const generateSummary = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('summarize-conversation', {
        body: { conversation_id: conversationId },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setLastResult({ messages_processed: data.messages_processed, is_fresh: data.is_fresh })
      queryClient.invalidateQueries({ queryKey: ['conversation-summary', conversationId] })
      if (data.messages_processed === 0) {
        // silent — no toast for auto-generated empty result
      } else if (data.is_fresh) {
        toast.success(`Resumo gerado · ${data.messages_processed} novas mensagens · ${data.tokens_used} tokens`)
      }
    },
    onError: () => toast.error('Erro ao gerar resumo'),
  })

  // Auto-generate summary on first open if none exists yet
  useEffect(() => {
    if (
      !summaryLoading &&
      savedData !== undefined &&
      !savedData?.conversation_summary &&
      !generateSummary.isPending &&
      autoGeneratedRef.current !== conversationId
    ) {
      autoGeneratedRef.current = conversationId
      generateSummary.mutate()
    }
  }, [summaryLoading, savedData, conversationId, generateSummary])

  const summary = savedData?.conversation_summary

  return (
    <div className="bg-secondary rounded-2xl p-4 space-y-3 border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Resumo da Conversa</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={generateSummary.isPending}
          onClick={() => generateSummary.mutate()}
          title="Gerar / atualizar resumo"
        >
          {generateSummary.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            : <RefreshCw className="w-3.5 h-3.5 text-primary" />
          }
        </Button>
      </div>

      {summaryLoading ? (
        <div className="h-12 bg-muted rounded-lg animate-pulse" />
      ) : summary ? (
        <p className="text-xs text-foreground leading-relaxed">{summary}</p>
      ) : generateSummary.isPending ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
          <Loader2 className="w-3 h-3 animate-spin" />
          Gerando resumo automático…
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Nenhum resumo gerado ainda. Clique em ↻ para gerar.
        </p>
      )}

      {(summary || lastResult) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          {lastResult?.messages_processed === 0
            ? <span>Resumo atual · nenhum token usado</span>
            : lastResult?.messages_processed
            ? <span>{lastResult.messages_processed} novas mensagens resumidas</span>
            : <span>Resumo salvo</span>
          }
        </div>
      )}
    </div>
  )
}

/* ─── Transcriptions Section ─── */

function TranscriptionsSection({ conversationId }: { conversationId: string }) {
  const { data: transcriptions = [], isLoading } = useQuery({
    queryKey: ['transcriptions', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_messages')
        .select('id, content, intent, created_at')
        .eq('conversation_id', conversationId)
        .eq('role', 'system')
        .in('intent', ['audio_transcription', 'image_transcription'])
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: !!conversationId,
  })

  return (
    <Section title="Transcrições de Mídia">
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : transcriptions.length === 0 ? (
        <div className="bg-secondary rounded-2xl p-4">
          <p className="text-xs text-muted-foreground text-center">Nenhuma transcrição nesta conversa</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transcriptions.map((t) => {
            const isAudio = t.intent === 'audio_transcription'
            const Icon = isAudio ? Mic : Image
            const label = isAudio ? 'Áudio transcrito' : 'Imagem transcrita'
            const time = t.created_at ? new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
            return (
              <div key={t.id} className="bg-secondary rounded-2xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{time}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {t.content}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

/* ─── Helper Components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 rounded-full bg-primary" />
        <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   HISTÓRICO TAB - Previous tickets for same contact
   ══════════════════════════════════════════════════ */

function HistoricoTab({ conversationId }: { conversationId: string }) {
  const { data: conversation } = useQuery({
    queryKey: ['historico-conv', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, uazapi_chat_id, customer_phone')
        .eq('id', conversationId)
        .maybeSingle()
      return data
    },
    enabled: !!conversationId,
  })

  const { data: previousTickets, isLoading } = useQuery({
    queryKey: ['previous-tickets-historico', conversationId, conversation?.uazapi_chat_id, conversation?.customer_phone],
    queryFn: async () => {
      if (!conversationId) return []

      let query = supabase
        .from('ai_conversations')
        .select('id, ticket_number, started_at, status, resolved_at, conversation_summary')
        .neq('id', conversationId)
        .order('started_at', { ascending: false })
        .limit(20)

      if (conversation?.uazapi_chat_id) {
        query = query.eq('uazapi_chat_id', conversation.uazapi_chat_id)
      } else if (conversation?.customer_phone) {
        query = query.eq('customer_phone', conversation.customer_phone)
      } else {
        return []
      }

      const { data: tickets, error } = await query
      if (error || !tickets?.length) return []

      const ticketIds = tickets.map(t => t.id)
      const { data: allMessages } = await supabase
        .from('ai_messages')
        .select('id, conversation_id, role, content, created_at, agent_id, ai_agents(name, color, specialty)')
        .in('conversation_id', ticketIds)
        .order('created_at', { ascending: true })
        .limit(500)

      const messagesByConv = new Map<string, any[]>()
      for (const msg of (allMessages || [])) {
        if (!msg.conversation_id) continue
        if (!messagesByConv.has(msg.conversation_id)) messagesByConv.set(msg.conversation_id, [])
        messagesByConv.get(msg.conversation_id)!.push(msg)
      }

      return tickets.map(ticket => ({
        ticket,
        messages: messagesByConv.get(ticket.id) || [],
      }))
    },
    enabled: !!conversationId && !!(conversation?.uazapi_chat_id || conversation?.customer_phone),
    staleTime: 60000,
  })

  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)

  const statusLabels: Record<string, { label: string; color: string }> = {
    finalizado: { label: 'Finalizado', color: 'bg-muted text-muted-foreground' },
    resolvido: { label: 'Resolvido', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    em_atendimento: { label: 'Em Atendimento', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
    aguardando: { label: 'Aguardando', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    aguardando_cliente: { label: 'Aguardando Cliente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    novo: { label: 'Novo', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  }

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">Carregando histórico...</span>
      </div>
    )
  }

  if (!previousTickets?.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <History className="w-8 h-8 opacity-40" />
        <span className="text-xs font-medium">Nenhum atendimento anterior encontrado</span>
        <span className="text-xs">Este é o primeiro contato deste cliente.</span>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground">{previousTickets.length} atendimento{previousTickets.length !== 1 ? 's' : ''} anterior{previousTickets.length !== 1 ? 'es' : ''}</span>
      </div>

      {previousTickets.map(({ ticket, messages }) => {
        const isExpanded = expandedTicket === ticket.id
        const status = statusLabels[ticket.status || ''] || { label: ticket.status || '—', color: 'bg-muted text-muted-foreground' }
        const timeAgo = ticket.started_at
          ? formatDistanceToNow(new Date(ticket.started_at), { addSuffix: true, locale: ptBR })
          : '—'

        return (
          <div key={ticket.id} className="rounded-xl border border-border bg-secondary/50 overflow-hidden">
            {/* Ticket header — info only, not a click trigger */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <Ticket className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-bold text-foreground font-mono">#{ticket.ticket_number}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground flex-1 truncate">{timeAgo}</span>
              <Badge className={cn('text-[9px] font-bold border-0 px-1.5 py-0', status.color)}>
                {status.label}
              </Badge>
            </div>

            {/* Summary */}
            {ticket.conversation_summary && (
              <div className="px-3 pb-2">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {ticket.conversation_summary}
                </p>
              </div>
            )}

            {/* "Ver conversa" explicit button */}
            <div className="px-3 pb-3">
              <button
                onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all',
                  isExpanded
                    ? 'bg-[#45E5E5]/10 border-[#45E5E5]/50 text-[#10293F] dark:text-cyan-400'
                    : 'bg-muted border-border text-muted-foreground hover:border-[#45E5E5]/40 hover:text-foreground hover:bg-[#45E5E5]/5'
                )}
              >
                <MessageSquare className="w-3 h-3" />
                {isExpanded ? 'Ocultar conversa' : `Ver conversa${messages.length > 0 ? ` (${messages.length})` : ''}`}
                {isExpanded
                  ? <ChevronDown className="w-3 h-3 ml-auto" />
                  : <ChevronRight className="w-3 h-3 ml-auto" />
                }
              </button>
            </div>

            {isExpanded && messages.length > 0 && (
              <div className="border-t border-border bg-card/50 px-3 py-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                {messages.map((msg: any) => (
                  <div key={msg.id} className="flex gap-2 text-xs">
                    <span className={cn(
                      'font-semibold shrink-0 w-16 truncate',
                      msg.role === 'user' ? 'text-sky-600 dark:text-sky-400' : 'text-violet-600 dark:text-violet-400'
                    )}>
                      {msg.role === 'user' ? 'Cliente' : (msg.ai_agents?.name || 'Agente')}
                    </span>
                    <span className="text-muted-foreground line-clamp-2">{msg.content}</span>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && messages.length === 0 && (
              <div className="border-t border-border px-3 py-2">
                <span className="text-xs text-muted-foreground italic">Sem mensagens registradas</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
