import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface AutomationFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  triggerFilter: string
  onTriggerFilterChange: (v: string) => void
  categoryFilter: string
  onCategoryFilterChange: (v: string) => void
  onlyMine: boolean
  onOnlyMineChange: (v: boolean) => void
}

const TRIGGER_OPTIONS = [
  { value: 'all', label: 'Todos os Gatilhos' },
  { value: 'message_received', label: 'Mensagem Recebida' },
  { value: 'ticket_created', label: 'Ticket Criado' },
  { value: 'status_changed', label: 'Status Alterado' },
  { value: 'stage_changed', label: 'Etapa Alterada' },
  { value: 'scheduled', label: 'Agendamento' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'csat_received', label: 'CSAT Recebido' },
  { value: 'sla_breached', label: 'SLA Violado' },
  { value: 'conversation_closed', label: 'Ticket Resolvido' },
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todas as Categorias' },
  { value: 'mensagens', label: 'Mensagens' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'ia', label: 'IA' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'sistema', label: 'Sistema' },
]

export function AutomationFilters({
  search, onSearchChange, triggerFilter, onTriggerFilterChange,
  categoryFilter, onCategoryFilterChange, onlyMine, onOnlyMineChange,
}: AutomationFiltersProps) {
  const hasFilters = search || triggerFilter !== 'all' || categoryFilter !== 'all' || onlyMine

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar automação..."
          className="pl-9 h-9"
        />
      </div>

      <Select value={triggerFilter} onValueChange={onTriggerFilterChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Tipo de Gatilho" />
        </SelectTrigger>
        <SelectContent>
          {TRIGGER_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch id="only-mine" checked={onlyMine} onCheckedChange={onOnlyMineChange} />
        <Label htmlFor="only-mine" className="text-xs text-muted-foreground cursor-pointer">Minhas</Label>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            onSearchChange('')
            onTriggerFilterChange('all')
            onCategoryFilterChange('all')
            onOnlyMineChange(false)
          }}
        >
          <X className="w-3 h-3 mr-1" /> Limpar
        </Button>
      )}
    </div>
  )
}
