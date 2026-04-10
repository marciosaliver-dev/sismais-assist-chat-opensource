import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

interface NotificationBadgeProps {
  onClick: () => void
  className?: string
}

export function NotificationBadge({ onClick, className }: NotificationBadgeProps) {
  const { unreadCount } = useNotifications()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn("relative h-8 w-8", className)}
      aria-label={`Notificacoes${unreadCount > 0 ? ` (${unreadCount} nao lidas)` : ''}`}
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  )
}
