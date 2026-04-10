import { useParams, Navigate, useSearchParams } from 'react-router-dom'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { KanbanBoard } from '@/components/tickets/KanbanBoard'
import { Spinner } from '@/components/ui/spinner'

export default function KanbanPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const initialTicketId = searchParams.get('ticket') || undefined
  const { data: boards = [], isLoading } = useKanbanBoards()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const board = boards.find(b => b.slug === slug)

  if (!board) {
    const defaultBoard = boards.find(b => b.is_default) || boards[0]
    if (defaultBoard?.slug) {
      return <Navigate to={`/kanban/${defaultBoard.slug}`} replace />
    }
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum board Kanban encontrado
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <KanbanBoard
        boardId={board.id}
        boardType={board.board_type}
        boardName={board.name}
        boardIcon={board.icon}
        boardColor={board.color}
        boardAlertThresholdMinutes={board.queue_alert_threshold_minutes}
        initialTicketId={initialTicketId}
      />
    </div>
  )
}
