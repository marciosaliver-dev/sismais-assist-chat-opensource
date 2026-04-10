import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { MessageSquare } from 'lucide-react'
import { BaseNode } from './BaseNode'

function SendMessageNodeComponent(props: NodeProps) {
  const message = props.data.config?.message || ''

  return (
    <BaseNode
      {...props}
      icon={MessageSquare}
      color="#06b6d4"
      title="Mensagem"
      description={message || 'Configurar mensagem...'}
    />
  )
}

export const SendMessageNode = memo(SendMessageNodeComponent)
