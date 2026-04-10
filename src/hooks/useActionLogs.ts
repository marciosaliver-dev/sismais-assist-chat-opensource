import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface ActionLog {
  id: string
  created_at: string
  conversation_id: string | null
  action_type: string
  agent_id: string | null
  status: string
  model: string | null
  duration_ms: number | null
  tokens_in: number
  tokens_out: number
  cost_usd: number
  error_message: string | null
  details: Record<string, unknown>
  notification_read: boolean
}

export function useActionLogs(limit = 50) {
  return useQuery({
    queryKey: ["action-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_action_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as ActionLog[]
    },
    refetchInterval: 10000,
  })
}

export function useUnreadErrors() {
  return useQuery({
    queryKey: ["unread-errors"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ai_action_logs" as any)
        .select("*", { count: "exact", head: true })
        .eq("notification_read", false)
        .in("status", ["error", "timeout"])
      if (error) throw error
      return count || 0
    },
    refetchInterval: 15000,
  })
}
