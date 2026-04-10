import { Sparkles, Send, Pencil, Loader2, Tag, CalendarClock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AISuggestion {
  text: string
  confidence: number
  type?: 'price' | 'schedule' | 'summary' | 'general'
}

interface CopilotSuggestionsProps {
  suggestion?: AISuggestion | null
  loading?: boolean
  onUseSuggestion?: (text: string) => void
  onSendDirect?: (text: string) => void
}

const typeConfig: Record<string, { label: string; icon: typeof Tag; color: string; bgClass: string; borderClass: string; textClass: string; btnBg: string; btnHover: string }> = {
  price: {
    label: 'Tabela de Preços',
    icon: Tag,
    color: 'hsl(180, 74%, 58%)',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/20 hover:border-primary/40',
    textClass: 'text-primary',
    btnBg: 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground',
    btnHover: 'hover:bg-primary hover:text-primary-foreground',
  },
  schedule: {
    label: 'Agendamento',
    icon: CalendarClock,
    color: '#fb923c',
    bgClass: 'bg-orange-400/10',
    borderClass: 'border-orange-400/20 hover:border-orange-400/40',
    textClass: 'text-orange-500',
    btnBg: 'bg-orange-400/10 text-orange-500 hover:bg-orange-400 hover:text-white',
    btnHover: 'hover:bg-orange-400 hover:text-white',
  },
  summary: {
    label: 'Resumo',
    icon: FileText,
    color: '#818cf8',
    bgClass: 'bg-indigo-400/10',
    borderClass: 'border-indigo-400/20 hover:border-indigo-400/40',
    textClass: 'text-indigo-500',
    btnBg: 'bg-indigo-400/10 text-indigo-500 hover:bg-indigo-400 hover:text-white',
    btnHover: 'hover:bg-indigo-400 hover:text-white',
  },
  general: {
    label: 'Sugestão',
    icon: Sparkles,
    color: 'hsl(180, 74%, 58%)',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/20 hover:border-primary/40',
    textClass: 'text-primary',
    btnBg: 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground',
    btnHover: 'hover:bg-primary hover:text-primary-foreground',
  },
}

function inferType(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('preço') || lower.includes('valor') || lower.includes('tabela') || lower.includes('plano')) return 'price'
  if (lower.includes('agend') || lower.includes('horário') || lower.includes('data') || lower.includes('marcar')) return 'schedule'
  if (lower.includes('resumo') || lower.includes('resumindo')) return 'summary'
  return 'general'
}

export function CopilotSuggestions({ suggestion, loading, onUseSuggestion, onSendDirect }: CopilotSuggestionsProps) {
  if (loading) {
    return (
      <div className="shrink-0 px-8 py-4" style={{ background: 'linear-gradient(to bottom, #f8fafc, transparent)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Sugestões do Copiloto
          </span>
        </div>
        <div className="bg-card border border-primary/20 rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 min-w-[280px]">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analisando conversa...</span>
        </div>
      </div>
    )
  }

  if (!suggestion) return null

  const type = suggestion.type || inferType(suggestion.text)
  const config = typeConfig[type] || typeConfig.general
  const TypeIcon = config.icon

  return (
    <div className="shrink-0 px-8 py-4" style={{ background: 'linear-gradient(to bottom, #f8fafc, transparent)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Sugestões do Copiloto
        </span>
        <span className="text-xs font-bold text-primary ml-auto">
          {Math.round(suggestion.confidence * 100)}% confiança
        </span>
      </div>

      {/* Cards container - horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 stagger-container" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        <style>{`.copilot-cards-scroll::-webkit-scrollbar { display: none; }`}</style>

        {/* Suggestion Card */}
        <div
          className={cn(
            'min-w-[280px] max-w-[360px] bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all shrink-0',
            config.borderClass
          )}
        >
          {/* Badge + Icon */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase', config.bgClass, config.textClass)}>
              <TypeIcon className="w-3 h-3" aria-hidden="true" />
              {config.label}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-foreground leading-normal mb-3 line-clamp-3">{suggestion.text}</p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-bold rounded-xl gap-1.5 transition-colors shadow-none btn-press',
                config.btnBg
              )}
              onClick={() => onSendDirect?.(suggestion.text)}
              aria-label="Enviar sugestão diretamente ao cliente"
            >
              <Send className="w-3 h-3" aria-hidden="true" />
              Enviar
            </Button>
            <Button
              size="sm"
              variant="ghost" 
              className="h-7 px-3 text-xs font-bold rounded-xl gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => onUseSuggestion?.(suggestion.text)}
              aria-label="Editar sugestão antes de enviar"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
              Editar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
