import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, ArrowRight, UserCheck, Flag, CheckCircle2, Loader2, ArrowRightLeft, Trash2, GitMerge } from 'lucide-react'
import type { ColumnConfig } from './KanbanColumn'
import type { HumanAgentOption } from './KanbanColumn'

interface BulkActionsBarProps {
  count: number
  columns: ColumnConfig[]
  humanAgents: HumanAgentOption[]
  onClear: () => void
  onMoveToStage: (stageId: string) => void
  onTransfer: (agentId: string | null) => void
  onChangePriority: (priority: string) => void
  onFinalize: () => void
  onMoveToBoard?: () => void
  onBulkDelete?: () => void
  onMerge?: () => void
  isAdmin?: boolean
  isProcessing?: boolean
}

export function BulkActionsBar({
  count,
  columns,
  humanAgents,
  onClear,
  onMoveToStage,
  onTransfer,
  onChangePriority,
  onFinalize,
  onMoveToBoard,
  onBulkDelete,
  onMerge,
  isAdmin,
  isProcessing,
}: BulkActionsBarProps) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
      {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}

      <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
        {count} selecionado{count > 1 ? 's' : ''}
      </Badge>

      <Button variant="ghost" size="sm" onClick={onClear} className="text-xs gap-1 text-muted-foreground">
        <X className="w-3.5 h-3.5" />
        Limpar
      </Button>

      <div className="w-px h-6 bg-border" />

      {/* Move to stage */}
      <Select onValueChange={onMoveToStage}>
        <SelectTrigger className="w-auto h-8 text-xs gap-1.5 border-dashed">
          <ArrowRight className="w-3.5 h-3.5" />
          <SelectValue placeholder="Mover para..." />
        </SelectTrigger>
        <SelectContent>
          {columns.map(col => (
            <SelectItem key={col.id} value={col.id}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                {col.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Move to board */}
      {onMoveToBoard && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-dashed"
          onClick={onMoveToBoard}
          disabled={isProcessing}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Mover Board
        </Button>
      )}

      {/* Transfer */}
      <Select onValueChange={(v) => onTransfer(v === '_any' ? null : v)}>
        <SelectTrigger className="w-auto h-8 text-xs gap-1.5 border-dashed">
          <UserCheck className="w-3.5 h-3.5" />
          <SelectValue placeholder="Transferir" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_any">Qualquer agente</SelectItem>
          {humanAgents.map(a => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority */}
      <Select onValueChange={onChangePriority}>
        <SelectTrigger className="w-auto h-8 text-xs gap-1.5 border-dashed">
          <Flag className="w-3.5 h-3.5" />
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Baixa</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="urgent">Urgente</SelectItem>
        </SelectContent>
      </Select>

      {count >= 2 && onMerge && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 border-dashed"
          onClick={onMerge}
          disabled={isProcessing}
        >
          <GitMerge className="w-3.5 h-3.5" />
          Mesclar ({count})
        </Button>
      )}

      <div className="w-px h-6 bg-border" />

      <Button
        variant="destructive"
        size="sm"
        className="text-xs gap-1.5"
        onClick={onFinalize}
        disabled={isProcessing}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Finalizar ({count})
      </Button>

      {isAdmin && onBulkDelete && (
        <>
          <div className="w-px h-6 bg-border" />
          <Button
            variant="destructive"
            size="sm"
            className="text-xs gap-1.5 bg-destructive/90 hover:bg-destructive"
            onClick={onBulkDelete}
            disabled={isProcessing}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir ({count})
          </Button>
        </>
      )}
    </div>
  )
}
