import { useState, useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface SearchableFilterSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  placeholder: string
  allLabel: string
  icon: React.ReactNode
  isActive: boolean
}

export function SearchableFilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  allLabel,
  icon,
  isActive,
}: SearchableFilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return options
    const s = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(s))
  }, [options, search])

  const selectedLabel = value && value !== 'all'
    ? options.find(o => o.value === value)?.label || placeholder
    : allLabel

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setSearch('') }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center h-[30px] rounded-full border-[1.5px] text-xs font-medium gap-1.5 px-3 whitespace-nowrap transition-colors',
            isActive
              ? 'bg-primary/10 border-primary/40 text-foreground font-semibold'
              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
        >
          {icon}
          <span className="truncate max-w-[120px]">{selectedLabel}</span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="flex items-center border-b px-2 py-1.5">
          <Search className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 border-0 shadow-none text-xs focus-visible:ring-0 p-0"
            autoFocus
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          <button
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors',
              (!value || value === 'all') && 'font-semibold'
            )}
            onClick={() => { onValueChange('all'); setOpen(false) }}
          >
            <Check className={cn('w-3.5 h-3.5', (!value || value === 'all') ? 'opacity-100' : 'opacity-0')} />
            {allLabel}
          </button>
          {filtered.map(o => (
            <button
              key={o.value}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors',
                value === o.value && 'font-semibold'
              )}
              onClick={() => { onValueChange(o.value); setOpen(false) }}
            >
              <Check className={cn('w-3.5 h-3.5', value === o.value ? 'opacity-100' : 'opacity-0')} />
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum resultado</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
