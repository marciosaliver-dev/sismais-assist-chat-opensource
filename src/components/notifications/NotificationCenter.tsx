import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  MessageSquare,
  UserPlus,
  TrendingUp,
  Volume2
} from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

interface NotificationCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    audioEnabled,
    setAudioEnabled,
    requestNotificationPermission
  } = useNotifications()

  const [showOnlyUnread, setShowOnlyUnread] = useState(false)

  const filteredNotifications = showOnlyUnread
    ? notifications?.filter(n => !n.is_read)
    : notifications

  const getIcon = (type: string, priority: string) => {
    if (priority === 'critical') return <AlertTriangle className="w-5 h-5 text-destructive" />
    switch (type) {
      case 'new_assignment': return <UserPlus className="w-5 h-5 text-primary" />
      case 'message_urgent': return <MessageSquare className="w-5 h-5 text-accent-foreground" />
      case 'escalation': return <TrendingUp className="w-5 h-5 text-primary" />
      case 'system': return <Info className="w-5 h-5 text-muted-foreground" />
      default: return <Bell className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive/10 border-destructive/30'
      case 'high': return 'bg-primary/10 border-primary/30'
      default: return 'bg-card border-border'
    }
  }

  const handleClick = (notification: any) => {
    if (!notification.is_read) markAsRead.mutate(notification.id)
    if (notification.action_url) {
      navigate(notification.action_url)
      onOpenChange(false)
    } else if (notification.conversation_id) {
      navigate(`/kanban/support?ticket=${notification.conversation_id}`)
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[440px] bg-background border-border">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <SheetTitle className="text-foreground">Notificações</SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending} variant="ghost" size="sm" className="text-xs">
                <CheckCheck className="w-3 h-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-3" />

        {/* Settings */}
        <div className="flex items-center gap-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Som</Label>
            <Switch checked={audioEnabled} onCheckedChange={setAudioEnabled} className="scale-75" />
          </div>
          <div className="flex items-center gap-2">
            <Bell className="w-3 h-3 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Browser</Label>
            <Button variant="link" size="sm" className="text-xs p-0 h-auto text-primary" onClick={requestNotificationPermission}>
              Ativar
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs text-muted-foreground">Não lidas</Label>
            <Switch checked={showOnlyUnread} onCheckedChange={setShowOnlyUnread} className="scale-75" />
          </div>
        </div>

        <Separator className="my-3" />

        {/* List */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-2 pr-2">
            {filteredNotifications && filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/30",
                    getPriorityClasses(notification.priority),
                    !notification.is_read && "border-primary/30"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getIcon(notification.type, notification.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
                        {!notification.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                        {notification.action_label && (
                          <span className="text-xs text-primary font-medium">{notification.action_label} →</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!notification.is_read && (
                        <Button
                          onClick={(e) => { e.stopPropagation(); markAsRead.mutate(notification.id) }}
                          variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(notification.id) }}
                        variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BellOff className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">{showOnlyUnread ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
