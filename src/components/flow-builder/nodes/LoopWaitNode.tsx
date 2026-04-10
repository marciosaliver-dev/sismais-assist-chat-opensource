import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { RotateCcw } from 'lucide-react'
import { BaseNode } from './BaseNode'

function LoopWaitNodeComponent(props: NodeProps) {
  return (
    <BaseNode {...props} icon={RotateCcw} color="#ca8a04" title={props.data.label || 'Loop/Aguardar'} showSourceHandle={false}
      multipleSourceHandles={[{ id: 'condition_met', label: 'Condição OK', color: '#22c55e' }, { id: 'loop', label: 'Loop', color: '#eab308' }]} />
  )
}
export const LoopWaitNode = memo(LoopWaitNodeComponent)
