import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

const db = supabase as any

export interface UpdateSection {
  name: string
  items: { text: string; path: string | null }[]
}

export interface SystemUpdate {
  id: string
  title: string
  description: string | null
  sections: UpdateSection[]
  version: string | null
  published_at: string
  created_by: string
  is_read?: boolean
}

export function useSystemUpdates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: updates, isLoading } = useQuery({
    queryKey: ['system-updates'],
    queryFn: async () => {
      const { data, error } = await db
        .from('system_updates')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as SystemUpdate[]
    },
  })

  const { data: readIds } = useQuery({
    queryKey: ['system-update-reads', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await db
        .from('system_update_reads')
        .select('update_id')
        .eq('user_id', user.id)

      if (error) throw error
      return (data ?? []).map((r: any) => r.update_id) as string[]
    },
    enabled: !!user?.id,
  })

  const markAsRead = useMutation({
    mutationFn: async (updateId: string) => {
      if (!user?.id) return
      const { error } = await db
        .from('system_update_reads')
        .upsert({ user_id: user.id, update_id: updateId }, { onConflict: 'user_id,update_id' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-update-reads', user?.id] })
    },
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id || !updates) return
      const unread = updates.filter(u => !(readIds || []).includes(u.id))
      if (unread.length === 0) return

      const rows = unread.map(u => ({ user_id: user.id, update_id: u.id }))
      const { error } = await db
        .from('system_update_reads')
        .upsert(rows, { onConflict: 'user_id,update_id' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-update-reads', user?.id] })
    },
  })

  const readSet = new Set(readIds || [])
  const enriched = (updates || []).map(u => ({
    ...u,
    is_read: readSet.has(u.id),
  }))

  const unreadCount = enriched.filter(u => !u.is_read).length

  return {
    updates: enriched,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }
}
