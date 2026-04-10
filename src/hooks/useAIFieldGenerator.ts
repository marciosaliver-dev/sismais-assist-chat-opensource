import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

type Action = 'generate' | 'improve' | 'simplify' | 'translate'

interface FieldContext {
  agent_specialty?: string
  agent_name?: string
  company_name?: string
  company_description?: string
  products_services?: string
  tone?: string
  existing_value?: string
  target_language?: string
  [key: string]: string | undefined
}

interface GenerateResult {
  text: string
  tokens_used: number
  cost_usd: number
  model_used: string
}

interface UseAIFieldGeneratorReturn {
  generate: (action: Action, fieldType: string, context: FieldContext) => Promise<string | null>
  isLoading: boolean
  result: GenerateResult | null
  lastError: string | null
}

export function useAIFieldGenerator(): UseAIFieldGeneratorReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const generate = useCallback(async (
    action: Action,
    fieldType: string,
    context: FieldContext
  ): Promise<string | null> => {
    setIsLoading(true)
    setLastError(null)
    setResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('ai-field-generator', {
        body: { action, field_type: fieldType, context },
      })

      if (error) throw new Error(error.message || 'Erro ao chamar IA')
      if (!data?.text) throw new Error('Resposta vazia da IA')

      const generateResult: GenerateResult = {
        text: data.text,
        tokens_used: data.tokens_used || 0,
        cost_usd: data.cost_usd || 0,
        model_used: data.model_used || 'unknown',
      }

      setResult(generateResult)
      return generateResult.text
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setLastError(msg)
      toast.error('Erro ao gerar com IA', { description: msg })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { generate, isLoading, result, lastError }
}
