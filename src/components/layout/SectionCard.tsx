import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  /** Section title */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Icon or element left of title */
  icon?: ReactNode;
  /** Actions on the right of the header */
  headerActions?: ReactNode;
  /** Card content */
  children: ReactNode;
  /** Remove padding from content area */
  noPadding?: boolean;
  /** Additional className for the card */
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  icon,
  headerActions,
  children,
  noPadding = false,
  className,
}: SectionCardProps) {
  const hasHeader = title || subtitle || icon || headerActions;

  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border",
        "shadow-[var(--shadow-card)]",
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 text-primary">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerActions && (
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className={cn(!noPadding && "p-5")}>{children}</div>
    </div>
  );
}
