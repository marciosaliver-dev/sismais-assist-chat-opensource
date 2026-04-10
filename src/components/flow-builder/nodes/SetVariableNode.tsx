import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Variable } from 'lucide-react'
import { BaseNode } from './BaseNode'

function SetVariableNodeComponent(props: NodeProps) {
  const name = props.data.config?.variable_name || ''
  const value = props.data.config?.value || ''

  return (
    <BaseNode
      {...props}
      icon={Variable}
      color="#6366f1"
      title="Variável"
      description={name ? `${name} = ${value || '...'}` : 'Configurar...'}
    />
  )
}

export const SetVariableNode = memo(SetVariableNodeComponent)
