import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { Clock } from 'lucide-react'
import { BaseNode } from './BaseNode'

function DelayNodeComponent(props: NodeProps) {
  const duration = props.data.config?.duration || 0
  const unit = props.data.config?.unit || 'seconds'
  const unitLabels: Record<string, string> = { seconds: 'seg', minutes: 'min', hours: 'h' }

  return (
    <BaseNode
      {...props}
      icon={Clock}
      color="#64748b"
      title="Delay"
      description={duration > 0 ? `Aguardar ${duration} ${unitLabels[unit] || unit}` : 'Configurar...'}
    />
  )
}

export const DelayNode = memo(DelayNodeComponent)
