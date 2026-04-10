import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { Star, ChevronDown, ChevronRight, Bot, UserCheck, ExternalLink, Shield, MessageSquare, Lightbulb } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

function scoreBadgeClasses(score: number): string {
  if (score >= 8) return 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30'
  if (score >= 6) return 'bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/50'
  return 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30'
}

function scoreProgressColor(score: number): string {
  if (score >= 8) return '#16A34A'
  if (score >= 6) return '#FFB800'
  return '#DC2626'
}

interface Props {
  evaluations: any[]
  onOpenTicket?: (conversationId: string) => void
}

export function EvaluationsTable({ evaluations, onOpenTicket }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleOpenTicket = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenTicket?.(conversationId)
  }

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
              <TableHead className="w-8 text-white/80" />
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Ticket</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Agente</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Score IA</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">CSAT</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-center">Tipo</TableHead>
              <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Data</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluations.map((ev: any, idx: number) => {
              const isExpanded = expandedId === ev.id
              return (
                <>
                  <TableRow
                    key={ev.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/20",
                      "hover:bg-muted/50"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                  >
                    <TableCell className="pl-3">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-[#45E5E5]" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="font-mono text-xs">#{ev.ai_conversations?.ticket_number || '—'}</span>
                      {ev.ai_conversations?.customer_name && (
                        <span className="text-xs text-muted-foreground ml-1.5">{ev.ai_conversations.customer_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{ev.human_agents?.name || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("text-xs font-semibold border", scoreBadgeClasses(ev.overall_score || 0))}>
                        {ev.overall_score}/10
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {ev.ai_conversations?.csat_score ? (
                        <Badge variant="outline" className={cn("text-xs font-semibold border", ev.ai_conversations.csat_score >= 4 ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30' : 'bg-[#FFFBEB] text-[#92400E] border-[#FFB800]/50')}>
                          {ev.ai_conversations.csat_score}/5
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1 text-xs">
                        {ev.evaluation_type === 'ai' ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        {ev.evaluation_type === 'ai' ? 'IA' : 'Cliente'}
                      </Badge>
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
                              onClick={(e) => handleOpenTicket(ev.conversation_id, e)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Abrir atendimento</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${ev.id}-detail`} className="bg-muted/10 hover:bg-muted/10">
                      <TableCell colSpan={8} className="py-4 px-4">
                        <ExpandedDetail ev={ev} onOpenTicket={handleOpenTicket} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>
        {evaluations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Star className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm font-medium">Nenhuma avaliação encontrada</p>
            <p className="text-xs mt-1">Ajuste os filtros ou aguarde novas avaliações</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExpandedDetail({ ev, onOpenTicket }: { ev: any; onOpenTicket: (id: string, e: React.MouseEvent) => void }) {
  const criteria = ev.criteria as Record<string, number> | null
  const criteriaLabels: Record<string, string> = {
    cordialidade: 'Cordialidade',
    clareza: 'Clareza',
    resolucao: 'Resolução',
    tempo_resposta: 'Tempo de Resposta',
    profissionalismo: 'Profissionalismo',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Summary Card */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#10293F] dark:text-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-[#45E5E5]" />
          Resumo
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{ev.conversation_summary || 'Sem resumo'}</p>
          <div className="border-t border-border pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Avaliação</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{ev.summary || '—'}</p>
          </div>
        </div>
        {ev.conversation_id && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5 text-xs w-full"
            onClick={(e) => onOpenTicket(ev.conversation_id, e)}
          >
            <ExternalLink className="h-3 w-3" />
            Abrir Atendimento
          </Button>
        )}
      </div>

      {/* Criteria Card */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#10293F] dark:text-foreground">
          <Shield className="h-3.5 w-3.5 text-[#45E5E5]" />
          Critérios
        </div>
        {criteria && Object.entries(criteria).map(([key, val]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{criteriaLabels[key] || key}</span>
              <span className={cn("font-semibold", val >= 8 ? 'text-[#16A34A]' : val >= 6 ? 'text-[#FFB800]' : 'text-[#DC2626]')}>
                {val}/10
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(val as number) * 10}%`,
                  backgroundColor: scoreProgressColor(val as number),
                }}
              />
            </div>
          </div>
        ))}
        {!criteria && <p className="text-xs text-muted-foreground">Sem critérios detalhados</p>}
      </div>

      {/* Strengths & Improvements Card */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#10293F] dark:text-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-[#45E5E5]" />
          Destaques
        </div>
        {ev.strengths?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-[#16A34A] uppercase tracking-wider">✅ Pontos Fortes</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {ev.strengths.map((s: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-[#16A34A]">•</span>{s}</li>)}
            </ul>
          </div>
        )}
        {ev.improvements?.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold text-[#FFB800] uppercase tracking-wider">⚠️ Melhorias</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {ev.improvements.map((s: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-[#FFB800]">•</span>{s}</li>)}
            </ul>
          </div>
        )}
        {(!ev.strengths?.length && !ev.improvements?.length) && (
          <p className="text-xs text-muted-foreground">Sem destaques registrados</p>
        )}
      </div>
    </div>
  )
}
