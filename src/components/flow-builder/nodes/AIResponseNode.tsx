import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Bot } from 'lucide-react'
import { BaseNode } from './BaseNode'

function AIResponseNodeComponent(props: NodeProps) {
  const agentName = props.data.config?.agent_name || 'Selecionar agente...'
  const model = props.data.config?.model || 'GPT-4o'

  return (
    <BaseNode
      {...props}
      icon={Bot}
      color="#a855f7"
      title="Resposta IA"
      description={agentName}
      badge={model}
    />
  )
}

export const AIResponseNode = memo(AIResponseNodeComponent)
