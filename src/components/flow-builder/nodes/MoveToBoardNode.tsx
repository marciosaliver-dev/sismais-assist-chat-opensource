import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { LayoutGrid } from 'lucide-react'
import { BaseNode } from './BaseNode'

function MoveToBoardNodeComponent(props: NodeProps) {
  const boardName = props.data.config?.board_name || ''
  return (
    <BaseNode {...props} icon={LayoutGrid} color="#0891b2" title="Mover Board"
      description={boardName || 'Configurar...'} />
  )
}

export const MoveToBoardNode = memo(MoveToBoardNodeComponent)
