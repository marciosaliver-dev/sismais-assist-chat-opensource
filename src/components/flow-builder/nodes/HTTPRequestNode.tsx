import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Globe } from 'lucide-react'
import { BaseNode } from './BaseNode'

function HTTPRequestNodeComponent(props: NodeProps) {
  const method = props.data.config?.method || 'GET'
  const url = props.data.config?.url || ''

  return (
    <BaseNode
      {...props}
      icon={Globe}
      color="#22c55e"
      title="HTTP Request"
      description={url ? `${method} ${url}` : 'Configurar...'}
      badge={method}
    />
  )
}

export const HTTPRequestNode = memo(HTTPRequestNodeComponent)
