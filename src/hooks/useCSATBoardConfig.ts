import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export type CSATQuestion = { key: string; label: string; type: 'scale' | 'text' | 'yes_no' }

export interface CSATBoardConfig {
  id: string
  board_id: string
  enabled: boolean
  scale_type: 'stars_1_5' | 'thumbs' | 'nps_0_10' | 'emoji'
  message_template: string
  questions: CSATQuestion[]
  send_on_close: boolean
  delay_minutes: number
  resend_enabled: boolean
  resend_after_hours: number
  max_resends: number
  response_window_hours: number
  ai_dimensions: string[]
  followup_enabled: boolean
  followup_threshold: number
  followup_message: string
  created_at: string
  updated_at: string
}

const DEFAULT_CONFIG: Omit<CSATBoardConfig, 'id' | 'board_id' | 'created_at' | 'updated_at'> = {
  enabled: false,
  scale_type: 'stars_1_5',
  message_template:
    '📊 *Pesquisa de Satisfação*\n\nOlá, {{nome}}! Seu atendimento (#{{protocolo}}) foi concluído.\n\nComo você avalia nosso suporte?\n\n1 ⭐ - Muito insatisfeito\n2 ⭐⭐ - Insatisfeito\n3 ⭐⭐⭐ - Regular\n4 ⭐⭐⭐⭐ - Satisfeito\n5 ⭐⭐⭐⭐⭐ - Muito satisfeito',
  questions: [],
  send_on_close: true,
  delay_minutes: 0,
  resend_enabled: false,
  resend_after_hours: 12,
  max_resends: 1,
  response_window_hours: 24,
  ai_dimensions: [],
  followup_enabled: true,
  followup_threshold: 2,
  followup_message: 'Sentimos muito pela experiência. Poderia nos contar o que podemos melhorar?',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function useCSATBoardConfig(boardId: string | undefined) {
  const qc = useQueryClient()
  const queryKey = ['csat_board_config', boardId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from('csat_board_configs')
        .select('*')
        .eq('board_id', boardId)
        .maybeSingle()
      if (error) throw error
      return data as CSATBoardConfig | null
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!boardId,
  })

  const config: CSATBoardConfig = data
    ? { ...DEFAULT_CONFIG, ...data }
    : ({
        ...DEFAULT_CONFIG,
        id: '',
        board_id: boardId ?? '',
        created_at: '',
        updated_at: '',
      } as CSATBoardConfig)

  const { mutateAsync: save, isPending: isSaving } = useMutation({
    mutationFn: async (updated: Partial<CSATBoardConfig>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, ...payload } = updated as any
      const { error } = await db
        .from('csat_board_configs')
        .upsert(
          { ...payload, board_id: boardId, ...(id ? { id } : {}) },
          { onConflict: 'board_id' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success('Configuração de CSAT salva.')
    },
    onError: () => {
      toast.error('Erro ao salvar configuração de CSAT.')
    },
  })

  return { config, defaults: DEFAULT_CONFIG, isLoading, save, isSaving }
}
