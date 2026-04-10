import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface StageAutomation {
  id: string
  kanban_stage_id: string
  flow_automation_id: string | null
  trigger_type: 'on_enter' | 'on_exit'
  action_type: string
  action_config: Record<string, any>
  active: boolean
  sort_order: number
  created_at: string
  flow_name?: string
}

export type ActionType =
  | 'change_ticket_status'
  | 'assign_agent'
  | 'send_message'
  | 'add_tag'
  | 'run_flow'
  | 'notify'
  | 'change_priority'
  | 'move_to_stage'
  | 'move_to_board'
  | 'assign_ai'
  | 'send_internal_message'
  | 'remove_tag'
  | 'change_category'
  | 'change_module'
  | 'create_conversation'
  | 'send_webhook'

export function getActionSummary(actionType: string, config: Record<string, any>): string {
  switch (actionType) {
    case 'change_ticket_status':
      return `Mudar status para ${config.status_name || 'N/A'}`
    case 'assign_agent':
      return config.agent_id === 'round_robin'
        ? 'Atribuir ao próximo agente disponível'
        : `Atribuir a ${config.agent_name || 'agente'}`
    case 'send_message': {
      const msg = (config.message || '').substring(0, 40)
      const delay = config.delay_minutes ? ` (após ${config.delay_minutes}min)` : ''
      return `Enviar: "${msg}..."${delay}`
    }
    case 'add_tag':
      return `Adicionar tag: ${config.tag || 'N/A'}`
    case 'run_flow':
      return `Executar fluxo: ${config.flow_name || 'N/A'}`
    case 'notify': {
      const targetMap: Record<string, string> = {
        assigned_agent: 'agente responsável',
        all_agents: 'todos os agentes',
        supervisor: 'supervisor',
      }
      return `Notificar ${targetMap[config.target] || config.target}`
    }
    case 'change_priority': {
      const prioMap: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Crítica' }
      return `Alterar prioridade para ${prioMap[config.priority] || config.priority}`
    }
    case 'move_to_stage':
      return `Mover para etapa: ${config.stage_name || 'N/A'}`
    case 'move_to_board':
      return `Mover para board: ${config.board_name || 'N/A'}`
    case 'assign_ai':
      return `Atribuir IA: ${config.agent_name || 'N/A'}`
    case 'send_internal_message': {
      const msg = (config.message || '').substring(0, 40)
      return `Nota interna: "${msg}..."`
    }
    case 'remove_tag':
      return `Remover tag: ${config.tag || 'N/A'}`
    case 'change_category':
      return `Alterar categoria: ${config.category_name || 'N/A'}`
    case 'change_module':
      return `Alterar módulo: ${config.module_name || 'N/A'}`
    case 'create_conversation':
      return `Criar novo atendimento`
    case 'send_webhook': {
      const method = config.method || 'POST'
      const url = (config.url || '').substring(0, 30)
      return `Webhook ${method}: ${url}...`
    }
    case 'run_automation':
      return `Executar: ${config.automation_name || 'Automação'}`
    default:
      return actionType
  }
}

export function useStageAutomations(stageId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['stage-automations', stageId]

  const { data: automations = [], isLoading } = useQuery({
    queryKey,
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('kanban_stage_automations')
        .select('id, kanban_stage_id, flow_automation_id, trigger_type, action_type, action_config, active, sort_order, created_at')
        .eq('kanban_stage_id', stageId)
        .order('sort_order')

      if (error) throw error

      const flowIds = [...new Set((data || []).map((d: any) => d.flow_automation_id).filter(Boolean))] as string[]
      const flowMap = new Map<string, string>()
      if (flowIds.length > 0) {
        const { data: flows } = await supabase
          .from('flow_automations')
          .select('id, name')
          .in('id', flowIds)
        for (const f of flows || []) {
          flowMap.set(f.id, f.name)
        }
      }

      return (data || []).map((d: any) => ({
        ...d,
        flow_name: d.flow_automation_id ? flowMap.get(d.flow_automation_id) || 'Fluxo desconhecido' : undefined,
      })) as StageAutomation[]
    },
  })

  const addAction = useMutation({
    mutationFn: async (params: {
      triggerType: 'on_enter' | 'on_exit'
      actionType: string
      actionConfig: Record<string, any>
      flowAutomationId?: string | null
    }) => {
      const maxSort = automations
        .filter(a => a.trigger_type === params.triggerType)
        .reduce((max, a) => Math.max(max, a.sort_order), -1)

      const { error } = await (supabase as any)
        .from('kanban_stage_automations')
        .insert({
          kanban_stage_id: stageId,
          trigger_type: params.triggerType,
          action_type: params.actionType,
          action_config: params.actionConfig,
          flow_automation_id: params.flowAutomationId || null,
          sort_order: maxSort + 1,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success('Ação adicionada')
    },
    onError: () => toast.error('Erro ao adicionar ação'),
  })

  const updateAction = useMutation({
    mutationFn: async (params: {
      id: string
      actionConfig?: Record<string, any>
      active?: boolean
      flowAutomationId?: string | null
    }) => {
      const updates: any = {}
      if (params.actionConfig !== undefined) updates.action_config = params.actionConfig
      if (params.active !== undefined) updates.active = params.active
      if (params.flowAutomationId !== undefined) updates.flow_automation_id = params.flowAutomationId

      const { error } = await (supabase as any)
        .from('kanban_stage_automations')
        .update(updates)
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('Erro ao atualizar ação'),
  })

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('kanban_stage_automations')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success('Ação removida')
    },
    onError: () => toast.error('Erro ao remover ação'),
  })

  const reorderActions = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        await (supabase as any)
          .from('kanban_stage_automations')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('Erro ao reordenar'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any)
        .from('kanban_stage_automations')
        .update({ active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  const enterAutomations = automations.filter(a => a.trigger_type === 'on_enter')
  const exitAutomations = automations.filter(a => a.trigger_type === 'on_exit')

  return {
    automations, enterAutomations, exitAutomations, isLoading,
    addAction, updateAction, deleteAction, reorderActions, toggleActive,
  }
}
