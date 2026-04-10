import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Package } from 'lucide-react'
import { BaseNode } from './BaseNode'

function ChangeModuleNodeComponent(props: NodeProps) {
  const name = props.data.config?.module_name || ''
  return (
    <BaseNode {...props} icon={Package} color="#0d9488" title="Alterar Módulo"
      description={name || 'Configurar...'} />
  )
}

export const ChangeModuleNode = memo(ChangeModuleNodeComponent)
