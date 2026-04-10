import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

export interface MultiSelectOption {
  value: string
  label: string
  color?: string
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  maxDisplayed?: number
}

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  className,
  maxDisplayed = 2,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 justify-between gap-1 text-sm font-normal min-w-[140px]",
            selected.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected.length === 0
              ? placeholder
              : selected.length <= maxDisplayed
                ? selectedLabels.join(", ")
                : `${selected.length} selecionados`}
          </span>
          {selected.length > 0 ? (
            <X
              className="h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onChange([])
              }}
            />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  if (selected.length === options.length) {
                    onChange([])
                  } else {
                    onChange(options.map((o) => o.value))
                  }
                }}
                className="text-xs font-medium text-muted-foreground"
              >
                <Check
                  className={cn(
                    "mr-2 h-3.5 w-3.5",
                    selected.length === options.length ? "opacity-100" : "opacity-0"
                  )}
                />
                {selected.length === options.length ? "Limpar tudo" : "Selecionar tudo"}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      selected.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.color && (
                    <span
                      className="mr-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
