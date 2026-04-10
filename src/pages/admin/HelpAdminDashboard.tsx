import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  PlayCircle,
  TicketCheck,
  FileText,
  ExternalLink,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { KPICard } from '@/components/dashboard/KPICard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; classes: string }> = {
  open: { label: 'Aberto', icon: AlertCircle, classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'Em andamento', icon: Clock, classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolvido', icon: CheckCircle, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Encerrado', icon: XCircle, classes: 'bg-slate-50 text-slate-600 border-slate-200' },
}

const PRIORITY_CONFIG: Record<string, { label: string; classes: string }> = {
  low: { label: 'Baixa', classes: 'bg-slate-50 text-slate-600' },
  medium: { label: 'Média', classes: 'bg-amber-50 text-amber-700' },
  high: { label: 'Alta', classes: 'bg-red-50 text-red-700' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface Ticket {
  id: string
  subject: string
  description: string
  status: string
  priority: string
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  created_at: string
}

export default function HelpAdminDashboard() {
  const qc = useQueryClient()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [newStatus, setNewStatus] = useState('')

  // Parallel counts
  const { data: manuaisCount = 0 } = useQuery({
    queryKey: ['help-admin-kpi-manuais'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'manual')
      return count ?? 0
    },
  })

  const { data: videosCount = 0 } = useQuery({
    queryKey: ['help-admin-kpi-videos'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('ai_knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('content_type', 'video')
        .eq('is_public', true)
        .eq('is_active', true)
      return count ?? 0
    },
  })

  const { data: openTickets = 0 } = useQuery({
    queryKey: ['help-admin-kpi-open-tickets'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('help_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress'])
      return count ?? 0
    },
  })

  const { data: totalTickets = 0 } = useQuery({
    queryKey: ['help-admin-kpi-total-tickets'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('help_tickets')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    },
  })

  const { data: recentTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['help-tickets-admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('help_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as Ticket[]
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from('help_tickets').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-tickets-admin'] })
      qc.invalidateQueries({ queryKey: ['help-admin-kpi-open-tickets'] })
      toast.success('Status atualizado com sucesso.')
      setSelectedTicket(null)
    },
    onError: () => toast.error('Erro ao atualizar status.'),
  })

  function openTicketDialog(ticket: Ticket) {
    setSelectedTicket(ticket)
    setNewStatus(ticket.status)
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central do Cliente</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie conteúdos e chamados do portal de autoatendimento.
            </p>
          </div>
          <Button variant="outline" className="gap-2" asChild>
            <a href="/help-center" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              Ver Portal
            </a>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Manuais"
            value={manuaisCount}
            subtitle="na base de conhecimento"
            icon={BookOpen}
          />
          <KPICard
            title="Vídeos Publicados"
            value={videosCount}
            subtitle="tutoriais disponíveis"
            icon={PlayCircle}
          />
          <KPICard
            title="Chamados Abertos"
            value={openTickets}
            subtitle="aguardando atendimento"
            icon={TicketCheck}
          />
          <KPICard
            title="Total de Chamados"
            value={totalTickets}
            subtitle="desde o início"
            icon={FileText}
          />
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            to="/admin/manuais"
            className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Gerenciar Manuais</p>
              <p className="text-sm text-muted-foreground">Criar, editar e publicar manuais</p>
            </div>
          </Link>
          <Link
            to="/knowledge"
            className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <PlayCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Gerenciar Conteúdos</p>
              <p className="text-sm text-muted-foreground">Vídeos, artigos e manuais — tudo em um só lugar</p>
            </div>
          </Link>
        </div>

        {/* Recent tickets */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Chamados Recentes</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 font-semibold text-foreground">Assunto</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-36 hidden sm:table-cell">Contato</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-28">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-24 hidden md:table-cell">Prioridade</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground w-28 hidden lg:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {ticketsLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                    </td>
                  </tr>
                ) : recentTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      Nenhum chamado recebido ainda.
                    </td>
                  </tr>
                ) : (
                  recentTickets.map((ticket) => {
                    const status = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open
                    const priority = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium
                    const StatusIcon = status.icon
                    return (
                      <tr
                        key={ticket.id}
                        className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => openTicketDialog(ticket)}
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground truncate max-w-xs">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{ticket.description}</p>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell">
                          <p className="truncate max-w-[120px]">{ticket.contact_name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={cn('text-xs font-semibold gap-1.5', status.classes)}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <Badge variant="outline" className={cn('text-xs', priority.classes)}>
                            {priority.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                          {formatDate(ticket.created_at)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket detail dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Chamado</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Assunto</p>
                <p className="font-semibold text-foreground">{selectedTicket.subject}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Descrição</p>
                <p className="text-foreground whitespace-pre-line">{selectedTicket.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Contato</p>
                  <p className="font-medium">{selectedTicket.contact_name}</p>
                  {selectedTicket.contact_email && (
                    <p className="text-muted-foreground text-xs">{selectedTicket.contact_email}</p>
                  )}
                  {selectedTicket.contact_phone && (
                    <p className="text-muted-foreground text-xs">{selectedTicket.contact_phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Data</p>
                  <p>{formatDate(selectedTicket.created_at)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Atualizar Status</p>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    updateStatusMutation.mutate({ id: selectedTicket.id, status: newStatus })
                  }
                  disabled={updateStatusMutation.isPending || newStatus === selectedTicket.status}
                >
                  {updateStatusMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
