import { useState, useMemo, useCallback } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_month"
  | "last_month"
  | "this_week"
  | "this_year"
  | "custom";

interface PeriodOption {
  value: PeriodPreset;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "this_week", label: "Esta semana" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

export interface PeriodValue {
  preset: PeriodPreset;
  from: Date;
  to: Date;
}

interface PeriodSelectorProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  /** Which presets to show. Defaults to all. */
  presets?: PeriodPreset[];
  className?: string;
}

/**
 * Computes date range for a given preset.
 */
export function computeDatesForPeriod(preset: PeriodPreset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "this_week":
      return { from: startOfWeek(now, { locale: ptBR }), to: endOfWeek(now, { locale: ptBR }) };
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "this_year":
      return { from: startOfYear(now), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom || startOfDay(now),
        to: customTo || endOfDay(now),
      };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export function PeriodSelector({
  value,
  onChange,
  presets,
  className,
}: PeriodSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const availableOptions = presets
    ? PERIOD_OPTIONS.filter((opt) => presets.includes(opt.value))
    : PERIOD_OPTIONS;

  const handlePresetChange = useCallback(
    (preset: string) => {
      const p = preset as PeriodPreset;
      if (p === "custom") {
        setCalendarOpen(true);
        return;
      }
      const dates = computeDatesForPeriod(p);
      onChange({ preset: p, ...dates });
    },
    [onChange]
  );

  const handleDateRangeSelect = useCallback(
    (range: DateRange | undefined) => {
      if (range?.from) {
        const from = startOfDay(range.from);
        const to = range.to ? endOfDay(range.to) : endOfDay(range.from);
        onChange({ preset: "custom", from, to });
        if (range.to) {
          setCalendarOpen(false);
        }
      }
    },
    [onChange]
  );

  const displayLabel = useMemo(() => {
    if (value.preset === "custom") {
      const fromStr = format(value.from, "dd/MM/yy", { locale: ptBR });
      const toStr = format(value.to, "dd/MM/yy", { locale: ptBR });
      return `${fromStr} — ${toStr}`;
    }
    return availableOptions.find((o) => o.value === value.preset)?.label || "";
  }, [value, availableOptions]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value.preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-sm">
              <CalendarDays className="w-4 h-4" />
              {format(value.from, "dd/MM", { locale: ptBR })} — {format(value.to, "dd/MM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: value.from, to: value.to }}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/**
 * Hook for using PeriodSelector with state management.
 * @param initialPreset - Default period preset (defaults to "last30")
 */
export function usePeriodSelector(initialPreset: PeriodPreset = "last30") {
  const initialDates = computeDatesForPeriod(initialPreset);
  const [period, setPeriod] = useState<PeriodValue>({
    preset: initialPreset,
    ...initialDates,
  });

  return { period, setPeriod };
}
