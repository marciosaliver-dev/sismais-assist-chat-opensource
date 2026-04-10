import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Tag } from 'lucide-react'
import { BaseNode } from './BaseNode'

function AddTagNodeComponent(props: NodeProps) {
  const tag = props.data.config?.tag || ''

  return (
    <BaseNode
      {...props}
      icon={Tag}
      color="#ca8a04"
      title="Tag"
      description={tag || 'Configurar tag...'}
    />
  )
}

export const AddTagNode = memo(AddTagNodeComponent)
