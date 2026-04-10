import { HourlyCell } from "@/hooks/useExecutiveDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface HourlyHeatmapProps {
  data: HourlyCell[];
  loading?: boolean;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function HourlyHeatmap({ data, loading }: HourlyHeatmapProps) {
  if (loading) return <Skeleton className="h-[200px] w-full" />;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  function getOpacity(count: number): number {
    if (count === 0) return 0.05;
    return 0.1 + (count / maxCount) * 0.85;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-1">
        {/* Hour labels */}
        <div className="flex items-center gap-0.5 pl-10">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex-1 text-center text-[9px] text-muted-foreground font-mono"
            >
              {h % 3 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>

        {/* Grid */}
        {DAY_LABELS.map((dayLabel, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-0.5">
            <span className="w-9 text-[10px] font-medium text-muted-foreground text-right pr-1 shrink-0">
              {dayLabel}
            </span>
            {Array.from({ length: 24 }, (_, h) => {
              const cell = data.find((d) => d.day === dayIdx && d.hour === h);
              const count = cell?.count || 0;
              return (
                <Tooltip key={h}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex-1 aspect-square rounded-[2px] min-w-[10px] transition-colors"
                      style={{
                        backgroundColor: `rgba(69, 229, 229, ${getOpacity(count)})`,
                        border: count > 0 ? "1px solid rgba(69, 229, 229, 0.3)" : "1px solid transparent",
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <strong>{dayLabel} {h}h</strong>: {count} atendimentos
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <span className="text-[10px] text-muted-foreground">Menos</span>
          {[0.05, 0.2, 0.4, 0.6, 0.85].map((op) => (
            <div
              key={op}
              className="w-3 h-3 rounded-[2px]"
              style={{ backgroundColor: `rgba(69, 229, 229, ${op})` }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">Mais</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
