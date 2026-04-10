import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Timer } from 'lucide-react'
import { BaseNode } from './BaseNode'

function WaitResponseNodeComponent(props: NodeProps) {
  return (
    <BaseNode {...props} icon={Timer} color="#f97316" title={props.data.label || 'Aguardar Resposta'} showSourceHandle={false}
      multipleSourceHandles={[{ id: 'responded', label: 'Respondeu', color: '#22c55e' }, { id: 'timeout', label: 'Timeout', color: '#ef4444' }]} />
  )
}
export const WaitResponseNode = memo(WaitResponseNodeComponent)
