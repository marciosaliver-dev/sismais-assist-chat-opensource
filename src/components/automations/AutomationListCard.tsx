import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Copy, BarChart3, Trash2, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CATEGORY_COLORS, TRIGGER_LABELS, TRIGGER_CATEGORY_MAP, ALL_TRIGGERS } from '@/data/automationConfig'
import type { Tables } from '@/integrations/supabase/types'

type Automation = Tables<'ai_automations'>

interface AutomationListCardProps {
  automation: Automation
  onEdit: (automation: Automation) => void
  onDuplicate: (automation: Automation) => void
  onDelete: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onViewLogs: (id: string) => void
}

export function AutomationListCard({
  automation, onEdit, onDuplicate, onDelete, onToggle, onViewLogs,
}: AutomationListCardProps) {
  const category = (automation as any).category || TRIGGER_CATEGORY_MAP[automation.trigger_type] || 'ticket'
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.ticket
  const triggerLabel = TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type
  const triggerDef = ALL_TRIGGERS.find(t => t.type === automation.trigger_type)
  const TriggerIcon = triggerDef?.icon || Zap

  return (
    <div className={`group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md border-l-4 ${colors.border} ${!automation.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg ${colors.icon} flex items-center justify-center shrink-0`}>
          <TriggerIcon className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{automation.name}</h3>
            {automation.is_active ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-xs gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ativa
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Inativa</Badge>
            )}
          </div>

          {automation.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{automation.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-xs ${colors.text}`}>
              {triggerLabel}
            </Badge>
            <Badge variant="secondary" className="text-xs capitalize">{category}</Badge>
            <span className="text-xs text-muted-foreground">
              Executada {automation.execution_count ?? 0}x
              {automation.last_executed_at && (
                <> · {formatDistanceToNow(new Date(automation.last_executed_at), { addSuffix: true, locale: ptBR })}</>
              )}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={automation.is_active ?? false}
            onCheckedChange={(checked) => onToggle(automation.id, checked)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(automation)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(automation)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewLogs(automation.id)}>
                <BarChart3 className="w-4 h-4 mr-2" /> Ver Logs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(automation.id)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
