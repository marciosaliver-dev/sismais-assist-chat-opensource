import { useState, ReactNode } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ExpandableFiltersProps {
  /** Number of active filters (shows badge) */
  activeCount?: number;
  /** Filter form content */
  children: ReactNode;
  /** Called when "Clear all" is clicked */
  onClearAll?: () => void;
  /** Label for the toggle button */
  label?: string;
  /** Start expanded */
  defaultExpanded?: boolean;
  /** Additional className */
  className?: string;
}

export function ExpandableFilters({
  activeCount = 0,
  children,
  onClearAll,
  label = "Filtros",
  defaultExpanded = false,
  className,
}: ExpandableFiltersProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={cn("shrink-0", className)}>
      {/* Toggle bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Filter className="w-4 h-4" />
          {label}
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="ml-1 h-5 min-w-[20px] px-1.5 text-xs"
            >
              {activeCount}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </Button>

        {activeCount > 0 && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onClearAll}
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Filter content */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          expanded
            ? "grid-rows-[1fr] opacity-100 mt-3"
            : "grid-rows-[0fr] opacity-0 mt-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-end gap-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
