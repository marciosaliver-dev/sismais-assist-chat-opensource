import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { ArrowRight } from 'lucide-react'
import { BaseNode } from './BaseNode'

function MoveToStageNodeComponent(props: NodeProps) {
  const stageName = props.data.config?.stage_name || ''
  return (
    <BaseNode {...props} icon={ArrowRight} color="#8b5cf6" title="Mover Etapa"
      description={stageName || 'Configurar...'} />
  )
}

export const MoveToStageNode = memo(MoveToStageNodeComponent)
