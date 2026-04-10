import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { KanbanTicket } from '@/hooks/useKanbanTickets'

const priorityLabels: Record<string, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border-orange-300' },
  urgent: { label: 'Urgente', className: 'bg-destructive text-destructive-foreground' },
  critical: { label: 'Crítica', className: 'bg-destructive text-destructive-foreground' },
}

interface Props {
  ticket: KanbanTicket | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChangeStatus: (ticketId: string, status: string) => void
}

export function TicketDetailDialog({ ticket, open, onOpenChange, onChangeStatus }: Props) {
  const navigate = useNavigate()
  if (!ticket) return null

  const priority = priorityLabels[ticket.priority || 'medium']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ticket.customer_name || ticket.customer_phone}
            <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number || '—'}</span>
          </DialogTitle>
          <DialogDescription>Detalhes do atendimento</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{ticket.status || 'novo'}</Badge>
            {priority && <Badge variant="outline" className={priority.className}>{priority.label}</Badge>}
          </div>

          {ticket.last_message && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Última mensagem</p>
              <p className="text-sm text-foreground">{ticket.last_message}</p>
            </div>
          )}

          {ticket.tags && ticket.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ticket.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {ticket.status === 'aguardando' && (
              <Button size="sm" onClick={() => { onChangeStatus(ticket.id, 'em_atendimento'); onOpenChange(false) }}>
                <UserCheck className="w-4 h-4 mr-1" /> Iniciar Atendimento
              </Button>
            )}
            {ticket.status === 'em_atendimento' && (
              <Button size="sm" variant="outline" onClick={() => { onChangeStatus(ticket.id, 'finalizado'); onOpenChange(false) }}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Finalizar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigate(`/inbox?ticket=${ticket.id}`)}>
              <MessageSquare className="w-4 h-4 mr-1" /> Ver Conversa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
