import { TrendingUp } from "lucide-react";
import { DemandForecastPoint } from "@/hooks/useSLAAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DemandForecastProps {
  data: DemandForecastPoint[] | undefined;
  loading?: boolean;
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16,41,63,0.1)",
  fontSize: 13,
};

export function DemandForecast({ data, loading }: DemandForecastProps) {
  if (loading) {
    return <Skeleton className="h-[300px] w-full rounded-xl" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Dados insuficientes para previsao</p>
      </div>
    );
  }

  // Find where forecast starts
  const forecastStartIdx = data.findIndex((d) => d.forecast !== null);
  const forecastStartDate = forecastStartIdx >= 0 ? data[forecastStartIdx].date : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)] hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] transition-shadow duration-200">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#45E5E5]" />
          <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">
            Previsao de Demanda
          </h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)] font-medium">
          Tendencia linear
        </span>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#45E5E5" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#45E5E5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFB800" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#FFB800" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            {forecastStartDate && (
              <ReferenceLine
                x={forecastStartDate}
                stroke="#FFB800"
                strokeDasharray="4 4"
                label={{
                  value: "Previsao",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#FFB800",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#45E5E5"
              fill="url(#gradActual)"
              strokeWidth={2}
              name="Atendimentos"
              dot={{ fill: "#45E5E5", r: 3 }}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#FFB800"
              fill="url(#gradForecast)"
              strokeWidth={2}
              strokeDasharray="6 3"
              name="Previsao"
              dot={{ fill: "#FFB800", r: 3 }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#45E5E5] rounded" />
            <span className="text-[11px] text-muted-foreground">Realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#FFB800] rounded" style={{ borderTop: "1px dashed #FFB800" }} />
            <span className="text-[11px] text-muted-foreground">Previsao (7 dias)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
