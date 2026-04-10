import { Bot, User, Star, Clock, DollarSign, CheckCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLAMetrics } from "@/hooks/useSLAAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AIvsHumanComparisonProps {
  data: SLAMetrics | undefined;
  loading?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16,41,63,0.1)",
  fontSize: 13,
};

export function AIvsHumanComparison({ data, loading }: AIvsHumanComparisonProps) {
  const { rate } = useExchangeRate();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data || data.byAgent.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Sem dados de agentes no periodo</p>
      </div>
    );
  }

  // Aggregate IA vs Human totals
  const iaAgents = data.byAgent.filter((a) => a.agentType === "ia");
  const humanAgents = data.byAgent.filter((a) => a.agentType === "humano");

  const iaTotal = iaAgents.reduce((s, a) => s + a.total, 0);
  const humanTotal = humanAgents.reduce((s, a) => s + a.total, 0);

  const iaAvgRes = iaAgents.length
    ? Math.round(iaAgents.reduce((s, a) => s + a.avgResolutionSeconds * a.total, 0) / Math.max(iaTotal, 1))
    : 0;
  const humanAvgRes = humanAgents.length
    ? Math.round(humanAgents.reduce((s, a) => s + a.avgResolutionSeconds * a.total, 0) / Math.max(humanTotal, 1))
    : 0;

  const iaCsatItems = iaAgents.filter((a) => a.avgCsat > 0);
  const humanCsatItems = humanAgents.filter((a) => a.avgCsat > 0);
  const iaAvgCsat = iaCsatItems.length
    ? Number((iaCsatItems.reduce((s, a) => s + a.avgCsat, 0) / iaCsatItems.length).toFixed(1))
    : 0;
  const humanAvgCsat = humanCsatItems.length
    ? Number((humanCsatItems.reduce((s, a) => s + a.avgCsat, 0) / humanCsatItems.length).toFixed(1))
    : 0;

  const iaSLA = iaAgents.length
    ? Math.round(iaAgents.reduce((s, a) => s + a.complianceRate * a.total, 0) / Math.max(iaTotal, 1))
    : 0;
  const humanSLA = humanAgents.length
    ? Math.round(humanAgents.reduce((s, a) => s + a.complianceRate * a.total, 0) / Math.max(humanTotal, 1))
    : 0;

  const iaCost = iaAgents.reduce((s, a) => s + a.totalCostUsd, 0) * rate;
  const costPerTicketIA = iaTotal > 0 ? iaCost / iaTotal : 0;

  // Chart data for top agents comparison
  const topAgents = data.byAgent.slice(0, 10).map((a) => ({
    name: a.agentName.length > 12 ? a.agentName.substring(0, 12) + "..." : a.agentName,
    atendimentos: a.total,
    sla: a.complianceRate,
    type: a.agentType,
  }));

  const metrics = [
    {
      label: "Atendimentos",
      ia: iaTotal,
      human: humanTotal,
      iaFormatted: String(iaTotal),
      humanFormatted: String(humanTotal),
      icon: CheckCircle,
      better: iaTotal >= humanTotal ? "ia" : "human",
    },
    {
      label: "Tempo Resolucao",
      ia: iaAvgRes,
      human: humanAvgRes,
      iaFormatted: formatDuration(iaAvgRes),
      humanFormatted: formatDuration(humanAvgRes),
      icon: Clock,
      better: iaAvgRes > 0 && humanAvgRes > 0 ? (iaAvgRes <= humanAvgRes ? "ia" : "human") : "none",
    },
    {
      label: "CSAT",
      ia: iaAvgCsat,
      human: humanAvgCsat,
      iaFormatted: iaAvgCsat > 0 ? `${iaAvgCsat}/5` : "--",
      humanFormatted: humanAvgCsat > 0 ? `${humanAvgCsat}/5` : "--",
      icon: Star,
      better: iaAvgCsat >= humanAvgCsat ? "ia" : "human",
    },
    {
      label: "SLA",
      ia: iaSLA,
      human: humanSLA,
      iaFormatted: `${iaSLA}%`,
      humanFormatted: `${humanSLA}%`,
      icon: Shield,
      better: iaSLA >= humanSLA ? "ia" : "human",
    },
    {
      label: "Custo/Ticket",
      ia: costPerTicketIA,
      human: 0,
      iaFormatted: costPerTicketIA > 0
        ? costPerTicketIA < 0.01
          ? `R$ ${costPerTicketIA.toFixed(4).replace(".", ",")}`
          : costPerTicketIA.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "--",
      humanFormatted: "N/A",
      icon: DollarSign,
      better: "none",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Side by side comparison */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#45E5E5]" />
          <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">
            IA vs Humano — Comparativo
          </h3>
        </div>
        <div className="p-4">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_100px] gap-2 mb-3 px-2">
            <div />
            <div className="text-center">
              <div className="w-8 h-8 mx-auto rounded-lg bg-[#E8F9F9] flex items-center justify-center mb-1">
                <Bot className="w-4 h-4 text-[#10293F]" />
              </div>
              <span className="text-[11px] font-semibold text-[#10293F] dark:text-foreground">IA</span>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 mx-auto rounded-lg bg-[#10293F] flex items-center justify-center mb-1">
                <User className="w-4 h-4 text-[#45E5E5]" />
              </div>
              <span className="text-[11px] font-semibold text-[#10293F] dark:text-foreground">Humano</span>
            </div>
          </div>

          {/* Rows */}
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className={cn(
                  "grid grid-cols-[1fr_100px_100px] gap-2 py-2.5 px-2 rounded-lg",
                  i % 2 === 0 ? "bg-[#F8FAFC] dark:bg-muted/30" : ""
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-[#10293F] dark:text-foreground">
                    {m.label}
                  </span>
                </div>
                <div className="text-center">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      m.better === "ia" ? "text-[#45E5E5]" : "text-[#10293F] dark:text-foreground"
                    )}
                  >
                    {m.iaFormatted}
                  </span>
                </div>
                <div className="text-center">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      m.better === "human" ? "text-[#45E5E5]" : "text-[#10293F] dark:text-foreground"
                    )}
                  >
                    {m.humanFormatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agents chart */}
      {topAgents.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">
              Volume por Agente
            </h3>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topAgents} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar
                  dataKey="atendimentos"
                  name="Atendimentos"
                  radius={[4, 4, 0, 0]}
                  fill="#45E5E5"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
