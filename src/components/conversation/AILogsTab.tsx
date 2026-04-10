import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Loader2, ChevronDown, ChevronRight, Route, MessageSquare, Zap, AlertTriangle, FileText, Brain } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useTicketAILogs, type TicketAILog } from '@/hooks/useTicketAILogs'
import { cn } from '@/lib/utils'

const EVENTO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  routing:       { label: 'Roteamento', icon: Route,        color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  resposta:      { label: 'Resposta IA', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  classificacao: { label: 'Classificação', icon: Zap,         color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  escalonamento: { label: 'Escalonamento', icon: AlertTriangle, color: 'text-destructive bg-destructive/10 border-destructive/30' },
  resumo:        { label: 'Resumo',      icon: FileText,     color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  descricao:     { label: 'Descrição',   icon: FileText,     color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  sentiment:     { label: 'Sentimento',  icon: Brain,        color: 'text-pink-500 bg-pink-500/10 border-pink-500/30' },
}

function formatTokenCost(tokensIn: number, tokensOut: number): string {
  // Approximate cost based on average OpenRouter pricing (~$0.0001 per 1k tokens)
  const cost = (tokensIn + tokensOut) * 0.0001 / 1000
  if (cost < 0.0001) return ''
  return `~$${cost.toFixed(5)}`
}

function LogEntry({ log }: { log: TicketAILog }) {
  const [open, setOpen] = useState(false)
  const config = EVENTO_CONFIG[log.evento_tipo] || {
    label: log.evento_tipo,
    icon: Brain,
    color: 'text-muted-foreground bg-muted border-border',
  }
  const Icon = config.icon
  const hasDetails = !!(log.prompt_enviado || log.resposta_recebida)
  const totalTokens = (log.tokens_input || 0) + (log.tokens_output || 0)
  const costStr = formatTokenCost(log.tokens_input || 0, log.tokens_output || 0)

  return (
    <div className="border-b border-border/40 py-2.5 last:border-0">
      <div className="flex items-start gap-2">
        {/* Type icon */}
        <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border', config.color)}>
          <Icon className="w-3 h-3" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn('text-[9px] h-4 px-1 border', config.color)}>
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(log.criado_em), 'HH:mm:ss', { locale: ptBR })}
            </span>
            {log.modelo_usado && (
              <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                {log.modelo_usado}
              </span>
            )}
          </div>

          {/* Metrics row */}
          {(totalTokens > 0 || log.confianca != null) && (
            <div className="flex items-center gap-2 mt-0.5">
              {totalTokens > 0 && (
                <span className="text-xs text-muted-foreground">
                  {log.tokens_input}+{log.tokens_output} tokens
                  {costStr && <span className="ml-1 text-muted-foreground/70">{costStr}</span>}
                </span>
              )}
              {log.confianca != null && (
                <span className={cn('text-xs font-medium', log.confianca >= 0.7 ? 'text-emerald-600' : log.confianca >= 0.4 ? 'text-amber-600' : 'text-destructive')}>
                  {(log.confianca * 100).toFixed(0)}% conf.
                </span>
              )}
            </div>
          )}

          {/* Quick summary of response */}
          {log.resposta_recebida && !open && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {log.resposta_recebida.substring(0, 80)}
            </p>
          )}

          {/* Expandable details */}
          {hasDetails && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {open ? 'Ocultar detalhes' : 'Ver detalhes'}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {log.prompt_enviado && (
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prompt enviado</p>
                    <pre className="text-xs bg-muted/60 p-2 rounded-md overflow-x-auto whitespace-pre-wrap break-words max-h-32 text-foreground/80">
                      {log.prompt_enviado}
                    </pre>
                  </div>
                )}
                {log.resposta_recebida && (
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resposta</p>
                    <pre className="text-xs bg-muted/60 p-2 rounded-md overflow-x-auto whitespace-pre-wrap break-words max-h-48 text-foreground/80">
                      {log.resposta_recebida}
                    </pre>
                  </div>
                )}
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Metadados</p>
                    <pre className="text-xs bg-muted/60 p-2 rounded-md overflow-x-auto max-h-24 text-foreground/80">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  )
}

interface AILogsTabProps {
  conversationId: string
}

export default function AILogsTab({ conversationId }: AILogsTabProps) {
  const { data: logs = [], isLoading } = useTicketAILogs(conversationId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Carregando histórico de IA...</span>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs">Nenhum evento de IA registrado para este ticket.</p>
        <p className="text-xs mt-1 opacity-70">Os eventos aparecem após o processamento de mensagens.</p>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-foreground">Histórico de Processamento IA</p>
        <span className="text-xs text-muted-foreground">{logs.length} eventos</span>
      </div>
      <div className="space-y-0">
        {logs.map(log => (
          <LogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  )
}
