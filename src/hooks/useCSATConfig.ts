import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const DEFAULT_CSAT_MESSAGE =
  '📊 *Pesquisa de Satisfação*\n\nSeu atendimento foi concluído! Como você avalia nosso suporte de 1 a 5?\n\n1 ⭐ - Muito insatisfeito\n2 ⭐⭐ - Insatisfeito\n3 ⭐⭐⭐ - Regular\n4 ⭐⭐⭐⭐ - Satisfeito\n5 ⭐⭐⭐⭐⭐ - Muito satisfeito'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface CSATConfig {
  message_template: string
  auto_send_on_close: boolean
  delay_hours: number
  enabled_time_limit: boolean
  isLoading: boolean
}

export function useCSATConfig(): CSATConfig {
  const { data, isLoading } = useQuery({
    queryKey: ['platform_ai_config', 'csat_survey'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_ai_config')
        .select('*')
        .eq('feature', 'csat_survey')
        .maybeSingle()

      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  const extra = data?.extra_config || {}

  return {
    message_template: (extra.message_template as string) || DEFAULT_CSAT_MESSAGE,
    auto_send_on_close: (extra.auto_send_on_close as boolean) ?? true,
    delay_hours: (extra.delay_hours as number) ?? 0,
    enabled_time_limit: (extra.enabled_time_limit as boolean) ?? false,
    isLoading,
  }
}
