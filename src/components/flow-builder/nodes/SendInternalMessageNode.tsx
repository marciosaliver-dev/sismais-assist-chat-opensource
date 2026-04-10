import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import { StickyNote } from 'lucide-react'
import { BaseNode } from './BaseNode'

function SendInternalMessageNodeComponent(props: NodeProps) {
  const msg = (props.data.config?.message || '').substring(0, 30)
  return (
    <BaseNode {...props} icon={StickyNote} color="#6366f1" title="Nota Interna"
      description={msg || 'Configurar...'} />
  )
}

export const SendInternalMessageNode = memo(SendInternalMessageNodeComponent)
