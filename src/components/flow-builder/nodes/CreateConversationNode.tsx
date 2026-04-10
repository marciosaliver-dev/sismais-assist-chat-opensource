import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { PlusCircle } from 'lucide-react'
import { BaseNode } from './BaseNode'

function CreateConversationNodeComponent(props: NodeProps) {
  return (
    <BaseNode {...props} icon={PlusCircle} color="#7c3aed" title="Criar Atendimento"
      description={props.data.config?.board_name || 'Configurar...'} />
  )
}

export const CreateConversationNode = memo(CreateConversationNodeComponent)
