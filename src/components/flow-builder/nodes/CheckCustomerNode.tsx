import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { UserCheck } from 'lucide-react'
import { BaseNode } from './BaseNode'

function CheckCustomerNodeComponent(props: NodeProps) {
  return (
    <BaseNode {...props} icon={UserCheck} color="#1e3a8a" title={props.data.label || 'Verificar Cliente'} showSourceHandle={false}
      multipleSourceHandles={[{ id: 'yes', label: 'Sim', color: '#22c55e' }, { id: 'no', label: 'Não', color: '#ef4444' }]} />
  )
}
export const CheckCustomerNode = memo(CheckCustomerNodeComponent)
