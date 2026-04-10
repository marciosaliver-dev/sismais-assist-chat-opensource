import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BookOpen, Target, Shield, AlertTriangle, Wrench, User, Info, Lightbulb
} from 'lucide-react'

interface ReasoningTabProps {
  conversationId: string
}

interface ReasoningSignals {
  kb_match?: { status: string; score: number | null; docs_count: number; top_doc_title?: string }
  specialty_alignment?: { status: string; agent_specialty: string; detected_intent: string }
  guardrails?: { violations: number; warnings: number; details?: string[] }
  hedging?: { detected: boolean; severity: string; penalty: number }
  tools_used?: string[]
  client_data?: { available: boolean; source?: string }
}

const signalConfig = [
  {
    key: 'kb_match' as const,
    icon: BookOpen,
    label: 'Knowledge Base',
    getValue: (s: ReasoningSignals) => {
      const kb = s.kb_match
      if (!kb) return { text: '—', color: 'text-muted-foreground' }
      if (kb.status === 'strong') return { text: `Match forte (${kb.score?.toFixed(2)})`, color: 'text-emerald-600' }
      if (kb.status === 'partial') return { text: `Match parcial (${kb.score?.toFixed(2)})`, color: 'text-amber-600' }
      if (kb.status === 'none') return { text: 'Sem match', color: 'text-destructive' }
      return { text: 'RAG desabilitado', color: 'text-muted-foreground' }
    },
    getBg: (s: ReasoningSignals) => {
      const st = s.kb_match?.status
      if (st === 'strong') return 'bg-emerald-50 dark:bg-emerald-950/30'
      if (st === 'partial') return 'bg-amber-50 dark:bg-amber-950/30'
      if (st === 'none') return 'bg-destructive/10'
      return 'bg-muted'
    },
  },
  {
    key: 'specialty' as const,
    icon: Target,
    label: 'Alinhamento specialty',
    getValue: (s: ReasoningSignals) => {
      const sa = s.specialty_alignment
      if (!sa) return { text: '—', color: 'text-muted-foreground' }
      const arrow = `${sa.agent_specialty} ↔ ${sa.detected_intent}`
      if (sa.status === 'aligned') return { text: arrow, color: 'text-emerald-600' }
      if (sa.status === 'misaligned') return { text: arrow, color: 'text-destructive' }
      return { text: arrow, color: 'text-amber-600' }
    },
    getBg: (s: ReasoningSignals) => {
      const st = s.specialty_alignment?.status
      if (st === 'aligned') return 'bg-emerald-50 dark:bg-emerald-950/30'
      if (st === 'misaligned') return 'bg-destructive/10'
      return 'bg-amber-50 dark:bg-amber-950/30'
    },
  },
  {
    key: 'guardrails' as const,
    icon: Shield,
    label: 'Guardrails',
    getValue: (s: ReasoningSignals) => {
      const g = s.guardrails
      if (!g) return { text: '—', color: 'text-muted-foreground' }
      if (g.violations > 0) return { text: `${g.violations} violação(ões)`, color: 'text-destructive' }
      if (g.warnings > 0) return { text: `${g.warnings} aviso(s)`, color: 'text-amber-600' }
      return { text: '0 violações', color: 'text-emerald-600' }
    },
    getBg: (s: ReasoningSignals) => {
      const g = s.guardrails
      if (g?.violations && g.violations > 0) return 'bg-destructive/10'
      if (g?.warnings && g.warnings > 0) return 'bg-amber-50 dark:bg-amber-950/30'
      return 'bg-emerald-50 dark:bg-emerald-950/30'
    },
  },
  {
    key: 'hedging' as const,
    icon: AlertTriangle,
    label: 'Hedging detectado',
    getValue: (s: ReasoningSignals) => {
      const h = s.hedging
      if (!h) return { text: '—', color: 'text-muted-foreground' }
      if (!h.detected) return { text: 'Nenhum', color: 'text-emerald-600' }
      if (h.severity === 'light') return { text: `Leve (${h.penalty})`, color: 'text-amber-600' }
      return { text: `Forte (${h.penalty})`, color: 'text-destructive' }
    },
    getBg: (s: ReasoningSignals) => {
      const h = s.hedging
      if (!h?.detected) return 'bg-emerald-50 dark:bg-emerald-950/30'
      if (h.severity === 'light') return 'bg-amber-50 dark:bg-amber-950/30'
      return 'bg-destructive/10'
    },
  },
  {
    key: 'tools' as const,
    icon: Wrench,
    label: 'Tools usadas',
    getValue: (s: ReasoningSignals) => {
      const t = s.tools_used
      if (!t || t.length === 0) return { text: 'Nenhuma', color: 'text-muted-foreground' }
      return { text: t.join(', '), color: 'text-foreground' }
    },
    getBg: () => 'bg-muted',
  },
  {
    key: 'client' as const,
    icon: User,
    label: 'Dados do cliente',
    getValue: (s: ReasoningSignals) => {
      const c = s.client_data
      if (!c) return { text: '—', color: 'text-muted-foreground' }
      if (c.available) return { text: `Disponível (${c.source || 'local'})`, color: 'text-emerald-600' }
      return { text: 'Indisponível', color: 'text-destructive' }
    },
    getBg: (s: ReasoningSignals) => {
      if (s.client_data?.available) return 'bg-emerald-50 dark:bg-emerald-950/30'
      return 'bg-destructive/10'
    },
  },
]

export function ReasoningTab({ conversationId }: ReasoningTabProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['reasoning', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_messages')
        .select('id, confidence, confidence_reason, tools_used, rag_sources, reasoning_text, reasoning_signals, created_at')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(10)
      return data || []
    },
    staleTime: 30_000,
    enabled: !!conversationId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
        <Lightbulb className="w-8 h-8 opacity-40" />
        <span className="text-sm">Nenhuma resposta da IA nesta conversa</span>
      </div>
    )
  }

  const selected = messages[selectedIdx]
  const conf = selected?.confidence ? Math.round(Number(selected.confidence) * 100) : null
  const signals: ReasoningSignals = ((selected as any)?.reasoning_signals as ReasoningSignals) || {}

  const confColor = conf === null ? 'text-muted-foreground'
    : conf < 50 ? 'text-destructive'
    : conf < 70 ? 'text-amber-600'
    : 'text-emerald-600'

  const confGradient = conf === null ? 'bg-muted'
    : conf < 50 ? 'bg-destructive'
    : conf < 70 ? 'bg-amber-500'
    : 'bg-emerald-500'

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Seletor de mensagens */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {messages.map((msg, i) => (
            <button
              key={msg.id}
              onClick={() => setSelectedIdx(i)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                i === selectedIdx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {i === 0 ? 'Última' : `#${messages.length - i}`}
            </button>
          ))}
        </div>

        {/* Bloco de confiança */}
        {conf !== null && (
          <div className="flex items-center gap-3">
            <span className={cn('text-3xl font-bold tabular-nums', confColor)}>{conf}%</span>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', confGradient)}
                  style={{ width: `${conf}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">Confiança geral</span>
            </div>
          </div>
        )}

        {/* Lista de sinais */}
        <div className="space-y-1">
          {signalConfig.map(({ key, icon: Icon, label, getValue, getBg }) => {
            const { text, color } = getValue(signals)
            const bg = getBg(signals)
            return (
              <div key={key} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', bg)}>
                  <Icon className="w-3.5 h-3.5 text-foreground/70" />
                </div>
                <span className="text-xs text-muted-foreground flex-1">{label}</span>
                <span className={cn('text-xs font-medium text-right max-w-[140px] truncate', color)}>{text}</span>
              </div>
            )
          })}
        </div>

        {/* Separador */}
        <div className="border-t border-dashed border-border" />

        {/* Explicação do agente */}
        {(selected as any)?.reasoning_text ? (
          <div>
            <span className="text-xs font-semibold text-foreground mb-1.5 block">Explicação do agente</span>
            <div className="bg-muted rounded-lg p-3 border-l-[3px] border-primary text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {(selected as any).reasoning_text}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Info className="w-4 h-4" />
            <span className="text-xs">Raciocínio não disponível para esta mensagem</span>
          </div>
        )}

        {/* Confidence reason (fallback para mensagens antigas) */}
        {!(selected as any)?.reasoning_text && (selected as any)?.confidence_reason && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Motivo:</span> {(selected as any).confidence_reason}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
