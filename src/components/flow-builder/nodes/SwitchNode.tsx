import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { List } from 'lucide-react'
import { BaseNode } from './BaseNode'

function SwitchNodeComponent(props: NodeProps) {
  const cases: Array<{ value: string; label: string }> = props.data.config?.cases || []
  const field = props.data.config?.field || 'Configurar...'

  const handles = [
    ...cases.map((c) => ({ id: c.value, label: c.label })),
    ...(cases.length > 0 ? [{ id: 'default', label: 'Padrão' }] : []),
  ]

  return (
    <BaseNode
      {...props}
      icon={List}
      color="#6366f1"
      title="Switch"
      description={field}
      showSourceHandle={handles.length === 0}
      multipleSourceHandles={handles.length > 0 ? handles : undefined}
    />
  )
}

export const SwitchNode = memo(SwitchNodeComponent)
