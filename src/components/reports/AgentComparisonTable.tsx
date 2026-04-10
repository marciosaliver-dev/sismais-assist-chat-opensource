import { Badge } from "@/components/ui/badge";
import { Star, Clock, Bot, User } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentPerformance } from "@/hooks/useExecutiveDashboard";

interface AgentComparisonTableProps {
  agents: AgentPerformance[];
  loading?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export function AgentComparisonTable({ agents, loading }: AgentComparisonTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!agents.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum agente com atendimentos no período
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agente</TableHead>
            <TableHead className="w-20">Tipo</TableHead>
            <TableHead className="text-right w-28">Atendimentos</TableHead>
            <TableHead className="text-right w-24">Taxa Sucesso</TableHead>
            <TableHead className="text-right w-20">CSAT</TableHead>
            <TableHead className="text-right w-28">Tempo Médio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={`${agent.type}-${agent.id}`}>
              <TableCell className="font-medium text-sm">
                <div className="flex items-center gap-2">
                  {agent.type === "ia" ? (
                    <Bot className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  {agent.name}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={agent.type === "ia" ? "default" : "secondary"} className="text-xs">
                  {agent.type === "ia" ? "IA" : "Humano"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold">{agent.conversations}</TableCell>
              <TableCell className="text-right">
                <span className={agent.successRate >= 70 ? "text-green-600 font-medium" : agent.successRate >= 40 ? "text-yellow-600" : "text-red-600"}>
                  {agent.successRate}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                {agent.avgCsat > 0 ? (
                  <span className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    {agent.avgCsat}
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                <span className="flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(agent.avgResolutionSeconds)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
