import { ArrowLeft, Phone, MoreVertical, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Ticket, TicketStatus } from "@/types/ticket";

interface ConversationHeaderProps {
  ticket: Ticket;
  onStatusChange: (status: TicketStatus) => void;
  onAssigneeChange: (assignee: string) => void;
  agents: { id: string; name: string }[];
}

const statusConfig: Record<TicketStatus, { label: string; class: string }> = {
  open: { label: "Aberto", class: "badge-open" },
  in_progress: { label: "Em atendimento", class: "bg-primary/15 text-primary border-primary/30" },
  pending: { label: "Pendente", class: "badge-pending" },
  resolved: { label: "Resolvido", class: "badge-resolved" },
  closed: { label: "Fechado", class: "badge-closed" },
};

export function ConversationHeader({ 
  ticket, 
  onStatusChange, 
  onAssigneeChange,
  agents 
}: ConversationHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-whatsapp flex items-center justify-center text-primary-foreground font-medium">
              {ticket.customerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{ticket.customerName}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{ticket.customerPhone}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Ticket ID */}
          <span className="text-sm font-medium text-muted-foreground">
            #{ticket.id}
          </span>

          {/* Status Selector */}
          <select
            value={ticket.status}
            onChange={(e) => onStatusChange(e.target.value as TicketStatus)}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
              statusConfig[ticket.status].class
            )}
          >
            <option value="open">Aberto</option>
            <option value="in_progress">Em atendimento</option>
            <option value="pending">Pendente</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
          </select>

          {/* Assignee Selector */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <select
              value={ticket.assignee || ""}
              onChange={(e) => onAssigneeChange(e.target.value)}
              className="text-sm bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="">Sem responsável</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.name}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Subject and Tags */}
      <div className="mt-3 ml-14 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-foreground">{ticket.subject}</span>
        {ticket.tags?.map((tag) => (
          <span
            key={tag}
            className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
