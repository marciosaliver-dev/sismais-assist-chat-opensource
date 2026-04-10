import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X, ToggleLeft } from 'lucide-react'
import { FILTER_FIELDS, FILTER_OPERATORS, type FilterFieldDef, type FilterFieldOption } from '@/data/automationConfig'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useMemo } from 'react'

interface FilterCondition {
  field: string
  operator: string
  value: string
}

interface Filters {
  logic: 'AND' | 'OR'
  conditions: FilterCondition[]
}

interface FilterBuilderProps {
  filters: Filters
  onChange: (f: Filters) => void
}

export function FilterBuilder({ filters, onChange }: FilterBuilderProps) {
  // Fetch dynamic data
  const { data: kanbanStages } = useQuery({
    queryKey: ['filter-kanban-stages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('kanban_stages')
        .select('id, name, board_id, kanban_boards(name)')
        .eq('active', true)
        .order('sort_order')
      return data || []
    },
  })

  const { data: humanAgents } = useQuery({
    queryKey: ['filter-human-agents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('human_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      return data || []
    },
  })

  const { data: aiAgents } = useQuery({
    queryKey: ['filter-ai-agents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      return data || []
    },
  })

  const dynamicOptions = useMemo(() => {
    const stageOpts: FilterFieldOption[] = (kanbanStages || []).map((s: any) => ({
      value: s.id,
      label: s.kanban_boards?.name ? `${s.kanban_boards.name} → ${s.name}` : s.name,
    }))

    const agentOpts: FilterFieldOption[] = [
      ...(humanAgents || []).map(a => ({ value: a.id, label: `👤 ${a.name}` })),
      ...(aiAgents || []).map(a => ({ value: a.id, label: `🤖 ${a.name}` })),
    ]

    return {
      'dynamic:kanban_stages': stageOpts,
      'dynamic:agents': agentOpts,
    } as Record<string, FilterFieldOption[]>
  }, [kanbanStages, humanAgents, aiAgents])

  const getOptionsForField = (fieldValue: string): FilterFieldOption[] | null => {
    const fieldDef = FILTER_FIELDS.find(f => f.value === fieldValue)
    if (!fieldDef) return null
    if (fieldDef.valueType === 'static' && fieldDef.staticOptions) return fieldDef.staticOptions
    if (fieldDef.valueType && fieldDef.valueType.startsWith('dynamic:')) return dynamicOptions[fieldDef.valueType] || []
    return null
  }

  const addCondition = () => {
    onChange({
      ...filters,
      conditions: [...filters.conditions, { field: '', operator: 'equals', value: '' }],
    })
  }

  const removeCondition = (index: number) => {
    onChange({
      ...filters,
      conditions: filters.conditions.filter((_, i) => i !== index),
    })
  }

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    onChange({
      ...filters,
      conditions: filters.conditions.map((c, i) => {
        if (i !== index) return c
        // Clear value when field changes
        if (updates.field && updates.field !== c.field) {
          return { ...c, ...updates, value: '' }
        }
        return { ...c, ...updates }
      }),
    })
  }

  const toggleLogic = () => {
    onChange({ ...filters, logic: filters.logic === 'AND' ? 'OR' : 'AND' })
  }

  const fieldGroups = [...new Set(FILTER_FIELDS.map(f => f.group))]

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {filters.conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleLogic} className="text-xs h-7 gap-1">
            <ToggleLeft className="w-3 h-3" />
            Lógica: <Badge variant="secondary" className="text-[9px] ml-1">{filters.logic}</Badge>
          </Button>
          <span className="text-xs text-muted-foreground">
            {filters.logic === 'AND' ? 'Todas as condições devem ser verdadeiras' : 'Pelo menos uma condição deve ser verdadeira'}
          </span>
        </div>
      )}

      {filters.conditions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">Nenhum filtro adicionado (executa para todos os casos)</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filters.conditions.map((condition, idx) => {
            const options = getOptionsForField(condition.field)
            return (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && (
                  <Badge variant="outline" className="text-[9px] shrink-0 w-8 justify-center">{filters.logic}</Badge>
                )}
                <Select value={condition.field} onValueChange={(v) => updateCondition(idx, { field: v })}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Campo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldGroups.map(group => (
                      <div key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{group}</div>
                        {FILTER_FIELDS.filter(f => f.group === group).map(f => (
                          <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={condition.operator} onValueChange={(v) => updateCondition(idx, { operator: v })}>
                  <SelectTrigger className="h-8 text-xs w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPERATORS.map(op => (
                      <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!['exists', 'not_exists'].includes(condition.operator) && (
                  options ? (
                    <Select value={condition.value} onValueChange={(v) => updateCondition(idx, { value: v })}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(idx, { value: e.target.value })}
                      placeholder="Valor..."
                      className="h-8 text-xs flex-1"
                    />
                  )
                )}

                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCondition(idx)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Button variant="outline" size="sm" className="text-xs w-full" onClick={addCondition}>
        <Plus className="w-3 h-3 mr-1" /> Adicionar Filtro
      </Button>
    </div>
  )
}
