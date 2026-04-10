import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface CSATSurveyRow {
  id: string
  conversation_id: string
  customer_phone: string
  status: string
  score: number | null
  raw_response: string | null
  ai_analysis: {
    sentiment?: string
    dimensions?: Record<string, number>
    tags?: string[]
    summary?: string
  } | null
  responded_at: string | null
  created_at: string
  conversation: {
    ticket_number: string | null
    customer_name: string | null
    kanban_board_id: string | null
    human_agent_id: string | null
  } | null
  config: {
    board: { name: string; slug: string } | null
  } | null
}

export interface CSATMetrics {
  avgScore: number
  responseRate: number
  totalSent: number
  sentimentBreakdown: Record<string, number>
}

interface CSATSurveyFilters {
  boardId?: string
  dateFrom?: string
  dateTo?: string
  status?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

function calculateMetrics(surveys: CSATSurveyRow[]): CSATMetrics {
  const totalSent = surveys.length
  const answered = surveys.filter((s) => s.score !== null)
  const avgScore =
    answered.length > 0
      ? answered.reduce((sum, s) => sum + (s.score ?? 0), 0) / answered.length
      : 0
  const responseRate = totalSent > 0 ? answered.length / totalSent : 0

  const sentimentBreakdown: Record<string, number> = {}
  for (const s of surveys) {
    const sentiment = s.ai_analysis?.sentiment
    if (sentiment) {
      sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] ?? 0) + 1
    }
  }

  return {
    avgScore: Math.round(avgScore * 100) / 100,
    responseRate: Math.round(responseRate * 10000) / 100,
    totalSent,
    sentimentBreakdown,
  }
}

export function useCSATSurveys(filters?: CSATSurveyFilters) {
  const queryKey = ['csat_surveys', filters ?? {}]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = db
        .from('csat_surveys')
        .select(
          `*,
          conversation:ai_conversations(ticket_number, customer_name, kanban_board_id, human_agent_id),
          config:csat_board_configs(board:kanban_boards(name, slug))`
        )
        .order('created_at', { ascending: false })
        .limit(200)

      if (filters?.boardId) {
        query = query.eq('conversation.kanban_board_id', filters.boardId)
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data as CSATSurveyRow[]
    },
    staleTime: 2 * 60 * 1000,
  })

  const surveys = data ?? []
  const metrics = calculateMetrics(surveys)

  return { surveys, metrics, isLoading }
}
