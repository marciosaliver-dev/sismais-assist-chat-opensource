import { AlertTriangle, AlertOctagon, TrendingUp, Clock, Star, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnomalyAlert } from "@/hooks/useSLAAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

interface AnomalyAlertsProps {
  alerts: AnomalyAlert[] | undefined;
  loading?: boolean;
}

const ALERT_ICONS: Record<string, React.ElementType> = {
  volume_spike: TrendingUp,
  high_latency: Clock,
  low_csat: Star,
  error_rate: Zap,
  sla_violation: Shield,
};

export function AnomalyAlerts({ alerts, loading }: AnomalyAlertsProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
          <Shield className="w-[18px] h-[18px] text-[#16A34A]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#10293F] dark:text-foreground">
            Nenhuma anomalia detectada
          </p>
          <p className="text-xs text-muted-foreground">Todas as metricas dentro dos limites esperados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const Icon = ALERT_ICONS[alert.type] || AlertTriangle;
        const isCritical = alert.severity === "critical";

        return (
          <div
            key={alert.id}
            className={cn(
              "rounded-xl border p-4 flex items-start gap-3 transition-all duration-200",
              "hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5",
              isCritical
                ? "bg-[#FEF2F2] border-[rgba(220,38,38,0.3)]"
                : "bg-[#FFFBEB] border-[rgba(255,184,0,0.5)]"
            )}
          >
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                isCritical ? "bg-[#DC2626]/10" : "bg-[#FFB800]/10"
              )}
            >
              {isCritical ? (
                <AlertOctagon className="w-[18px] h-[18px] text-[#DC2626]" />
              ) : (
                <Icon className="w-[18px] h-[18px] text-[#92400E]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isCritical ? "text-[#DC2626]" : "text-[#92400E]"
                  )}
                >
                  {alert.title}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded",
                    isCritical
                      ? "bg-[#DC2626] text-white"
                      : "bg-[#FFB800] text-[#10293F]"
                  )}
                >
                  {isCritical ? "CRITICO" : "ALERTA"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
