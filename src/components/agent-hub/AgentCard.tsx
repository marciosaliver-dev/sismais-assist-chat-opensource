import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Edit2, FlaskConical, Copy, MoreVertical, MessageSquare, Star, CheckCircle2, Target, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMetric } from '@/hooks/useAgentMetrics'
import type { Tables } from '@/integrations/supabase/types'
import { specialtyMap } from '@/components/agents/agent-specialties'

type Agent = Tables<'ai_agents'>

interface AgentCardProps {
  agent: Agent & Partial<AgentMetric>
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
}

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  internal: 'Interno',
  omnichannel: 'Omnichannel',
}

export function AgentCard({ agent, onEdit, onDelete, onToggleActive }: AgentCardProps) {
  const navigate = useNavigate()
  const spec = specialtyMap[agent.specialty] || { emoji: '🤖', label: agent.specialty }

  const conversations = agent.conversations_today ?? 0
  const csat = (agent.avg_csat ?? 0).toFixed(1)
  const resolution = Math.round(agent.resolution_rate ?? 0)
  const confidence = Math.round((agent.avg_confidence ?? (agent.confidence_threshold ?? 0.7)) * 100)

  const accentColor = agent.color || '#45E5E5'

  // Extract tools and skills counts from support_config
  const supportConfig = (agent as any).support_config as Record<string, any> | null
  const toolsCount = Array.isArray((agent as any).tools) ? (agent as any).tools.length : 0
  const skillsCount = Array.isArray(supportConfig?.skills) ? supportConfig.skills.length : 0

  // Channels from support_config or default
  const channels: string[] = Array.isArray(supportConfig?.channels)
    ? supportConfig.channels
    : [(agent as any).channel_type || 'whatsapp']

  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-200',
        'hover:shadow-[0_4px_16px_rgba(16,41,63,0.12)] hover:-translate-y-0.5',
        !agent.is_active && 'opacity-60'
      )}
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            {spec.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  agent.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'
                )}
              />
              <p className="font-semibold text-foreground truncate">{agent.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">{spec.label}</p>
          </div>
        </div>

        {/* Toggle active */}
        <Switch
          checked={agent.is_active ?? false}
          onCheckedChange={(checked) => onToggleActive(agent.id, checked)}
          aria-label={`${agent.is_active ? 'Desativar' : 'Ativar'} agente ${agent.name}`}
          className="shrink-0 mt-0.5"
        />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-1 px-4 pb-3">
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 p-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">{conversations}</span>
          <span className="text-[10px] text-muted-foreground leading-tight text-center">hoje</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 p-2">
          <Star className="w-3.5 h-3.5 text-[#FFB800]" />
          <span className="text-sm font-bold text-foreground">{csat}</span>
          <span className="text-[10px] text-muted-foreground leading-tight text-center">CSAT</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 p-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-sm font-bold text-foreground">{resolution}%</span>
          <span className="text-[10px] text-muted-foreground leading-tight text-center">resolv.</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 p-2">
          <Target className="w-3.5 h-3.5 text-[#45E5E5]" />
          <span className="text-sm font-bold text-foreground">{confidence}%</span>
          <span className="text-[10px] text-muted-foreground leading-tight text-center">conf.</span>
        </div>
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 border-t border-border pt-2.5">
        {channels.slice(0, 2).map((ch) => (
          <Badge key={ch} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            📱 {channelLabels[ch] || ch}
          </Badge>
        ))}
        {skillsCount > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            🧠 {skillsCount} skills
          </Badge>
        )}
        {toolsCount > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            🔧 {toolsCount} tools
          </Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 flex-1"
          onClick={() => onEdit(agent)}
        >
          <Edit2 className="w-3 h-3" />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 flex-1"
          onClick={() => navigate(`/ai-builder?agent_id=${agent.id}`)}
        >
          <Wand2 className="w-3 h-3" />
          Editar com IA
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 flex-1"
          onClick={() => navigate(`/agents/playground/${agent.id}`)}
        >
          <FlaskConical className="w-3 h-3" />
          Testar
        </Button>

        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" aria-label="Mais opções">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/agents/${agent.id}/activity`)}>
              Ver atividade
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(agent.id)}
            >
              Excluir agente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
