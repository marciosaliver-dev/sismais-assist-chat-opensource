import { AlertTriangle, XCircle, Info, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WarningBoxProps {
  type: 'error' | 'warning' | 'info' | 'success'
  title?: string
  children: React.ReactNode
  className?: string
}

const config = {
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
    titleColor: 'text-red-800',
    textColor: 'text-red-700',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800',
    textColor: 'text-amber-700',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-700',
  },
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-500',
    titleColor: 'text-green-800',
    textColor: 'text-green-700',
  },
}

export function WarningBox({ type, title, children, className }: WarningBoxProps) {
  const c = config[type]
  const Icon = c.icon

  return (
    <div className={cn('rounded-lg border p-4', c.bg, className)}>
      <div className="flex gap-3">
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', c.iconColor)} />
        <div className="flex-1 min-w-0">
          {title && <p className={cn('font-semibold text-sm mb-1', c.titleColor)}>{title}</p>}
          <div className={cn('text-sm leading-relaxed', c.textColor)}>{children}</div>
        </div>
      </div>
    </div>
  )
}
