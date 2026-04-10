import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ReportKPI {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  trend?: { value: string; isPositive: boolean };
  accent?: "cyan" | "navy" | "yellow" | "success" | "error" | "purple";
}

interface ReportKPICardsProps {
  kpis: ReportKPI[];
  loading?: boolean;
  className?: string;
  columns?: 3 | 4 | 5;
}

const accentMap = {
  cyan: {
    iconBg: "bg-[#E8F9F9]",
    iconColor: "text-[#10293F]",
    border: "border-t-[#45E5E5]",
  },
  navy: {
    iconBg: "bg-[#10293F]",
    iconColor: "text-[#45E5E5]",
    border: "border-t-[#10293F]",
  },
  yellow: {
    iconBg: "bg-[#FFFBEB]",
    iconColor: "text-[#10293F]",
    border: "border-t-[#FFB800]",
  },
  success: {
    iconBg: "bg-[#F0FDF4]",
    iconColor: "text-[#16A34A]",
    border: "border-t-[#16A34A]",
  },
  error: {
    iconBg: "bg-[#FEF2F2]",
    iconColor: "text-[#DC2626]",
    border: "border-t-[#DC2626]",
  },
  purple: {
    iconBg: "bg-purple-50",
    iconColor: "text-[#7C3AED]",
    border: "border-t-[#7C3AED]",
  },
};

const colsClass = (cols: number) => {
  if (cols === 3) return "grid-cols-1 sm:grid-cols-3";
  if (cols === 5) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
};

export function ReportKPICards({ kpis, loading, className, columns }: ReportKPICardsProps) {
  const cols = columns || Math.min(kpis.length, 4);

  if (loading) {
    return (
      <div className={cn("grid gap-4", colsClass(cols), className)}>
        {kpis.map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3 border-t-2 border-t-border">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4 stagger-container", colsClass(cols), className)}>
      {kpis.map((kpi, i) => {
        const accent = accentMap[kpi.accent || "cyan"];
        const Icon = kpi.icon;

        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border border-border bg-card p-5 border-t-[3px] transition-all duration-200",
              "hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5",
              accent.border
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                {kpi.title}
                {kpi.tooltip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      {kpi.tooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
              </span>
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accent.iconBg)}>
                <Icon className={cn("w-[18px] h-[18px]", accent.iconColor)} />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">
              {kpi.value}
            </p>
            {(kpi.subtitle || kpi.trend) && (
              <div className="flex items-center gap-2 mt-2">
                {kpi.trend && (
                  <span className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded",
                    kpi.trend.isPositive
                      ? "text-[#16A34A] bg-[#F0FDF4]"
                      : "text-[#DC2626] bg-[#FEF2F2]"
                  )}>
                    {kpi.trend.isPositive ? "↑" : "↓"} {kpi.trend.value}
                  </span>
                )}
                {kpi.subtitle && (
                  <span className="text-xs text-muted-foreground">{kpi.subtitle}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
