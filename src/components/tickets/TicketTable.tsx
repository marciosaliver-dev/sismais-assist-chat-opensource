import { useNavigate } from "react-router-dom";
import { MessageSquare, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ticket, TicketStatus, TicketPriority } from "@/types/ticket";

interface TicketTableProps {
  tickets: Ticket[];
}

const statusConfig: Record<TicketStatus, { label: string; class: string }> = {
  open: { label: "Aberto", class: "badge-open" },
  in_progress: { label: "Em atendimento", class: "bg-primary/15 text-primary border-primary/30" },
  pending: { label: "Pendente", class: "badge-pending" },
  resolved: { label: "Resolvido", class: "badge-resolved" },
  closed: { label: "Fechado", class: "badge-closed" },
};

const priorityConfig: Record<TicketPriority, { label: string; class: string }> = {
  urgent: { label: "Urgente", class: "bg-destructive/15 text-destructive" },
  high: { label: "Alta", class: "bg-warning/15 text-warning" },
  medium: { label: "Média", class: "bg-primary/15 text-primary" },
  low: { label: "Baixa", class: "bg-muted text-muted-foreground" },
};

export function TicketTable({ tickets }: TicketTableProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ticket
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Cliente
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Prioridade
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Responsável
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Atualizado
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              className="border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer transition-smooth"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-whatsapp flex items-center justify-center text-primary-foreground text-sm font-medium shrink-0">
                    {ticket.customerName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">#{ticket.id}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {ticket.subject}
                    </p>
                  </div>
                  {ticket.unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-1.5 py-0.5 rounded-full">
                      {ticket.unreadCount}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm text-foreground">{ticket.customerName}</p>
                <p className="text-xs text-muted-foreground">{ticket.customerPhone}</p>
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full border",
                  statusConfig[ticket.status].class
                )}>
                  {statusConfig[ticket.status].label}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded",
                  priorityConfig[ticket.priority].class
                )}>
                  {priorityConfig[ticket.priority].label}
                </span>
              </td>
              <td className="px-4 py-3">
                {ticket.assignee ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                      {ticket.assignee.charAt(0)}
                    </div>
                    <span className="text-sm text-foreground">{ticket.assignee}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm">{ticket.updatedAt}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {tickets.length === 0 && (
        <div className="py-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum ticket encontrado</p>
        </div>
      )}
    </div>
  );
}
