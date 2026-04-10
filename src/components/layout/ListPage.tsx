import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ListPageProps {
  /** PageHeader component */
  header: ReactNode;
  /** Filter bar area (SearchBar, ExpandableFilters, PeriodSelector, etc.) */
  filters?: ReactNode;
  /** Desktop table content */
  desktopContent?: ReactNode;
  /** Mobile card list content */
  mobileContent?: ReactNode;
  /** Content shown on both desktop and mobile (use instead of desktop/mobile split) */
  children?: ReactNode;
  /** Pagination component */
  pagination?: ReactNode;
  /** Extra info row between content and pagination (e.g. "Showing 1-50 of 200") */
  footerInfo?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Standard layout wrapper for list/table pages.
 *
 * Usage:
 * ```tsx
 * <ListPage
 *   header={<PageHeader title="Contatos" titleMeta={totalCount} />}
 *   filters={
 *     <>
 *       <SearchBar value={search} onChange={setSearch} />
 *       <ExpandableFilters activeCount={activeFilters}>
 *         ...filter selects...
 *       </ExpandableFilters>
 *     </>
 *   }
 *   desktopContent={<DataTable ... />}
 *   mobileContent={<MobileListCard ... />}
 *   pagination={<Pagination ... />}
 * />
 * ```
 */
export function ListPage({
  header,
  filters,
  desktopContent,
  mobileContent,
  children,
  pagination,
  footerInfo,
  className,
}: ListPageProps) {
  return (
    <div
      className={cn(
        "p-6 h-full overflow-hidden flex flex-col gap-4",
        className
      )}
    >
      {/* Header */}
      {header}

      {/* Filters */}
      {filters && <div className="shrink-0 space-y-3">{filters}</div>}

      {/* Content area */}
      <div className="flex-1 overflow-hidden min-h-0">
        {children ? (
          children
        ) : (
          <>
            {/* Desktop content */}
            {desktopContent && (
              <div className="hidden md:flex h-full flex-col">
                {desktopContent}
              </div>
            )}
            {/* Mobile content */}
            {mobileContent && (
              <div className="flex md:hidden h-full flex-col overflow-y-auto">
                {mobileContent}
              </div>
            )}
            {/* Fallback if only one is provided */}
            {!desktopContent && !mobileContent && null}
          </>
        )}
      </div>

      {/* Footer: info + pagination */}
      {(footerInfo || pagination) && (
        <div className="shrink-0 pt-2 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">{footerInfo}</div>
          <div>{pagination}</div>
        </div>
      )}
    </div>
  );
}
