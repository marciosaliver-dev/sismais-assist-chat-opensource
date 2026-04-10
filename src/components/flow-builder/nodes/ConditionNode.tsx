import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { GitBranch } from 'lucide-react'
import { BaseNode } from './BaseNode'

function ConditionNodeComponent(props: NodeProps) {
  const field = props.data.config?.field || ''
  const operator = props.data.config?.operator || 'equals'
  const value = props.data.config?.value || ''

  const description = field
    ? `${field} ${operator} ${value}`
    : 'Configurar condição...'

  return (
    <BaseNode
      {...props}
      icon={GitBranch}
      color="#a855f7"
      title="Condição"
      description={description}
      showSourceHandle={false}
      multipleSourceHandles={[
        { id: 'true', label: props.data.config?.true_label || 'Sim', color: '#22c55e' },
        { id: 'false', label: props.data.config?.false_label || 'Não', color: '#ef4444' },
      ]}
    />
  )
}

export const ConditionNode = memo(ConditionNodeComponent)
