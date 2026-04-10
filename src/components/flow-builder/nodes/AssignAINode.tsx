import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Bot } from 'lucide-react'
import { BaseNode } from './BaseNode'

function AssignAINodeComponent(props: NodeProps) {
  const agentName = props.data.config?.agent_name || 'Selecionar agente IA...'

  return (
    <BaseNode
      {...props}
      icon={Bot}
      color="#0891b2"
      title="Atribuir IA"
      description={agentName}
      badge="AI"
    />
  )
}

export const AssignAINode = memo(AssignAINodeComponent)
