import { useQuery } from '@tanstack/react-query'
import { BookPlus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'

interface TrainingOpportunity {
  id: string
  question: string
  frequency: number
  source_conv_id: string
}

export function TrainingOpportunities() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<TrainingOpportunity[]>({
    queryKey: ['supervisor_training_opportunities'],
    queryFn: async () => {
      // Buscar mensagens de clientes sem resposta confiante da IA (confiança < 50)
      // que repetem padrões similares — proxy para "gaps na base de conhecimento"
      const { data: lowConfMsgs, error } = await supabase
        .from('ai_messages')
        .select('content, conversation_id, confidence')
        .eq('role', 'assistant')
        .lt('confidence', 50)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50)

      if (error) throw error

      // Agrupar por termos similares (simplificado — palavras com >3 chars em comum)
      const grouped = new Map<string, TrainingOpportunity>()
      for (const msg of (lowConfMsgs || [])) {
        const key = (msg.content || '').substring(0, 60)
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: key,
            question: key,
            frequency: 1,
            source_conv_id: msg.conversation_id || '',
          })
        } else {
          grouped.get(key)!.frequency++
        }
      }

      return Array.from(grouped.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 8)
    },
    refetchInterval: 120_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhuma oportunidade de treino identificada nos últimos 7 dias.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map(opp => (
        <div
          key={opp.id}
          className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-sm truncate">
              "{opp.question}"
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA respondeu com baixa confiança {opp.frequency}x nos últimos 7 dias
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="sm"
              className="text-xs h-8 gap-1"
              onClick={() => navigate('/knowledge')}
            >
              <BookPlus className="h-3.5 w-3.5" />
              Criar artigo
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
