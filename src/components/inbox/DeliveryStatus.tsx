import { Check, Headphones, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface DeliveryStatusProps {
  status: string | null | undefined
  className?: string
}

export function DeliveryStatus({ status, className }: DeliveryStatusProps) {
  if (!status) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Check className="w-3 h-3 text-muted-foreground/60" />
      </span>
    )
  }

  switch (status) {
    case 'sent':
      return (
        <span className={cn("inline-flex items-center", className)}>
          <Check className="w-3 h-3 text-muted-foreground/60" />
        </span>
      )
    case 'delivered':
      return (
        <span className={cn("inline-flex items-center -space-x-1.5", className)}>
          <Check className="w-3 h-3 text-muted-foreground/60" />
          <Check className="w-3 h-3 text-muted-foreground/60" />
        </span>
      )
    case 'read':
      return (
        <span className={cn("inline-flex items-center -space-x-1.5", className)}>
          <Check className="w-3 h-3 text-blue-500" />
          <Check className="w-3 h-3 text-blue-500" />
        </span>
      )
    case 'played':
      return (
        <span className={cn("inline-flex items-center gap-0.5", className)}>
          <span className="inline-flex items-center -space-x-1.5">
            <Check className="w-3 h-3 text-blue-500" />
            <Check className="w-3 h-3 text-blue-500" />
          </span>
          <Headphones className="w-2.5 h-2.5 text-blue-500" />
        </span>
      )
    case 'failed':
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("inline-flex items-center", className)}>
                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Falha no envio
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    default:
      return (
        <span className={cn("inline-flex items-center", className)}>
          <Check className="w-3 h-3 text-muted-foreground/60" />
        </span>
      )
  }
}
