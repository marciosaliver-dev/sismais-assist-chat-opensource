import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UnclassifiedCTA() {
  const navigate = useNavigate()

  const { data: count = 0 } = useQuery({
    queryKey: ['unclassified-conversations-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['finalizado', 'closed', 'resolved'])
        .is('ticket_category_id', null)
      return count || 0
    },
    staleTime: 5 * 60 * 1000,
  })

  if (!count) return null

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#FFB800]/40 bg-[#FFFBEB]">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#FFB800]/20 flex items-center justify-center">
        <Tag className="w-4 h-4 text-[#92400E]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#92400E]">
          {count} atendimento{count !== 1 ? 's' : ''} finalizado{count !== 1 ? 's' : ''} sem classificação
        </p>
        <p className="text-xs text-[#92400E]/70 mt-0.5">
          Classifique para melhorar o aprendizado dos agentes IA e os relatórios de qualidade.
        </p>
      </div>
      <Button
        size="sm"
        className="flex-shrink-0 bg-[#FFB800] hover:bg-[#e6a600] text-[#10293F] border-0 font-semibold gap-1.5"
        onClick={() => navigate('/queue?filter=unclassified')}
      >
        Revisar agora
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
