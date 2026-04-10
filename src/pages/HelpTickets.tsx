import { useState, useEffect, useMemo } from 'react'
import { Search, Ticket, RotateCw, CheckCircle, Lock, Clock, Tag, User, ChevronRight, Plus, AlertTriangle, Mail, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

const HELP_EMAIL_KEY = 'helpTicketEmail'

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof Clock
  borderClass: string
  badgeBg: string
  badgeText: string
  dotColor: string
  iconBg: string
}> = {
  open: {
    label: 'Aberto',
    icon: AlertTriangle,
    borderClass: 'border-l-gms-yellow',
    badgeBg: 'bg-gms-warn-bg',
    badgeText: 'text-yellow-800',
    dotColor: 'bg-gms-yellow',
    iconBg: 'bg-amber-50 text-amber-600',
  },
  in_progress: {
    label: 'Em Andamento',
    icon: RotateCw,
    borderClass: 'border-l-blue-500',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    dotColor: 'bg-blue-500',
    iconBg: 'bg-blue-50 text-blue-600',
  },
  resolved: {
    label: 'Resolvido',
    icon: CheckCircle,
    borderClass: 'border-l-gms-ok',
    badgeBg: 'bg-gms-ok-bg',
    badgeText: 'text-green-700',
    dotColor: 'bg-gms-ok',
    iconBg: 'bg-green-50 text-green-600',
  },
  closed: {
    label: 'Encerrado',
    icon: Lock,
    borderClass: 'border-l-gms-g300',
    badgeBg: 'bg-gms-g100',
    badgeText: 'text-gms-g500',
    dotColor: 'bg-gms-g300',
    iconBg: 'bg-gray-100 text-gray-500',
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

export default function HelpTickets() {
  const [email, setEmail] = useState('')
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')

  useEffect(() => {
    const saved = localStorage.getItem(HELP_EMAIL_KEY) ?? ''
    if (saved) {
      setEmail(saved)
      setConfirmedEmail(saved)
    }
  }, [])

  const handleEmailSubmit = () => {
    const trimmed = email.trim()
    if (!trimmed) return
    setConfirmedEmail(trimmed)
    localStorage.setItem(HELP_EMAIL_KEY, trimmed)
  }

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['help-tickets-client', confirmedEmail],
    queryFn: async () => {
      if (!confirmedEmail) return []
      const { data, error } = await (supabase as any)
        .from('help_tickets')
        .select('*')
        .eq('contact_email', confirmedEmail)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!confirmedEmail,
  })

  const filtered = useMemo(() => {
    let list = [...tickets]

    if (statusFilter !== 'all') {
      list = list.filter((t: any) => t.status === statusFilter)
    }

    if (periodFilter !== 'all') {
      const now = Date.now()
      const cutoff = {
        '7d': 7 * 86400000,
        '30d': 30 * 86400000,
        '90d': 90 * 86400000,
      }[periodFilter]
      if (cutoff) {
        list = list.filter((t: any) => now - new Date(t.created_at).getTime() < cutoff)
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((t: any) =>
        t.subject?.toLowerCase().includes(q) ||
        t.id?.toString().includes(q)
      )
    }

    return list
  }, [tickets, statusFilter, periodFilter, searchQuery])

  const kpis = useMemo(() => {
    const open = tickets.filter((t: any) => t.status === 'open').length
    const inProgress = tickets.filter((t: any) => t.status === 'in_progress').length
    const resolved = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length
    return { open, inProgress, resolved, total: tickets.length }
  }, [tickets])

  // Email gate
  if (!confirmedEmail) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <HelpHeader />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="bg-white rounded-xl border border-gms-g200 shadow-sm p-8 max-w-md w-full text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-gms-cyan-light flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-gms-navy" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gms-navy font-display">Acessar Meus Chamados</h2>
              <p className="text-sm text-gms-g500 mt-1">Informe o e-mail usado ao abrir seus chamados.</p>
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-10"
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit() }}
              />
              <Button
                onClick={handleEmailSubmit}
                className="bg-gms-cyan text-gms-navy hover:bg-gms-cyan/90 shrink-0 gap-2 font-semibold"
              >
                <Search className="w-4 h-4" />
                Buscar
              </Button>
            </div>
          </div>
        </main>
        <HelpFloatingChat />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <HelpHeader />

      {/* Page Header */}
      <div className="bg-gms-navy">
        <div className="max-w-5xl mx-auto w-full px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/50 mb-2">
                <span>Central de Ajuda</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-white font-medium">Meus Chamados</span>
              </div>
              <h1 className="text-xl font-bold text-white font-display">Meus Chamados</h1>
              <p className="text-sm text-white/60 mt-1">
                Acompanhe o status dos seus chamados de suporte ({confirmedEmail})
              </p>
            </div>
            <Link
              to="/help/tickets/new"
              className="inline-flex items-center gap-2 bg-gms-cyan text-gms-navy font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-gms-cyan/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Abrir Novo Chamado
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 space-y-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Abertos', value: kpis.open, dot: 'bg-gms-yellow', sub: 'Aguardando atendimento' },
            { label: 'Em Andamento', value: kpis.inProgress, dot: 'bg-blue-500', sub: 'Sendo tratados' },
            { label: 'Resolvidos', value: kpis.resolved, dot: 'bg-gms-ok', sub: 'Finalizados' },
            { label: 'Total', value: kpis.total, dot: 'bg-gms-g300', sub: 'Todos os chamados' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gms-g200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('w-2 h-2 rounded-full', kpi.dot)} />
                <span className="text-xs font-medium text-gms-g500 uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-gms-navy font-display">{kpi.value}</p>
              <p className="text-xs text-gms-g500 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gms-g500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por assunto ou ID..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gms-g200 bg-white text-sm text-gms-navy focus:outline-none focus:ring-2 focus:ring-gms-cyan/30"
          >
            <option value="all">Todos os status</option>
            <option value="open">Abertos</option>
            <option value="in_progress">Em Andamento</option>
            <option value="resolved">Resolvidos</option>
            <option value="closed">Encerrados</option>
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gms-g200 bg-white text-sm text-gms-navy focus:outline-none focus:ring-2 focus:ring-gms-cyan/30"
          >
            <option value="all">Todo o periodo</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
          <button
            onClick={() => {
              setConfirmedEmail('')
              localStorage.removeItem(HELP_EMAIL_KEY)
            }}
            className="h-9 px-3 rounded-lg border border-gms-g200 bg-white text-sm text-gms-g500 hover:text-gms-navy hover:border-gms-g300 transition-colors flex items-center gap-1.5"
            title="Trocar e-mail"
          >
            <User className="w-3.5 h-3.5" />
            Trocar
          </button>
        </div>

        {/* Ticket List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gms-cyan" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="w-10 h-10 text-gms-g300 mx-auto mb-3" />
            <p className="font-medium text-gms-navy">Nenhum chamado encontrado</p>
            <p className="text-sm text-gms-g500 mt-1">
              {tickets.length === 0
                ? 'Voce ainda nao possui chamados registrados.'
                : 'Nenhum chamado corresponde aos filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((ticket: any) => {
              const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open
              const StatusIcon = cfg.icon
              const isClosed = ticket.status === 'closed'

              return (
                <div
                  key={ticket.id}
                  className={cn(
                    'bg-white rounded-xl border border-gms-g200 border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer group',
                    cfg.borderClass,
                    isClosed && 'opacity-70'
                  )}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Status Icon */}
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', cfg.iconBg)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gms-g500">#{ticket.id?.toString().slice(0, 8)}</span>
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.badgeBg, cfg.badgeText)}>
                          {cfg.label}
                        </span>
                        {ticket.priority === 'high' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gms-err-bg text-gms-err">
                            Alta Prioridade
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gms-navy truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gms-g500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(ticket.created_at)}
                        </span>
                        {ticket.contact_name && (
                          <span className="text-xs text-gms-g500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {ticket.contact_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gms-g500 hidden sm:block">{formatRelative(ticket.created_at)}</span>
                      <ChevronRight className="w-4 h-4 text-gms-g300 group-hover:text-gms-navy transition-colors" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <HelpFloatingChat />
    </div>
  )
}
