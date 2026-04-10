import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { PenSquare } from 'lucide-react'
import { BaseNode } from './BaseNode'

function UpdateFieldNodeComponent(props: NodeProps) {
  const field = props.data.config?.field || ''
  const value = props.data.config?.value || ''

  return (
    <BaseNode
      {...props}
      icon={PenSquare}
      color="#3b82f6"
      title="Atualizar"
      description={field ? `${field} = ${value}` : 'Configurar...'}
    />
  )
}

export const UpdateFieldNode = memo(UpdateFieldNodeComponent)
