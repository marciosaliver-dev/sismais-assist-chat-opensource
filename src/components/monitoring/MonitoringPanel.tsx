import { useActionLogs } from "@/hooks/useActionLogs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Sucesso" },
  error: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Erro" },
  timeout: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Timeout" },
  fallback: { icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10", label: "Fallback" },
} as const

export function MonitoringPanel() {
  const { data: logs = [], isLoading } = useActionLogs(100)

  const errorCount = logs.filter(l => l.status === "error" || l.status === "timeout").length
  const successRate = logs.length > 0
    ? ((logs.filter(l => l.status === "success").length / logs.length) * 100).toFixed(1)
    : "0"
  const avgLatency = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / logs.length)
    : 0
  const totalCost = logs.reduce((sum, l) => sum + (l.cost_usd || 0), 0)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Carregando monitoramento...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Taxa de sucesso</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="text-xs text-muted-foreground">Erros recentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{avgLatency}ms</div>
            <div className="text-xs text-muted-foreground">Latência média</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">Custo total</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Timeline de Ações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => {
                const config = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.success
                const Icon = config.icon

                return (
                  <div
                    key={log.id}
                    className={cn("flex items-start gap-3 p-2 rounded-lg text-xs", config.bg)}
                  >
                    <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{log.action_type}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {config.label}
                        </Badge>
                        {log.model && (
                          <span className="text-muted-foreground truncate">{log.model}</span>
                        )}
                      </div>
                      {log.error_message && (
                        <p className="text-destructive mt-0.5 truncate">{log.error_message}</p>
                      )}
                      <div className="flex gap-3 mt-0.5 text-muted-foreground">
                        {log.duration_ms != null && <span>{log.duration_ms}ms</span>}
                        {(log.tokens_in > 0 || log.tokens_out > 0) && (
                          <span>{log.tokens_in}→{log.tokens_out} tokens</span>
                        )}
                        <span>{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {logs.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma ação registrada ainda
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
