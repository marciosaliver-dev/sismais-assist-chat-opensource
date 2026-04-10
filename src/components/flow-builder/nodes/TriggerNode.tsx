import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Zap } from 'lucide-react'
import { BaseNode } from './BaseNode'

const triggerLabels: Record<string, string> = {
  message_received: 'Mensagem Recebida',
  ticket_created: 'Ticket Criado',
  scheduled: 'Agendado',
  webhook: 'Webhook',
  status_changed: 'Mudança de Status',
  stage_changed: 'Mudança de Etapa',
  conversation_closed: 'Atendimento Finalizado',
  conversation_reopened: 'Atendimento Reaberto',
  agent_assigned: 'Agente Atribuído',
  tag_added: 'Tag Adicionada',
  priority_changed: 'Prioridade Alterada',
  sla_breached: 'SLA Violado',
  csat_received: 'CSAT Recebido',
  no_response_timeout: 'Timeout Sem Resposta',
}

function TriggerNodeComponent(props: NodeProps) {
  const triggerType = props.data.config?.trigger_type || 'message_received'

  return (
    <BaseNode
      {...props}
      icon={Zap}
      color="#eab308"
      title="Gatilho"
      description={triggerLabels[triggerType] || triggerType}
      badge="Start"
      showTargetHandle={false}
    />
  )
}

export const TriggerNode = memo(TriggerNodeComponent)
