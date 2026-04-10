import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface AISuggestionResult {
  text: string
  confidence: number
  sources?: { title: string; url: string }[]
  sentiment?: string
  urgency?: string
  intent?: string
  summary?: string
}

export function useAISuggestion() {
  const [suggestion, setSuggestion] = useState<AISuggestionResult | null>(null)
  const [loading, setLoading] = useState(false)

  const generateSuggestion = async (conversationId: string, pendingMessage?: string, mode?: 'generate' | 'context' | 'improve', agentContext?: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('copilot-suggest', {
        body: {
          conversation_id: conversationId,
          pending_message: pendingMessage && pendingMessage !== 'última mensagem' ? pendingMessage : undefined,
          mode: mode || 'generate',
          agent_context: agentContext || undefined,
        },
      })

      if (error) throw error

      setSuggestion({
        text: data.text,
        confidence: data.confidence,
        sources: data.sources,
        sentiment: data.sentiment,
        urgency: data.urgency,
        intent: data.intent,
        summary: data.summary,
      })
    } catch (err: any) {
      console.error('AI suggestion error:', err)
      const msg = err?.message || err?.context?.body || ''
      if (typeof msg === 'string' && (msg.includes('402') || msg.includes('créditos') || msg.includes('credits'))) {
        toast.error('Créditos de IA esgotados. Adicione créditos no OpenRouter.')
      } else if (typeof msg === 'string' && msg.includes('429')) {
        toast.error('Limite de requisições IA excedido. Tente novamente.')
      } else {
        toast.error('Erro ao gerar sugestão de IA')
      }
      setSuggestion(null)
    } finally {
      setLoading(false)
    }
  }

  const clearSuggestion = () => setSuggestion(null)

  return { suggestion, loading, generateSuggestion, clearSuggestion }
}
