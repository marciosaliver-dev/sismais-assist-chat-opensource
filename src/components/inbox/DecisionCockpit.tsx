import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Wand2 } from 'lucide-react'

interface DecisionCockpitProps {
  conversationId: string
  onSendNow: (text: string) => void
  onSendLater: (text: string) => void
  suggestion?: {
    text: string
    confidence: number
    sources?: { title: string; url: string }[]
  } | null
}

export function DecisionCockpit({ onSendNow, suggestion }: DecisionCockpitProps) {
  const displayText = suggestion
    ? suggestion.text.slice(0, 200) + (suggestion.text.length > 200 ? '...' : '')
    : 'Aguardando contexto para gerar sugestão...'

  return (
    <div className="border-t border-border bg-card/80 px-4 py-3 shrink-0">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold tracking-wider text-foreground uppercase">Cockpit de IA</span>
            {suggestion && (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs h-5 px-2 font-semibold uppercase">
                Sugestão Pronta
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {displayText}
          </p>
        </div>

        {/* Action */}
        {suggestion && (
          <Button
            size="sm"
            onClick={() => onSendNow(suggestion.text)}
            className="shrink-0 bg-[hsl(var(--background))] text-foreground border border-border hover:bg-accent gap-1.5 h-9 px-4 font-medium"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Aplicar Resposta
          </Button>
        )}
      </div>
    </div>
  )
}
