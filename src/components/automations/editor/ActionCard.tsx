import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2, ChevronUp, ChevronDown, Clock } from 'lucide-react'
import { ALL_ACTIONS, CATEGORY_COLORS } from '@/data/automationConfig'

interface ActionCardProps {
  index: number
  action: { type: string; category: string; params: Record<string, any>; delay_minutes: number; on_error?: string }
  total: number
  onUpdate: (updates: any) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ActionCard({ index, action, total, onUpdate, onRemove, onMoveUp, onMoveDown }: ActionCardProps) {
  const actionDef = ALL_ACTIONS.find(a => a.type === action.type)
  const colors = CATEGORY_COLORS[action.category] || CATEGORY_COLORS.ticket
  const Icon = actionDef?.icon || Clock

  return (
    <div className={`rounded-xl border border-l-4 ${colors.border} bg-card overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 ${colors.bg}`}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] w-5 h-5 p-0 justify-center shrink-0">{index + 1}</Badge>
          <div className={`w-6 h-6 rounded-md ${colors.icon} flex items-center justify-center shrink-0`}>
            <Icon className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold">{actionDef?.label || action.type}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={onMoveUp}>
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === total - 1} onClick={onMoveDown}>
            <ChevronDown className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {actionDef?.fields?.map(field => (
          <div key={field.key}>
            <Label className="text-xs">{field.label}</Label>
            {field.type === 'textarea' ? (
              <Textarea
                value={action.params[field.key] || ''}
                onChange={(e) => onUpdate({ params: { ...action.params, [field.key]: e.target.value } })}
                placeholder={field.placeholder}
                className="text-xs mt-0.5"
                rows={2}
              />
            ) : field.type === 'select' && field.options ? (
              <Select value={action.params[field.key] || ''} onValueChange={(v) => onUpdate({ params: { ...action.params, [field.key]: v } })}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map(o => (
                    <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={field.type === 'number' ? 'number' : 'text'}
                value={action.params[field.key] || ''}
                onChange={(e) => onUpdate({ params: { ...action.params, [field.key]: e.target.value } })}
                placeholder={field.placeholder}
                className="h-8 text-xs mt-0.5"
              />
            )}
          </div>
        ))}

        {!actionDef?.fields?.length && (
          <p className="text-xs text-muted-foreground">Sem configurações adicionais</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/30">
        <Clock className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Delay:</span>
        <Input
          type="number"
          min={0}
          value={action.delay_minutes}
          onChange={(e) => onUpdate({ delay_minutes: parseInt(e.target.value) || 0 })}
          className="h-6 w-16 text-xs"
        />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
    </div>
  )
}
