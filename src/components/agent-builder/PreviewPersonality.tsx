import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

const SPECIALTY_LABELS: Record<string, string> = {
  triage: 'Triagem',
  support: 'Suporte',
  financial: 'Financeiro',
  sales: 'Vendas',
  sdr: 'SDR',
  copilot: 'Copiloto',
  analytics: 'Analytics',
}

const TONE_LABELS: Record<string, string> = {
  empathetic: 'Empático',
  professional: 'Profissional',
  friendly: 'Amigável',
  formal: 'Formal',
  casual: 'Casual',
}

interface PreviewPersonalityProps {
  config: AgentConfig
}

export default function PreviewPersonality({ config }: PreviewPersonalityProps) {
  const [expanded, setExpanded] = useState(false)

  const previewPrompt = config.system_prompt.slice(0, 200)
  const hasMore = config.system_prompt.length > 200

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ backgroundColor: config.color || '#10293F' }}
        >
          {config.name ? config.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {config.name || <span className="text-muted-foreground italic">Sem nome</span>}
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="secondary" className="text-xs bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)]">
              {SPECIALTY_LABELS[config.specialty] || config.specialty}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {TONE_LABELS[config.tone] || config.tone}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {config.language}
            </Badge>
          </div>
        </div>
      </div>

      {config.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{config.description}</p>
      )}

      {config.system_prompt && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt do sistema</p>
          <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono text-foreground/80 leading-relaxed">
            {expanded ? config.system_prompt : previewPrompt}
            {hasMore && !expanded && '...'}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                'flex items-center gap-1 text-xs text-[#10293F] dark:text-[#45E5E5] font-medium',
                'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45E5E5] rounded'
              )}
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Ver menos</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Ver mais</>
              )}
            </button>
          )}
        </div>
      )}

      {!config.name && !config.system_prompt && (
        <p className="text-sm text-muted-foreground italic text-center py-2">
          Descreva o agente no chat para ver a personalidade aqui.
        </p>
      )}
    </div>
  )
}
