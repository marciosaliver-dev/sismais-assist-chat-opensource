import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAutomationLogs } from '@/hooks/useAutomationLogs'

interface AutomationLogsProps {
  automationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AutomationLogs({ automationId, open, onOpenChange }: AutomationLogsProps) {
  const { logs, isLoading } = useAutomationLogs(automationId || undefined)

  const getStatusIcon = (status: string | null) => {
    if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-primary" />
    if (status === 'failed') return <XCircle className="w-4 h-4 text-destructive" />
    if (status === 'partial') return <AlertCircle className="w-4 h-4 text-warning" />
    return <Clock className="w-4 h-4 text-muted-foreground" />
  }

  const getStatusVariant = (status: string | null): "default" | "destructive" | "outline" | "secondary" => {
    if (status === 'success') return 'default'
    if (status === 'failed') return 'destructive'
    return 'secondary'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Logs de Execução</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <Badge variant={getStatusVariant(log.status)}>{log.status}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.executed_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>

                  {log.error_message && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      Erro: {log.error_message}
                    </p>
                  )}

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Tempo: {log.execution_time_ms ?? 0}ms</span>
                    {log.actions_executed && (
                      <span>Ações: {(log.actions_executed as any[]).length}</span>
                    )}
                  </div>

                  {log.trigger_data && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver dados do trigger
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32">
                        {JSON.stringify(log.trigger_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
