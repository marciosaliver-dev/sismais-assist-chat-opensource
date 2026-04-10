import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Zap, Users } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { Skill } from '@/hooks/useAgentSkills'

interface Props {
  skill: Skill
  agentCount?: number
  isAssigned?: boolean
  isEnabled?: boolean
  onToggle?: (enabled: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
  compact?: boolean
}

const categoryLabels: Record<string, string> = {
  atendimento: 'Atendimento',
  financeiro: 'Financeiro',
  vendas: 'Vendas',
  tecnico: 'Técnico',
  interno: 'Interno',
  general: 'Geral',
}

const categoryColors: Record<string, string> = {
  atendimento: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  financeiro: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  vendas: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  tecnico: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  interno: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  general: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

function getIcon(iconName: string | null) {
  if (!iconName) return Zap
  const Icon = (LucideIcons as Record<string, any>)[iconName]
  return Icon || Zap
}

export function SkillCard({ skill, agentCount, isAssigned, isEnabled, onToggle, onEdit, onDelete, compact }: Props) {
  const Icon = getIcon(skill.icon)

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
          isEnabled ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${skill.color}20`, color: skill.color || '#6366f1' }}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
          <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
        </div>

        {onToggle && (
          <Switch
            checked={isEnabled ?? false}
            onCheckedChange={onToggle}
          />
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${skill.color}20`, color: skill.color || '#6366f1' }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">{skill.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-xs ${categoryColors[skill.category] || categoryColors.general}`}>
                {categoryLabels[skill.category] || skill.category}
              </Badge>
              {skill.auto_activate && (
                <Badge variant="secondary" className="text-xs">Auto</Badge>
              )}
              {skill.is_system && (
                <Badge variant="secondary" className="text-xs">Sistema</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && !skill.is_system && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{skill.description}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {(skill.trigger_keywords?.length ?? 0) > 0 && (
            <span>{skill.trigger_keywords!.length} keywords</span>
          )}
          {(skill.trigger_intents?.length ?? 0) > 0 && (
            <span>{skill.trigger_intents!.length} intents</span>
          )}
          {(skill.tool_ids?.length ?? 0) > 0 && (
            <span>{skill.tool_ids!.length} tools</span>
          )}
        </div>
        {agentCount !== undefined && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{agentCount} agente{agentCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
