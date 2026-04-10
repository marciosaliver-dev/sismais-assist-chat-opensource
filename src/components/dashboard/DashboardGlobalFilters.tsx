import { useMemo, useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PeriodSelector } from "@/components/layout/PeriodSelector"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import { useDashboardFilters } from "@/contexts/DashboardFilterContext"
import { useTicketLookups } from "@/hooks/useTicketReport"
import { cn } from "@/lib/utils"

export function DashboardGlobalFilters() {
  const { filters, setFilter, resetFilters, hasActiveFilters } = useDashboardFilters()
  const { categories, modules, humanAgents, aiAgents, boards } = useTicketLookups()
  const [expanded, setExpanded] = useState(false)

  const categoryOptions = useMemo(
    () => (categories.data || []).map((c) => ({ value: c.id, label: c.name, color: c.color || undefined })),
    [categories.data],
  )
  const moduleOptions = useMemo(
    () => (modules.data || []).map((m) => ({ value: m.id, label: m.name })),
    [modules.data],
  )
  const boardOptions = useMemo(
    () => (boards.data || []).map((b) => ({ value: b.id, label: b.name })),
    [boards.data],
  )
  const humanAgentOptions = useMemo(
    () => (humanAgents.data || []).map((a) => ({ value: a.id, label: a.name })),
    [humanAgents.data],
  )
  const aiAgentOptions = useMemo(
    () => (aiAgents.data || []).map((a) => ({ value: a.id, label: a.name })),
    [aiAgents.data],
  )

  const activeCount = [
    filters.categoryIds,
    filters.moduleIds,
    filters.boardIds,
    filters.humanAgentIds,
    filters.aiAgentIds,
  ].filter((arr) => arr.length > 0).length

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {/* Período — sempre visível */}
      <PeriodSelector
        value={filters.period}
        onChange={(v) => setFilter("period", v)}
      />

      {/* Botão expandir filtros */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 gap-1.5 text-sm",
          (expanded || hasActiveFilters) && "border-[#45E5E5] text-[#10293F]",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <Filter className="h-3.5 w-3.5" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-[#45E5E5] text-[#10293F] text-[10px] font-bold px-1.5">
            {activeCount}
          </span>
        )}
      </Button>

      {/* Filtros expandidos */}
      {expanded && (
        <>
          <MultiSelectCombobox
            options={categoryOptions}
            selected={filters.categoryIds}
            onChange={(v) => setFilter("categoryIds", v)}
            placeholder="Categorias"
            searchPlaceholder="Buscar categoria..."
          />
          <MultiSelectCombobox
            options={moduleOptions}
            selected={filters.moduleIds}
            onChange={(v) => setFilter("moduleIds", v)}
            placeholder="Módulos"
            searchPlaceholder="Buscar módulo..."
          />
          <MultiSelectCombobox
            options={boardOptions}
            selected={filters.boardIds}
            onChange={(v) => setFilter("boardIds", v)}
            placeholder="Boards"
            searchPlaceholder="Buscar board..."
          />
          <MultiSelectCombobox
            options={humanAgentOptions}
            selected={filters.humanAgentIds}
            onChange={(v) => setFilter("humanAgentIds", v)}
            placeholder="Equipe"
            searchPlaceholder="Buscar agente..."
          />
          <MultiSelectCombobox
            options={aiAgentOptions}
            selected={filters.aiAgentIds}
            onChange={(v) => setFilter("aiAgentIds", v)}
            placeholder="Agentes IA"
            searchPlaceholder="Buscar agente IA..."
          />

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-xs text-muted-foreground hover:text-destructive"
              onClick={resetFilters}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </>
      )}
    </div>
  )
}
