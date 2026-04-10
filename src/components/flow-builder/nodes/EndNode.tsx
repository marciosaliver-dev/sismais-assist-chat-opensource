import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { StopCircle } from 'lucide-react'
import { BaseNode } from './BaseNode'

function EndNodeComponent(props: NodeProps) {
  return (
    <BaseNode
      {...props}
      icon={StopCircle}
      color="#ef4444"
      title="Fim"
      description="Fluxo finalizado"
      showSourceHandle={false}
      badge="End"
    />
  )
}

export const EndNode = memo(EndNodeComponent)
