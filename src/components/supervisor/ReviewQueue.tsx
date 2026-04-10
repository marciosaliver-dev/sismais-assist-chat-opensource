import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Edit, UserCheck, Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface ConversationWithLowConfidence {
  id: string
  customer_name: string | null
  customer_phone: string | null
  last_message_at: string | null
  ai_min_confidence: number | null
}

export function ReviewQueue() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<ConversationWithLowConfidence[]>({
    queryKey: ['supervisor_review_queue'],
    queryFn: async () => {
      // Buscar conversas em atendimento com pelo menos uma mensagem de IA com baixa confiança
      const { data, error } = await supabase
        .from('ai_conversations')
        .select(`
          id, customer_name, customer_phone, last_message_at,
          ai_messages(confidence)
        `)
        .eq('handler_type', 'ai')
        .eq('status', 'em_atendimento')
        .limit(20)

      if (error) throw error

      // Calcular confiança mínima por conversa
      return (data || [])
        .map((conv: any) => ({
          id: conv.id,
          customer_name: conv.customer_name,
          customer_phone: conv.customer_phone,
          last_message_at: conv.last_message_at,
          ai_min_confidence: conv.ai_messages?.length
            ? Math.min(...conv.ai_messages.map((m: any) => m.confidence ?? 100))
            : null,
        }))
        .filter(c => c.ai_min_confidence !== null && c.ai_min_confidence < 70)
        .sort((a, b) => (a.ai_min_confidence ?? 100) - (b.ai_min_confidence ?? 100))
    },
    refetchInterval: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: async (convId: string) => {
      // "Aprovar" = confirmar que a IA pode continuar (sem ação concreta, mas registra intenção)
      await supabase.from('ai_conversations').update({
        context: { supervisor_approved: true, approved_at: new Date().toISOString() }
      }).eq('id', convId)
    },
    onSuccess: () => {
      toast.success('Conversa aprovada — IA pode continuar')
      qc.invalidateQueries({ queryKey: ['supervisor_review_queue'] })
    },
  })

  const assumeMutation = useMutation({
    mutationFn: async (convId: string) => {
      const { error } = await supabase.from('ai_conversations').update({
        handler_type: 'human',
        status: 'aguardando',
        queue_entered_at: new Date().toISOString(),
      }).eq('id', convId)
      if (error) throw error
    },
    onSuccess: (_, convId) => {
      toast.success('Conversa assumida — agora em atendimento humano')
      qc.invalidateQueries({ queryKey: ['supervisor_review_queue'] })
      navigate(`/inbox?conversation=${convId}`)
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
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
        Nenhuma conversa aguardando revisão no momento.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map(conv => {
        const conf = conv.ai_min_confidence ?? 100
        const confColor = conf < 50 ? 'text-red-500' : conf < 65 ? 'text-orange-500' : 'text-yellow-500'

        return (
          <div
            key={conv.id}
            className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">
                  {conv.customer_name || conv.customer_phone || 'Desconhecido'}
                </span>
                <Badge variant="outline" className={cn('text-xs', confColor)}>
                  Confiança IA: {conf}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Última mensagem: {conv.last_message_at
                  ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                title="Ver conversa"
                onClick={() => navigate(`/inbox?conversation=${conv.id}`)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                title="Aprovar — IA pode continuar"
                onClick={() => approveMutation.mutate(conv.id)}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600"
                title="Assumir como humano"
                onClick={() => assumeMutation.mutate(conv.id)}
                disabled={assumeMutation.isPending}
              >
                <UserCheck className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
