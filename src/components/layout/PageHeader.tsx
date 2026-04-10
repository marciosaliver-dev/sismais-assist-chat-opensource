import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Subtitle / description */
  subtitle?: string;
  /** Count badge next to title (e.g. total items) */
  titleMeta?: string | number;
  /** Back navigation path. Shows arrow button when set. */
  backPath?: string;
  /** Action buttons on the right */
  actions?: ReactNode;
  /** Extra content below title row (e.g. tabs, filters) */
  children?: ReactNode;
  /** Additional className for wrapper */
  className?: string;
  /** Whether to show the accent border bottom */
  accent?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  titleMeta,
  backPath,
  actions,
  children,
  className,
  accent = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("shrink-0", accent && "page-header", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {backPath && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => navigate(backPath)}
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground truncate">
                {title}
              </h1>
              {titleMeta !== undefined && titleMeta !== null && (
                <Badge variant="secondary" className="text-sm shrink-0">
                  {titleMeta}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
