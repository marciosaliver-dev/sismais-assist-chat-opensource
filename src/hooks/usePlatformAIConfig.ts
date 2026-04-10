import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

export type AIFeature =
  | 'summarization'
  | 'audio_transcription'
  | 'image_transcription'
  | 'copilot'
  | 'agent_executor'
  | 'orchestrator'
  | 'message_analyzer'
  | 'embedding'
  | 'tts'
  | 'default_model_triage'
  | 'default_model_support'
  | 'default_model_financial'
  | 'default_model_sales'
  | 'default_model_copilot'
  | 'billing_default_agent'
  | 'default_ai_agent_id'
  | 'default_board_id'
  | 'default_stage_id'
  | 'show_agent_name'
  | 'sla_alerts'
  | 'csat_survey'
  | 'inactive_conversation'

export interface PlatformAIConfig {
  id: string
  feature: AIFeature
  model: string
  enabled: boolean
  extra_config: Record<string, unknown>
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function usePlatformAIConfigs() {
  return useQuery({
    queryKey: ['platform_ai_config'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_ai_config')
        .select('*')
        .order('feature')

      if (error) throw error
      return (data || []) as PlatformAIConfig[]
    },
  })
}

export function usePlatformAIConfig(feature: AIFeature) {
  return useQuery({
    queryKey: ['platform_ai_config', feature],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_ai_config')
        .select('*')
        .eq('feature', feature)
        .maybeSingle()

      if (error) throw error
      return data as PlatformAIConfig | null
    },
  })
}

export function useUpdatePlatformAIConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: Partial<PlatformAIConfig> & { feature: AIFeature }) => {
      const { data, error } = await db
        .from('platform_ai_config')
        .upsert(
          {
            feature: config.feature,
            model: config.model,
            enabled: config.enabled,
            extra_config: config.extra_config,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'feature' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_: unknown, variables: Partial<PlatformAIConfig> & { feature: AIFeature }) => {
      queryClient.invalidateQueries({ queryKey: ['platform_ai_config'] })
      queryClient.invalidateQueries({ queryKey: ['platform_ai_config', variables.feature] })
      toast({ title: 'Configuração salva', description: 'As configurações de IA foram atualizadas.' })
    },
    onError: (err: unknown) => {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' })
    },
  })
}
