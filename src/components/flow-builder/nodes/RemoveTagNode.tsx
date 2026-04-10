import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Tag } from 'lucide-react'
import { BaseNode } from './BaseNode'

function RemoveTagNodeComponent(props: NodeProps) {
  const tag = props.data.config?.tag || ''
  return (
    <BaseNode {...props} icon={Tag} color="#dc2626" title="Remover Tag"
      description={tag || 'Configurar...'} />
  )
}

export const RemoveTagNode = memo(RemoveTagNodeComponent)
