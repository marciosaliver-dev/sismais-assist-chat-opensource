import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { User } from 'lucide-react'
import { BaseNode } from './BaseNode'

const strategyLabels: Record<string, string> = {
  specific: 'Agente Específico',
  round_robin: 'Round Robin',
  least_busy: 'Menos Ocupado',
}

function AssignHumanNodeComponent(props: NodeProps) {
  const strategy = props.data.config?.strategy || 'round_robin'

  return (
    <BaseNode
      {...props}
      icon={User}
      color="#f97316"
      title="Atribuir Humano"
      description={strategyLabels[strategy] || strategy}
      badge="Human"
    />
  )
}

export const AssignHumanNode = memo(AssignHumanNodeComponent)
