import { ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

// ── Sortable Header ──

interface SortableHeaderProps {
  label: string;
  field: string;
  currentField: string;
  currentDirection: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentField === field;
  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDirection === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

// ── Skeleton Rows ──

interface SkeletonRowsProps {
  /** Number of skeleton rows */
  count?: number;
  /** Number of columns */
  columns: number;
  /** Column widths for skeleton variation */
  columnWidths?: string[];
}

export function SkeletonRows({
  count = 5,
  columns,
  columnWidths,
}: SkeletonRowsProps) {
  const defaultWidths = ["w-32", "w-24", "w-40", "w-20", "w-28", "w-16"];

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton
                className={cn(
                  "h-4",
                  columnWidths?.[j] || defaultWidths[j % defaultWidths.length]
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Empty State ──

interface EmptyStateProps {
  icon?: ReactNode;
  message?: string;
  className?: string;
}

export function TableEmptyState({
  icon,
  message = "Nenhum resultado encontrado",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-muted-foreground gap-2",
        className
      )}
    >
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Smart Pagination ──

interface SmartPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Show "Showing X-Y of Z" text */
  showInfo?: boolean;
  from?: number;
  to?: number;
  total?: number;
  className?: string;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }
  return pages;
}

export function SmartPagination({
  currentPage,
  totalPages,
  onPageChange,
  showInfo = true,
  from,
  to,
  total,
  className,
}: SmartPaginationProps) {
  if (totalPages <= 1 && !showInfo) return null;

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {showInfo && from !== undefined && to !== undefined && total !== undefined && (
        <p className="text-sm text-muted-foreground">
          Mostrando {from}–{to} de {total}
        </p>
      )}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={p === currentPage}
                    onClick={() => onPageChange(p)}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  onPageChange(Math.min(totalPages, currentPage + 1))
                }
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

// ── Sortable Table Hook ──

import { useState, useCallback } from "react";

export function useSortable(defaultField: string, defaultDirection: "asc" | "desc" = "desc") {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultDirection);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  return { sortField, sortDirection, handleSort };
}
