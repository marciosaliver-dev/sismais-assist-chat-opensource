import { Shield, AlertTriangle, CheckCircle, Clock, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLAMetrics } from "@/hooks/useSLAAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface SLAComplianceCardProps {
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

const PRIORITY_COLORS: Record<string, string> = {
  critica: "#7C3AED",
  alta: "#DC2626",
  media: "#FFB800",
  baixa: "#16A34A",
};

const PRIORITY_LABELS: Record<string, string> = {
  critica: "Critica",
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16,41,63,0.1)",
  fontSize: 13,
};

export function SLAComplianceCard({ data, loading }: SLAComplianceCardProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-[240px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data || data.totalTickets === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Sem dados de SLA no periodo</p>
      </div>
    );
  }

  const complianceColor =
    data.complianceRate >= 90
      ? "#16A34A"
      : data.complianceRate >= 70
      ? "#FFB800"
      : "#DC2626";

  const chartData = data.byPriority
    .sort((a, b) => {
      const order = ["critica", "alta", "media", "baixa"];
      return order.indexOf(a.priority) - order.indexOf(b.priority);
    })
    .map((p) => ({
      name: PRIORITY_LABELS[p.priority] || p.priority,
      compliance: p.complianceRate,
      total: p.total,
      fill: PRIORITY_COLORS[p.priority] || "#999",
    }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#45E5E5]" />
          <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">
            Conformidade SLA
          </h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Compliance Rate */}
            <div className="text-center">
              <div
                className="text-3xl font-bold font-[Poppins,Inter,system-ui,sans-serif]"
                style={{ color: complianceColor }}
              >
                {data.complianceRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Taxa de conformidade</p>
            </div>

            {/* Within SLA */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <CheckCircle className="w-[18px] h-[18px] text-[#16A34A]" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#10293F] dark:text-foreground">
                  {data.withinSLA}
                </p>
                <p className="text-[11px] text-muted-foreground">Dentro do SLA</p>
              </div>
            </div>

            {/* Violated */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FEF2F2] flex items-center justify-center">
                <AlertTriangle className="w-[18px] h-[18px] text-[#DC2626]" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#10293F] dark:text-foreground">
                  {data.violatedSLA}
                </p>
                <p className="text-[11px] text-muted-foreground">Violaram SLA</p>
              </div>
            </div>

            {/* Avg Resolution */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <Clock className="w-[18px] h-[18px] text-[#10293F]" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#10293F] dark:text-foreground">
                  {formatDuration(data.avgResolutionSeconds)}
                </p>
                <p className="text-[11px] text-muted-foreground">Tempo medio resolucao</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* By Priority Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">
              Conformidade por Prioridade
            </h3>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value}%`, "Conformidade"]}
                />
                <Bar dataKey="compliance" name="Conformidade %" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
