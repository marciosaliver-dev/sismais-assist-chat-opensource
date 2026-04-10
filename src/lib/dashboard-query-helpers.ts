import type { DashboardFilters } from "@/contexts/DashboardFilterContext"

/**
 * Aplica filtros globais do dashboard a uma query Supabase em ai_conversations.
 * Retorna a mesma query com .in() para cada array não-vazio.
 */
export function applyDashboardFilters<T extends { in: (col: string, values: string[]) => T; gte: (col: string, val: string) => T; lte: (col: string, val: string) => T; or: (filter: string) => T }>(
  query: T,
  filters: DashboardFilters,
  options?: { skipPeriod?: boolean },
): T {
  let q = query

  if (!options?.skipPeriod) {
    q = q.gte("started_at", filters.period.from.toISOString())
    q = q.lte("started_at", filters.period.to.toISOString())
  }

  // Excluir descartados
  q = q.or("is_discarded.is.null,is_discarded.eq.false")

  if (filters.categoryIds.length > 0) {
    q = q.in("ticket_category_id", filters.categoryIds)
  }
  if (filters.moduleIds.length > 0) {
    q = q.in("ticket_module_id", filters.moduleIds)
  }
  if (filters.boardIds.length > 0) {
    q = q.in("kanban_board_id", filters.boardIds)
  }
  if (filters.humanAgentIds.length > 0) {
    q = q.in("human_agent_id", filters.humanAgentIds)
  }
  if (filters.aiAgentIds.length > 0) {
    q = q.in("current_agent_id", filters.aiAgentIds)
  }

  return q
}
