import { Inbox, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import type { Ticket } from "@/types/ticket";

interface StatsRowProps {
  tickets: Ticket[];
}

export function StatsRow({ tickets }: StatsRowProps) {
  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedToday = tickets.filter(t => t.status === "resolved").length;
  const urgentCount = tickets.filter(t => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length;

  const stats = [
    {
      label: "Abertos",
      value: openCount,
      icon: Inbox,
      color: "bg-warning/10 text-warning",
    },
    {
      label: "Em atendimento",
      value: inProgressCount,
      icon: Clock,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Resolvidos hoje",
      value: resolvedToday,
      icon: CheckCircle,
      color: "bg-success/10 text-success",
    },
    {
      label: "Urgentes",
      value: urgentCount,
      icon: AlertTriangle,
      color: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl border border-border p-4 flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
            <stat.icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
