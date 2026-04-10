import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings, Trash2, FlaskConical, GraduationCap, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '@/integrations/supabase/types'
import { cn } from '@/lib/utils'

type Agent = Tables<'ai_agents'>

interface AgentListCardProps {
  agent: Agent & {
    todayConversations?: number
    todaySuccessRate?: number
  }
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
  onTest: (agent: Agent) => void
  onRetrain?: (agent: Agent) => void
}

import { specialtyMap } from './agent-specialties'

const channelTypeMap: Record<string, string> = {
  whatsapp: '📱 WhatsApp',
  internal: '🤝 Interno',
  omnichannel: '🌐 Omnichannel',
}



const modelLabels: Record<string, string> = {
  'google/gemini-flash-1.5': 'Gemini Flash 1.5',
  'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
  'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  'openai/gpt-4o': 'GPT-4o',
  'anthropic/claude-3-haiku': 'Claude 3 Haiku',
  'x-ai/grok-beta': 'Grok Beta',
}

export function AgentListCard({ agent, onEdit, onDelete, onTest, onRetrain }: AgentListCardProps) {
  const navigate = useNavigate()
  const spec = specialtyMap[agent.specialty] || { emoji: '🤖', label: agent.specialty }

  const modelShort = modelLabels[agent.model] || agent.model?.split('/').pop() || agent.model

  return (
    <Card className={cn(
      "border-border hover:border-[#45E5E5]/40 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all",
      !agent.is_active && "opacity-60"
    )}>
      <CardContent className="p-5 space-y-3">
        {/* Header: avatar + name + status + actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${agent.color}20` }}
            >
              {spec.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{agent.name}</p>
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                  agent.is_active
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", agent.is_active ? "bg-emerald-500" : "bg-muted-foreground")} />
                  {agent.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{spec.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {onRetrain && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRetrain(agent)} title="Retreinar" aria-label="Retreinar agente via chat">
                <GraduationCap className="w-4 h-4 text-[#45E5E5]" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/agents/${agent.id}/activity`)} title="Atividade" aria-label="Ver histórico de atividades">
              <Activity className="w-4 h-4 text-[#10B981]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onTest(agent)} title="Playground" aria-label="Testar agente no playground">
              <FlaskConical className="w-4 h-4 text-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(agent)} title="Editar" aria-label="Editar agente">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(agent.id)} title="Excluir" aria-label="Excluir agente">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
        )}

        {/* Config row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{channelTypeMap[(agent as any).channel_type] || '📱 WhatsApp'}</span>
          <span className="truncate max-w-[140px]" title={agent.model}>{modelShort}</span>
          <span>Confiança {Math.round((agent.confidence_threshold ?? 0.7) * 100)}%</span>
          <span>Prioridade {agent.priority}</span>
        </div>

        {/* Metrics footer */}
        <div className="flex items-center gap-4 border-t border-border pt-3 text-xs">
          <span className="font-semibold text-foreground">{agent.todayConversations || 0} <span className="font-normal text-muted-foreground">conversas</span></span>
          <span className="font-semibold text-foreground">{agent.todaySuccessRate || 0}% <span className="font-normal text-muted-foreground">sucesso</span></span>
          <span className="font-semibold text-foreground">{(agent.avg_csat ?? 0).toFixed(1)}/5 <span className="font-normal text-muted-foreground">CSAT</span></span>
        </div>
      </CardContent>
    </Card>
  )
}
