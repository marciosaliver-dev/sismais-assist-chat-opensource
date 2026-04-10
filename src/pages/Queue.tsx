import { useState, useMemo } from 'react'
import { useQueueTickets, type QueueTicket } from '@/hooks/useQueueTickets'
import { useErrorHandler, EmptyState } from '@/hooks/useErrorHandler'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ListOrdered,
  Users,
  Phone,
  MessageSquare,
  HandMetal,
  Clock,
  AlertTriangle,
  Timer,
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useWaitTimer, getWaitColor, formatHHMMSS } from '@/hooks/useWaitTimer'

// ── Timer Component ──
function WaitTimer({ since }: { since: string | null }) {
  const elapsed = useWaitTimer(since, 10000)

  if (!since) return <span className="text-muted-foreground text-sm">—</span>

  return (
    <div className="flex items-center gap-1.5">
      <Timer className="h-4 w-4 shrink-0" style={{ color: 'inherit' }} />
      <span className={`font-mono text-base font-bold ${getWaitColor(elapsed)}`}>
        {formatHHMMSS(elapsed)}
      </span>
    </div>
  )
}

// ── Priority helpers ──
const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]' },
  high: { label: 'Alta', className: 'bg-[#FEF2F2] text-[#DC2626] border-[rgba(220,38,38,0.3)]' },
  medium: { label: 'Média', className: 'bg-[#FFFBEB] text-[#92400E] border-[rgba(255,184,0,0.5)]' },
  low: { label: 'Baixa', className: 'bg-[#F0FDF4] text-[#16A34A] border-[rgba(22,163,74,0.3)]' },
}

function PriorityBadge({ priority }: { priority: string | null }) {
  const cfg = priorityConfig[priority || 'medium'] || priorityConfig.medium
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

// ── Queue Card ──
function QueueCard({
  ticket,
  position,
  onAssume,
  isAssuming,
}: {
  ticket: QueueTicket
  position: number
  onAssume: () => void
  isAssuming: boolean
}) {
  const displayName = ticket.client_name || ticket.customer_name || ticket.customer_phone

  return (
    <Card className="p-4 flex items-center gap-4 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] transition-shadow">
      {/* Avatar + Position */}
      <div className="relative shrink-0">
        <Avatar className="w-10 h-10">
          {ticket.avatar_url && <AvatarImage src={ticket.avatar_url} alt={displayName} />}
          <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
            {(displayName || '?').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#45E5E5] text-[#10293F] text-xs font-bold flex items-center justify-center shadow-sm">
          {position}
        </span>
      </div>

      {/* Timer */}
      <div className="w-28 shrink-0">
        <WaitTimer since={ticket.queue_entered_at || ticket.started_at} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold text-sm truncate">{displayName}</p>
        <div className="flex flex-wrap items-center gap-2">
          {ticket.subscribed_product && ticket.subscribed_product !== 'outro' && (
            <Badge variant="secondary" className="text-xs">{ticket.subscribed_product}</Badge>
          )}
          <Badge variant="outline" className="text-xs gap-1">
            <MessageSquare className="h-3 w-3" />
            {ticket.communication_channel === 'whatsapp' ? 'WhatsApp' : ticket.communication_channel || 'WhatsApp'}
          </Badge>
          <PriorityBadge priority={ticket.priority} />
          {ticket.category_name && (
            <Badge variant="outline" className="text-xs">{ticket.category_name}</Badge>
          )}
          {ticket.module_name && (
            <Badge variant="outline" className="text-xs">{ticket.module_name}</Badge>
          )}
        </div>
      </div>

      {/* Ticket # */}
      <span className="text-xs text-muted-foreground shrink-0">#{ticket.ticket_number}</span>

      {/* Assume button */}
      <Button
        size="sm"
        onClick={onAssume}
        disabled={isAssuming}
        className="shrink-0 gap-1.5"
      >
        <HandMetal className="h-4 w-4" />
        Assumir
      </Button>
    </Card>
  )
}

// ── Main Page ──
export default function Queue() {
  const { tickets, isLoading, isError, error, onlineAgentsCount, assumeTicket } = useQueueTickets()
  const { user } = useSupabaseAuth()
  const { ErrorDisplay, retry } = useErrorHandler()

  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [myQueueOnly, setMyQueueOnly] = useState(false)

  // Get current user's human_agent_id
  const { data: myAgentId } = useQuery({
    queryKey: ['my-human-agent-id', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data } = await supabase
        .from('human_agents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      return data?.id || null
    },
    enabled: !!user,
  })

  // Derive unique filter options
  const products = useMemo(() => {
    const set = new Set<string>()
    tickets.forEach(t => {
      if (t.subscribed_product && t.subscribed_product !== 'outro') set.add(t.subscribed_product)
    })
    return Array.from(set).sort()
  }, [tickets])

  const categories = useMemo(() => {
    const set = new Set<string>()
    tickets.forEach(t => { if (t.category_name) set.add(t.category_name) })
    return Array.from(set).sort()
  }, [tickets])

  // Apply filters
  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (productFilter !== 'all' && t.subscribed_product !== productFilter) return false
      if (categoryFilter !== 'all' && t.category_name !== categoryFilter) return false
      if (myQueueOnly && myAgentId && t.human_agent_id !== myAgentId) return false
      return true
    })
  }, [tickets, priorityFilter, productFilter, categoryFilter, myQueueOnly, myAgentId])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 space-y-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Fila de Atendimento</h1>
            <Badge variant="secondary" className="text-sm">
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              <strong className="text-foreground">{onlineAgentsCount}</strong> agente{onlineAgentsCount !== 1 ? 's' : ''} online
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>

          {products.length > 0 && (
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {products.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="my-queue"
              checked={myQueueOnly}
              onCheckedChange={setMyQueueOnly}
            />
            <Label htmlFor="my-queue" className="text-sm cursor-pointer">
              Minha fila
            </Label>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="w-28 h-6" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-9 w-24" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <ErrorDisplay
            title="Erro ao carregar fila"
            message="Não foi possível carregar os tickets da fila."
            onRetry={() => retry()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="Nenhum ticket na fila"
            description="Não há tickets aguardando atendimento no momento."
          />
        ) : (
          filtered.map((ticket, i) => (
            <QueueCard
              key={ticket.id}
              ticket={ticket}
              position={i + 1}
              onAssume={() => assumeTicket.mutate(ticket)}
              isAssuming={assumeTicket.isPending}
            />
          ))
        )}
      </div>
    </div>
  )
}
