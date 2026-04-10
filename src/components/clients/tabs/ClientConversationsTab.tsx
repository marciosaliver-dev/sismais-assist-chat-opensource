import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { STATUS_COLORS } from '../constants'

interface ClientConversationsTabProps {
  conversations: any[]
}

export function ClientConversationsTab({ conversations }: ClientConversationsTabProps) {
  const navigate = useNavigate()

  if (conversations.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum atendimento registrado para este cliente.</p>
  }

  return (
    <div className="space-y-2">
      {conversations.map(conv => (
        <Card key={conv.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/kanban/support?ticket=${conv.id}`)}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">#{conv.ticket_number}</span>
                <Badge variant="secondary" className={STATUS_COLORS[conv.status || 'active'] || STATUS_COLORS.active}>
                  {conv.status === 'active' ? 'Ativo' : conv.status === 'resolved' ? 'Resolvido' : conv.status === 'closed' ? 'Fechado' : conv.status || 'Ativo'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {conv.handler_type === 'ai' ? 'IA' : 'Humano'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {conv.csat_rating && (
                  <span className="text-xs text-amber-600 font-medium">CSAT {conv.csat_rating}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(conv.started_at!), "dd/MM/yy HH:mm", { locale: ptBR })}
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
            {conv.tags && conv.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {conv.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs h-5">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
