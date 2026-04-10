import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  type ModelCatalogEntry, TIER_CONFIG, estimateCostPer1kMessages, formatModelCost,
} from '@/hooks/useModelCatalog'
import { useExchangeRate } from '@/hooks/useExchangeRate'

interface ModelComboboxProps {
  models: ModelCatalogEntry[]
  value: string
  onChange: (modelId: string) => void
  placeholder?: string
  showCostEstimate?: boolean
}

export function ModelCombobox({
  models,
  value,
  onChange,
  placeholder = 'Selecionar modelo...',
  showCostEstimate = true,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false)
  const { rate } = useExchangeRate()

  const selected = useMemo(() => models.find(m => m.model_id === value), [models, value])

  const grouped = useMemo(() => {
    const map = new Map<string, ModelCatalogEntry[]>()
    for (const m of models) {
      const list = map.get(m.provider) || []
      list.push(m)
      map.set(m.provider, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [models])

  const costEstimate = useMemo(() => {
    if (!selected) return null
    const usd = estimateCostPer1kMessages(selected, 500, 300)
    return { usd, brl: usd * rate }
  }, [selected, rate])

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 font-normal text-sm"
          >
            {selected ? (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{selected.display_name}</span>
                <Badge className={cn('text-xs px-1 py-0 shrink-0', TIER_CONFIG[selected.tier]?.badgeClass)}>
                  {TIER_CONFIG[selected.tier]?.label}
                </Badge>
                <span className="text-muted-foreground text-xs shrink-0">{selected.provider}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[450px] p-0 overflow-hidden" align="start">
          <Command>
            <CommandInput placeholder="Buscar modelo..." />
            <CommandList>
              <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
              {grouped.map(([provider, items]) => (
                <CommandGroup key={provider} heading={provider}>
                  {items.map(m => {
                    const tierCfg = TIER_CONFIG[m.tier]
                    return (
                      <CommandItem
                        key={m.id}
                        value={`${m.display_name} ${m.model_id} ${m.provider}`}
                        onSelect={() => {
                          onChange(m.model_id)
                          setOpen(false)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check className={cn('h-3.5 w-3.5 shrink-0', value === m.model_id ? 'opacity-100' : 'opacity-0')} />
                        <span className="flex-1 truncate text-sm">{m.display_name}</span>
                        {tierCfg && (
                          <Badge className={cn('text-[9px] px-1 py-0 shrink-0', tierCfg.badgeClass)}>
                            {tierCfg.label}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0 font-mono">
                          {formatModelCost(m.input_cost_per_1m)}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showCostEstimate && selected && costEstimate && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DollarSign className="w-3 h-3" />
          <span>
            Estimativa: <strong className="text-foreground">~${costEstimate.usd.toFixed(2)}/mês</strong>
            {' '}(R$ {costEstimate.brl.toFixed(2)}) para 1.000 conversas
          </span>
        </div>
      )}
    </div>
  )
}
