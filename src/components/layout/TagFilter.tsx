import { cn } from "@/lib/utils";

interface TagOption {
  value: string;
  label: string;
  count?: number;
  color?: string;
}

interface TagFilterProps {
  /** Available tags */
  options: TagOption[];
  /** Currently selected value(s) */
  value: string | string[];
  /** Called when selection changes */
  onChange: (value: string | string[]) => void;
  /** Allow selecting multiple tags */
  multiple?: boolean;
  /** Show "All" option */
  showAll?: boolean;
  /** Label for "All" option */
  allLabel?: string;
  /** Additional className */
  className?: string;
}

export function TagFilter({
  options,
  value,
  onChange,
  multiple = false,
  showAll = true,
  allLabel = "Todos",
  className,
}: TagFilterProps) {
  const selectedSet = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const isAllSelected = selectedSet.size === 0;

  const handleClick = (tagValue: string) => {
    if (multiple) {
      const newSet = new Set(selectedSet);
      if (newSet.has(tagValue)) {
        newSet.delete(tagValue);
      } else {
        newSet.add(tagValue);
      }
      onChange(Array.from(newSet));
    } else {
      onChange(tagValue === (value as string) ? "" : tagValue);
    }
  };

  const handleAllClick = () => {
    onChange(multiple ? [] : "");
  };

  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label="Filtrar por tag"
    >
      {showAll && (
        <button
          type="button"
          onClick={handleAllClick}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
            isAllSelected
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
          )}
        >
          {allLabel}
        </button>
      )}
      {options.map((tag) => {
        const isSelected = selectedSet.has(tag.value);
        return (
          <button
            key={tag.value}
            type="button"
            onClick={() => handleClick(tag.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {tag.color && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
            )}
            {tag.label}
            {tag.count !== undefined && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0 rounded-full min-w-[18px] text-center",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tag.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
