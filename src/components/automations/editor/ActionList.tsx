import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ActionCard } from './ActionCard'
import { ACTION_CATEGORIES, CATEGORY_COLORS, type ActionDef } from '@/data/automationConfig'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

interface ActionItem {
  type: string
  category: string
  params: Record<string, any>
  delay_minutes: number
  on_error?: string
}

interface ActionListProps {
  actions: ActionItem[]
  onChange: (actions: ActionItem[]) => void
}

export function ActionList({ actions, onChange }: ActionListProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)

  const addAction = (actionDef: ActionDef) => {
    const params: Record<string, any> = {}
    actionDef.fields?.forEach(f => { params[f.key] = '' })
    onChange([...actions, {
      type: actionDef.type,
      category: actionDef.category,
      params,
      delay_minutes: 0,
      on_error: 'continue',
    }])
    setSelectorOpen(false)
  }

  const updateAction = (index: number, updates: Partial<ActionItem>) => {
    onChange(actions.map((a, i) => i === index ? { ...a, ...updates } : a))
  }

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index))
  }

  const moveAction = (index: number, direction: 'up' | 'down') => {
    const newActions = [...actions]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newActions.length) return
    ;[newActions[index], newActions[targetIndex]] = [newActions[targetIndex], newActions[index]]
    onChange(newActions)
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {actions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">Nenhuma ação adicionada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => (
            <ActionCard
              key={idx}
              index={idx}
              action={action}
              total={actions.length}
              onUpdate={(updates) => updateAction(idx, updates)}
              onRemove={() => removeAction(idx)}
              onMoveUp={() => moveAction(idx, 'up')}
              onMoveDown={() => moveAction(idx, 'down')}
            />
          ))}
        </div>
      )}

      <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs w-full">
            <Plus className="w-3 h-3 mr-1" /> Adicionar Ação
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-3 max-h-[400px] overflow-y-auto" align="start">
          <p className="text-xs font-semibold mb-2">Selecione uma ação:</p>
          {ACTION_CATEGORIES.map(cat => {
            const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.ticket
            return (
              <div key={cat.name} className="mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.icon}`} />
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{cat.name}</span>
                </div>
                <div className="space-y-0.5">
                  {cat.actions.map(actionDef => {
                    const Icon = actionDef.icon
                    return (
                      <button
                        key={actionDef.type}
                        className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted/50 text-left transition-colors"
                        onClick={() => addAction(actionDef as ActionDef)}
                      >
                        <div className={`w-6 h-6 rounded-md ${colors.icon} flex items-center justify-center shrink-0`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{actionDef.label}</p>
                          <p className="text-xs text-muted-foreground">{actionDef.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </PopoverContent>
      </Popover>
    </div>
  )
}
