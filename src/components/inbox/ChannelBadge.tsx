import { Badge } from '@/components/ui/badge'
import { Smartphone, ShieldCheck } from 'lucide-react'

interface ChannelBadgeProps {
  channelType: string | null | undefined
  size?: 'sm' | 'default'
}

export function ChannelBadge({ channelType, size = 'default' }: ChannelBadgeProps) {
  if (channelType === 'meta_whatsapp') {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-green-300 bg-green-50 text-green-700 ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs'
        }`}
      >
        <ShieldCheck className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        Meta WA
      </Badge>
    )
  }

  if (channelType === 'uazapi' || !channelType) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-slate-300 bg-slate-50 text-slate-600 ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs'
        }`}
      >
        <Smartphone className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        UAZAPI
      </Badge>
    )
  }

  return null
}
