import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MessageSquare, Bot, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Conversation {
  id: string
  customer_name: string | null
  customer_phone: string
  status: string | null
  handler_type: string | null
  started_at: string | null
  ai_messages_count: number | null
  human_messages_count: number | null
  ai_resolved?: boolean
  ai_agents?: { name: string; color: string; specialty: string } | null
}

interface RecentConversationsProps {
  conversations: Conversation[]
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)]' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-[#EFF6FF] text-[#2563EB] border-[rgba(37,99,235,0.3)]' },
  aguardando_cliente: { label: 'Aguardando', className: 'bg-[#FFFBEB] text-[#92400E] border-[rgba(255,184,0,0.5)]' },
  finalizado: { label: 'Finalizado', className: 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]' },
  resolved: { label: 'Resolvido', className: 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]' },
  escalated: { label: 'Escalado', className: 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]' },
}

export function RecentConversations({ conversations }: RecentConversationsProps) {
  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="bg-[#10293F] text-white pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#45E5E5]" />
          Conversas Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {(!conversations || conversations.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa recente</p>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conv) => {
              const status = statusConfig[conv.status || 'active'] || { label: conv.status || 'Ativo', className: 'bg-muted text-muted-foreground' }
              return (
                <div key={conv.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8FAFC] transition-colors duration-150">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                      backgroundColor: conv.handler_type === 'ai' ? '#E8F9F9' : '#F5F5F5'
                    }}>
                      {conv.handler_type === 'ai' 
                        ? <Bot className="w-4 h-4 text-[#10293F]" />
                        : <User className="w-4 h-4 text-[#666666]" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#10293F] dark:text-foreground truncate">
                        {conv.customer_name || conv.customer_phone}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.ai_agents?.name || 'Sem agente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-[10px] border ${status.className}`}>
                      {status.label}
                    </Badge>
                    {conv.ai_resolved && (
                      <Badge variant="outline" className="text-[10px] border bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]">
                        IA
                      </Badge>
                    )}
                    {conv.started_at && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(conv.started_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
