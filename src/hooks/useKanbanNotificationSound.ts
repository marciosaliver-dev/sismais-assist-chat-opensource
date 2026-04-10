import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface QueueTicketInfo {
  id: string
  queue_entered_at: string | null
  handler_type: string | null
  status: string | null
  customer_name: string | null
  customer_phone: string
}

export function useKanbanNotificationSound(
  ticketIds: string[],
  ticketMap: Map<string, { customer_name: string | null; customer_phone: string }>,
  queueTickets?: QueueTicketInfo[]
) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('kanban-sound-enabled') !== 'false'
  })
  const queryClient = useQueryClient()
  const ticketIdsRef = useRef(ticketIds)
  const ticketMapRef = useRef(ticketMap)
  const soundEnabledRef = useRef(soundEnabled)
  const alertedQueueRef = useRef<Set<string>>(new Set())

  useEffect(() => { ticketIdsRef.current = ticketIds }, [ticketIds])
  useEffect(() => { ticketMapRef.current = ticketMap }, [ticketMap])
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev
      localStorage.setItem('kanban-sound-enabled', String(next))
      return next
    })
  }, [])

  const playTone = useCallback((frequency: number, duration: number, volume = 0.3) => {
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch {}
  }, [])

  const playUrgentAlert = useCallback(() => {
    // Distinctive 3-tone descending alert for 30min+ queue
    playTone(1200, 0.15, 0.5)
    setTimeout(() => playTone(1000, 0.15, 0.45), 180)
    setTimeout(() => playTone(800, 0.25, 0.4), 360)
  }, [playTone])

  // Channel 1: new user messages
  useEffect(() => {
    const channel = supabase
      .channel(`kanban-new-messages-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_messages' },
        (payload) => {
          const msg = payload.new as any
          if (msg.role !== 'user') return
          const convId = msg.conversation_id
          if (!convId || !ticketIdsRef.current.includes(convId)) return

          if (soundEnabledRef.current) playTone(800, 0.3)

          const ticket = ticketMapRef.current.get(convId)
          const name = ticket?.customer_name || ticket?.customer_phone || 'Cliente'
          const preview = (msg.content || '').substring(0, 60)
          toast.info(`${name}: ${preview}`, { duration: 4000 })

          queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient, playTone])

  // Channel 2: escalation to human
  useEffect(() => {
    const channel = supabase
      .channel(`kanban-escalation-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_conversations' },
        (payload) => {
          const newRecord = payload.new as any
          const oldRecord = payload.old as any

          // Only trigger on actual transition to human
          if (newRecord.handler_type !== 'human') return
          if (oldRecord.handler_type === 'human') return
          if (!ticketIdsRef.current.includes(newRecord.id)) return

          if (soundEnabledRef.current) {
            playTone(1000, 0.2, 0.4)
            setTimeout(() => playTone(1200, 0.3, 0.4), 200)
          }

          const ticket = ticketMapRef.current.get(newRecord.id)
          const name = ticket?.customer_name || ticket?.customer_phone || newRecord.customer_name || 'Cliente'
          toast.warning(`⚠️ ${name} escalonado para atendente`, { duration: 6000 })

          queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient, playTone])

  // Channel 3: Queue 30min+ alert (client-side timer check)
  useEffect(() => {
    if (!queueTickets || queueTickets.length === 0) return

    const THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

    const check = () => {
      const now = Date.now()
      for (const t of queueTickets) {
        // Only tickets awaiting human
        if (t.handler_type !== 'human' || t.status !== 'aguardando') continue
        if (!t.queue_entered_at) continue
        if (alertedQueueRef.current.has(t.id)) continue

        const waitMs = now - new Date(t.queue_entered_at).getTime()
        if (waitMs >= THRESHOLD_MS) {
          alertedQueueRef.current.add(t.id)

          if (soundEnabledRef.current) {
            playUrgentAlert()
          }

          // Toast removido — alerta visual fica apenas no card do Kanban
        }
      }
    }

    check()
    const interval = setInterval(check, 30000) // check every 30s

    return () => clearInterval(interval)
  }, [queueTickets, playUrgentAlert])

  // Cleanup alerted set: remove tickets no longer in queue
  useEffect(() => {
    if (!queueTickets) return
    const currentIds = new Set(queueTickets.map(t => t.id))
    for (const id of alertedQueueRef.current) {
      if (!currentIds.has(id)) {
        alertedQueueRef.current.delete(id)
      }
    }
  }, [queueTickets])

  return { soundEnabled, toggleSound }
}
