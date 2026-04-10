import { useState } from 'react'
import { useFeedbackList } from '@/hooks/useFeedback'
import type { FeedbackType, FeedbackStatus } from '@/hooks/useFeedback'
import { FeedbackCard } from './FeedbackCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { MessageSquarePlus } from 'lucide-react'

export function FeedbackList() {
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')

  const { data: items = [], isLoading } = useFeedbackList({
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FeedbackType | 'all')}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="improvement">Melhoria</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FeedbackStatus | 'all')}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_review">Em Análise</SelectItem>
            <SelectItem value="in_progress">Em Desenvolvimento</SelectItem>
            <SelectItem value="done">Concluído</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquarePlus className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
