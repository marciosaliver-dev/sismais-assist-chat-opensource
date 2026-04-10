import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Clock } from 'lucide-react'
import { BaseNode } from './BaseNode'

function CheckScheduleNodeComponent(props: NodeProps) {
  return (
    <BaseNode {...props} icon={Clock} color="#c084fc" title={props.data.label || 'Verificar Horário'} showSourceHandle={false}
      multipleSourceHandles={[{ id: 'inside', label: 'Dentro', color: '#22c55e' }, { id: 'outside', label: 'Fora', color: '#ef4444' }]} />
  )
}
export const CheckScheduleNode = memo(CheckScheduleNodeComponent)
