import { ReactNode } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormPageProps {
  /** Form title */
  title: string;
  /** Subtitle */
  subtitle?: string;
  /** Path to navigate back to */
  backPath?: string;
  /** Form content (sections, fields) */
  children: ReactNode;
  /** Called when save button is clicked */
  onSave?: () => void;
  /** Whether the form has unsaved changes (enables save button) */
  hasChanges?: boolean;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Save button label */
  saveLabel?: string;
  /** Extra action buttons in footer */
  footerActions?: ReactNode;
  /** Extra action buttons in header (right side) */
  headerActions?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Standard layout wrapper for form/edit pages.
 * Provides consistent header with back button, title, and sticky footer with save.
 *
 * Usage:
 * ```tsx
 * <FormPage
 *   title="Novo Agente"
 *   subtitle="Configure um novo agente de IA"
 *   backPath="/agents"
 *   onSave={handleSave}
 *   hasChanges={isDirty}
 *   isSaving={mutation.isPending}
 * >
 *   <SectionCard title="Informações Básicas">
 *     <Input ... />
 *   </SectionCard>
 * </FormPage>
 * ```
 */
export function FormPage({
  title,
  subtitle,
  backPath,
  children,
  onSave,
  hasChanges = true,
  isSaving = false,
  saveLabel = "Salvar",
  footerActions,
  headerActions,
  className,
}: FormPageProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-4 max-w-4xl">
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
              <h1 className="text-xl font-semibold text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
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
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 space-y-6 max-w-4xl">{children}</div>
      </div>

      {/* Sticky footer */}
      {onSave && (
        <div className="shrink-0 px-6 py-4 border-t border-border bg-card">
          <div className="flex items-center justify-between gap-4 max-w-4xl">
            <div>{footerActions}</div>
            <div className="flex items-center gap-3">
              {backPath && (
                <Button
                  variant="outline"
                  onClick={() => navigate(backPath)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
              )}
              <Button
                onClick={onSave}
                disabled={!hasChanges || isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
