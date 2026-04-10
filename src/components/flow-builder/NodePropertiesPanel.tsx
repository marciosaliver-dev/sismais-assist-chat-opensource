import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Node } from 'reactflow'

import { TriggerProperties } from './properties/TriggerProperties'
import { SendMessageProperties } from './properties/SendMessageProperties'
import { AIResponseProperties } from './properties/AIResponseProperties'
import { AssignHumanProperties } from './properties/AssignHumanProperties'
import { AssignAIProperties } from './properties/AssignAIProperties'
import { ConditionProperties } from './properties/ConditionProperties'
import { SwitchProperties } from './properties/SwitchProperties'
import { DelayProperties } from './properties/DelayProperties'
import { HTTPRequestProperties } from './properties/HTTPRequestProperties'
import { AddTagProperties } from './properties/AddTagProperties'
import { SetVariableProperties } from './properties/SetVariableProperties'
import { UpdateFieldProperties } from './properties/UpdateFieldProperties'
import { JumpToFlowProperties } from './properties/JumpToFlowProperties'
import { SearchKnowledgeProperties } from './properties/SearchKnowledgeProperties'
import { MoveToStageProperties } from './properties/MoveToStageProperties'
import { MoveToBoardProperties } from './properties/MoveToBoardProperties'
import { RemoveTagProperties } from './properties/RemoveTagProperties'
import { ChangeCategoryProperties } from './properties/ChangeCategoryProperties'
import { ChangeModuleProperties } from './properties/ChangeModuleProperties'
import { CreateConversationProperties } from './properties/CreateConversationProperties'
import { SendInternalMessageProperties } from './properties/SendInternalMessageProperties'
import { CheckScheduleProperties } from './properties/CheckScheduleProperties'
import { WaitResponseProperties } from './properties/WaitResponseProperties'
import { CheckCustomerProperties } from './properties/CheckCustomerProperties'
import { LoopWaitProperties } from './properties/LoopWaitProperties'

interface NodePropertiesPanelProps {
  node: Node
  onUpdate: (data: any) => void
  onClose: () => void
  onDelete: () => void
}

const nodeTypeLabels: Record<string, string> = {
  trigger: 'Configurar Gatilho',
  send_message: 'Configurar Mensagem',
  ai_response: 'Configurar Resposta IA',
  assign_human: 'Atribuição Humana',
  assign_ai: 'Atribuição IA',
  condition: 'Configurar Condição',
  switch: 'Configurar Switch',
  delay: 'Configurar Delay',
  http_request: 'Configurar Webhook',
  add_tag: 'Configurar Tags',
  set_variable: 'Configurar Variável',
  update_field: 'Atualizar Campo',
  jump_to_flow: 'Ir para Fluxo',
  search_knowledge: 'Busca RAG',
  end: 'Finalização',
  move_to_stage: 'Mover Etapa',
  move_to_board: 'Mover Board',
  remove_tag: 'Remover Tag',
  change_category: 'Alterar Categoria',
  change_module: 'Alterar Módulo',
  create_conversation: 'Criar Atendimento',
  send_internal_message: 'Nota Interna',
  check_schedule: 'Verificar Horário',
  wait_response: 'Aguardar Resposta',
  check_customer: 'Verificar Cliente',
  loop_wait: 'Loop/Aguardar',
}

export function NodePropertiesPanel({ node, onUpdate, onClose, onDelete }: NodePropertiesPanelProps) {
  const config = node.data?.config || {}

  const updateConfig = (key: string, value: any) => {
    onUpdate({ config: { ...config, [key]: value } })
  }

  const batchUpdateConfig = (updates: Record<string, any>) => {
    onUpdate({ config: { ...config, ...updates } })
  }

  const renderFields = () => {
    switch (node.type) {
      case 'trigger':
        return <TriggerProperties config={config} onUpdate={updateConfig} />
      case 'send_message':
        return <SendMessageProperties config={config} onUpdate={updateConfig} onBatchUpdate={batchUpdateConfig} />
      case 'ai_response':
        return <AIResponseProperties config={config} onUpdate={updateConfig} onBatchUpdate={batchUpdateConfig} />
      case 'assign_human':
        return <AssignHumanProperties config={config} onUpdate={updateConfig} onBatchUpdate={batchUpdateConfig} />
      case 'assign_ai':
        return <AssignAIProperties config={config} onBatchUpdate={batchUpdateConfig} />
      case 'condition':
        return <ConditionProperties config={config} onUpdate={updateConfig} />
      case 'switch':
        return <SwitchProperties config={config} onUpdate={updateConfig} />
      case 'delay':
        return <DelayProperties config={config} onUpdate={updateConfig} />
      case 'http_request':
        return <HTTPRequestProperties config={config} onUpdate={updateConfig} />
      case 'add_tag':
        return <AddTagProperties config={config} onUpdate={updateConfig} />
      case 'set_variable':
        return <SetVariableProperties config={config} onUpdate={updateConfig} />
      case 'update_field':
        return <UpdateFieldProperties config={config} onUpdate={updateConfig} />
      case 'jump_to_flow':
        return <JumpToFlowProperties config={config} onBatchUpdate={batchUpdateConfig} />
      case 'search_knowledge':
        return <SearchKnowledgeProperties config={config} onUpdate={updateConfig} />
      case 'move_to_stage':
        return <MoveToStageProperties config={config} onUpdate={updateConfig} onBatchUpdate={batchUpdateConfig} />
      case 'move_to_board':
        return <MoveToBoardProperties config={config} onUpdate={updateConfig} onBatchUpdate={batchUpdateConfig} />
      case 'remove_tag':
        return <RemoveTagProperties config={config} onUpdate={updateConfig} />
      case 'change_category':
        return <ChangeCategoryProperties config={config} onBatchUpdate={batchUpdateConfig} />
      case 'change_module':
        return <ChangeModuleProperties config={config} onBatchUpdate={batchUpdateConfig} />
      case 'create_conversation':
        return <CreateConversationProperties config={config} onUpdate={updateConfig} onBatchUpdate={batchUpdateConfig} />
      case 'send_internal_message':
        return <SendInternalMessageProperties config={config} onUpdate={updateConfig} />
      case 'check_schedule':
        return <CheckScheduleProperties config={config} onUpdate={updateConfig} />
      case 'wait_response':
        return <WaitResponseProperties config={config} onUpdate={updateConfig} />
      case 'check_customer':
        return <CheckCustomerProperties config={config} onUpdate={updateConfig} />
      case 'loop_wait':
        return <LoopWaitProperties config={config} onUpdate={updateConfig} />
      case 'end':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Mensagem de Finalização</Label>
              <Textarea
                value={config.reason || 'Fluxo concluído'}
                onChange={(e) => updateConfig('reason', e.target.value)}
                placeholder="Descrição da finalização..."
                className="text-xs mt-1"
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">🛑 Este é o ponto final do fluxo</p>
          </div>
        )
      default:
        return <p className="text-xs text-muted-foreground">Selecione um node para editar.</p>
    }
  }

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">
          {nodeTypeLabels[node.type || ''] || 'Propriedades'}
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              value={node.data?.label || ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="text-xs"
            />
          </div>
          {renderFields()}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-border">
        <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Excluir Node
        </Button>
      </div>
    </div>
  )
}
