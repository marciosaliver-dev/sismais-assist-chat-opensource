import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Clock, AlertTriangle } from 'lucide-react'

interface InternalWaitingReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}

const MIN_REASON_LENGTH = 10

export function InternalWaitingReasonDialog({
  open,
  onOpenChange,
  onConfirm,
}: InternalWaitingReasonDialogProps) {
  const [reason, setReason] = useState('')
  const isValid = reason.trim().length >= MIN_REASON_LENGTH

  const handleConfirm = () => {
    if (!isValid) return
    onConfirm(reason.trim())
    setReason('')
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) setReason('')
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#10293F]">
            <Clock className="w-5 h-5 text-[#7C3AED]" />
            Aguardando Interno
          </DialogTitle>
          <DialogDescription>
            Informe o que está sendo aguardado internamente para prosseguir com o atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="waiting-reason" className="text-sm font-semibold text-[#10293F]">
              O que está sendo aguardado? <span className="text-[#DC2626]">*</span>
            </Label>
            <Textarea
              id="waiting-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Aguardando resposta do time de desenvolvimento sobre o bug #1234..."
              className="min-h-[100px] resize-none focus:border-[#45E5E5] focus:ring-[#45E5E5]/20"
              aria-required="true"
              aria-describedby="waiting-reason-hint"
            />
            <div id="waiting-reason-hint" className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Mínimo {MIN_REASON_LENGTH} caracteres
              </span>
              <span className={`text-xs ${reason.trim().length < MIN_REASON_LENGTH ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                {reason.trim().length}/{MIN_REASON_LENGTH}
              </span>
            </div>
          </div>

          {reason.trim().length > 0 && !isValid && (
            <div className="flex items-center gap-1.5 text-xs text-[#DC2626]">
              <AlertTriangle className="w-3.5 h-3.5" />
              Descreva com mais detalhes o que está sendo aguardado
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
          >
            <Clock className="w-4 h-4 mr-2" />
            Confirmar Aguardando
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
