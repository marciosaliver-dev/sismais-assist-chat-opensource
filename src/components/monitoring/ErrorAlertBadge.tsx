import { AlertTriangle } from "lucide-react"
import { useUnreadErrors } from "@/hooks/useActionLogs"
import { cn } from "@/lib/utils"

export function ErrorAlertBadge() {
  const { data: count = 0 } = useUnreadErrors()

  if (count === 0) return null

  return (
    <div className="relative">
      <AlertTriangle className={cn("w-5 h-5", count > 0 ? "text-destructive" : "text-muted-foreground")} />
      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
        {count > 99 ? "99+" : count}
      </span>
    </div>
  )
}
