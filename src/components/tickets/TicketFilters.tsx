import { Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TicketStatus, TicketPriority } from "@/types/ticket";

interface TicketFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: TicketStatus | "all";
  onStatusChange: (status: TicketStatus | "all") => void;
  priorityFilter: TicketPriority | "all";
  onPriorityChange: (priority: TicketPriority | "all") => void;
  assigneeFilter: string;
  onAssigneeChange: (assignee: string) => void;
  agents: { id: string; name: string }[];
}

const statusOptions: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertos" },
  { value: "in_progress", label: "Em atendimento" },
  { value: "pending", label: "Pendentes" },
  { value: "resolved", label: "Resolvidos" },
  { value: "closed", label: "Fechados" },
];

const priorityOptions: { value: TicketPriority | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

export function TicketFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  assigneeFilter,
  onAssigneeChange,
  agents,
}: TicketFiltersProps) {
  const hasFilters = statusFilter !== "all" || priorityFilter !== "all" || assigneeFilter !== "all";

  const clearFilters = () => {
    onStatusChange("all");
    onPriorityChange("all");
    onAssigneeChange("all");
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar tickets..."
          className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as TicketStatus | "all")}
          className="px-3 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value as TicketPriority | "all")}
          className="px-3 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Prioridade</option>
          {priorityOptions.slice(1).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Assignee Filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => onAssigneeChange(e.target.value)}
          className="px-3 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Responsável</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.name}>
              {agent.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
