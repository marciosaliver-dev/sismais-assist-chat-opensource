import { Bot, TrendingUp, BookOpen, Edit, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Tables } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>

interface SpecialtyCardProps {
  agent: Agent
  onEdit: (agent: Agent) => void
  onTest: (agent: Agent) => void
}

const SPECIALTY_LABELS: Record<string, string> = {
  triage:    'Triagem',
  support:   'Suporte',
  financial: 'Financeiro',
  sales:     'Vendas',
  sdr:       'SDR',
  copilot:   'Copiloto',
  analytics: 'Analítico',
}

const SPECIALTY_COLORS: Record<string, string> = {
  triage:    'bg-purple-500/10 text-purple-500 border-purple-500/20',
  support:   'bg-blue-500/10 text-blue-500 border-blue-500/20',
  financial: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  sales:     'bg-orange-500/10 text-orange-500 border-orange-500/20',
  sdr:       'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  copilot:   'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  analytics: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
}

export function SpecialtyCard({ agent, onEdit, onTest }: SpecialtyCardProps) {
  const specialty = agent.specialty || 'support'
  const isActive = agent.is_active

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 transition-all hover:shadow-md',
      isActive ? 'border-border' : 'border-dashed border-border opacity-60'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            SPECIALTY_COLORS[specialty] || SPECIALTY_COLORS.support
          )}>
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{agent.name}</span>
              <Badge variant="outline" className={cn(
                'text-xs shrink-0',
                SPECIALTY_COLORS[specialty] || SPECIALTY_COLORS.support
              )}>
                {SPECIALTY_LABELS[specialty] || specialty}
              </Badge>
              {!isActive && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Inativa
                </Badge>
              )}
              {specialty === 'triage' && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                  ⚡ Sempre ativa
                </Badge>
              )}
            </div>
            {agent.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onTest(agent)}>
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(agent)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
        {agent.rag_enabled && (
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> RAG ativo
          </span>
        )}
        {agent.model && (
          <span className="truncate">{agent.model.split('/').pop()}</span>
        )}
        {typeof agent.confidence_threshold === 'number' && (
          <span className="flex items-center gap-1 ml-auto">
            <TrendingUp className="h-3 w-3" />
            Escalar &lt; {agent.confidence_threshold}%
          </span>
        )}
      </div>
    </div>
  )
}
