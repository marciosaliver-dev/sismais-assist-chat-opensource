import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useNotifications() {
  const queryClient = useQueryClient()
  const [audioEnabled, setAudioEnabled] = useState(true)

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data
    },
    refetchInterval: 10000
  })

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0

  // Update browser tab title with unread count
  useEffect(() => {
    const baseTitle = 'SisCRM'
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle
  }, [unreadCount])

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Todas as notificações marcadas como lidas')
    }
  })

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const playNotificationSound = useCallback(() => {
    if (!audioEnabled) return
    try {
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch {
      // Ignore audio errors
    }
  }, [audioEnabled])

  const showBrowserNotification = useCallback((notification: any) => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        tag: notification.id,
        requireInteraction: notification.priority === 'critical'
      })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            playNotificationSound()
            showBrowserNotification(payload.new)

            const n = payload.new as any
            if (n.priority === 'critical') {
              toast.error(n.title, { description: n.message, duration: 10000 })
            } else if (n.priority === 'high') {
              toast.warning(n.title, { description: n.message, duration: 5000 })
            } else {
              toast.info(n.title, { description: n.message })
            }
          }
        )
        .subscribe()
    }

    setup()
    return () => { channel?.unsubscribe() }
  }, [queryClient, playNotificationSound, showBrowserNotification])

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Seu navegador não suporta notificações')
      return false
    }
    if (Notification.permission === 'granted') return true
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    audioEnabled,
    setAudioEnabled,
    requestNotificationPermission
  }
}
