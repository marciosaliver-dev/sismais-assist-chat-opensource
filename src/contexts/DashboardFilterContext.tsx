import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"
import { type PeriodValue, computeDatesForPeriod } from "@/components/layout/PeriodSelector"
import { useDebounce } from "@/hooks/useDebounce"

export interface DashboardFilters {
  period: PeriodValue
  categoryIds: string[]
  moduleIds: string[]
  boardIds: string[]
  humanAgentIds: string[]
  aiAgentIds: string[]
}

interface DashboardFilterContextValue {
  filters: DashboardFilters
  debouncedFilters: DashboardFilters
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void
  resetFilters: () => void
  hasActiveFilters: boolean
}

const defaultPeriod: PeriodValue = {
  preset: "today",
  ...computeDatesForPeriod("today"),
}

const defaultFilters: DashboardFilters = {
  period: defaultPeriod,
  categoryIds: [],
  moduleIds: [],
  boardIds: [],
  humanAgentIds: [],
  aiAgentIds: [],
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null)

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters)
  const debouncedFilters = useDebounce(filters, 300)

  const setFilter = useCallback(<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  const hasActiveFilters = useMemo(() => {
    return (
      filters.categoryIds.length > 0 ||
      filters.moduleIds.length > 0 ||
      filters.boardIds.length > 0 ||
      filters.humanAgentIds.length > 0 ||
      filters.aiAgentIds.length > 0
    )
  }, [filters])

  const value = useMemo(
    () => ({ filters, debouncedFilters, setFilter, resetFilters, hasActiveFilters }),
    [filters, debouncedFilters, setFilter, resetFilters, hasActiveFilters],
  )

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  )
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFilterContext)
  if (!ctx) throw new Error("useDashboardFilters must be used within DashboardFilterProvider")
  return ctx
}
