import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle } from 'lucide-react'
import { useMetaWindow } from '@/hooks/useMetaWindow'

interface MetaWindowIndicatorProps {
  channelType: string | null | undefined
  lastCustomerMessageAt: string | null | undefined
}

export function MetaWindowIndicator({ channelType, lastCustomerMessageAt }: MetaWindowIndicatorProps) {
  const { isOpen, formattedRemaining } = useMetaWindow(channelType, lastCustomerMessageAt)

  if (channelType !== 'meta_whatsapp') return null

  if (isOpen) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-green-300 bg-green-50 text-green-700 text-xs"
      >
        <Clock className="h-3 w-3" />
        Janela aberta · {formattedRemaining}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-yellow-400 bg-yellow-50 text-yellow-800 text-xs"
    >
      <AlertTriangle className="h-3 w-3" />
      Janela fechada
    </Badge>
  )
}
