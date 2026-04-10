import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { ArrowRight } from 'lucide-react'
import { BaseNode } from './BaseNode'

function JumpToFlowNodeComponent(props: NodeProps) {
  const flowName = props.data.config?.flow_name || 'Selecionar fluxo...'

  return (
    <BaseNode
      {...props}
      icon={ArrowRight}
      color="#475569"
      title="Ir para Fluxo"
      description={flowName}
    />
  )
}

export const JumpToFlowNode = memo(JumpToFlowNodeComponent)
