import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Eye, ChevronDown, Send, MessageSquare, XCircle, SkipForward } from 'lucide-react'
import { useCampaignExecutions, useCampaignContacts, type Campaign, type CampaignExecution } from '@/hooks/useCampaigns'
import { cn } from '@/lib/utils'

interface Props {
  campaign: Campaign
}

export function CampaignExecutionHistory({ campaign }: Props) {
  const { data: executions = [], isLoading } = useCampaignExecutions(campaign.id)
  const [selectedExec, setSelectedExec] = useState<CampaignExecution | null>(null)

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-600' },
    approved: { label: 'Aprovada', color: 'bg-blue-500/10 text-blue-600' },
    running: { label: 'Executando', color: 'bg-cyan-500/10 text-cyan-600' },
    completed: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-600' },
    cancelled: { label: 'Cancelada', color: 'bg-red-500/10 text-red-600' },
    failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-600' },
  }

  if (isLoading) return null

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Histórico de Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução ainda</p>
          ) : (
            <div className="space-y-2">
              {executions.map(exec => {
                const sc = statusConfig[exec.status] || statusConfig.pending
                return (
                  <div key={exec.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <Badge variant="secondary" className={cn('text-xs', sc.color)}>{sc.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(exec.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {exec.contacted}/{exec.total_targets}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-emerald-600" /> {exec.replied}</span>
                        {exec.failed > 0 && (
                          <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" /> {exec.failed}</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedExec(exec)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Detalhes
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact details dialog */}
      {selectedExec && (
        <ExecutionContactsDialog
          execution={selectedExec}
          open={!!selectedExec}
          onOpenChange={() => setSelectedExec(null)}
        />
      )}
    </>
  )
}

function ExecutionContactsDialog({ execution, open, onOpenChange }: {
  execution: CampaignExecution
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: contacts = [], isLoading } = useCampaignContacts(execution.id)

  const contactStatusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'text-muted-foreground' },
    sending: { label: 'Enviando', color: 'text-blue-600' },
    sent: { label: 'Enviado', color: 'text-blue-600' },
    delivered: { label: 'Entregue', color: 'text-emerald-600' },
    replied: { label: 'Respondeu', color: 'text-emerald-700 font-medium' },
    converted: { label: 'Convertido', color: 'text-violet-600 font-medium' },
    failed: { label: 'Falhou', color: 'text-red-600' },
    skipped: { label: 'Ignorado', color: 'text-muted-foreground' },
    opted_out: { label: 'Opt-out', color: 'text-amber-600' },
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Contatos da Execução — {new Date(execution.created_at).toLocaleString('pt-BR')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span>Total: {execution.total_targets}</span>
          <span>Enviados: {execution.contacted}</span>
          <span className="text-emerald-600">Respostas: {execution.replied}</span>
          <span className="text-red-500">Falhas: {execution.failed}</span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contato</TableHead>
                <TableHead className="text-xs">Telefone</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Enviado</TableHead>
                <TableHead className="text-xs">Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map(contact => {
                const cs = contactStatusLabels[contact.status] || contactStatusLabels.pending
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="text-xs">{contact.contact_name || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{contact.contact_phone}</TableCell>
                    <TableCell>
                      <span className={cn('text-xs', cs.color)}>{cs.label}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {contact.sent_at ? new Date(contact.sent_at).toLocaleString('pt-BR', { timeStyle: 'short' }) : '-'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={contact.message_sent || ''}>
                      {contact.message_sent?.substring(0, 60) || '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
