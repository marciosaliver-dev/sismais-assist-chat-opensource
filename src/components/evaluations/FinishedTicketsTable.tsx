import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

function scoreBadgeClasses(score: number): string {
  if (score >= 8) return 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30'
  if (score >= 6) return 'bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/50'
  return 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30'
}

interface Props {
  tickets: any[]
  isLoading: boolean
  onOpenTicket?: (ticketId: string) => void
}

export function FinishedTicketsTable({ tickets, isLoading, onOpenTicket }: Props) {
  if (isLoading) return <Skeleton className="h-64 rounded-lg" />

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Ticket</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Cliente</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Agente</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Status</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">CSAT</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Score IA</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Finalizado em</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t: any, idx: number) => (
              <TableRow key={t.id} className={cn(
                "transition-colors",
                idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                "hover:bg-muted/50"
              )}>
                <TableCell className="font-mono text-xs font-medium">#{t.ticket_number}</TableCell>
                <TableCell className="text-sm">{t.customer_name || '—'}</TableCell>
                <TableCell className="text-sm">{t.human_agents?.name || '—'}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs capitalize">{t.status}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {t.csat_score ? (
                    <Badge variant="outline" className={cn("text-xs font-semibold border", t.csat_score >= 4 ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30' : 'bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/50')}>
                      {t.csat_score}/5
                    </Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {t.eval_score !== null ? (
                    <Badge variant="outline" className={cn("text-xs font-semibold border", scoreBadgeClasses(t.eval_score))}>
                      {t.eval_score}/10
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/40 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Sem avaliação
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.resolved_at ? format(new Date(t.resolved_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onOpenTicket?.(t.id)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Abrir atendimento</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm font-medium">Nenhum ticket finalizado encontrado</p>
            <p className="text-xs mt-1">Ajuste os filtros de data para ver resultados</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
