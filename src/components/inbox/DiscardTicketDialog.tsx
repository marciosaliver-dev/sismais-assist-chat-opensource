import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EyeOff, AlertTriangle } from 'lucide-react'

interface DiscardTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  ticketNumber?: number
}

export function DiscardTicketDialog({
  open,
  onOpenChange,
  onConfirm,
  ticketNumber,
}: DiscardTicketDialogProps) {
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setReason('')
      setReasonError(false)
    }
    onOpenChange(open)
  }

  const handleConfirm = () => {
    if (!reason.trim()) {
      setReasonError(true)
      return
    }
    onConfirm(reason.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-amber-500" />
            Descartar Ticket{ticketNumber ? ` #${ticketNumber}` : ''}
          </DialogTitle>
          <DialogDescription>
            Tickets descartados não contam nas estatísticas (TMA, CSAT, contagem). Esta ação pode ser revertida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Ao descartar, este ticket será excluído de todos os relatórios e métricas de desempenho. Use para atendimentos de teste, spam ou abertos por engano.
            </p>
          </div>

          {/* Motivo do descarte */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Motivo do descarte <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (e.target.value.trim()) setReasonError(false)
              }}
              placeholder="Ex: Ticket de teste, spam, duplicado, aberto por engano..."
              className={`min-h-[100px] text-sm resize-none rounded-xl ${reasonError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {reasonError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Informe o motivo do descarte.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="rounded-xl bg-amber-500 text-white hover:bg-amber-600"
          >
            <EyeOff className="w-4 h-4 mr-1.5" />
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
