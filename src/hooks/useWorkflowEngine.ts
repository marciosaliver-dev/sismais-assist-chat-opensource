/**
 * useWorkflowEngine — Hook unificado de automacoes
 *
 * Combina dados de ai_automations e flow_automations em uma
 * interface unica. Usado na pagina de Automacoes para apresentar
 * uma visao consolidada enquanto a migracao gradual acontece.
 */

import { useMemo } from 'react'
import { useAutomations } from '@/hooks/useAutomations'
import { useFlowAutomations } from '@/hooks/useFlowAutomations'

export interface UnifiedWorkflow {
  id: string
  name: string
  description: string | null
  triggerType: string
  isActive: boolean
  executionCount: number
  lastExecutedAt: string | null
  source: 'legacy' | 'flow'
  /** Para legacy: links para /automations/:id. Para flow: /flow-builder/:id */
  editPath: string
  createdAt: string | null
  raw: any
}

export function useWorkflowEngine() {
  const {
    automations,
    isLoading: loadingLegacy,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
  } = useAutomations()

  const {
    flows,
    isLoading: loadingFlows,
    createFlow,
    updateFlow,
    deleteFlow,
    toggleFlow,
  } = useFlowAutomations()

  const isLoading = loadingLegacy || loadingFlows

  const unified = useMemo<UnifiedWorkflow[]>(() => {
    const result: UnifiedWorkflow[] = []

    // Legacy automations
    for (const a of automations ?? []) {
      result.push({
        id: a.id,
        name: a.name,
        description: a.description || null,
        triggerType: a.trigger_type,
        isActive: a.is_active ?? false,
        executionCount: a.execution_count ?? 0,
        lastExecutedAt: a.last_executed_at ?? null,
        source: 'legacy',
        editPath: `/automations/${a.id}`,
        createdAt: a.created_at ?? null,
        raw: a,
      })
    }

    // Flow automations
    for (const f of flows ?? []) {
      result.push({
        id: f.id,
        name: f.name,
        description: f.description || null,
        triggerType: f.trigger_type,
        isActive: f.is_active,
        executionCount: f.execution_count,
        lastExecutedAt: f.last_executed_at ?? null,
        source: 'flow',
        editPath: `/flow-builder/${f.id}`,
        createdAt: f.created_at ?? null,
        raw: f,
      })
    }

    // Ordenar por data de criacao desc
    result.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return db - da
    })

    return result
  }, [automations, flows])

  // Stats
  const stats = useMemo(() => ({
    total: unified.length,
    active: unified.filter(w => w.isActive).length,
    totalExecutions: unified.reduce((s, w) => s + w.executionCount, 0),
    legacyCount: unified.filter(w => w.source === 'legacy').length,
    flowCount: unified.filter(w => w.source === 'flow').length,
  }), [unified])

  return {
    workflows: unified,
    isLoading,
    stats,
    // Delegate mutations
    legacy: { createAutomation, updateAutomation, deleteAutomation, toggleAutomation },
    flow: { createFlow, updateFlow, deleteFlow, toggleFlow },
  }
}
