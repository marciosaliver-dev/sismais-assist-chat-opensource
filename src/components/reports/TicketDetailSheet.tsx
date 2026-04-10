import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Clock, User, Bot, MessageSquare, Star, Tag, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TicketRow } from "@/hooks/useTicketReport";

interface TicketDetailSheetProps {
  ticket: TicketRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

function statusBadge(status: string | null) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    aberto: { bg: "bg-[#E8F9F9]", text: "text-[#10293F]", border: "border-[rgba(69,229,229,0.4)]", label: "Aberto" },
    em_atendimento: { bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", border: "border-blue-200", label: "Em Atendimento" },
    aguardando: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[rgba(255,184,0,0.5)]", label: "Aguardando" },
    finalizado: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-green-200", label: "Finalizado" },
    resolvido: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-green-200", label: "Resolvido" },
    cancelado: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", border: "border-red-200", label: "Cancelado" },
  };
  const s = map[status || ""] || { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: status || "—" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function priorityLabel(priority: string | null) {
  const map: Record<string, string> = {
    critica: "text-[#7C3AED]",
    alta: "text-[#DC2626]",
    media: "text-[#FFB800]",
    baixa: "text-[#16A34A]",
  };
  if (!priority) return null;
  return (
    <span className={`text-xs font-semibold ${map[priority] || "text-muted-foreground"}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

export function TicketDetailSheet({ ticket, open, onOpenChange }: TicketDetailSheetProps) {
  const navigate = useNavigate();
  if (!ticket) return null;

  function handleVerAtendimento() {
    onOpenChange(false);
    navigate(`/kanban/support?ticket=${ticket!.id}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto p-0">
        {/* Navy Header */}
        <div className="bg-[#10293F] text-white px-6 py-5">
          <div className="text-[11px] font-mono text-white/50 mb-1">
            #{ticket.ticket_number}
          </div>
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg leading-snug text-white font-semibold">
              {ticket.ticket_subject || "Sem assunto"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {statusBadge(ticket.status)}
            {priorityLabel(ticket.priority)}
            {ticket.ai_resolved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-[rgba(69,229,229,0.15)] text-[#45E5E5] border border-[rgba(69,229,229,0.3)]">
                <Bot className="w-3 h-3" /> IA
              </span>
            )}
          </div>
        </div>

        <div className="px-6 space-y-6 py-6">
          {/* Cliente */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</h4>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#10293F] text-[#45E5E5] text-xs font-bold flex items-center justify-center shrink-0">
                {(ticket.customer_name || ticket.customer_phone || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-[#10293F] dark:text-foreground">
                  {ticket.customer_name || ticket.customer_phone}
                </p>
                {ticket.customer_name && (
                  <p className="text-xs text-muted-foreground">{ticket.customer_phone}</p>
                )}
              </div>
            </div>
          </section>

          {/* Agente */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atendimento</h4>
            <div className="grid grid-cols-2 gap-3">
              {ticket.agent_name && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#E8F9F9] dark:bg-primary/10">
                  <Bot className="w-4 h-4 text-[#10293F] dark:text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Agente IA</p>
                    <p className="text-xs font-medium text-[#10293F] dark:text-foreground">{ticket.agent_name}</p>
                  </div>
                </div>
              )}
              {ticket.human_agent_name && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Agente Humano</p>
                    <p className="text-xs font-medium text-[#10293F] dark:text-foreground">{ticket.human_agent_name}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Classificação */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Classificação</h4>
            <div className="flex flex-wrap gap-2">
              {ticket.category_name && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-card"
                  style={ticket.category_color ? { borderLeftColor: ticket.category_color, borderLeftWidth: 3 } : undefined}
                >
                  {ticket.category_name}
                </span>
              )}
              {ticket.module_name && (
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-card">
                  {ticket.module_name}
                </span>
              )}
              {ticket.stage_name && (
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-[#10293F] text-white">
                  {ticket.stage_name}
                </span>
              )}
            </div>
            {ticket.tags && ticket.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                {ticket.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </section>

          {/* Métricas */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Métricas</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-[#45E5E5]" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Resolução</span>
                </div>
                <p className="text-lg font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
                  {formatDuration(ticket.resolution_seconds)}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-[#FFB800]" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">CSAT</span>
                </div>
                <p className="text-lg font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
                  {ticket.csat_score ? `${ticket.csat_score}/5` : "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30">
                <p className="text-muted-foreground mb-0.5">Início</p>
                <p className="font-medium text-[#10293F] dark:text-foreground">
                  {ticket.started_at ? new Date(ticket.started_at).toLocaleString("pt-BR") : "—"}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30">
                <p className="text-muted-foreground mb-0.5">Resolvido em</p>
                <p className="font-medium text-[#10293F] dark:text-foreground">
                  {ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString("pt-BR") : "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Resumo */}
          {ticket.conversation_summary && (
            <section className="space-y-3">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Resumo da Conversa
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed bg-[#F8FAFC] dark:bg-muted/30 rounded-lg p-4 border border-border/50">
                {ticket.conversation_summary}
              </p>
            </section>
          )}

          {/* Ação principal */}
          <button
            onClick={handleVerAtendimento}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#45E5E5] text-[#10293F] text-sm font-semibold hover:bg-[#2ecece] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Ver Atendimento
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
