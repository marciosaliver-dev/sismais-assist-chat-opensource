import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PartyPopper, Bot, UserCheck, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Props {
  evaluations: any[]
  onOpenTicket?: (conversationId: string) => void
}

export function LowScoreTable({ evaluations, onOpenTicket }: Props) {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Ticket</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Agente</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Score</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tipo</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Resumo</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Data</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluations.map((ev: any, idx: number) => (
              <TableRow
                key={ev.id}
                className={cn(
                  "transition-colors border-l-3",
                  idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                  "hover:bg-[#FEF2F2]/50",
                  "border-l-[3px] border-l-[#DC2626]"
                )}
              >
                <TableCell className="font-medium">
                  <span className="font-mono text-xs">#{ev.ai_conversations?.ticket_number || '—'}</span>
                  {ev.ai_conversations?.customer_name && (
                    <span className="text-xs text-muted-foreground ml-1.5">{ev.ai_conversations.customer_name}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{ev.human_agents?.name || '—'}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs font-bold bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/40">
                    {ev.overall_score}/10
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="gap-1 text-xs">
                    {ev.evaluation_type === 'ai' ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                    {ev.evaluation_type === 'ai' ? 'IA' : 'Cliente'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                  {ev.summary || ev.conversation_summary || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ev.created_at ? format(new Date(ev.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                </TableCell>
                <TableCell>
                  {ev.conversation_id && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onOpenTicket?.(ev.conversation_id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Abrir atendimento</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {evaluations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <PartyPopper className="h-10 w-10 opacity-40 mb-3 text-[#16A34A]" />
            <p className="text-sm font-medium text-[#16A34A]">Nenhuma avaliação crítica — bom trabalho! 🎉</p>
            <p className="text-xs mt-1">Todas as avaliações estão acima de 5/10</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
