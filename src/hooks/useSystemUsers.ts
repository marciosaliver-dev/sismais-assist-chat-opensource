import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SystemUser {
  id: string
  email: string
  name: string
  role: string
  is_approved: boolean
}

export function useSystemUsers() {
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-system-users')
      if (error) throw error
      return (data as SystemUser[]) || []
    }
  })

  const users = allUsers.filter(u => u.is_approved !== false)
  const pendingUsers = allUsers.filter(u => u.is_approved === false)

  return { users, pendingUsers, isLoading }
}
