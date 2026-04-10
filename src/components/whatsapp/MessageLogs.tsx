import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowDownLeft, ArrowUpRight, Check, CheckCheck, Clock, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useWhatsAppBusinessMessages } from '@/hooks/useWhatsAppBusinessMessages'

export function MessageLogs() {
  const { recentMessages } = useWhatsAppBusinessMessages()

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3.5 h-3.5 text-primary" />
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
      case 'sent': return <Check className="w-3.5 h-3.5 text-muted-foreground" />
      case 'failed': return <span className="text-destructive text-xs">✗</span>
      default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">📊 Logs de Mensagens</CardTitle>
          <Badge variant="outline">Últimas 24h</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[400px]">
          {recentMessages && recentMessages.length > 0 ? (
            <div className="space-y-2">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-smooth">
                  <div className="mt-0.5">
                    {msg.direction === 'inbound' ? (
                      <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--whatsapp))]" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {msg.direction === 'inbound' ? msg.from_phone : msg.to_phone}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {msg.type || 'text'}
                      </Badge>
                      {msg.direction === 'outbound' && (
                        <span>{getStatusIcon(msg.status)}</span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {msg.text_body || `[${msg.type}]`}
                    </p>

                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {msg.created_at && formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma mensagem nas últimas 24h</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
