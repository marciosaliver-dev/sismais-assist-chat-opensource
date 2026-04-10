import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useKanbanBoards, type KanbanBoard } from '@/hooks/useKanbanBoards'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WhatsAppInstanceSelect } from '@/components/shared/WhatsAppInstanceSelect'
import { Separator } from '@/components/ui/separator'

interface TransferBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBoardId?: string
  onConfirm: (boardId: string, instanceId?: string) => void
  isProcessing?: boolean
  title?: string
}

export function TransferBoardDialog({
  open,
  onOpenChange,
  currentBoardId,
  onConfirm,
  isProcessing,
  title = 'Mover para Board',
}: TransferBoardDialogProps) {
  const { data: boards = [] } = useKanbanBoards()
  const [selected, setSelected] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string>('__keep__')

  const availableBoards = boards.filter(b => b.id !== currentBoardId)

  const handleConfirm = () => {
    if (selected) {
      onConfirm(selected, instanceId === '__keep__' ? undefined : instanceId)
      setSelected(null)
      setInstanceId('__keep__')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          {availableBoards.map(board => (
            <button
              key={board.id}
              onClick={() => setSelected(board.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                selected === board.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent'
              )}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: board.color }}
              />
              <div>
                <p className="text-sm font-medium">{board.name}</p>
                <p className="text-xs text-muted-foreground">{board.board_type}</p>
              </div>
            </button>
          ))}
          {availableBoards.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum outro board disponível.
            </p>
          )}
        </div>
        {selected && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Instância WhatsApp (opcional)</p>
              <WhatsAppInstanceSelect
                value={instanceId}
                onChange={setInstanceId}
                showSameChannel
                label="Canal de envio após transferência"
              />
              <p className="text-xs text-muted-foreground">
                Selecione "Mesmo canal" para manter a instância atual ou escolha uma nova.
              </p>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || isProcessing}>
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
