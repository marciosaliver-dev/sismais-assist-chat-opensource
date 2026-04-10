import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTicketLookups, TicketReportFilters } from "@/hooks/useTicketReport";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "aberto", label: "Aberto" },
  { value: "em_atendimento", label: "Em Atendimento" },
  { value: "aguardando", label: "Aguardando" },
  { value: "finalizado", label: "Finalizado" },
  { value: "resolvido", label: "Resolvido" },
  { value: "cancelado", label: "Cancelado" },
];

const PRIORITY_OPTIONS = [
  { value: "critica", label: "Crítica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

interface TicketFiltersProps {
  filters: TicketReportFilters;
  onChange: (filters: Partial<TicketReportFilters>) => void;
  onClear: () => void;
  className?: string;
}

export function TicketFilters({ filters, onChange, onClear, className }: TicketFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const { categories, modules, humanAgents, aiAgents, boards, clients } = useTicketLookups();

  const hasActiveFilters =
    filters.status || filters.priority || filters.categoryId || filters.moduleId ||
    filters.humanAgentId || filters.aiAgentId || filters.boardId || filters.clientId;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className={cn(hasActiveFilters && "border-primary text-primary")}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {[filters.status, filters.priority, filters.categoryId, filters.moduleId, filters.humanAgentId, filters.aiAgentId, filters.boardId, filters.clientId].filter(Boolean).length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 rounded-lg border border-border bg-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={filters.status || "__all__"} onValueChange={(v) => onChange({ status: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select value={filters.priority || "__all__"} onValueChange={(v) => onChange({ priority: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select value={filters.categoryId || "__all__"} onValueChange={(v) => onChange({ categoryId: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {(categories.data || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Module */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Módulo</label>
            <Select value={filters.moduleId || "__all__"} onValueChange={(v) => onChange({ moduleId: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(modules.data || []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Human Agent */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Agente Humano</label>
            <Select value={filters.humanAgentId || "__all__"} onValueChange={(v) => onChange({ humanAgentId: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(humanAgents.data || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Agent */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Agente IA</label>
            <Select value={filters.aiAgentId || "__all__"} onValueChange={(v) => onChange({ aiAgentId: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(aiAgents.data || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Board */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Board</label>
            <Select value={filters.boardId || "__all__"} onValueChange={(v) => onChange({ boardId: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(boards.data || []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cliente</label>
            <Select value={filters.clientId || "__all__"} onValueChange={(v) => onChange({ clientId: v === "__all__" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(clients.data || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name || c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
