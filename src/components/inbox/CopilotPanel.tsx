import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Lightbulb, FileText, Search, TrendingUp, Zap, Loader2,
  User, Clock, Tag, AlertTriangle, ArrowUp, ArrowDown, Minus,
  History, BarChart3, Ticket, ExternalLink
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { CustomerProfileCard } from './CustomerProfileCard'
import { cn } from '@/lib/utils'
import type { Tables } from '@/integrations/supabase/types'
import { formatDistanceToNow, format, differenceInSeconds } from 'date-fns'

// Attendance Timer component for human agent
function AttendanceTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mt-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold uppercase text-muted-foreground">Tempo de atendimento</span>
      </div>
      <p className="text-lg font-display font-bold text-primary mt-1">
        {mins}:{secs.toString().padStart(2, '0')}
      </p>
    </div>
  )
}

import { ptBR } from 'date-fns/locale'

type Conversation = Tables<'ai_conversations'>

interface CopilotPanelProps {
  conversation: Conversation | null
  suggestion: {
    text: string
    confidence: number
    sources?: { title: string; url: string }[]
    sentiment?: string
    urgency?: string
    intent?: string
    summary?: string
  } | null
  suggestionLoading: boolean
  onUseSuggestion: (text: string) => void
  onRequestSuggestion: () => void
  onPriorityChange?: (priority: string, score: number) => void
  copilotEnabled?: boolean
  onToggleCopilot?: (enabled: boolean) => void
}

const priorityConfig: Record<string, { label: string; color: string; icon: typeof ArrowUp; score: number }> = {
  critical: { label: 'Crítica', color: 'text-destructive bg-destructive/10 border-destructive/30', icon: AlertTriangle, score: 100 },
  high: { label: 'Alta', color: 'text-orange-600 bg-orange-50 border-orange-300 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-700', icon: ArrowUp, score: 75 },
  medium: { label: 'Média', color: 'text-primary bg-primary/10 border-primary/30', icon: Minus, score: 50 },
  low: { label: 'Baixa', color: 'text-muted-foreground bg-muted border-border', icon: ArrowDown, score: 25 },
}

type TabValue = 'insights' | 'profile' | 'ticket'

export function CopilotPanel({
  conversation,
  suggestion,
  suggestionLoading,
  onUseSuggestion,
  onRequestSuggestion,
  onPriorityChange,
  copilotEnabled = true,
  onToggleCopilot,
}: CopilotPanelProps) {
  const [relatedDocs, setRelatedDocs] = useState<{ id: string; title: string; category: string }[]>([])
  const [analysis, setAnalysis] = useState<{ sentiment: string; urgency: string; intent: string }>({
    sentiment: 'neutral',
    urgency: 'medium',
    intent: 'geral',
  })
  const [conversationHistory, setConversationHistory] = useState<Conversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('insights')

  // Fetch real analysis from latest ai_messages
  useEffect(() => {
    if (!conversation) return

    const fetchAnalysis = async () => {
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('sentiment, urgency, intent')
        .eq('conversation_id', conversation.id)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(1)

      if (msgs && msgs.length > 0) {
        setAnalysis({
          sentiment: msgs[0].sentiment || 'neutral',
          urgency: msgs[0].urgency || 'medium',
          intent: msgs[0].intent || 'geral',
        })
      }
    }

    const fetchDocs = async () => {
      const { data: docs } = await supabase
        .from('ai_knowledge_base')
        .select('id, title, category')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(5)

      if (docs) setRelatedDocs(docs)
    }

    fetchAnalysis()
    fetchDocs()
  }, [conversation?.id])

  // Fetch conversation history for this customer
  useEffect(() => {
    if (!conversation?.customer_phone) {
      setConversationHistory([])
      return
    }

    const fetchHistory = async () => {
      setHistoryLoading(true)
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('customer_phone', conversation.customer_phone)
        .neq('id', conversation.id)
        .order('started_at', { ascending: false })
        .limit(20)

      setConversationHistory((data || []) as Conversation[])
      setHistoryLoading(false)
    }

    fetchHistory()
  }, [conversation?.customer_phone, conversation?.id])

  // Update analysis when suggestion returns real data
  useEffect(() => {
    if (suggestion?.sentiment || suggestion?.urgency || suggestion?.intent) {
      setAnalysis({
        sentiment: suggestion.sentiment || analysis.sentiment,
        urgency: suggestion.urgency || analysis.urgency,
        intent: suggestion.intent || analysis.intent,
      })
    }
  }, [suggestion])

  if (!conversation) {
    return (
      <div className="w-full lg:w-96 flex items-center justify-center h-full bg-card border-l border-border">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-display font-semibold text-foreground text-sm">Painel de Inteligência</p>
          <p className="text-xs text-muted-foreground mt-1">Selecione uma conversa</p>
        </div>
      </div>
    )
  }

  const sentimentEmoji: Record<string, string> = { positive: '😊', negative: '😞', neutral: '😐' }
  const urgencyColors: Record<string, string> = {
    critical: 'text-destructive',
    high: 'text-destructive',
    medium: 'text-primary',
    low: 'text-muted-foreground',
  }

  const currentPriority = (conversation as any).priority || 'medium'
  const aiSuggestedPriority = (conversation as any).ai_suggested_priority
  const priorityReason = (conversation as any).priority_reason

  const handleSetPriority = async (priority: string) => {
    const config = priorityConfig[priority]
    if (!config) return

    await supabase
      .from('ai_conversations')
      .update({ priority, priority_score: config.score } as any)
      .eq('id', conversation.id)

    onPriorityChange?.(priority, config.score)
  }

  const tabs: { id: TabValue; icon: typeof BarChart3; label: string }[] = [
    { id: 'insights', icon: BarChart3, label: 'Insights' },
    { id: 'profile', icon: User, label: 'Perfil' },
    { id: 'ticket', icon: Ticket, label: 'Ticket' },
  ]

  // Sale probability (mock based on analysis)
  const saleProbability = analysis.sentiment === 'positive' ? 78 : analysis.sentiment === 'negative' ? 25 : 52

  return (
    <div className="w-full lg:w-96 flex flex-col h-full bg-card border-l border-border">
      {/* Tab Navigation */}
      <div className="p-4 bg-secondary/50 shrink-0" role="tablist" aria-label="Painel de inteligência">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                  isActive
                    ? 'bg-card shadow-sm border border-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-card'
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        {activeTab === 'insights' && (
          <div className="p-4 space-y-4 tab-content-enter" key="insights" role="tabpanel" id="tabpanel-insights" aria-labelledby="tab-insights">
            {/* Customer Insight Card */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-[6px] rounded-full bg-primary" />
                <span className="text-xs font-bold text-foreground">Insights do Cliente</span>
              </div>
              <div className="relative bg-secondary border border-secondary rounded-2xl p-4 overflow-hidden">
                {/* Decorative circle */}
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-primary/5" />
                <div className="relative flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl border border-border shadow-sm bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-lg shrink-0">
                    {conversation.customer_name?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm text-foreground truncate">
                      {conversation.customer_name || 'Cliente'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{conversation.customer_phone}</p>
                    <Badge className="mt-1 text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 h-5 px-2">
                      Lead Quente
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Sale Probability */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-[6px] rounded-full bg-primary" />
                <span className="text-xs font-bold text-foreground">Probabilidade de Venda</span>
              </div>
              <div className="bg-ai-soft border border-primary/20 rounded-2xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Score de conversão</p>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-display font-bold text-primary">{saleProbability}%</span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${saleProbability}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs font-semibold italic text-primary-dark">
                  "Cliente demonstra alto interesse no produto, engajamento acima da média."
                </p>
              </div>
            </div>

            {/* Analysis */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-[6px] rounded-full bg-primary" />
                <span className="text-xs font-bold text-foreground">Análise em Tempo Real</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-secondary border border-secondary rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sentimento</p>
                  <p className="text-xl">{sentimentEmoji[analysis.sentiment] || '😐'}</p>
                </div>
                <div className="bg-secondary border border-secondary rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Urgência</p>
                  <p className={cn('text-sm font-bold capitalize', urgencyColors[analysis.urgency] || 'text-primary')}>{analysis.urgency}</p>
                </div>
                <div className="bg-secondary border border-secondary rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Intenção</p>
                  <p className="text-xs font-bold capitalize">{analysis.intent.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>

            {/* Conversation Summary */}
            {(suggestion?.summary || suggestionLoading) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-[6px] rounded-full bg-primary" />
                  <span className="text-xs font-bold text-foreground">Resumo da Conversa</span>
                </div>
                <div className="bg-secondary border border-secondary rounded-2xl p-4">
                  {suggestionLoading ? (
                    <div className="flex items-center gap-2 py-2 justify-center text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Gerando resumo...</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">{suggestion?.summary}</p>
                  )}
                </div>
              </div>
            )}

            {/* Suggestion */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-[6px] rounded-full bg-primary" />
                  <span className="text-xs font-bold text-foreground">Sugestão IA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{copilotEnabled ? 'Ativa' : 'Inativa'}</span>
                  <Switch
                    checked={copilotEnabled}
                    onCheckedChange={(checked) => onToggleCopilot?.(checked)}
                    className="scale-75"
                  />
                </div>
              </div>
              {!copilotEnabled ? (
                <div className="bg-secondary border border-border rounded-2xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Sugestões desativadas</p>
                  <p className="text-xs text-muted-foreground mt-1">Ative o toggle para receber sugestões automáticas da IA</p>
                </div>
              ) : (suggestion || suggestionLoading) ? (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  {suggestionLoading ? (
                    <div className="flex items-center gap-2 py-3 justify-center text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Analisando...</span>
                    </div>
                  ) : suggestion ? (
                    <>
                      <p className="text-sm text-foreground mb-3 leading-relaxed">{suggestion.text}</p>
                      <div className="flex items-center gap-2 mb-3">
                        <Progress value={suggestion.confidence * 100} className="h-1.5 flex-1" />
                        <span className="text-xs font-bold text-muted-foreground">{Math.round(suggestion.confidence * 100)}%</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => onUseSuggestion(suggestion.text)} className="flex-1 h-8 text-xs rounded-xl">Usar</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl">Editar</Button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="bg-secondary border border-border rounded-2xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Nenhuma sugestão ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">Aguardando nova mensagem do cliente</p>
                </div>
              )}
            </div>

            {/* Knowledge Base */}
            {relatedDocs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-[6px] rounded-full bg-primary" />
                  <span className="text-xs font-bold text-foreground">Base de Conhecimento</span>
                </div>
                <div className="space-y-1.5">
                  {relatedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary cursor-pointer transition-colors">
                      <p className="text-xs text-foreground font-medium">{doc.title}</p>
                      <Badge variant="outline" className="text-[9px] shrink-0">{doc.category}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-4 space-y-4 tab-content-enter" key="profile" role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile">
            <CustomerProfileCard phone={conversation.customer_phone} conversationId={conversation.id} />

            {/* History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-[6px] rounded-full bg-primary" />
                  <span className="text-xs font-bold text-foreground">Histórico</span>
                </div>
                <Badge variant="secondary" className="text-[9px] font-bold">{conversationHistory.length}</Badge>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : conversationHistory.length === 0 ? (
                <div className="text-center py-6 bg-secondary rounded-2xl">
                  <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Primeiro contato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversationHistory.slice(0, 5).map((hist) => (
                    <div key={hist.id} className="bg-card border border-border rounded-xl p-3 hover:bg-secondary/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={hist.status === 'resolved' ? 'secondary' : 'default'} className="text-[9px] h-4">
                          {hist.status === 'resolved' ? '✅' : '🟢'} {hist.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {hist.started_at && format(new Date(hist.started_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                      {hist.resolution_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{hist.resolution_summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ticket' && (
          <div className="p-4 space-y-4 tab-content-enter" key="ticket" role="tabpanel" id="tabpanel-ticket" aria-labelledby="tab-ticket">
            {/* Status Grid */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-[6px] rounded-full bg-primary" />
                <span className="text-xs font-bold text-foreground">Status do Ticket</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-secondary rounded-xl p-3 shadow-sm">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Status</p>
                  <p className="text-xs font-bold text-foreground capitalize">{conversation.status || 'active'}</p>
                </div>
                <div className="bg-card border border-secondary rounded-xl p-3 shadow-sm">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Handler</p>
                  <p className="text-xs font-bold text-foreground">{conversation.handler_type === 'ai' ? '🤖 IA' : '👤 Humano'}</p>
                </div>
                <div className="bg-card border border-secondary rounded-xl p-3 shadow-sm">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Msgs IA</p>
                  <p className="text-xs font-bold text-foreground">{conversation.ai_messages_count || 0}</p>
                </div>
                <div className="bg-card border border-secondary rounded-xl p-3 shadow-sm">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Msgs Humanas</p>
                  <p className="text-xs font-bold text-foreground">{conversation.human_messages_count || 0}</p>
                </div>
              </div>
              </div>
              {/* Attendance Timer */}
              {conversation.handler_type === 'human' && conversation.status === 'active' && conversation.started_at && (
                <AttendanceTimer startedAt={conversation.started_at} />
              )}
            {/* Priority */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-[6px] rounded-full bg-primary" />
                <span className="text-xs font-bold text-foreground">Prioridade</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(priorityConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <button
                      key={key}
                      onClick={() => handleSetPriority(key)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all',
                        currentPriority === key
                          ? cfg.color + ' ring-1 ring-offset-1'
                          : 'border-border text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
              {aiSuggestedPriority && aiSuggestedPriority !== currentPriority && (
                <div className="bg-secondary rounded-xl p-2.5 border border-border mt-3">
                  <p className="text-xs text-muted-foreground">🤖 IA sugere: <strong className="text-foreground">{priorityConfig[aiSuggestedPriority]?.label}</strong></p>
                  {priorityReason && <p className="text-xs text-muted-foreground mt-1">{priorityReason}</p>}
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs rounded-xl" onClick={() => handleSetPriority(aiSuggestedPriority)}>
                    Aceitar sugestão
                  </Button>
                </div>
              )}
            </div>

            {/* Classification */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-[6px] rounded-full bg-primary" />
                <span className="text-xs font-bold text-foreground">Classificação IA</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-secondary rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Sentimento</p>
                  <p className="text-lg mt-1">{sentimentEmoji[analysis.sentiment] || '😐'}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Urgência</p>
                  <p className={cn('text-sm font-bold capitalize mt-1', urgencyColors[analysis.urgency])}>{analysis.urgency}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Intenção</p>
                  <p className="text-xs font-bold capitalize mt-1">{analysis.intent.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>

            {conversation.resolution_summary && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-[6px] rounded-full bg-primary" />
                  <span className="text-xs font-bold text-foreground">Resumo</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed bg-secondary rounded-xl p-3">{conversation.resolution_summary}</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer CRM Button */}
      <div className="p-4 border-t border-border shrink-0">
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl hover:bg-secondary transition-colors" aria-label="Abrir perfil do cliente no CRM">
          <ExternalLink className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-bold text-foreground">Abrir no CRM</span>
        </button>
      </div>
    </div>
  )
}
