import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  /** Current search value (controlled) */
  value: string;
  /** Called with the raw (non-debounced) value */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  autoFocus = false,
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gms-g500 pointer-events-none" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9 border-gms-g300 rounded-md focus-visible:border-gms-cyan focus-visible:ring-2 focus-visible:ring-[rgba(69,229,229,0.15)]"
        autoFocus={autoFocus}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-gms-g100"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * Hook that combines SearchBar state with debounce.
 * Returns [displayValue, debouncedValue, setValue] for controlled usage.
 */
export function useSearchBar(delay = 300) {
  const [value, setValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return [value, debouncedValue, setValue] as const;
}
