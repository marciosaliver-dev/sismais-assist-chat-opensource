import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Check } from 'lucide-react'
import { TRIGGER_CATEGORIES, CATEGORY_COLORS } from '@/data/automationConfig'

interface TriggerSelectorProps {
  selectedTrigger: string
  onSelect: (type: string, category: string) => void
  options?: Record<string, any>
  onOptionsChange?: (opts: Record<string, any>) => void
}

export function TriggerSelector({ selectedTrigger, onSelect }: TriggerSelectorProps) {
  const [expanded, setExpanded] = useState<string[]>(['Mensagens', 'Ticket'])

  const toggleCategory = (name: string) => {
    setExpanded(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  if (selectedTrigger) {
    const cat = TRIGGER_CATEGORIES.find(c => c.triggers.some(t => t.type === selectedTrigger))
    const trigger = cat?.triggers.find(t => t.type === selectedTrigger)
    if (trigger) {
      const Icon = trigger.icon
      const colors = CATEGORY_COLORS[cat!.category] || CATEGORY_COLORS.ticket
      return (
        <div className={`rounded-xl border p-4 ${colors.bg} border-l-4 ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${colors.icon} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{trigger.label}</h3>
                <p className="text-xs text-muted-foreground">{trigger.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onSelect('', '')} className="text-xs">
              Trocar
            </Button>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <p className="text-xs text-muted-foreground mb-3">Selecione o gatilho que inicia esta automação:</p>
      {TRIGGER_CATEGORIES.map(cat => {
        const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.ticket
        const isOpen = expanded.includes(cat.name)
        return (
          <Collapsible key={cat.name} open={isOpen} onOpenChange={() => toggleCategory(cat.name)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors.icon}`} />
                <span className="text-xs font-semibold">{cat.name}</span>
                <Badge variant="secondary" className="text-[9px]">{cat.triggers.length}</Badge>
              </div>
              <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              {cat.triggers.map(trigger => {
                const Icon = trigger.icon
                const isSelected = selectedTrigger === trigger.type
                return (
                  <button
                    key={trigger.type}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-left transition-colors ${
                      isSelected ? `${colors.bg} border ${colors.border}` : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onSelect(trigger.type, cat.category)}
                  >
                    <div className={`w-7 h-7 rounded-md ${colors.icon} flex items-center justify-center shrink-0`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{trigger.label}</p>
                      <p className="text-xs text-muted-foreground">{trigger.description}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
