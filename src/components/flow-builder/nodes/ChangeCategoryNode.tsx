import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { FolderOpen } from 'lucide-react'
import { BaseNode } from './BaseNode'

function ChangeCategoryNodeComponent(props: NodeProps) {
  const name = props.data.config?.category_name || ''
  return (
    <BaseNode {...props} icon={FolderOpen} color="#ea580c" title="Alterar Categoria"
      description={name || 'Configurar...'} />
  )
}

export const ChangeCategoryNode = memo(ChangeCategoryNodeComponent)
